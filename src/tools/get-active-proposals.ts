import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { TallyGraphQLClient } from '../graphql-client.js';
import { getActiveProposals } from '../proposal-tools.js';

/**
 * Tool for getting votable proposals (active or extended status)
 * 
 * This tool provides proposals where users can currently vote with:
 * - Cross-organizational query support (with limitations)
 * - Organization-specific filtering (strongly recommended)
 * - Chain ID filtering
 * - Pagination support
 * - Vote count conversion reminder
 * 
 * IMPORTANT: The Tally API does NOT support efficient cross-organizational queries 
 * without organizationId. For reliable results, ALWAYS specify organizationId when possible.
 */

/**
 * Registers the get_active_proposals tool with an MCP server instance
 * 
 * @param server - The MCP server instance to register the tool with
 * @param graphqlClient - The Tally GraphQL client for making API calls
 */
export function registerGetActiveProposalsTool(server: McpServer, graphqlClient: TallyGraphQLClient): void {
  server.tool(
    'get_active_proposals',
    'Get active votable proposals',
    {
      page: z.number().optional().describe('Page number (default: 1)'),
      pageSize: z
        .number()
        .optional()
        .describe('Number of proposals per page (max: 100, default: 20)'),
      chainId: z.string().optional().describe('Filter by chain ID'),
      organizationId: z
        .string()
        .optional()
        .describe('Filter by organization ID (recommended for best results)'),
    },
    async (args): Promise<CallToolResult> => {
      try {
        if (!graphqlClient) {
          throw new Error('Server not properly initialized');
        }
        const result = await getActiveProposals(graphqlClient, {
          page: args.page,
          pageSize: args.pageSize,
          chainId: args.chainId,
          organizationId: args.organizationId,
        });

        // Transform to expected structure
        const response = {
          items: result.proposals,
          totalCount: result.pagination.totalCount,
          pageInfo: {
            hasNextPage: result.pagination.hasNextPage,
            hasPreviousPage: result.pagination.hasPreviousPage,
            startCursor: undefined,
            endCursor: undefined,
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
