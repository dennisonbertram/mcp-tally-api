/**
 * Trending Proposals Resource Template
 * 
 * Provides human-readable markdown overviews of active proposals across all DAOs via tally://trending/proposals
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import { TallyGraphQLClient } from '../graphql-client.js';
import { getActiveProposals } from '../proposal-tools.js';

export interface TrendingProposalsOverview {
  uri: string;
  mimeType: string;
  text: string;
}

/**
 * Generate a markdown overview for trending/active proposals
 */
export async function getTrendingProposalsOverview(
  graphqlClient: TallyGraphQLClient
): Promise<TrendingProposalsOverview> {
  try {
    // Get active proposals across all DAOs
    const activeProposalsData = await getActiveProposals(graphqlClient, { pageSize: 20 });
    
    if (!activeProposalsData || !activeProposalsData.proposals) {
      throw new Error('No active proposals data available');
    }

    // Generate markdown content
    const markdown = generateTrendingProposalsMarkdown(activeProposalsData);
    
    return {
      uri: 'tally://trending/proposals',
      mimeType: 'text/markdown',
      text: markdown
    };
  } catch (error) {
    // Return error as markdown
    return {
      uri: 'tally://trending/proposals',
      mimeType: 'text/markdown',
      text: `# Error Loading Trending Proposals\n\n**Error:** ${error instanceof Error ? error.message : 'Unknown error'}\n\n*Unable to fetch active governance activity*`
    };
  }
}

/**
 * Generate markdown content for trending proposals
 */
function generateTrendingProposalsMarkdown(data: any): string {
  const sections: string[] = [];
  const proposals = data.proposals || [];
  
  // Header
  sections.push('# 🔥 Trending Governance Activity');
  sections.push('');
  sections.push(`**${proposals.length} Active Proposal(s) Across All DAOs**`);
  sections.push('');
  
  if (proposals.length === 0) {
    sections.push('*No active proposals found at this time.*');
    sections.push('');
    sections.push('Check back later for ongoing governance activity!');
    sections.push('');
  } else {
    // Group proposals by organization
    const proposalsByOrg = groupProposalsByOrganization(proposals);
    
    // Summary stats
    const orgCount = Object.keys(proposalsByOrg).length;
    sections.push(`## 📊 Activity Summary`);
    sections.push('');
    sections.push(`- **Active DAOs:** ${orgCount}`);
    sections.push(`- **Total Active Proposals:** ${proposals.length}`);
    sections.push('');
    
    // List proposals by organization
    sections.push('## 🏛️ Active Proposals by DAO');
    sections.push('');
    
    Object.entries(proposalsByOrg).forEach(([orgName, orgProposals]: [string, any[]]) => {
      sections.push(`### ${orgName} (${orgProposals.length} proposal${orgProposals.length > 1 ? 's' : ''})`);
      sections.push('');
      
      orgProposals.forEach((proposal) => {
        const statusEmoji = getStatusEmoji(proposal.status);
        const title = proposal.metadata?.title || proposal.title || 'Untitled Proposal';
        const truncatedTitle = title.length > 80 ? title.substring(0, 80) + '...' : title;
        
        sections.push(`#### ${statusEmoji} ${truncatedTitle}`);
        sections.push('');
        
        if (proposal.endTime) {
          sections.push(`- **Voting Ends:** ${formatDate(proposal.endTime)}`);
        }
        
        if (proposal.votingStats) {
          const stats = proposal.votingStats;
          if (stats.total !== undefined && stats.total > 0) {
            sections.push(`- **Total Votes:** ${formatVotes(stats.total)}`);
          }
        }
        
        if (proposal.proposer?.address) {
          sections.push(`- **Proposer:** \`${proposal.proposer.address.substring(0, 10)}...\``);
        }
        
        sections.push('');
      });
    });
    
    // Call to action
    sections.push('## 🗳️ Get Involved');
    sections.push('');
    sections.push('These proposals are currently accepting votes! Visit the respective DAO platforms to participate in governance.');
    sections.push('');
  }
  
  // Footer
  sections.push('---');
  sections.push(`*Data from Tally API • Updated: ${new Date().toLocaleString()}*`);
  
  return sections.join('\n');
}

/**
 * Group proposals by organization name
 */
function groupProposalsByOrganization(proposals: any[]): Record<string, any[]> {
  const grouped: Record<string, any[]> = {};
  
  proposals.forEach((proposal) => {
    const orgName = proposal.organization?.name || 'Unknown DAO';
    if (!grouped[orgName]) {
      grouped[orgName] = [];
    }
    grouped[orgName].push(proposal);
  });
  
  // Sort organizations by number of proposals (descending)
  const sortedEntries = Object.entries(grouped).sort(([, a], [, b]) => b.length - a.length);
  const sortedGrouped: Record<string, any[]> = {};
  sortedEntries.forEach(([orgName, orgProposals]) => {
    sortedGrouped[orgName] = orgProposals;
  });
  
  return sortedGrouped;
}

/**
 * Get emoji for proposal status
 */
function getStatusEmoji(status: string): string {
  switch (status?.toLowerCase()) {
    case 'active':
    case 'voting':
      return '🗳️';
    case 'passed':
    case 'succeeded':
      return '✅';
    case 'failed':
    case 'defeated':
      return '❌';
    case 'executed':
      return '⚡';
    case 'queued':
      return '⏳';
    case 'pending':
      return '🔄';
    case 'canceled':
    case 'cancelled':
      return '🚫';
    default:
      return '📋';
  }
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Tomorrow';
    } else if (diffDays > 0) {
      return `In ${diffDays} day${diffDays > 1 ? 's' : ''}`;
    } else {
      return 'Ended';
    }
  } catch {
    return dateString;
  }
}

/**
 * Format vote counts for display
 */
function formatVotes(votes: number | string): string {
  const num = typeof votes === 'string' ? parseFloat(votes) : votes;
  if (isNaN(num)) return votes.toString();
  
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  } else {
    return num.toLocaleString();
  }
}

/**
 * Register the trending proposals resource with the MCP server
 * 
 * @param server - The McpServer instance to register the resource with
 * @param graphqlClient - The TallyGraphQLClient instance for API access
 */
export function registerTrendingProposalsResource(server: McpServer, graphqlClient: TallyGraphQLClient): void {
  server.resource(
    'trending-proposals',
    'tally://trending/proposals',
    { mimeType: 'text/markdown' },
    async (): Promise<ReadResourceResult> => {
      if (!graphqlClient) {
        throw new Error('Server not properly initialized');
      }
      
      const response = await getTrendingProposalsOverview(graphqlClient);

      return {
        contents: [
          {
            uri: response.uri,
            mimeType: response.mimeType,
            text: response.text,
          },
        ],
      };
    }
  );
} 