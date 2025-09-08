import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { TallyGraphQLClient } from '../graphql-client.js';
import { listOrganizations } from '../organization-tools.js';

/**
 * Tool for listing organizations with pagination, filtering, and sorting options
 * 
 * This tool provides comprehensive organization listing with:
 * - Pagination support (page, pageSize)
 * - Chain ID filtering
 * - Logo presence filtering
 * - Sorting by various fields (id, name, explore, popular)
 * - Sort order control (asc/desc)
 * - Proposal statistics transformation
 */

/**
 * Registers the list_organizations tool with an MCP server instance
 * 
 * @param server - The MCP server instance to register the tool with
 * @param graphqlClient - The Tally GraphQL client for making API calls
 */
export function registerListOrganizationsTool(server: McpServer, graphqlClient: TallyGraphQLClient): void {
  server.tool(
    'list_organizations',
    'Browse and discover DAOs',
    {
      page: z.number().optional().describe('Page number (default: 1)'),
      pageSize: z
        .number()
        .optional()
        .describe('Number of organizations per page (max: 100, default: 20)'),
      chainId: z
        .string()
        .optional()
        .describe(
          'Filter by blockchain chain ID (e.g., "eip155:1" for Ethereum mainnet)'
        ),
      hasLogo: z
        .boolean()
        .optional()
        .describe('Filter by whether organization has a logo'),
      sortBy: z
        .string()
        .optional()
        .describe(
          'Sort field: id (date), name, explore (by activity), popular (default: name)'
        ),
      sortOrder: z
        .string()
        .optional()
        .describe('Sort order: asc or desc (default: asc)'),
    },
    async (args): Promise<CallToolResult> => {
      try {
        if (!graphqlClient) {
          throw new Error('GraphQL client not properly initialized');
        }
        
        const result = await listOrganizations(graphqlClient, {
          page: args.page,
          pageSize: args.pageSize,
          chainId: args.chainId,
          hasLogo: args.hasLogo,
          sortBy: args.sortBy as any,
          sortOrder: args.sortOrder as any,
        });

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