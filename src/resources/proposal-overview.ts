/**
 * Proposal Overview Resource Template
 * 
 * Provides human-readable markdown overviews of proposals via tally://org/{organizationId}/proposal/{proposalId}
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import { TallyGraphQLClient } from '../graphql-client.js';
import { getProposal } from '../proposal-tools.js';

export interface ProposalOverview {
  uri: string;
  mimeType: string;
  text: string;
}

/**
 * Generate a markdown overview for a proposal
 */
export async function getProposalOverview(
  graphqlClient: TallyGraphQLClient,
  organizationId: string,
  proposalId: string
): Promise<ProposalOverview> {
  try {
    // Use existing proposal tool to get data
    const proposal = await getProposal(graphqlClient, { organizationId, proposalId });
    
    if (!proposal) {
      throw new Error(`Proposal with ID ${proposalId} not found in organization ${organizationId}`);
    }

    // Generate markdown content
    const markdown = generateProposalMarkdown(proposal, organizationId, proposalId);
    
    return {
      uri: `tally://org/${organizationId}/proposal/${proposalId}`,
      mimeType: 'text/markdown',
      text: markdown
    };
  } catch (error) {
    // Return error as markdown
    return {
      uri: `tally://org/${organizationId}/proposal/${proposalId}`,
      mimeType: 'text/markdown',
      text: `# Error Loading Proposal\n\n**Error:** ${error instanceof Error ? error.message : 'Unknown error'}\n\n*Organization ID: ${organizationId} • Proposal ID: ${proposalId}*`
    };
  }
}

/**
 * Generate markdown content for a proposal
 */
function generateProposalMarkdown(proposal: any, organizationId: string, proposalId: string): string {
  const sections: string[] = [];
  
  // Header with status indicator
  const statusEmoji = getStatusEmoji(proposal.status);
  sections.push(`# ${statusEmoji} ${proposal.metadata?.title || proposal.title || 'Untitled Proposal'}`);
  sections.push('');
  
  // Organization info
  if (proposal.organization?.name) {
    sections.push(`**Organization:** ${proposal.organization.name}`);
    sections.push('');
  }
  
  // Status and timing
  sections.push('## 📋 Proposal Details');
  sections.push('');
  sections.push(`- **Status:** ${formatStatus(proposal.status)}`);
  sections.push(`- **Proposal ID:** ${proposalId}`);
  
  if (proposal.proposer?.address) {
    sections.push(`- **Proposer:** \`${proposal.proposer.address}\``);
  }
  
  if (proposal.startTime) {
    sections.push(`- **Start Time:** ${formatDate(proposal.startTime)}`);
  }
  
  if (proposal.endTime) {
    sections.push(`- **End Time:** ${formatDate(proposal.endTime)}`);
  }
  sections.push('');
  
  // Description
  if (proposal.metadata?.description || proposal.description) {
    sections.push('## 📄 Description');
    sections.push('');
    const description = proposal.metadata?.description || proposal.description;
    // Truncate very long descriptions
    const truncatedDesc = description.length > 500 
      ? description.substring(0, 500) + '...' 
      : description;
    sections.push(truncatedDesc);
    sections.push('');
  }
  
  // Voting statistics
  if (proposal.votingStats) {
    sections.push('## 🗳️ Voting Results');
    sections.push('');
    
    const stats = proposal.votingStats;
    if (stats.for !== undefined) sections.push(`- **For:** ${formatVotes(stats.for)}`);
    if (stats.against !== undefined) sections.push(`- **Against:** ${formatVotes(stats.against)}`);
    if (stats.abstain !== undefined) sections.push(`- **Abstain:** ${formatVotes(stats.abstain)}`);
    if (stats.total !== undefined) sections.push(`- **Total Votes:** ${formatVotes(stats.total)}`);
    
    sections.push('');
  }
  
  // Execution details
  if (proposal.executionDetails) {
    sections.push('## ⚙️ Execution');
    sections.push('');
    const exec = proposal.executionDetails;
    if (exec.executed) {
      sections.push('✅ **Status:** Executed');
      if (exec.executedAt) {
        sections.push(`- **Executed At:** ${formatDate(exec.executedAt)}`);
      }
    } else {
      sections.push('⏳ **Status:** Not executed');
    }
    sections.push('');
  }
  
  // Actions summary
  if (proposal.actions && proposal.actions.length > 0) {
    sections.push('## 🎯 Actions');
    sections.push('');
    sections.push(`This proposal contains **${proposal.actions.length}** action(s) to be executed.`);
    sections.push('');
  }
  
  // Footer
  sections.push('---');
  sections.push(`*Data from Tally API • Organization ID: ${organizationId} • Proposal ID: ${proposalId}*`);
  
  return sections.join('\n');
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
 * Format proposal status for display
 */
function formatStatus(status: string): string {
  if (!status) return 'Unknown';
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
 * Register the proposal overview resource template with the MCP server
 * 
 * @param server - The McpServer instance to register the resource with
 * @param graphqlClient - The TallyGraphQLClient instance for API access
 */
export function registerProposalOverviewResource(server: McpServer, graphqlClient: TallyGraphQLClient): void {
  server.resource(
    'proposal-overview',
    new ResourceTemplate('tally://org/{organizationId}/proposal/{proposalId}', { list: undefined }),
    async (uri, params): Promise<ReadResourceResult> => {
      if (!graphqlClient) {
        throw new Error('Server not properly initialized');
      }
      
      const organizationId = Array.isArray(params.organizationId) ? params.organizationId[0] : params.organizationId;
      const proposalId = Array.isArray(params.proposalId) ? params.proposalId[0] : params.proposalId;
      
      if (!organizationId || !proposalId) {
        throw new Error('Both organizationId and proposalId are required');
      }
      
      const response = await getProposalOverview(graphqlClient, organizationId, proposalId);

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