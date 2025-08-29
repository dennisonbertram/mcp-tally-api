/**
 * Delegate Leaderboard Tool
 * 
 * Get top delegates ranked by voting power, activity, or delegator count with 
 * performance analysis and reputation metrics for governance insights.
 */

import { z } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { TallyGraphQLClient } from '../graphql-client.js';

/**
 * Register the delegate leaderboard tool with the MCP server
 */
export function registerDelegateLeaderboardTool(server: any, graphqlClient: TallyGraphQLClient): void {
  server.tool(
    'get_delegate_leaderboard',
    'Get top delegates ranked by voting power, activity, or delegator count with performance analysis and reputation metrics',
    {
      organizationId: z.string().describe('Organization ID (required) - the DAO to get delegate leaderboard for'),
      sortBy: z.enum(['votingPower', 'delegators', 'activity']).optional().describe('Sort delegates by criteria (default: votingPower)'),
      limit: z.number().optional().describe('Number of delegates to return (default: 10, max: 50)')
    },
    async ({ organizationId, sortBy = 'votingPower', limit = 10 }: { organizationId: string; sortBy?: 'votingPower' | 'delegators' | 'activity'; limit?: number }): Promise<CallToolResult> => {
      try {
        if (!graphqlClient) {
          throw new Error('GraphQL client not properly initialized');
        }

        // Validate and clamp limit
        const clampedLimit = Math.min(Math.max(limit, 1), 50);
        
        // Map sortBy to GraphQL enum values
        const sortByMapping: Record<string, string> = {
          'votingPower': 'votes',
          'delegators': 'delegators', 
          'activity': 'votes' // Use votes as proxy for activity
        };
        const graphqlSortBy = sortByMapping[sortBy] || 'votes';

        const query = `query { delegates(input: {filters: {organizationId: ${organizationId}}, page: {limit: ${clampedLimit}}, sort: {sortBy: ${graphqlSortBy}, isDescending: true}}) { nodes { ... on Delegate { id delegatorsCount votesCount isPrioritized account { address name ens twitter bio picture } statement { statement statementSummary isSeekingDelegation } organization { name } token { symbol decimals } } } pageInfo { count } } }`;

        const result = await graphqlClient.query(query, {});

        if (!result?.delegates?.nodes) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'No delegates found or invalid organization ID',
                organizationId: organizationId
              }, null, 2)
            }],
            isError: true
          };
        }

        // Process delegates to add rankings and analytics
        const delegates = result.delegates.nodes;
        const totalDelegates = result.delegates.pageInfo.count || delegates.length;
        
        const processedDelegates = delegates.map((delegate: any, index: number) => {
          const processedDelegate = { ...delegate };
          
          // Convert voting power from wei to readable format
          const votesWei = delegate.votesCount || '0';
          const decimals = delegate.token?.decimals || 18;
          const votesReadable = (parseFloat(votesWei) / Math.pow(10, decimals)).toLocaleString();
          processedDelegate.votingPowerFormatted = `${votesReadable} ${delegate.token?.symbol || 'tokens'}`;
          
          // Add ranking and performance metrics
          processedDelegate.rank = index + 1;
          processedDelegate.percentileRank = totalDelegates > 0 ? Math.round((1 - index / totalDelegates) * 100) : 0;
          
          // Calculate delegation efficiency (voting power per delegator)
          const delegationEfficiency = delegate.delegatorsCount > 0 
            ? parseFloat(votesWei) / delegate.delegatorsCount 
            : parseFloat(votesWei);
          processedDelegate.delegationEfficiency = (delegationEfficiency / Math.pow(10, decimals)).toLocaleString();
          
          // Add delegate category based on voting power
          const votesNum = parseFloat(votesWei);
          if (votesNum === 0) {
            processedDelegate.delegateCategory = 'Inactive';
          } else if (votesNum < Math.pow(10, decimals + 3)) { // < 1K tokens
            processedDelegate.delegateCategory = 'Emerging';
          } else if (votesNum < Math.pow(10, decimals + 4)) { // < 10K tokens
            processedDelegate.delegateCategory = 'Active';
          } else if (votesNum < Math.pow(10, decimals + 5)) { // < 100K tokens
            processedDelegate.delegateCategory = 'Major';
          } else {
            processedDelegate.delegateCategory = 'Whale';
          }

          // Add statement quality indicators
          if (delegate.statement?.statement) {
            const statementLength = delegate.statement.statement.length;
            if (statementLength > 500) {
              processedDelegate.statementQuality = 'Comprehensive';
            } else if (statementLength > 100) {
              processedDelegate.statementQuality = 'Moderate';
            } else if (statementLength > 0) {
              processedDelegate.statementQuality = 'Brief';
            } else {
              processedDelegate.statementQuality = 'None';
            }
          } else {
            processedDelegate.statementQuality = 'None';
          }

          return processedDelegate;
        });

        // Calculate comparative analytics
        const totalVotingPower = delegates.reduce((sum: number, d: any) => 
          sum + parseFloat(d.votesCount || '0'), 0);
        const totalDelegators = delegates.reduce((sum: number, d: any) => 
          sum + (d.delegatorsCount || 0), 0);
        const avgVotingPower = delegates.length > 0 ? totalVotingPower / delegates.length : 0;
        const avgDelegators = delegates.length > 0 ? totalDelegators / delegates.length : 0;

        const decimals = delegates[0]?.token?.decimals || 18;
        
        const response = {
          organizationId: organizationId,
          organizationName: delegates[0]?.organization?.name || 'Unknown',
          tokenSymbol: delegates[0]?.token?.symbol || 'Unknown',
          sortBy: sortBy,
          totalDelegatesShown: processedDelegates.length,
          totalDelegatesInDAO: totalDelegates,
          leaderboard: processedDelegates,
          analytics: {
            totalVotingPower: (totalVotingPower / Math.pow(10, decimals)).toLocaleString(),
            averageVotingPower: (avgVotingPower / Math.pow(10, decimals)).toLocaleString(),
            totalDelegators: totalDelegators,
            averageDelegatorsPerDelegate: Math.round(avgDelegators * 100) / 100,
            topDelegateVotingPower: processedDelegates[0]?.votingPowerFormatted || '0',
            concentrationRatio: totalVotingPower > 0 ? 
              Math.round((parseFloat(delegates[0]?.votesCount || '0') / totalVotingPower) * 10000) / 100 : 0,
            delegateCategories: {
              whales: processedDelegates.filter((d: any) => d.delegateCategory === 'Whale').length,
              major: processedDelegates.filter((d: any) => d.delegateCategory === 'Major').length,
              active: processedDelegates.filter((d: any) => d.delegateCategory === 'Active').length,
              emerging: processedDelegates.filter((d: any) => d.delegateCategory === 'Emerging').length,
              inactive: processedDelegates.filter((d: any) => d.delegateCategory === 'Inactive').length
            },
            statementQuality: {
              comprehensive: processedDelegates.filter((d: any) => d.statementQuality === 'Comprehensive').length,
              moderate: processedDelegates.filter((d: any) => d.statementQuality === 'Moderate').length,
              brief: processedDelegates.filter((d: any) => d.statementQuality === 'Brief').length,
              none: processedDelegates.filter((d: any) => d.statementQuality === 'None').length
            }
          },
          conversionNote: `⚠️ Voting power amounts are converted from wei (${decimals} decimals) to human-readable format. Raw amounts are preserved in the 'votesCount' field.`
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
            text: `Error fetching delegate leaderboard: ${error instanceof Error ? error.message : 'Unknown error'}`
          }],
          isError: true
        };
      }
    }
  );
}