import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { TallyGraphQLClient } from '../graphql-client.js';
import { getDAOParticipants } from '../user-tools.js';

/**
 * Tool for getting participants of a specific DAO with pagination, filtering, and sorting
 * 
 * This tool retrieves the list of participants (users who have interacted with the DAO)
 * including their voting power, delegation status, and participation metrics.
 * Supports pagination for large DAOs with many participants.
 */

/**
 * Registers the get_dao_participants tool with an MCP server instance
 * 
 * @param server - The MCP server instance to register the tool with
 * @param graphqlClient - The Tally GraphQL client for making API calls
 */
export function registerGetDAOParticipantsTool(server: McpServer, graphqlClient: TallyGraphQLClient): void {
  server.tool(
    'get_dao_participants',
    'List DAO participants',
    {
      organizationId: z
        .string()
        .describe('Organization ID (required)'),
      pageSize: z
        .number()
        .optional()
        .describe('Number of participants per page (max: 100, default: 20)'),
    },
    async ({
      organizationId,
      pageSize,
    }): Promise<CallToolResult> => {
      try {
        if (!graphqlClient) {
          throw new Error('Server not properly initialized');
        }
        const result = await getDAOParticipants(graphqlClient, {
          organizationId,
          pageSize,
        });

        // Transform to expected structure
        const response = {
          items: result?.items || [],
          totalCount: result?.totalCount || 0,
          pageInfo: {
            hasNextPage: result?.pageInfo.hasNextPage || false,
            hasPreviousPage: result?.pageInfo.hasPreviousPage || false,
            startCursor: result?.pageInfo.startCursor,
            endCursor: result?.pageInfo.endCursor,
          },
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response, null, 2),
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