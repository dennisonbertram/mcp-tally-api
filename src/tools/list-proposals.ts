import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { TallyGraphQLClient } from '../graphql-client.js';
import { listProposals } from '../proposal-tools.js';

/**
 * Tool for listing proposals for a specific organization with pagination, filtering, and sorting
 * 
 * This tool provides comprehensive proposal listing with:
 * - Pagination support (page, pageSize)
 * - Organization ID filtering (required)
 * - Governor contract ID filtering
 * - Proposer address filtering
 * - Sort order control (asc/desc)
 * - Proposal status and metadata transformation
 * - Token unit conversion reminders
 */

/**
 * Registers the list_proposals tool with an MCP server instance
 * 
 * @param server - The MCP server instance to register the tool with
 * @param graphqlClient - The Tally GraphQL client for making API calls
 */
export function registerListProposalsTool(server: McpServer, graphqlClient: TallyGraphQLClient): void {
  server.tool(
    'list_proposals',
    'List DAO proposals',
    {
      organizationId: z.string().describe('Organization ID (required)'),
      page: z.number().optional().describe('Page number (default: 1)'),
      pageSize: z
        .number()
        .optional()
        .describe('Number of proposals per page (max: 100, default: 20)'),
      governorId: z
        .string()
        .optional()
        .describe('Filter by governor contract ID'),
      proposer: z.string().optional().describe('Filter by proposer address'),
      sortOrder: z
        .string()
        .optional()
        .describe('Sort order: asc or desc (default: desc)'),
    },
    async (args): Promise<CallToolResult> => {
      try {
        if (!graphqlClient) {
          throw new Error('GraphQL client not properly initialized');
        }
        
        const result = await listProposals(graphqlClient, {
          organizationId: args.organizationId,
          page: args.page,
          pageSize: args.pageSize,
          governorId: args.governorId,
          proposer: args.proposer,
          isDraft: false, // Always exclude drafts
          includeArchived: false, // Always exclude archived drafts
          sortOrder: args.sortOrder as any,
        });

        // Transform to expected structure
        const response = {
          items: result.proposals.map((proposal) => ({
            id: proposal.id,
            onchainId: proposal.id, // Use id as onchainId if not available
            status: proposal.status,
            metadata: {
              title: proposal.title,
              description: proposal.description,
            },
            organization: proposal.organization || {
              name: 'Unknown',
              slug: 'unknown',
            },
            proposer: proposal.proposer,
            votingStats: proposal.votingStats,
            startTime: proposal.startTime,
            endTime: proposal.endTime,
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