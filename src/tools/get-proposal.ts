import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { TallyGraphQLClient } from '../graphql-client.js';
import { getProposal } from '../proposal-tools.js';

/**
 * Tool for getting detailed information about a specific proposal
 * 
 * This tool provides comprehensive proposal details with:
 * - Support for both organizationId and organizationSlug parameters
 * - Complete proposal metadata (title, description, status)
 * - Voting statistics with raw token unit reminder
 * - Timeline information (start/end times)
 * - Execution details and actions
 * - Timelock operations and analysis
 * - Token information with decimal conversion guidance
 */

/**
 * Registers the get_proposal tool with an MCP server instance
 * 
 * @param server - The MCP server instance to register the tool with
 * @param graphqlClient - The Tally GraphQL client for making API calls
 */
export function registerGetProposalTool(server: McpServer, graphqlClient: TallyGraphQLClient): void {
  server.tool(
    'get_proposal',
    'Get detailed information about a specific proposal',
    {
      organizationId: z
        .string()
        .optional()
        .describe('Organization ID (use either this or organizationSlug)'),
      organizationSlug: z
        .string()
        .optional()
        .describe('Organization slug (use either this or organizationId)'),
      proposalId: z.string().describe('Proposal ID (required)'),
    },
    async ({
      organizationId,
      organizationSlug,
      proposalId,
    }): Promise<CallToolResult> => {
      try {
        if (!graphqlClient) {
          throw new Error('Server not properly initialized');
        }
        const result = await getProposal(graphqlClient, {
          organizationId,
          organizationSlug,
          proposalId,
        });

        if (!result) {
          throw new Error('Proposal not found');
        }

        // Transform to expected structure
        const response = {
          id: result.id,
          onchainId: result.id, // Use id as onchainId if not available
          status: result.status,
          metadata: {
            title: result.title,
            description: result.description,
          },
          organization: {
            name: result.organization?.name || 'Unknown',
            slug: result.organization?.slug || 'unknown',
          },
          proposer: result.proposer,
          votingStats: result.votingStats,
          startTime: result.startTime,
          endTime: result.endTime,
          executionDetails: result.executionDetails,
          actions: result.actions,
          executableCalls: result.executableCalls, // Include detailed executable calls
          timelockOperations: result.timelockOperations, // Include timelock analysis
          timelockSummary: result.timelockSummary, // Include timelock summary
          tokenInfo: result.tokenInfo, // Include token information with conversion note
          conversionReminder: "⚠️ IMPORTANT: All vote counts (yesVotes, noVotes, abstainVotes, totalVotes) are in raw token units (Ethereum-style). To convert to human-readable amounts, divide by 10^decimals where decimals is typically 18 for most governance tokens.",
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
