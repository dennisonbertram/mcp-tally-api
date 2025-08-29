import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { TallyGraphQLClient } from '../graphql-client.js';
import { getOrganizationsWithActiveProposals } from '../organization-tools.js';

/**
 * Tool for getting organizations that have active proposals with filtering options
 * 
 * This tool provides comprehensive organization filtering with:
 * - Minimum active proposals threshold
 * - Chain ID filtering
 * - Pagination support (page, pageSize)
 * - Data transformation for compatibility
 */

/**
 * Registers the get_organizations_with_active_proposals tool with an MCP server instance
 * 
 * @param server - The MCP server instance to register the tool with
 * @param graphqlClient - The Tally GraphQL client for making API calls
 */
export function registerGetOrganizationsWithActiveProposalsTool(server: McpServer, graphqlClient: TallyGraphQLClient): void {
  server.tool(
    'get_organizations_with_active_proposals',
    'Get organizations that have active proposals with filtering options',
    {
      minActiveProposals: z
        .number()
        .optional()
        .describe('Minimum number of active proposals (default: 1)'),
      chainId: z.string().optional().describe('Filter by chain ID'),
      page: z.number().optional().describe('Page number (default: 1)'),
      pageSize: z
        .number()
        .optional()
        .describe('Number of organizations per page (max: 100, default: 20)'),
    },
    async ({
      minActiveProposals,
      chainId,
      page,
      pageSize,
    }): Promise<CallToolResult> => {
      try {
        if (!graphqlClient) {
          throw new Error('Server not properly initialized');
        }
        const result = await getOrganizationsWithActiveProposals(
          graphqlClient,
          {
            page,
            pageSize,
            minActiveProposals,
            chainId,
          }
        );

        // Transform to expected structure
        const response = {
          items: result.organizations.map((org) => ({
            ...org,
            chainIds: [org.chainId], // Convert single chainId to array
            proposalCount: org.proposalStats.total,
            hasActiveProposals: org.proposalStats.active > 0,
          })),
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