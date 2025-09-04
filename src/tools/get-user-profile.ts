import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { TallyGraphQLClient } from '../graphql-client.js';
import { getUserProfile } from '../user-tools.js';

/**
 * Tool for getting comprehensive user profile including user details and DAO participations
 * 
 * This tool provides complete user information with:
 * - User account details (name, bio, social links)
 * - DAO participation history
 * - Delegation information
 * - Voting activity statistics
 * - Pagination support for large participation lists
 */

/**
 * Registers the get_user_profile tool with an MCP server instance
 * 
 * @param server - The MCP server instance to register the tool with
 * @param graphqlClient - The Tally GraphQL client for making API calls
 */
export function registerGetUserProfileTool(server: McpServer, graphqlClient: TallyGraphQLClient): void {
  server.tool(
    'get_user_profile',
    'Get user profile and DAO activity',
    {
      address: z.string().describe('Ethereum address of the user (required)'),
      pageSize: z
        .number()
        .optional()
        .describe('Number of DAO participations per page (max: 100, default: 20)'),
    },
    async ({ address, pageSize }): Promise<CallToolResult> => {
      try {
        if (!graphqlClient) {
          throw new Error('Server not properly initialized');
        }
        const result = await getUserProfile(graphqlClient, { address, pageSize });
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
