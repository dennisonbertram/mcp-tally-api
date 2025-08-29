/**
 * User Profile Overview Resource Template
 * 
 * Provides human-readable markdown overviews of user governance profiles via tally://user/{address}
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import { TallyGraphQLClient } from '../graphql-client.js';
import { getUserProfile } from '../user-tools.js';

export interface UserOverview {
  uri: string;
  mimeType: string;
  text: string;
}

/**
 * Generate a markdown overview for a user's governance profile
 */
export async function getUserOverview(
  graphqlClient: TallyGraphQLClient,
  address: string
): Promise<UserOverview> {
  try {
    // Use existing user profile tool to get data
    const userProfile = await getUserProfile(graphqlClient, { address, pageSize: 10 });
    
    if (!userProfile) {
      throw new Error(`User profile not found for address ${address}`);
    }

    // Generate markdown content
    const markdown = generateUserMarkdown(userProfile, address);
    
    return {
      uri: `tally://user/${address}`,
      mimeType: 'text/markdown',
      text: markdown
    };
  } catch (error) {
    // Return error as markdown
    return {
      uri: `tally://user/${address}`,
      mimeType: 'text/markdown',
      text: `# Error Loading User Profile\n\n**Error:** ${error instanceof Error ? error.message : 'Unknown error'}\n\n*Address: ${address}*`
    };
  }
}

/**
 * Generate markdown content for a user profile
 */
function generateUserMarkdown(userProfile: any, address: string): string {
  const sections: string[] = [];
  
  // Header
  const displayName = userProfile.user?.name || userProfile.user?.ens || 'Anonymous User';
  sections.push(`# 👤 ${displayName}`);
  sections.push('');
  
  // Basic info
  sections.push('## 📋 Profile Details');
  sections.push('');
  sections.push(`- **Address:** \`${address}\``);
  
  if (userProfile.user?.ens) {
    sections.push(`- **ENS:** ${userProfile.user.ens}`);
  }
  
  if (userProfile.user?.twitter) {
    sections.push(`- **Twitter:** [@${userProfile.user.twitter}](https://twitter.com/${userProfile.user.twitter})`);
  }
  
  if (userProfile.user?.email) {
    sections.push(`- **Email:** ${userProfile.user.email}`);
  }
  
  sections.push('');
  
  // DAO Participation Summary
  if (userProfile.participations && userProfile.participations.length > 0) {
    sections.push('## 🏛️ DAO Participation');
    sections.push('');
    sections.push(`**Active in ${userProfile.participations.length} DAO(s):**`);
    sections.push('');
    
    userProfile.participations.forEach((participation: any) => {
      const org = participation.organization;
      if (org) {
        const votingPower = participation.votingPower ? formatVotingPower(participation.votingPower) : 'N/A';
        const delegateInfo = participation.delegate ? ' (Delegate)' : '';
        sections.push(`### ${org.name}${delegateInfo}`);
        sections.push('');
        sections.push(`- **Voting Power:** ${votingPower}`);
        
        if (participation.proposalsCreated !== undefined) {
          sections.push(`- **Proposals Created:** ${participation.proposalsCreated}`);
        }
        
        if (participation.votesCast !== undefined) {
          sections.push(`- **Votes Cast:** ${participation.votesCast}`);
        }
        
        if (participation.delegate && participation.delegateStatement) {
          sections.push(`- **Delegate Statement:** Available`);
        }
        
        sections.push('');
      }
    });
  } else {
    sections.push('## 🏛️ DAO Participation');
    sections.push('');
    sections.push('*No DAO participation found for this address.*');
    sections.push('');
  }
  
  // Governance Activity Summary
  if (userProfile.participations && userProfile.participations.length > 0) {
    const totalProposals = userProfile.participations.reduce((sum: number, p: any) => sum + (p.proposalsCreated || 0), 0);
    const totalVotes = userProfile.participations.reduce((sum: number, p: any) => sum + (p.votesCast || 0), 0);
    const delegateCount = userProfile.participations.filter((p: any) => p.delegate).length;
    
    sections.push('## 📊 Activity Summary');
    sections.push('');
    sections.push(`- **Total Proposals Created:** ${totalProposals}`);
    sections.push(`- **Total Votes Cast:** ${totalVotes}`);
    sections.push(`- **Delegate Roles:** ${delegateCount}`);
    sections.push(`- **DAOs Participated:** ${userProfile.participations.length}`);
    sections.push('');
  }
  
  // Bio/Description
  if (userProfile.user?.bio) {
    sections.push('## 📝 Bio');
    sections.push('');
    sections.push(userProfile.user.bio);
    sections.push('');
  }
  
  // Footer
  sections.push('---');
  sections.push(`*Data from Tally API • Address: ${address}*`);
  
  return sections.join('\n');
}

/**
 * Format voting power for display
 */
function formatVotingPower(votingPower: number | string): string {
  const num = typeof votingPower === 'string' ? parseFloat(votingPower) : votingPower;
  if (isNaN(num)) return votingPower.toString();
  
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(2)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(2)}K`;
  } else {
    return num.toLocaleString();
  }
}

/**
 * Register the user overview resource template with the MCP server
 * 
 * @param server - The McpServer instance to register the resource with
 * @param graphqlClient - The TallyGraphQLClient instance for API access
 */
export function registerUserOverviewResource(server: McpServer, graphqlClient: TallyGraphQLClient): void {
  server.resource(
    'user-overview',
    new ResourceTemplate('tally://user/{address}', { list: undefined }),
    async (uri, params): Promise<ReadResourceResult> => {
      if (!graphqlClient) {
        throw new Error('Server not properly initialized');
      }
      
      const address = Array.isArray(params.address) ? params.address[0] : params.address;
      
      if (!address) {
        throw new Error('Address parameter is required');
      }
      
      const response = await getUserOverview(graphqlClient, address);

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