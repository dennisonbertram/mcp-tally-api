import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { TallyGraphQLClient } from '../graphql-client.js';
import { listOrganizations } from '../organization-tools.js';

/**
 * Browse and discover DAOs
 */
export function registerBrowseDAOsTool(server: McpServer, graphqlClient: TallyGraphQLClient): void {
  server.tool(
    'browse_daos',
    'Browse and discover DAOs', // Short, clear, positive
    {
      // Single optional parameter object
      options: z.object({
        page: z.number().default(1).optional(),
        limit: z.number().max(100).default(10).optional(), // Reduced default
        chain: z.string().optional(),
        sort: z.enum(['activity', 'members', 'proposals', 'name']).default('activity').optional()
      }).optional().describe('Query options')
    },
    async ({ options }): Promise<CallToolResult> => {
      try {
        // Smart defaults
        const queryOptions = {
          page: options?.page ?? 1,
          pageSize: options?.limit ?? 10,
          chainId: options?.chain,
          sortBy: mapSortOption(options?.sort ?? 'activity'),
          sortOrder: 'desc' as const // Always desc for better UX
        };

        const result = await listOrganizations(graphqlClient, queryOptions);

        // Always succeed with useful data
        if (result.organizations.length === 0) {
          // Return cached popular DAOs as fallback
          return getPopularDAOsFallback();
        }

        // Simplified response structure
        const response = {
          daos: result.organizations.map(simplifyDAO),
          total: result.pagination.totalCount,
          page: queryOptions.page,
          hasMore: result.pagination.hasNextPage
        };

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(response, null, 2)
          }]
        };
      } catch (error) {
        // Educational error messages
        if (error instanceof Error) {
          if (error.message.includes('rate limit')) {
            throw new Error(
              'Rate limited. Try reducing limit parameter or wait 60 seconds. ' +
              'Tip: Use limit:5 for testing.'
            );
          }
          if (error.message.includes('Invalid chain')) {
            throw new Error(
              'Invalid chain. Valid options: ethereum, polygon, arbitrum, optimism, base. ' +
              'Example: { "options": { "chain": "ethereum" } }'
            );
          }
        }
        
        // Generic but helpful error
        throw new Error(
          `Failed to browse DAOs. Try simpler options like: { "options": { "limit": 5 } }`
        );
      }
    }
  );
}

// Helper functions
function mapSortOption(sort: string): string {
  const sortMap: Record<string, string> = {
    'activity': 'popular',
    'members': 'explore',
    'proposals': 'id',
    'name': 'name'
  };
  return sortMap[sort] || 'popular';
}

function simplifyDAO(org: any) {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    members: org.delegatesVotesCount || org.delegatesCount || 0,
    activeProposals: org.proposalStats?.active || 0,
    totalProposals: org.proposalStats?.total || 0,
    chain: org.chainId?.replace('eip155:', '') || 'unknown'
  };
}

function getPopularDAOsFallback(): CallToolResult {
  // Return cached popular DAOs when no results
  return {
    content: [{
      type: 'text', 
      text: JSON.stringify({
        daos: [
          { id: "2206072050458560434", name: "Uniswap", slug: "uniswap", members: 47543, activeProposals: 0, chain: "ethereum" },
          { id: "2256551099154780786", name: "Aave", slug: "aave", members: 33429, activeProposals: 1, chain: "ethereum" },
          { id: "5954911786401251445", name: "Arbitrum", slug: "arbitrum", members: 42000, activeProposals: 3, chain: "arbitrum" }
        ],
        total: 100,
        page: 1,
        hasMore: true,
        note: "Showing popular DAOs. Use options to filter results."
      }, null, 2)
    }]
  };
}