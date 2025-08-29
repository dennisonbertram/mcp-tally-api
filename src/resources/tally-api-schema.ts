/**
 * Tally API Schema Resource
 *
 * This resource provides the complete GraphQL schema for the Tally API through
 * introspection, allowing AI models to understand the API structure and capabilities.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import { TallyGraphQLClient } from '../graphql-client.js';

/**
 * Register the Tally API schema resource with the MCP server
 * 
 * @param server - The McpServer instance to register the resource with
 * @param graphqlClient - The TallyGraphQLClient instance for API access
 */
export function registerTallyApiSchemaResource(server: McpServer, graphqlClient: TallyGraphQLClient): void {
  server.resource(
    'tally-api-schema',
    'tally://api/schema',
    { mimeType: 'application/json' },
    async (): Promise<ReadResourceResult> => {
      try {
        // GraphQL introspection query to get the full schema
        const introspectionQuery = `
          query IntrospectionQuery {
            __schema {
              types {
                name
                kind
                description
                fields {
                  name
                  description
                  type {
                    name
                    kind
                    ofType {
                      name
                      kind
                    }
                  }
                  args {
                    name
                    description
                    type {
                      name
                      kind
                      ofType {
                        name
                        kind
                      }
                    }
                  }
                }
                inputFields {
                  name
                  description
                  type {
                    name
                    kind
                    ofType {
                      name
                      kind
                    }
                  }
                }
                interfaces {
                  name
                  kind
                }
                enumValues {
                  name
                  description
                }
                possibleTypes {
                  name
                  kind
                }
              }
              queryType {
                name
              }
              mutationType {
                name
              }
              subscriptionType {
                name
              }
              directives {
                name
                description
                locations
                args {
                  name
                  description
                  type {
                    name
                    kind
                  }
                }
              }
            }
          }
        `;

        const schemaData = await graphqlClient.query(introspectionQuery);

        return {
          contents: [
            {
              uri: 'tally://api/schema',
              mimeType: 'application/json',
              text: JSON.stringify({
                description: 'Tally GraphQL API Schema with Practical Examples',
                timestamp: new Date().toISOString(),
                schema: schemaData,
                practicalExamples: {
                  votesQuery: {
                    description: 'Query votes on a specific proposal with voter details and voting power',
                    howItWorks: {
                      nodes: 'GraphQL uses nodes pattern for paginated results. The actual data is in nodes array, metadata in pageInfo',
                      filters: 'Use filters object to narrow results by proposalId, vote type, hasReason, voter address, etc.',
                      sorting: 'Use sort object with isDescending boolean and sortBy field (id, amount, etc.)',
                      pagination: 'Use page object with limit (max results) and cursors for navigation'
                    },
                    query: `query Votes($input: VotesInput!) {
  votes(input: $input) {
    nodes {
      ... on OnchainVote {
        id
        amount
        voter {
          id
          address
          ens
          name
        }
        type
        reason
        proposal {
          id
          metadata {
            title
          }
        }
        txHash
        block {
          timestamp
          number
        }
        chainId
      }
    }
    pageInfo {
      firstCursor
      lastCursor
      count
    }
  }
}`,
                    exampleVariables: {
                      basic: {
                        input: {
                          filters: {
                            proposalId: "2662020087342433698"
                          },
                          page: { limit: 10 }
                        }
                      },
                      withReasons: {
                        input: {
                          filters: {
                            proposalId: "2662020087342433698",
                            hasReason: true
                          },
                          page: { limit: 5 }
                        }
                      },
                      againstVotes: {
                        input: {
                          filters: {
                            proposalId: "2662020087342433698",
                            type: "against"
                          },
                          page: { limit: 3 },
                          sort: {
                            isDescending: true,
                            sortBy: "amount"
                          }
                        }
                      }
                    },
                    availableFilters: {
                      proposalId: 'Required - ID of the proposal to get votes for',
                      type: 'Optional - Vote type: "for", "against", or "abstain"',
                      hasReason: 'Optional - Boolean to filter votes with/without comments',
                      voter: 'Optional - Specific voter address to filter by',
                      chainId: 'Optional - Blockchain chain ID filter'
                    },
                    voteDataExplanation: {
                      amount: 'Voting power/weight used (in token units, often needs decimal conversion)',
                      voter: 'Complete voter information including address, ENS name if available',
                      type: 'Vote direction - for, against, or abstain',
                      reason: 'Optional comment/reasoning provided by voter (can be null)',
                      txHash: 'Transaction hash of the vote on-chain',
                      block: 'Block information including timestamp and block number',
                      chainId: 'Blockchain identifier (e.g., 1 for Ethereum mainnet, 137 for Polygon)'
                    }
                  }
                }
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        // If introspection fails, return basic schema information
        return {
          contents: [
            {
              uri: 'tally://api/schema',
              mimeType: 'application/json',
              text: JSON.stringify({
                description: 'Tally GraphQL API Schema (Basic Info)',
                timestamp: new Date().toISOString(),
                error: `Schema introspection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                endpoint: graphqlClient.getEndpoint(),
                note: 'Use the execute_graphql_query tool to run custom queries against this API',
              }, null, 2),
            },
          ],
        };
      }
    }
  );
}