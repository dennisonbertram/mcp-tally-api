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
                description: 'Tally GraphQL API Schema',
                timestamp: new Date().toISOString(),
                schema: schemaData,
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