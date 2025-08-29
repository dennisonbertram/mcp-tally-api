import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { TallyGraphQLClient } from '../graphql-client.js';

/**
 * Tool for executing arbitrary GraphQL queries against the Tally API
 * 
 * This is an advanced tool that allows users to run custom GraphQL queries
 * directly against the Tally API. It's useful for:
 * - Complex queries not covered by other tools
 * - Debugging and exploration of the API
 * - Custom data analysis and reporting
 * - Schema introspection queries
 * 
 * Users should be familiar with the Tally GraphQL schema to use this tool effectively.
 */

/**
 * Registers the execute_graphql_query tool with an MCP server instance
 * 
 * @param server - The MCP server instance to register the tool with
 * @param graphqlClient - The Tally GraphQL client for making API calls
 */
export function registerExecuteGraphQLQueryTool(server: McpServer, graphqlClient: TallyGraphQLClient): void {
  server.tool(
    'execute_graphql_query',
    'Execute an arbitrary GraphQL query against the Tally API',
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