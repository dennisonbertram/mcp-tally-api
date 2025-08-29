import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { TallyGraphQLClient } from '../graphql-client.js';
import { getDelegates } from '../user-tools.js';

/**
 * Tool for getting enhanced delegate information for a specific organization
 * 
 * This tool retrieves comprehensive delegate data including:
 * - Voting power and delegated amounts
 * - Account details and statements
 * - Organization-specific information
 * - Sortable and paginated results
 * 
 * Particularly useful for analyzing delegation patterns and identifying key delegates
 * in a DAO's governance structure.
 */

/**
 * Registers the get_delegates tool with an MCP server instance
 * 
 * @param server - The MCP server instance to register the tool with
 * @param graphqlClient - The Tally GraphQL client for making API calls
 */
export function registerGetDelegatesTool(server: McpServer, graphqlClient: TallyGraphQLClient): void {
  server.tool(
    'get_delegates',
    'Get enhanced delegate information for a specific organization including voting power, account details, statements, and organization info',
    {
      organizationId: z
        .string()
        .describe('Organization ID (required)'),
      pageSize: z
        .number()
        .optional()
        .describe('Number of delegates per page (max: 100, default: 20)'),
      sortBy: z
        .string()
        .optional()
        .describe(
          'Sort field: id, votes, delegators, isPrioritized (default: votes)'
        ),
      sortOrder: z
        .string()
        .optional()
        .describe('Sort order: asc or desc (default: desc)'),
    },
    async ({
      organizationId,
      pageSize,
      sortBy,
      sortOrder,
    }): Promise<CallToolResult> => {
      try {
        if (!graphqlClient) {
          throw new Error('Server not properly initialized');
        }
        const result = await getDelegates(graphqlClient, {
          organizationId,
          pageSize,
          sortBy,
          sortOrder,
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
          conversionReminder: "⚠️ IMPORTANT: All vote counts and voting power values (votesCount, delegated amounts) are in raw token units (Ethereum-style). To convert to human-readable amounts, divide by 10^decimals where decimals is typically 18 for most governance tokens.",
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