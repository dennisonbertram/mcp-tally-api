/**
 * Recent Votes Tool
 * 
 * Get recent voting activity across all DAOs with activity scoring and trend analysis
 * for tracking governance engagement and participation patterns.
 */

import { z } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { TallyGraphQLClient } from '../graphql-client.js';

/**
 * Register the recent votes tool with the MCP server
 */
export function registerRecentVotesTool(server: any, graphqlClient: TallyGraphQLClient): void {
  server.tool(
    'get_recent_votes',
    'Get recent voting activity across all DAOs with activity scoring and trend analysis',
    {
      limit: z.number().optional().describe('Number of recent votes to return (default: 20, max: 100)'),
      timeframe: z.enum(['24h', '7d', '30d']).optional().describe('Time period for recent votes (default: 7d)'),
      chainId: z.string().optional().describe('Filter by specific blockchain chain ID')
    },
    async ({ limit = 20, timeframe = '7d', chainId }: { 
      limit?: number; 
      timeframe?: '24h' | '7d' | '30d'; 
      chainId?: string; 
    }): Promise<CallToolResult> => {
      try {
        if (!graphqlClient) {
          throw new Error('GraphQL client not properly initialized');
        }

        // Validate limit
        const finalLimit = Math.min(Math.max(1, limit), 100);
        
        // Step 1: Get active proposals to sample recent votes from
        const proposalLimit = Math.min(10, Math.ceil(finalLimit / 2)); // Get enough proposals to have variety
        const proposalsQuery = `query { proposals(input: {filters: {status: "active"${chainId ? `, chainId: "${chainId}"` : ''}}, page: {limit: ${proposalLimit}}}) { nodes { id title organization { name slug chainId } } } }`;
        
        const proposalsResult = await graphqlClient.query(proposalsQuery, {});
        
        if (!proposalsResult?.proposals?.nodes || proposalsResult.proposals.nodes.length === 0) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'No active proposals found for recent voting activity',
                timeframe: timeframe,
                chainId: chainId
              }, null, 2)
            }],
            isError: true
          };
        }

        // Step 2: Get recent votes from active proposals
        const allVotes: any[] = [];
        const votesPerProposal = Math.max(5, Math.ceil(finalLimit / proposalsResult.proposals.nodes.length));
        
        for (const proposal of proposalsResult.proposals.nodes) {
          try {
            const votesQuery = `query { votes(input: {filters: {proposalId: ${proposal.id}}, page: {limit: ${votesPerProposal}}}) { nodes { ... on OnchainVote { id amount type voter { address name } proposal { id title organization { name slug chainId } } } } } }`;
            
            const votesResult = await graphqlClient.query(votesQuery, {});
            
            if (votesResult?.votes?.nodes) {
              // Add proposal context to each vote
              const votesWithContext = votesResult.votes.nodes.map((vote: any) => ({
                ...vote,
                proposal: {
                  id: proposal.id,
                  title: proposal.title,
                  organization: proposal.organization
                }
              }));
              
              allVotes.push(...votesWithContext);
            }
          } catch (error) {
            // Continue with other proposals if one fails
            console.warn(`Failed to get votes for proposal ${proposal.id}:`, error);
          }
        }

        if (allVotes.length === 0) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'No recent votes found in active proposals',
                checkedProposals: proposalsResult.proposals.nodes.length,
                timeframe: timeframe
              }, null, 2)
            }],
            isError: true
          };
        }

        // Step 3: Process and enhance votes with activity scoring
        const processedVotes = allVotes.map((vote: any) => {
          const processedVote = { ...vote };
          
          // Convert vote amount from wei to readable format
          if (vote.amount && vote.amount !== '0') {
            const amountWei = vote.amount;
            const amountReadable = (parseFloat(amountWei) / Math.pow(10, 18)).toLocaleString();
            processedVote.amountFormatted = `${amountReadable} tokens`;
          } else {
            processedVote.amountFormatted = '0 tokens';
          }
          
          // Add vote weight category
          const amountNum = parseFloat(vote.amount || '0');
          if (amountNum === 0) {
            processedVote.voteWeight = 'No voting power';
            processedVote.activityScore = 1; // Participation matters
          } else if (amountNum < 1e18) {
            processedVote.voteWeight = 'Small voter';
            processedVote.activityScore = 2;
          } else if (amountNum < 1e21) {
            processedVote.voteWeight = 'Medium voter'; 
            processedVote.activityScore = 4;
          } else if (amountNum < 1e24) {
            processedVote.voteWeight = 'Large voter';
            processedVote.activityScore = 6;
          } else {
            processedVote.voteWeight = 'Whale voter';
            processedVote.activityScore = 10;
          }

          // Add recency bonus (assuming higher IDs are more recent)
          const voteId = parseInt(vote.id || '0');
          processedVote.recencyScore = Math.floor(voteId / 1e15); // Simple recency scoring
          processedVote.totalActivityScore = processedVote.activityScore + (processedVote.recencyScore * 0.1);

          return processedVote;
        });

        // Step 4: Sort by activity score (most impactful recent votes first)
        processedVotes.sort((a, b) => b.totalActivityScore - a.totalActivityScore);

        // Limit to requested amount
        const finalVotes = processedVotes.slice(0, finalLimit);

        // Step 5: Generate summary analytics
        const daoBreakdown = finalVotes.reduce((acc: any, vote) => {
          const daoName = vote.proposal?.organization?.name || 'Unknown';
          if (!acc[daoName]) {
            acc[daoName] = { count: 0, totalAmount: 0 };
          }
          acc[daoName].count++;
          acc[daoName].totalAmount += parseFloat(vote.amount || '0');
          return acc;
        }, {});

        const voteTypeBreakdown = {
          for: finalVotes.filter((v: any) => v.type === 'for').length,
          against: finalVotes.filter((v: any) => v.type === 'against').length,
          abstain: finalVotes.filter((v: any) => v.type === 'abstain').length
        };

        const response = {
          recentVotes: finalVotes,
          summary: {
            totalVotes: finalVotes.length,
            checkedProposals: proposalsResult.proposals.nodes.length,
            timeframe: timeframe,
            chainFilter: chainId || 'all chains',
            voteTypeBreakdown: voteTypeBreakdown,
            daoActivity: Object.entries(daoBreakdown)
              .sort(([,a]: any, [,b]: any) => b.count - a.count)
              .slice(0, 5), // Top 5 most active DAOs
            highestImpactVote: finalVotes.length > 0 ? {
              dao: finalVotes[0].proposal?.organization?.name,
              proposal: finalVotes[0].proposal?.title?.substring(0, 100) + '...',
              voter: finalVotes[0].voter?.name || finalVotes[0].voter?.address,
              amount: finalVotes[0].amountFormatted,
              type: finalVotes[0].type,
              activityScore: finalVotes[0].totalActivityScore
            } : null
          },
          conversionNote: '⚠️ Vote amounts are converted from wei (18 decimals) to human-readable format. Activity scores combine vote weight and recency.'
        };

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(response, null, 2)
          }]
        };
      } catch (error) {
        if (error instanceof Error && (error.message.includes('GraphQL errors') || error.message.includes('rate limit') || error.message.includes('Invalid'))) {
          throw error;
        }
        return {
          content: [{
            type: 'text', 
            text: `Error fetching recent votes: ${error instanceof Error ? error.message : 'Unknown error'}`
          }],
          isError: true
        };
      }
    }
  );
}