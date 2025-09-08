import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { TallyGraphQLClient } from '../graphql-client.js';
import { getOrganization } from '../organization-tools.js';

/**
 * Tool for getting detailed information about a specific organization by ID or slug
 * 
 * This tool provides comprehensive organization details with:
 * - Support for both organizationId and organizationSlug parameters
 * - Complete organization metadata (name, description, website, social links)
 * - Chain ID transformation to chainIds array format
 * - Proposal statistics (total count, active status)
 * - Timelock and safe address information
 * - Token conversion reminder for proper vote interpretation
 */

/**
 * Registers the get_organization tool with an MCP server instance
 * 
 * @param server - The MCP server instance to register the tool with
 * @param graphqlClient - The Tally GraphQL client for making API calls
 */
export function registerGetOrganizationTool(server: McpServer, graphqlClient: TallyGraphQLClient): void {
  server.tool(
    'get_organization',
    'Get DAO details',
    {
      organizationId: z
        .string()
        .optional()
        .describe('Organization ID (use either this or organizationSlug)'),
      organizationSlug: z
        .string()
        .optional()
        .describe('Organization slug (use either this or organizationId)'),
    },
    async ({ organizationId, organizationSlug }): Promise<CallToolResult> => {
      try {
        if (!graphqlClient) {
          throw new Error('Server not properly initialized');
        }
        const result = await getOrganization(graphqlClient, {
          organizationId,
          organizationSlug,
        });

        if (!result) {
          throw new Error('Organization not found');
        }

        // Transform to include all expected fields
        const response = {
          id: result.id,
          name: result.name,
          slug: result.slug,
          chainIds: [result.chainId], // Convert single chainId to array
          memberCount: result.memberCount,
          proposalCount: result.proposalStats.total,
          hasActiveProposals: result.proposalStats.active > 0,
          description: result.description,
          website: result.website,
          twitter: result.twitter,
          github: result.github,
          timelocks: result.timelocks, // Include timelock information
          safes: result.safes, // Include safe addresses
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