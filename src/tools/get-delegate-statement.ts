import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { TallyGraphQLClient } from '../graphql-client.js';
import { getDelegateStatement } from '../user-tools.js';

/**
 * Tool for getting delegate statement for a specific user and organization
 * 
 * This tool retrieves the delegate statement (mission, goals, policies) that
 * a delegate has published for a specific DAO/organization. This helps users
 * understand a delegate's platform and governance approach.
 */

/**
 * Registers the get_delegate_statement tool with an MCP server instance
 * 
 * @param server - The MCP server instance to register the tool with
 * @param graphqlClient - The Tally GraphQL client for making API calls
 */
export function registerGetDelegateStatementTool(server: McpServer, graphqlClient: TallyGraphQLClient): void {
  server.tool(
    'get_delegate_statement',
    'Get delegate statement for a specific user and organization',
    {
      address: z.string().describe('Ethereum address of the delegate (required)'),
      organizationId: z.string().describe('Organization ID (required)'),
    },
    async ({ address, organizationId }): Promise<CallToolResult> => {
      try {
        if (!graphqlClient) {
          throw new Error('Server not properly initialized');
        }
        const result = await getDelegateStatement(graphqlClient, { address, organizationId });
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