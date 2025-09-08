import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { TallyGraphQLClient } from '../graphql-client.js';

/**
 * Tool for getting voters for a specific proposal with pagination and sorting
 * 
 * This tool provides comprehensive voter information with:
 * - Pagination support (limit, cursor)
 * - Sorting by voting power or vote order
 * - Vote types (for/against/abstain)
 * - ENS names and addresses
 * - Vote reasons when provided
 * - Human-readable token amounts
 * 
 * Based on tested GraphQL queries from development_log.md (2025-09-06)
 */

// Helper function to format wei to human-readable token amount
function formatTokenAmount(weiAmount: string, decimals: number = 18): string {
  try {
    const amount = BigInt(weiAmount);
    const divisor = BigInt(10 ** decimals);
    const wholePart = amount / divisor;
    const fractionalPart = amount % divisor;
    
    // Format with up to 4 decimal places
    const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    const significantFractional = fractionalStr.slice(0, 4);
    
    // Remove trailing zeros
    const trimmedFractional = significantFractional.replace(/0+$/, '');
    
    if (trimmedFractional === '') {
      return wholePart.toString();
    }
    
    return `${wholePart}.${trimmedFractional}`;
  } catch (error) {
    return weiAmount; // Return original if conversion fails
  }
}

/**
 * Registers the get_proposal_voters tool with an MCP server instance
 * 
 * @param server - The MCP server instance to register the tool with
 * @param graphqlClient - The Tally GraphQL client for making API calls
 */
export function registerGetProposalVotersTool(server: McpServer, graphqlClient: TallyGraphQLClient): void {
  server.tool(
    'get_proposal_voters',
    'Get voters for a proposal',
    {
      proposalId: z.string().describe('Proposal ID (required)'),
      limit: z.number().optional().describe('Number of voters to return (default: 20, max: 100)'),
      sortBy: z.enum(['amount', 'id']).optional().describe('Sort field: amount (voting power) or id (vote order) (default: amount)'),
      sortOrder: z.enum(['asc', 'desc']).optional().describe('Sort order: asc or desc (default: desc for amount, asc for id)'),
      cursor: z.string().optional().describe('Pagination cursor for next page'),
      voteType: z.enum(['for', 'against', 'abstain']).optional().describe('Filter by vote type'),
    },
    async ({
      proposalId,
      limit = 20,
      sortBy = 'amount',
      sortOrder,
      cursor,
      voteType,
    }): Promise<CallToolResult> => {
      try {
        if (!graphqlClient) {
          throw new Error('GraphQL client not properly initialized');
        }

        // Validate limit
        const validatedLimit = Math.min(Math.max(1, limit), 100);
        
        // Determine sort order (default desc for amount, asc for id)
        const isDescending = sortOrder ? sortOrder === 'desc' : sortBy === 'amount';

        // Build GraphQL query based on tested query from development_log.md
        const query = `
          query GetProposalVoters($proposalId: IntID!, $page: PageInput, $sort: VotesSortInput) {
            votes(input: {
              filters: {proposalId: $proposalId}, 
              page: $page, 
              sort: $sort
            }) {
              nodes {
                ... on OnchainVote {
                  id
                  voter { 
                    address 
                    ens 
                  }
                  amount
                  type
                  reason
                }
              }
              pageInfo {
                firstCursor
                lastCursor
              }
            }
          }
        `;

        // Build variables
        const variables: any = {
          proposalId,
          page: {
            limit: validatedLimit,
          },
          sort: {
            sortBy,
            isDescending,
          },
        };

        // Add cursor for pagination if provided
        if (cursor) {
          variables.page.afterCursor = cursor;
        }

        const result = await graphqlClient.query(query, variables);

        if (!result.votes) {
          throw new Error('Invalid response from Tally API');
        }

        // Process and filter voters
        let voters = result.votes.nodes
          .filter((vote: any) => vote && vote.voter) // Filter out null votes
          .map((vote: any) => ({
            id: vote.id,
            address: vote.voter.address,
            ens: vote.voter.ens,
            voteType: vote.type,
            votingPower: {
              raw: vote.amount,
              formatted: formatTokenAmount(vote.amount, 18),
              unit: 'tokens (18 decimals)',
            },
            reason: vote.reason || null,
          }));

        // Apply vote type filter if specified
        if (voteType) {
          voters = voters.filter((voter: any) => voter.voteType === voteType);
        }

        // Calculate vote statistics
        const voteStats = {
          totalVoters: voters.length,
          forVotes: voters.filter((v: any) => v.voteType === 'for').length,
          againstVotes: voters.filter((v: any) => v.voteType === 'against').length,
          abstainVotes: voters.filter((v: any) => v.voteType === 'abstain').length,
        };

        // Calculate total voting power by type
        const votingPowerByType = {
          for: voters
            .filter((v: any) => v.voteType === 'for')
            .reduce((sum: bigint, v: any) => sum + BigInt(v.votingPower.raw), BigInt(0)),
          against: voters
            .filter((v: any) => v.voteType === 'against')
            .reduce((sum: bigint, v: any) => sum + BigInt(v.votingPower.raw), BigInt(0)),
          abstain: voters
            .filter((v: any) => v.voteType === 'abstain')
            .reduce((sum: bigint, v: any) => sum + BigInt(v.votingPower.raw), BigInt(0)),
        };

        const response = {
          proposalId,
          voters,
          voteStats,
          votingPowerSummary: {
            for: formatTokenAmount(votingPowerByType.for.toString(), 18),
            against: formatTokenAmount(votingPowerByType.against.toString(), 18),
            abstain: formatTokenAmount(votingPowerByType.abstain.toString(), 18),
            total: formatTokenAmount(
              (votingPowerByType.for + votingPowerByType.against + votingPowerByType.abstain).toString(),
              18
            ),
            unit: 'tokens (18 decimals)',
          },
          pagination: {
            hasNextPage: !!result.votes.pageInfo?.lastCursor,
            nextCursor: result.votes.pageInfo?.lastCursor || null,
            limit: validatedLimit,
            sortBy,
            sortOrder: isDescending ? 'desc' : 'asc',
          },
          note: 'Vote amounts are in wei (10^-18 tokens). Use the formatted values for display.',
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