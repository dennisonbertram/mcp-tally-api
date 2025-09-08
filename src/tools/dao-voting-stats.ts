/**
 * DAO Voting Statistics Tool
 * 
 * Get comprehensive DAO governance statistics including participation rates, 
 * proposal success rates, and voting power analytics for governance insights.
 */

import { z } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { TallyGraphQLClient } from '../graphql-client.js';

/**
 * Register the DAO voting statistics tool with the MCP server
 */
export function registerDAOVotingStatsTool(server: any, graphqlClient: TallyGraphQLClient): void {
  server.tool(
    'get_dao_voting_stats',
    'Get comprehensive DAO governance statistics including participation rates, proposal success rates, and voting power analytics',
    {
      organizationId: z.string().describe('Organization ID (required) - the ID of the DAO to analyze'),
      timeframe: z.enum(['30d', '90d', '1y', 'all']).optional().describe('Time period for analysis (default: all)'),
      includeHistorical: z.boolean().optional().describe('Include historical trend data (default: false)')
    },
    async ({ organizationId, timeframe = 'all', includeHistorical = false }: { 
      organizationId: string; 
      timeframe?: '30d' | '90d' | '1y' | 'all'; 
      includeHistorical?: boolean; 
    }): Promise<CallToolResult> => {
      try {
        if (!graphqlClient) {
          throw new Error('GraphQL client not properly initialized');
        }

        // Get organization and proposal statistics
        const query = `query {
          organization(id: ${organizationId}) {
            id
            name
            slug
            proposalStats {
              total
              active
              passed
              failed
            }
            delegateStats {
              total
              totalVotingPower
            }
            stats {
              proposalsCount
              delegatesCount
              votersCount
              tokens {
                totalSupply
                transferable
              }
            }
          }
          proposals(input: {
            filters: {organizationId: ${organizationId}}, 
            page: {limit: 50}
          }) {
            nodes {
              id
              status
              metadata {
                title
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
          }
        }`;

        const result = await graphqlClient.query(query, {});

        if (!result?.organization) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'Organization not found',
                organizationId: organizationId
              }, null, 2)
            }],
            isError: true
          };
        }

        const organization = result.organization;
        const proposals = result.proposals?.nodes || [];

        // Filter proposals by timeframe if specified
        let filteredProposals = proposals;
        if (timeframe !== 'all') {
          const cutoffDate = new Date();
          const days = timeframe === '30d' ? 30 : timeframe === '90d' ? 90 : 365;
          cutoffDate.setDate(cutoffDate.getDate() - days);
          
          filteredProposals = proposals.filter((proposal: any) => {
            const proposalDate = new Date(proposal.start?.timestamp || proposal.end?.timestamp || '');
            return proposalDate >= cutoffDate;
          });
        }

        // Calculate voting statistics
        const totalProposals = filteredProposals.length;
        const statusCounts = filteredProposals.reduce((counts: any, proposal: any) => {
          const status = proposal.status?.toLowerCase() || 'other';
          counts[status] = (counts[status] || 0) + 1;
          return counts;
        }, {});

        // Calculate participation metrics
        let totalVotesAcrossProposals = 0;
        let totalVotersAcrossProposals = 0;
        let totalForVotes = 0;
        let totalAgainstVotes = 0;
        let totalAbstainVotes = 0;

        filteredProposals.forEach((proposal: any) => {
          const voteStats = proposal.voteStats || [];
          const proposalTotalVotes = voteStats.reduce((sum: number, stat: any) => 
            sum + (stat.votersCount || 0), 0);
          totalVotersAcrossProposals += proposalTotalVotes;

          voteStats.forEach((stat: any) => {
            const votesCount = parseFloat(stat.votesCount || '0');
            totalVotesAcrossProposals += votesCount;
            
            if (stat.type === 'for') {
              totalForVotes += votesCount;
            } else if (stat.type === 'against') {
              totalAgainstVotes += votesCount;
            } else if (stat.type === 'abstain') {
              totalAbstainVotes += votesCount;
            }
          });
        });

        // Calculate success and participation rates
        const passedProposals = (statusCounts.executed || 0) + (statusCounts.succeeded || 0);
        const failedProposals = statusCounts.failed || 0;
        const decidedProposals = passedProposals + failedProposals;
        
        const successRate = decidedProposals > 0 ? (passedProposals / decidedProposals) * 100 : 0;
        const avgVotersPerProposal = totalProposals > 0 ? totalVotersAcrossProposals / totalProposals : 0;

        // Generate governance health score (simplified)
        let healthScore = 0;
        let healthFactors: string[] = [];

        // Factor 1: Proposal activity (30 points max)
        if (totalProposals >= 10) {
          healthScore += 30;
          healthFactors.push('High proposal activity');
        } else if (totalProposals >= 5) {
          healthScore += 20;
          healthFactors.push('Moderate proposal activity');
        } else if (totalProposals >= 1) {
          healthScore += 10;
          healthFactors.push('Some proposal activity');
        }

        // Factor 2: Success rate (25 points max)
        if (successRate >= 80) {
          healthScore += 25;
          healthFactors.push('High success rate');
        } else if (successRate >= 60) {
          healthScore += 20;
          healthFactors.push('Good success rate');
        } else if (successRate >= 40) {
          healthScore += 15;
          healthFactors.push('Moderate success rate');
        } else if (decidedProposals > 0) {
          healthScore += 10;
          healthFactors.push('Low success rate');
        }

        // Factor 3: Voter participation (25 points max)
        if (avgVotersPerProposal >= 100) {
          healthScore += 25;
          healthFactors.push('Excellent participation');
        } else if (avgVotersPerProposal >= 50) {
          healthScore += 20;
          healthFactors.push('Good participation');
        } else if (avgVotersPerProposal >= 20) {
          healthScore += 15;
          healthFactors.push('Moderate participation');
        } else if (avgVotersPerProposal >= 5) {
          healthScore += 10;
          healthFactors.push('Low participation');
        }

        // Factor 4: Active governance (20 points max)
        const activeProposals = statusCounts.active || 0;
        if (activeProposals >= 3) {
          healthScore += 20;
          healthFactors.push('Multiple active proposals');
        } else if (activeProposals >= 1) {
          healthScore += 15;
          healthFactors.push('Has active proposals');
        }

        const response = {
          organization: {
            id: organization.id,
            name: organization.name,
            slug: organization.slug
          },
          analysisMetadata: {
            timeframe: timeframe,
            totalProposalsAnalyzed: totalProposals,
            includesHistorical: includeHistorical,
            analysisTimestamp: new Date().toISOString()
          },
          proposalStatistics: {
            totalProposals: totalProposals,
            statusBreakdown: statusCounts,
            successMetrics: {
              passedProposals: passedProposals,
              failedProposals: failedProposals,
              successRate: Math.round(successRate * 100) / 100,
              decidedProposals: decidedProposals
            }
          },
          participationMetrics: {
            totalVotersAcrossProposals: totalVotersAcrossProposals,
            averageVotersPerProposal: Math.round(avgVotersPerProposal * 100) / 100,
            totalDelegates: organization.delegateStats?.total || 0,
            estimatedUniqueParticipants: Math.max(totalVotersAcrossProposals, organization.delegateStats?.total || 0)
          },
          votingPowerDistribution: {
            totalVotingPowerRaw: totalVotesAcrossProposals.toString(),
            forVotesRaw: totalForVotes.toString(),
            againstVotesRaw: totalAgainstVotes.toString(),
            abstainVotesRaw: totalAbstainVotes.toString(),
            forPercentage: totalVotesAcrossProposals > 0 ? 
              Math.round((totalForVotes / totalVotesAcrossProposals) * 10000) / 100 : 0,
            againstPercentage: totalVotesAcrossProposals > 0 ? 
              Math.round((totalAgainstVotes / totalVotesAcrossProposals) * 10000) / 100 : 0
          },
          governanceHealth: {
            overallScore: Math.round(healthScore),
            rating: healthScore >= 80 ? 'Excellent' : 
                   healthScore >= 60 ? 'Good' : 
                   healthScore >= 40 ? 'Fair' : 
                   healthScore >= 20 ? 'Poor' : 'Inactive',
            keyFactors: healthFactors,
            recommendations: healthScore < 60 ? [
              'Increase proposal frequency',
              'Improve voter engagement',
              'Enhance communication strategies'
            ].slice(0, Math.max(1, 3 - Math.floor(healthScore / 20))) : [
              'Maintain current governance practices',
              'Continue community engagement'
            ]
          },
          conversionNote: '⚠️ Voting power values are in raw token units. Use organization-specific queries for formatted amounts with proper decimals.'
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
            text: `Error analyzing DAO voting statistics: ${error instanceof Error ? error.message : 'Unknown error'}`
          }],
          isError: true
        };
      }
    }
  );
}