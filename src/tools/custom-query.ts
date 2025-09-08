import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { TallyGraphQLClient } from '../graphql-client.js';

/**
 * Advanced tool for executing custom GraphQL queries against the Tally API
 * 
 * ADVANCED: Use other tools first - this is for complex custom queries only.
 * Requires knowledge of the Tally GraphQL schema.
 * 
 * Use cases:
 * - Complex queries not covered by other tools
 * - Custom data analysis and reporting
 * - Schema introspection
 */

/**
 * Registers the custom_query tool with an MCP server instance
 * 
 * @param server - The MCP server instance to register the tool with
 * @param graphqlClient - The Tally GraphQL client for making API calls
 */
export function registerCustomQueryTool(server: McpServer, graphqlClient: TallyGraphQLClient): void {
  server.tool(
    'custom_query',
    '[Advanced] Custom GraphQL query',
    {
      query: z.string().describe('GraphQL query string'),
      variables: z.record(z.any()).optional().describe('Optional variables for the GraphQL query'),
    },
    async ({ query, variables }): Promise<CallToolResult> => {
      try {
        if (!graphqlClient) {
          throw new Error('Server not properly initialized');
        }

        // Execute the arbitrary query
        const result = await graphqlClient.query(query, variables);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        // For validation errors and expected errors, throw them
        if (
          error instanceof Error &&
          (error.message.includes('GraphQL errors') ||
            error.message.includes('rate limit') ||
            error.message.includes('Invalid'))
        ) {
          throw error;
        }

        // For unexpected errors, return error object
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}