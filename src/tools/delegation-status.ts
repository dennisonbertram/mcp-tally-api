/**
 * Delegation Status Tool
 * 
 * Get user delegation status including received delegations and current delegation target 
 * with power analysis for comprehensive delegation insights.
 */

import { z } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { TallyGraphQLClient } from '../graphql-client.js';

/**
 * Register the delegation status tool with the MCP server
 */
export function registerDelegationStatusTool(server: any, graphqlClient: TallyGraphQLClient): void {
  server.tool(
    'get_delegation_status',
    'Get user delegation status including received delegations and current delegation target with power analysis',
    {
      address: z.string().describe('Ethereum address to check delegation status for (required)'),
      organizationId: z.string().optional().describe('Filter by specific organization/DAO ID')
    },
    async ({ address, organizationId }: { 
      address: string; 
      organizationId?: string; 
    }): Promise<CallToolResult> => {
      try {
        if (!graphqlClient) {
          throw new Error('GraphQL client not properly initialized');
        }

        // Query for delegation information
        const query = organizationId 
          ? `query { 
              delegate(input: {address: "${address}", organizationId: "${organizationId}"}) { 
                id 
                account { 
                  address 
                  name 
                  ens 
                  twitter 
                  bio 
                } 
                delegatorsCount 
                votesCount 
                isPrioritized 
                organization { 
                  id 
                  name 
                } 
                statement { 
                  statement 
                  isSeekingDelegation 
                } 
                token { 
                  id 
                  name 
                  symbol 
                  decimals 
                } 
              } 
            }`
          : `query { 
              delegates(input: {filters: {address: "${address}"}, page: {limit: 50}}) { 
                nodes { 
                  ... on Delegate {
                    id 
                    account { 
                      address 
                      name 
                      ens 
                    } 
                    organization { 
                      id 
                      name 
                    } 
                    delegatorsCount 
                    votesCount 
                    token { 
                      symbol 
                      decimals 
                    }
                  }
                } 
              } 
            }`;

        const result = await graphqlClient.query(query, {});

        if (organizationId) {
          // Organization-specific delegation status
          const delegate = result?.delegate;
          
          if (!delegate) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  address: address,
                  organizationId: organizationId,
                  status: 'No delegation activity found',
                  isDelegateInThisDAO: false,
                  receivedDelegations: [],
                  totalDelegatedPower: '0',
                  delegatorCount: 0,
                  analysis: {
                    delegationType: 'Not a delegate',
                    powerLevel: 'No voting power',
                    engagementLevel: 'No activity'
                  }
                }, null, 2)
              }]
            };
          }

          // Calculate delegation power and analysis
          const votingPower = delegate.votesCount || '0';
          const decimals = delegate.token?.decimals || 18;
          const formattedPower = votingPower !== '0' ? 
            `${(parseFloat(votingPower) / Math.pow(10, decimals)).toLocaleString()} ${delegate.token?.symbol || 'tokens'}` : 
            '0 tokens';

          // Power level analysis
          const powerNum = parseFloat(votingPower);
          let powerLevel: string, delegationType: string, engagementLevel: string;
          
          if (powerNum === 0) {
            powerLevel = 'No voting power';
            delegationType = 'Not a delegate';
            engagementLevel = 'No activity';
          } else if (powerNum < 1e18) {
            powerLevel = 'Small delegate';
            delegationType = 'Emerging delegate';
            engagementLevel = 'Low activity';
          } else if (powerNum < 1e21) {
            powerLevel = 'Medium delegate';
            delegationType = 'Active delegate';
            engagementLevel = 'Moderate activity';
          } else if (powerNum < 1e24) {
            powerLevel = 'Large delegate';
            delegationType = 'Significant delegate';
            engagementLevel = 'High activity';
          } else {
            powerLevel = 'Whale delegate';
            delegationType = 'Major delegate';
            engagementLevel = 'Very high activity';
          }

          const response = {
            address: address,
            organizationId: organizationId,
            organizationName: delegate.organization?.name || 'Unknown',
            isDelegateInThisDAO: true,
            delegateInfo: {
              id: delegate.id,
              account: delegate.account,
              delegatorsCount: delegate.delegatorsCount || 0,
              votesCount: delegate.votesCount,
              isPrioritized: delegate.isPrioritized,
              statement: delegate.statement,
              token: delegate.token
            },
            delegationSummary: {
              totalDelegatedPower: votingPower,
              totalDelegatedPowerFormatted: formattedPower,
              delegatorCount: delegate.delegatorsCount || 0,
              analysis: {
                delegationType,
                powerLevel,
                engagementLevel,
                isSeekingDelegation: delegate.statement?.isSeekingDelegation || false,
                hasStatement: !!(delegate.statement?.statement)
              }
            },
            conversionNote: `⚠️ Voting power converted from wei (${decimals} decimals) to human-readable format.`
          };

          return {
            content: [{
              type: 'text',
              text: JSON.stringify(response, null, 2)
            }]
          };
        } else {
          // Cross-DAO delegation overview
          const delegates = result?.delegates?.nodes || [];
          
          if (delegates.length === 0) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  address: address,
                  status: 'No delegation activity found across any DAOs',
                  totalDAOs: 0,
                  delegateRoles: [],
                  summary: {
                    totalVotingPower: '0',
                    totalDelegators: 0,
                    averagePowerPerDAO: '0'
                  }
                }, null, 2)
              }]
            };
          }

          // Process all delegate roles
          const delegateRoles = delegates.map((delegate: any) => {
            const votingPower = delegate.votesCount || '0';
            const decimals = delegate.token?.decimals || 18;
            const formattedPower = votingPower !== '0' ? 
              `${(parseFloat(votingPower) / Math.pow(10, decimals)).toLocaleString()} ${delegate.token?.symbol || 'tokens'}` : 
              '0 tokens';

            return {
              organization: delegate.organization,
              votingPower: votingPower,
              votingPowerFormatted: formattedPower,
              delegatorCount: delegate.delegatorsCount || 0,
              tokenSymbol: delegate.token?.symbol || 'Unknown'
            };
          });

          // Calculate summary statistics
          const totalVotingPower = delegates.reduce((sum: number, d: any) => 
            sum + parseFloat(d.votesCount || '0'), 0);
          const totalDelegators = delegates.reduce((sum: number, d: any) => 
            sum + (d.delegatorsCount || 0), 0);

          const response = {
            address: address,
            status: 'Active delegate across multiple DAOs',
            totalDAOs: delegates.length,
            delegateRoles: delegateRoles,
            summary: {
              totalVotingPowerRaw: totalVotingPower.toString(),
              totalDelegators: totalDelegators,
              averageDelegatorsPerDAO: Math.round((totalDelegators / delegates.length) * 100) / 100,
              mostInfluentialDAO: delegateRoles.reduce((max, current) => 
                parseFloat(current.votingPower) > parseFloat(max.votingPower) ? current : max, 
                delegateRoles[0]
              ).organization.name
            },
            conversionNote: '⚠️ Cross-DAO summary shows raw voting power values. Use organization-specific queries for formatted amounts.'
          };

          return {
            content: [{
              type: 'text',
              text: JSON.stringify(response, null, 2)
            }]
          };
        }
      } catch (error) {
        if (error instanceof Error && (error.message.includes('GraphQL errors') || error.message.includes('rate limit') || error.message.includes('Invalid'))) {
          throw error;
        }
        return {
          content: [{
            type: 'text',
            text: `Error fetching delegation status: ${error instanceof Error ? error.message : 'Unknown error'}`
          }],
          isError: true
        };
      }
    }
  );
}