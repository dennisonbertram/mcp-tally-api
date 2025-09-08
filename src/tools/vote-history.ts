/**
 * Vote History Tool
 * 
 * Get historical voting patterns and analyze voting behavior over time
 * for comprehensive governance participation insights.
 */

import { z } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { TallyGraphQLClient } from '../graphql-client.js';

/**
 * Register the vote history tool with the MCP server
 */
export function registerVoteHistoryTool(server: any, graphqlClient: TallyGraphQLClient): void {
  server.tool(
    'get_vote_history',
    'Get historical voting patterns and analyze voting behavior over time with participation insights',
    {
      address: z.string().describe('Ethereum address to get vote history for (required)'),
      organizationId: z.string().optional().describe('Filter by specific organization/DAO ID'),
      limit: z.number().optional().describe('Number of votes to return (default: 20, max: 100)'),
      includeAnalysis: z.boolean().optional().describe('Include voting pattern analysis (default: true)')
    },
    async ({ address, organizationId, limit = 20, includeAnalysis = true }: { 
      address: string; 
      organizationId?: string; 
      limit?: number;
      includeAnalysis?: boolean; 
    }): Promise<CallToolResult> => {
      try {
        if (!graphqlClient) {
          throw new Error('GraphQL client not properly initialized');
        }

        // Validate and clamp limit
        const clampedLimit = Math.min(Math.max(limit, 1), 100);

        // Build query to get voting history for the address
        const organizationFilter = organizationId ? `, organizationId: "${organizationId}"` : '';
        const query = `query {
          votes(input: {
            filters: {
              voter: "${address}"${organizationFilter}
            },
            page: {limit: ${clampedLimit}},
            sort: {sortBy: id, isDescending: true}
          }) {
            nodes {
              ... on OnchainVote {
                id
                amount
                type
                reason
                voter {
                  address
                  name
                }
                proposal {
                  id
                  onchainId
                  metadata {
                    title
                  }
                  organization {
                    id
                    name
                  }
                  status
                  start {
                    ... on Block {
                      timestamp
                    }
                    ... on BlocklessTimestamp {
                      timestamp
                    }
                  }
                  end {
                    ... on Block {
                      timestamp
                    }
                    ... on BlocklessTimestamp {
                      timestamp
                    }
                  }
                }
                block {
                  timestamp
                  number
                }
              }
            }
            pageInfo {
              count
            }
          }
        }`;

        const result = await graphqlClient.query(query, {});

        if (!result?.votes?.nodes || result.votes.nodes.length === 0) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                address: address,
                organizationId: organizationId,
                status: 'No voting history found',
                totalVotes: 0,
                votingPattern: {
                  forVotes: 0,
                  againstVotes: 0,
                  abstainVotes: 0
                },
                message: organizationId ? 
                  'No votes found for this address in the specified DAO' : 
                  'No votes found for this address across all DAOs'
              }, null, 2)
            }]
          };
        }

        const votes = result.votes.nodes;
        const totalVotesFound = result.votes.pageInfo?.count || votes.length;

        // Process votes with enhanced data
        const processedVotes = votes.map((vote: any) => {
          const voteAmount = vote.amount || '0';
          const decimals = 18; // Default to 18, could be enhanced with token data
          const formattedAmount = voteAmount !== '0' ? 
            `${(parseFloat(voteAmount) / Math.pow(10, decimals)).toLocaleString()} tokens` : 
            '0 tokens';

          return {
            id: vote.id,
            proposalInfo: {
              id: vote.proposal?.id,
              onchainId: vote.proposal?.onchainId,
              title: vote.proposal?.metadata?.title || 'Untitled',
              organization: vote.proposal?.organization?.name || 'Unknown',
              status: vote.proposal?.status
            },
            voteDetails: {
              type: vote.type,
              amount: voteAmount,
              amountFormatted: formattedAmount,
              reason: vote.reason || null,
              hasReason: !!(vote.reason && vote.reason.trim())
            },
            timing: {
              voteTimestamp: vote.block?.timestamp || '',
              blockNumber: vote.block?.number || null,
              proposalStart: vote.proposal?.start?.timestamp || '',
              proposalEnd: vote.proposal?.end?.timestamp || ''
            }
          };
        });

        // Generate voting pattern analysis if requested
        let analysis = null;
        if (includeAnalysis) {
          const voteTypes = {
            for: processedVotes.filter(v => v.voteDetails.type === 'for').length,
            against: processedVotes.filter(v => v.voteDetails.type === 'against').length,
            abstain: processedVotes.filter(v => v.voteDetails.type === 'abstain').length
          };

          const totalAnalyzedVotes = voteTypes.for + voteTypes.against + voteTypes.abstain;
          
          // DAO participation analysis
          const daoParticipation = processedVotes.reduce((acc: any, vote) => {
            const daoName = vote.proposalInfo.organization;
            if (!acc[daoName]) {
              acc[daoName] = { count: 0, forVotes: 0, againstVotes: 0, abstainVotes: 0 };
            }
            acc[daoName].count++;
            if (vote.voteDetails.type === 'for') acc[daoName].forVotes++;
            else if (vote.voteDetails.type === 'against') acc[daoName].againstVotes++;
            else if (vote.voteDetails.type === 'abstain') acc[daoName].abstainVotes++;
            return acc;
          }, {});

          // Engagement metrics
          const votesWithReasons = processedVotes.filter(v => v.voteDetails.hasReason).length;
          const uniqueDAOs = Object.keys(daoParticipation).length;
          
          // Time-based analysis (simplified)
          const recentVotes = processedVotes.filter(v => {
            const voteTime = new Date(v.timing.voteTimestamp);
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            return voteTime >= thirtyDaysAgo;
          }).length;

          analysis = {
            votingPattern: {
              totalVotes: totalAnalyzedVotes,
              forVotes: voteTypes.for,
              againstVotes: voteTypes.against,
              abstainVotes: voteTypes.abstain,
              forPercentage: totalAnalyzedVotes > 0 ? Math.round((voteTypes.for / totalAnalyzedVotes) * 10000) / 100 : 0,
              againstPercentage: totalAnalyzedVotes > 0 ? Math.round((voteTypes.against / totalAnalyzedVotes) * 10000) / 100 : 0,
              abstainPercentage: totalAnalyzedVotes > 0 ? Math.round((voteTypes.abstain / totalAnalyzedVotes) * 10000) / 100 : 0
            },
            daoParticipation: {
              uniqueDAOs: uniqueDAOs,
              daoBreakdown: Object.entries(daoParticipation)
                .sort(([,a]: any, [,b]: any) => b.count - a.count)
                .slice(0, 10) // Top 10 DAOs
                .map(([name, stats]: any) => ({
                  daoName: name,
                  votesCount: stats.count,
                  forVotes: stats.forVotes,
                  againstVotes: stats.againstVotes,
                  abstainVotes: stats.abstainVotes
                }))
            },
            engagementMetrics: {
              votesWithReasons: votesWithReasons,
              reasoningRate: totalAnalyzedVotes > 0 ? Math.round((votesWithReasons / totalAnalyzedVotes) * 10000) / 100 : 0,
              recentActivity: recentVotes,
              activityLevel: recentVotes >= 10 ? 'Very Active' : 
                            recentVotes >= 5 ? 'Active' : 
                            recentVotes >= 1 ? 'Moderate' : 'Inactive'
            },
            behaviorInsights: [
              voteTypes.for > voteTypes.against + voteTypes.abstain ? 'Generally supportive of proposals' : 
              voteTypes.against > voteTypes.for + voteTypes.abstain ? 'Generally critical of proposals' : 
              voteTypes.abstain > voteTypes.for + voteTypes.against ? 'Frequently abstains from voting' : 
              'Balanced voting approach',
              
              uniqueDAOs > 5 ? 'Active across multiple DAOs' : 
              uniqueDAOs > 1 ? 'Participates in several DAOs' : 
              'Focused on single DAO',
              
              votesWithReasons / totalAnalyzedVotes > 0.5 ? 'Frequently provides voting rationale' : 
              votesWithReasons / totalAnalyzedVotes > 0.2 ? 'Sometimes provides voting rationale' : 
              'Rarely provides voting rationale',
              
              recentVotes > 0 ? 'Recently active in governance' : 'No recent governance activity'
            ].filter(Boolean)
          };
        }

        const response = {
          voteHistory: {
            voterAddress: address,
            organizationFilter: organizationId || 'All DAOs',
            totalVotesInHistory: totalVotesFound,
            votesReturned: processedVotes.length,
            votes: processedVotes
          },
          ...(analysis && { analysis }),
          metadata: {
            queryTimestamp: new Date().toISOString(),
            includesAnalysis: includeAnalysis,
            limitApplied: clampedLimit,
            moreVotesAvailable: totalVotesFound > processedVotes.length,
            conversionNote: '⚠️ Vote amounts are converted from wei (18 decimals assumed) to readable format. Raw amounts preserved in amount fields.'
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
            text: `Error fetching vote history: ${error instanceof Error ? error.message : 'Unknown error'}`
          }],
          isError: true
        };
      }
    }
  );
}