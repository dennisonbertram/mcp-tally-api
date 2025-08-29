/**
 * Voter Profile Tool
 * 
 * Get comprehensive voter analysis with reputation scoring, voting patterns, 
 * and participation metrics across all DAOs for deep governance insights.
 */

import { z } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { TallyGraphQLClient } from '../graphql-client.js';

/**
 * Register the voter profile tool with the MCP server
 */
export function registerVoterProfileTool(server: any, graphqlClient: TallyGraphQLClient): void {
  server.tool(
    'get_voter_profile',
    'Get comprehensive voter analysis with reputation scoring, voting patterns, and participation metrics across all DAOs',
    {
      address: z.string().describe('Ethereum address of the voter to profile (required)'),
      includeRecentActivity: z.boolean().optional().describe('Include recent voting activity analysis (default: true)'),
      calculateReputation: z.boolean().optional().describe('Calculate governance reputation score (default: true)')
    },
    async ({ address, includeRecentActivity = true, calculateReputation = true }: { 
      address: string; 
      includeRecentActivity?: boolean; 
      calculateReputation?: boolean; 
    }): Promise<CallToolResult> => {
      try {
        if (!graphqlClient) {
          throw new Error('GraphQL client not properly initialized');
        }

        // Use single combined query following exact pattern from get_proposal_votes - inline query format
        const query = `query { accountV2(id: "${address}") { id address name bio twitter ens picture } delegatees(input: { filters: { address: "${address}" }, page: { limit: 50 } }) { nodes { ... on Delegation { id organization { id name slug } token { symbol name decimals } votes } } } delegates(input: { filters: { address: "${address}" } }) { nodes { ... on Delegate { id organization { id name slug } statement { statement statementSummary isSeekingDelegation } votesCount delegatorsCount token { id symbol name decimals } } } } }`;

        const result = await graphqlClient.query(query, {});

        if (!result?.accountV2) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'No account found or invalid address',
                address: address,
                suggestion: 'Please verify the Ethereum address is correct and the user has participated in governance'
              }, null, 2)
            }],
            isError: true
          };
        }

        // Transform DAO participations with human-readable amounts
        const daoParticipations = (result.delegatees?.nodes || []).map((delegation: any) => {
          const decimals = delegation.token?.decimals || 18;
          const rawAmount = parseFloat(delegation.votes || '0');
          const humanAmount = rawAmount / Math.pow(10, decimals);
          
          return {
            ...delegation,
            votesHuman: humanAmount.toLocaleString(),
            votesRaw: delegation.votes,
            token: {
              ...delegation.token,
              decimals: decimals
            }
          };
        });

        // Transform delegate participations with human-readable amounts
        const delegateParticipations = (result.delegates?.nodes || []).map((delegate: any) => {
          const decimals = delegate.token?.decimals || 18;
          const rawAmount = parseFloat(delegate.votesCount || '0');
          const humanAmount = rawAmount / Math.pow(10, decimals);
          
          return {
            ...delegate,
            votesCountHuman: humanAmount.toLocaleString(),
            votesCountRaw: delegate.votesCount,
            token: {
              ...delegate.token,
              decimals: decimals
            }
          };
        });

        // Calculate comprehensive reputation metrics
        let reputationAnalysis = null;
        if (calculateReputation) {
          const totalDaos = new Set([
            ...daoParticipations.map((d: any) => d.organization.id),
            ...delegateParticipations.map((d: any) => d.organization.id)
          ]).size;
          
          const totalDelegators = delegateParticipations.reduce((sum: number, d: any) => sum + (d.delegatorsCount || 0), 0);
          const totalVotingPower = delegateParticipations.reduce((sum: number, d: any) => {
            const decimals = d.token?.decimals || 18;
            return sum + (parseFloat(d.votesCountRaw || '0') / Math.pow(10, decimals));
          }, 0);
          
          const hasStatements = delegateParticipations.filter((d: any) => 
            d.statement && (d.statement.statement || d.statement.statementSummary)
          ).length;
          
          // Calculate reputation score (0-100)
          let reputationScore = 0;
          reputationScore += Math.min(totalDaos * 10, 30); // Max 30 points for DAO diversity
          reputationScore += Math.min(totalDelegators * 2, 25); // Max 25 points for delegator trust
          reputationScore += Math.min(Math.log10(totalVotingPower + 1) * 5, 20); // Max 20 points for voting power
          reputationScore += (hasStatements / Math.max(delegateParticipations.length, 1)) * 15; // Max 15 points for statement quality
          reputationScore += (result.accountV2.ens ? 5 : 0); // 5 points for ENS
          reputationScore += (result.accountV2.twitter ? 5 : 0); // 5 points for Twitter
          
          // Determine voter category
          let voterCategory = 'Newcomer';
          if (reputationScore >= 80) voterCategory = 'Governance Leader';
          else if (reputationScore >= 60) voterCategory = 'Active Participant';
          else if (reputationScore >= 40) voterCategory = 'Regular Voter';
          else if (reputationScore >= 20) voterCategory = 'Occasional Participant';
          
          // Determine participation pattern
          let participationPattern = 'Single DAO Focus';
          if (totalDaos >= 10) participationPattern = 'Ecosystem Wide';
          else if (totalDaos >= 5) participationPattern = 'Multi DAO Active';
          else if (totalDaos >= 3) participationPattern = 'Selective Participation';
          
          reputationAnalysis = {
            overallScore: Math.round(reputationScore),
            voterCategory,
            participationPattern,
            metrics: {
              daoCount: totalDaos,
              totalDelegators,
              totalVotingPowerFormatted: totalVotingPower.toLocaleString(),
              statementCompletion: `${hasStatements}/${delegateParticipations.length}`,
              hasENS: !!result.accountV2.ens,
              hasTwitter: !!result.accountV2.twitter,
              hasBio: !!result.accountV2.bio
            },
            insights: [
              totalDaos >= 5 ? '🌐 Cross-ecosystem participant with diverse DAO involvement' : '🎯 Focused on specific DAOs',
              totalDelegators >= 10 ? '👥 Trusted by community with significant delegation' : totalDelegators >= 1 ? '🤝 Has some community trust' : '🌱 Building community presence',
              hasStatements >= delegateParticipations.length * 0.5 ? '📝 Active in communicating governance positions' : '💬 Could improve governance communication',
              totalVotingPower >= 1000 ? '⚡ Significant voting power holder' : totalVotingPower >= 100 ? '🗳️ Moderate voting influence' : '🌟 Growing governance participant'
            ]
          };
        }

        // Recent activity analysis
        let activityAnalysis = null;
        if (includeRecentActivity) {
          const activeDaos = delegateParticipations.filter((d: any) => (d.votesCountRaw && parseFloat(d.votesCountRaw) > 0) || d.delegatorsCount > 0);
          const seekingDelegation = delegateParticipations.filter((d: any) => d.statement?.isSeekingDelegation).length;
          
          activityAnalysis = {
            activeDaoCount: activeDaos.length,
            totalDaoCount: delegateParticipations.length,
            activelySeekingDelegation: seekingDelegation,
            topDaosByVotingPower: delegateParticipations
              .filter((d: any) => d.votesCountRaw && parseFloat(d.votesCountRaw) > 0)
              .sort((a: any, b: any) => parseFloat(b.votesCountRaw) - parseFloat(a.votesCountRaw))
              .slice(0, 5)
              .map((d: any) => ({
                dao: d.organization.name,
                votingPower: d.votesCountHuman,
                delegators: d.delegatorsCount
              })),
            topDaosByDelegators: delegateParticipations
              .filter((d: any) => d.delegatorsCount > 0)
              .sort((a: any, b: any) => b.delegatorsCount - a.delegatorsCount)
              .slice(0, 5)
              .map((d: any) => ({
                dao: d.organization.name,
                delegators: d.delegatorsCount,
                votingPower: d.votesCountHuman
              }))
          };
        }

        const response = {
          voterProfile: {
            account: result.accountV2,
            summary: {
              totalDaosParticipated: new Set([
                ...daoParticipations.map((d: any) => d.organization.id),
                ...delegateParticipations.map((d: any) => d.organization.id)
              ]).size,
              daoParticipations: daoParticipations.length,
              delegateRoles: delegateParticipations.length,
              totalDelegators: delegateParticipations.reduce((sum: number, d: any) => sum + (d.delegatorsCount || 0), 0)
            },
            daoParticipations,
            delegateParticipations,
            ...(reputationAnalysis && { reputationAnalysis }),
            ...(activityAnalysis && { activityAnalysis })
          },
          metadata: {
            profileGenerated: new Date().toISOString(),
            includeRecentActivity,
            calculateReputation,
            conversionNote: '💡 All voting power amounts show both human-readable (votesHuman/votesCountHuman) and raw wei values (votesRaw/votesCountRaw). Use token decimals for custom conversions.'
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
            text: `Error fetching voter profile: ${error instanceof Error ? error.message : 'Unknown error'}`
          }],
          isError: true
        };
      }
    }
  );
}