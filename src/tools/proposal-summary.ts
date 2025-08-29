/**
 * Proposal Summary Tool
 * 
 * Get comprehensive proposal analysis with voting projections, outcome predictions, 
 * and executive summary with rich analysis including quorum progress and voting momentum.
 */

import { z } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { TallyGraphQLClient } from '../graphql-client.js';

/**
 * Register the proposal summary tool with the MCP server
 */
export function registerProposalSummaryTool(server: any, graphqlClient: TallyGraphQLClient): void {
  server.tool(
    'get_proposal_summary',
    'Get comprehensive proposal analysis with voting projections, outcome predictions, and executive summary. Provides rich analysis including quorum progress, likely outcome, time remaining, voting momentum, and formatted vote amounts.',
    {
      proposalId: z.string().describe('Proposal ID (required) - the ID of the proposal to analyze'),
      organizationId: z.string().optional().describe('Organization ID for additional context'),
      includePredictions: z.boolean().optional().describe('Include outcome predictions (default: true)')
    },
    async ({ 
      proposalId, 
      organizationId, 
      includePredictions = true 
    }: { 
      proposalId: string; 
      organizationId?: string; 
      includePredictions?: boolean; 
    }): Promise<CallToolResult> => {
      try {
        if (!graphqlClient) {
          throw new Error('GraphQL client not properly initialized');
        }

        // Comprehensive GraphQL query for proposal analysis
        const query = `query GetProposal($proposalId: IntID!) {
          proposal(input: { id: $proposalId }) {
            id
            onchainId
            status
            metadata {
              title
              description
            }
            organization {
              id
              name
              slug
            }
            proposer {
              address
              name
            }
            governor {
              id
              tokenId
              token {
                id
                symbol
                name
                decimals
              }
            }
            voteStats {
              type
              votesCount
              votersCount
              percent
            }
            start {
              ... on Block {
                timestamp
                number
              }
              ... on BlocklessTimestamp {
                timestamp
              }
            }
            end {
              ... on Block {
                timestamp
                number
              }
              ... on BlocklessTimestamp {
                timestamp
              }
            }
          }
        }`;

        const result = await graphqlClient.query(query, { proposalId });

        if (!result?.proposal) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'Proposal not found',
                proposalId: proposalId
              }, null, 2)
            }],
            isError: true
          };
        }

        const proposal = result.proposal;
        const tokenInfo = proposal.governor?.token;
        const decimals = tokenInfo?.decimals || 18;
        const tokenSymbol = tokenInfo?.symbol || 'TOKEN';

        // Extract vote counts
        const voteStats = proposal.voteStats || [];
        const forVotes = voteStats.find((v: any) => v.type === 'for')?.votesCount || '0';
        const againstVotes = voteStats.find((v: any) => v.type === 'against')?.votesCount || '0';
        const abstainVotes = voteStats.find((v: any) => v.type === 'abstain')?.votesCount || '0';
        
        // Calculate totals
        const totalVotes = BigInt(forVotes) + BigInt(againstVotes) + BigInt(abstainVotes);

        // Format vote amounts from wei to readable format
        const formatTokenAmount = (amountWei: string): string => {
          if (amountWei === '0') return '0';
          const amount = parseFloat(amountWei) / Math.pow(10, decimals);
          return amount.toLocaleString(undefined, { 
            maximumFractionDigits: 2,
            minimumFractionDigits: 0 
          });
        };

        const formattedForVotes = formatTokenAmount(forVotes);
        const formattedAgainstVotes = formatTokenAmount(againstVotes);
        const formattedAbstainVotes = formatTokenAmount(abstainVotes);
        const formattedTotalVotes = formatTokenAmount(totalVotes.toString());

        // Time calculations
        const now = new Date();
        const startTime = new Date(proposal.start?.timestamp || '');
        const endTime = new Date(proposal.end?.timestamp || '');
        const timeRemaining = endTime.getTime() - now.getTime();
        const totalVotingPeriod = endTime.getTime() - startTime.getTime();
        const progressPct = Math.max(0, Math.min(100, ((now.getTime() - startTime.getTime()) / totalVotingPeriod) * 100));

        // Voting momentum analysis
        const voterStats = {
          totalVoters: voteStats.reduce((sum: number, v: any) => sum + (v.votersCount || 0), 0),
          forVoters: voteStats.find((v: any) => v.type === 'for')?.votersCount || 0,
          againstVoters: voteStats.find((v: any) => v.type === 'against')?.votersCount || 0,
          abstainVoters: voteStats.find((v: any) => v.type === 'abstain')?.votersCount || 0,
        };

        // Outcome prediction (if requested)
        let outcomePrediction = null;
        if (includePredictions) {
          const forVotesBig = BigInt(forVotes);
          const againstVotesBig = BigInt(againstVotes);
          
          let prediction = 'Unknown';
          let confidence = 'Low';
          
          if (totalVotes === 0n) {
            prediction = 'No votes yet';
            confidence = 'N/A';
          } else if (forVotesBig > againstVotesBig) {
            const margin = Number((forVotesBig * 100n) / totalVotes);
            if (margin >= 90) {
              prediction = 'Likely to PASS';
              confidence = 'Very High';
            } else if (margin >= 70) {
              prediction = 'Likely to PASS';
              confidence = 'High';
            } else if (margin >= 55) {
              prediction = 'Likely to PASS';
              confidence = 'Moderate';
            } else {
              prediction = 'Uncertain';
              confidence = 'Low';
            }
          } else if (againstVotesBig > forVotesBig) {
            const margin = Number((againstVotesBig * 100n) / totalVotes);
            if (margin >= 90) {
              prediction = 'Likely to FAIL';
              confidence = 'Very High';
            } else if (margin >= 70) {
              prediction = 'Likely to FAIL';
              confidence = 'High';
            } else if (margin >= 55) {
              prediction = 'Likely to FAIL';
              confidence = 'Moderate';
            } else {
              prediction = 'Uncertain';
              confidence = 'Low';
            }
          } else {
            prediction = 'Currently tied';
            confidence = 'N/A';
          }

          outcomePrediction = {
            prediction,
            confidence,
            forMargin: Number((forVotesBig * 100n) / (totalVotes || 1n)),
            againstMargin: Number((againstVotesBig * 100n) / (totalVotes || 1n)),
            reasoning: `Based on current voting patterns with ${formattedTotalVotes} ${tokenSymbol} votes cast`
          };
        }

        // Time remaining formatting
        const formatTimeRemaining = (ms: number): string => {
          if (ms <= 0) return 'Voting ended';
          const days = Math.floor(ms / (1000 * 60 * 60 * 24));
          const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          if (days > 0) return `${days} days, ${hours} hours remaining`;
          if (hours > 0) return `${hours} hours remaining`;
          const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
          return `${minutes} minutes remaining`;
        };

        const response = {
          proposalSummary: {
            basicInfo: {
              id: proposal.id,
              onchainId: proposal.onchainId,
              title: proposal.metadata?.title || 'Untitled',
              status: proposal.status,
              organization: proposal.organization?.name || 'Unknown',
              proposer: proposal.proposer?.name || proposal.proposer?.address || 'Unknown'
            },
            votingResults: {
              forVotes: {
                count: formattedForVotes,
                raw: forVotes,
                voters: voterStats.forVoters,
                percentage: voteStats.find((v: any) => v.type === 'for')?.percent || 0
              },
              againstVotes: {
                count: formattedAgainstVotes,
                raw: againstVotes,
                voters: voterStats.againstVoters,
                percentage: voteStats.find((v: any) => v.type === 'against')?.percent || 0
              },
              abstainVotes: {
                count: formattedAbstainVotes,
                raw: abstainVotes,
                voters: voterStats.abstainVoters,
                percentage: voteStats.find((v: any) => v.type === 'abstain')?.percent || 0
              },
              totalVotes: {
                count: formattedTotalVotes,
                raw: totalVotes.toString(),
                voters: voterStats.totalVoters,
                symbol: tokenSymbol
              }
            },
            timeline: {
              startTime: proposal.start?.timestamp || '',
              endTime: proposal.end?.timestamp || '',
              timeRemaining: formatTimeRemaining(timeRemaining),
              progressPercentage: Math.round(progressPct * 100) / 100,
              status: timeRemaining <= 0 ? 'Concluded' : 'Active'
            },
            ...(outcomePrediction && { outcomePrediction }),
            executiveSummary: {
              leadingOption: totalVotes === 0n ? 'No votes yet' : 
                BigInt(forVotes) > BigInt(againstVotes) ? 'FOR' : 
                BigInt(againstVotes) > BigInt(forVotes) ? 'AGAINST' : 'TIED',
              participationLevel: voterStats.totalVoters > 100 ? 'High' : 
                voterStats.totalVoters > 20 ? 'Moderate' : 'Low',
              keyInsights: [
                `${voterStats.totalVoters} total participants`,
                `${formattedTotalVotes} ${tokenSymbol} voting power deployed`,
                timeRemaining > 0 ? formatTimeRemaining(timeRemaining) : 'Voting concluded',
                outcomePrediction ? `${outcomePrediction.prediction} (${outcomePrediction.confidence} confidence)` : ''
              ].filter(Boolean)
            }
          },
          metadata: {
            analysisTimestamp: new Date().toISOString(),
            includedPredictions: includePredictions,
            tokenInfo: {
              symbol: tokenSymbol,
              decimals: decimals,
              name: tokenInfo?.name || 'Unknown Token'
            },
            conversionNote: `⚠️ Vote amounts converted from wei (${decimals} decimals) to human-readable format. Raw amounts preserved in 'raw' fields.`
          }
        };

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(response, null, 2)
          }]
        };
      } catch (error) {
        if (error instanceof Error && (error.message.includes('GraphQL errors') || error.message.includes('rate limit') || error.message.includes('Invalid'))) {
          throw error;
        }
        return {
          content: [{
            type: 'text',
            text: `Error analyzing proposal: ${error instanceof Error ? error.message : 'Unknown error'}`
          }],
          isError: true
        };
      }
    }
  );
}