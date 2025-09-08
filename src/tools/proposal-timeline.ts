/**
 * Proposal Timeline Tool
 * 
 * Get proposal lifecycle tracking with key milestones, voting phases, 
 * and timeline analysis for comprehensive governance monitoring.
 */

import { z } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { TallyGraphQLClient } from '../graphql-client.js';

/**
 * Register the proposal timeline tool with the MCP server
 */
export function registerProposalTimelineTool(server: any, graphqlClient: TallyGraphQLClient): void {
  server.tool(
    'get_proposal_timeline',
    'Get proposal lifecycle tracking with key milestones, voting phases, and timeline analysis',
    {
      proposalId: z.string().describe('Proposal ID (required) - the ID of the proposal to track'),
      includeVotingActivity: z.boolean().optional().describe('Include voting activity milestones (default: true)')
    },
    async ({ proposalId, includeVotingActivity = true }: { 
      proposalId: string; 
      includeVotingActivity?: boolean; 
    }): Promise<CallToolResult> => {
      try {
        if (!graphqlClient) {
          throw new Error('GraphQL client not properly initialized');
        }

        // Get comprehensive proposal data for timeline analysis
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
              name
            }
            proposer {
              address
              name
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
            voteStats {
              type
              votesCount
              votersCount
              percent
            }
            block {
              timestamp
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
        const now = new Date();
        const createdTime = new Date(proposal.block?.timestamp || '');
        const startTime = new Date(proposal.start?.timestamp || '');
        const endTime = new Date(proposal.end?.timestamp || '');

        // Create timeline milestones
        const milestones = [
          {
            event: 'Proposal Created',
            timestamp: proposal.block?.timestamp || '',
            status: 'completed',
            description: `Created by ${proposal.proposer?.name || proposal.proposer?.address || 'Unknown'}`,
            blockNumber: proposal.start?.number || null
          }
        ];

        if (startTime.getTime() !== createdTime.getTime()) {
          milestones.push({
            event: 'Voting Started',
            timestamp: proposal.start?.timestamp || '',
            status: now >= startTime ? 'completed' : 'pending',
            description: 'Community voting period began',
            blockNumber: proposal.start?.number || null
          });
        }

        // Add voting activity milestones if requested
        if (includeVotingActivity && proposal.voteStats) {
          const totalVoters = proposal.voteStats.reduce((sum: number, stat: any) => 
            sum + (stat.votersCount || 0), 0);
          
          if (totalVoters > 0) {
            milestones.push({
              event: 'Voting Activity',
              timestamp: proposal.start?.timestamp || '',
              status: 'completed',
              description: `${totalVoters} participants cast votes`,
              blockNumber: null
            });
          }
        }

        milestones.push({
          event: 'Voting Ends',
          timestamp: proposal.end?.timestamp || '',
          status: now >= endTime ? 'completed' : 'pending',
          description: 'Community voting period concludes',
          blockNumber: proposal.end?.number || null
        });

        // Add final outcome milestone based on status
        const finalStatus = proposal.status?.toLowerCase();
        if (['executed', 'succeeded', 'failed', 'cancelled'].includes(finalStatus || '')) {
          milestones.push({
            event: 'Proposal Concluded',
            timestamp: proposal.end?.timestamp || '',
            status: 'completed',
            description: `Proposal ${finalStatus?.toUpperCase() || 'CONCLUDED'}`,
            blockNumber: null
          });
        } else if (now >= endTime && finalStatus === 'active') {
          milestones.push({
            event: 'Awaiting Execution',
            timestamp: proposal.end?.timestamp || '',
            status: 'pending',
            description: 'Voting concluded, awaiting execution',
            blockNumber: null
          });
        }

        // Calculate timeline metrics
        const totalDuration = endTime.getTime() - startTime.getTime();
        const elapsed = Math.min(now.getTime() - startTime.getTime(), totalDuration);
        const progressPercentage = totalDuration > 0 ? (elapsed / totalDuration) * 100 : 0;

        const votingPhase = now < startTime ? 'Pre-voting' :
                           now >= startTime && now < endTime ? 'Active voting' :
                           'Post-voting';

        // Format time remaining
        const timeRemaining = endTime.getTime() - now.getTime();
        const formatTimeRemaining = (ms: number): string => {
          if (ms <= 0) return 'Voting concluded';
          const days = Math.floor(ms / (1000 * 60 * 60 * 24));
          const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          if (days > 0) return `${days} days, ${hours} hours remaining`;
          if (hours > 0) return `${hours} hours remaining`;
          const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
          return `${minutes} minutes remaining`;
        };

        // Voting statistics summary
        const voteStats = proposal.voteStats || [];
        const votingSummary = {
          totalParticipants: voteStats.reduce((sum: number, stat: any) => sum + (stat.votersCount || 0), 0),
          forVotes: voteStats.find((v: any) => v.type === 'for')?.votersCount || 0,
          againstVotes: voteStats.find((v: any) => v.type === 'against')?.votersCount || 0,
          abstainVotes: voteStats.find((v: any) => v.type === 'abstain')?.votersCount || 0
        };

        const response = {
          proposalTimeline: {
            basicInfo: {
              id: proposal.id,
              onchainId: proposal.onchainId,
              title: proposal.metadata?.title || 'Untitled',
              organization: proposal.organization?.name || 'Unknown',
              currentStatus: proposal.status
            },
            timeline: {
              milestones: milestones.sort((a, b) => 
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
              ),
              currentPhase: votingPhase,
              progressPercentage: Math.round(progressPercentage * 100) / 100
            },
            schedule: {
              createdAt: proposal.block?.timestamp || '',
              votingStarted: proposal.start?.timestamp || '',
              votingEnds: proposal.end?.timestamp || '',
              timeRemaining: formatTimeRemaining(timeRemaining),
              totalDuration: {
                milliseconds: totalDuration,
                days: Math.floor(totalDuration / (1000 * 60 * 60 * 24)),
                hours: Math.floor(totalDuration / (1000 * 60 * 60))
              }
            },
            ...(includeVotingActivity && {
              votingActivity: {
                summary: votingSummary,
                participationRate: votingSummary.totalParticipants > 0 ? 'Active' : 'Low',
                leadingOption: votingSummary.forVotes > votingSummary.againstVotes ? 'FOR' :
                              votingSummary.againstVotes > votingSummary.forVotes ? 'AGAINST' : 'TIED'
              }
            }),
            keyInsights: [
              `Currently in ${votingPhase.toLowerCase()} phase`,
              `${Math.round(progressPercentage)}% of voting period elapsed`,
              votingSummary.totalParticipants > 0 ? 
                `${votingSummary.totalParticipants} participants engaged` : 
                'No voting activity yet',
              timeRemaining > 0 ? formatTimeRemaining(timeRemaining) : 'Voting concluded'
            ]
          },
          metadata: {
            analysisTimestamp: new Date().toISOString(),
            includesVotingActivity: includeVotingActivity,
            timelineGenerated: 'Based on on-chain events and timestamps'
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
            text: `Error generating proposal timeline: ${error instanceof Error ? error.message : 'Unknown error'}`
          }],
          isError: true
        };
      }
    }
  );
}