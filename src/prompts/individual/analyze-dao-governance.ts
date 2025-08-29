/**
 * Analyze the overall governance health of a DAO
 */

import { z } from 'zod';
import type { GetPromptResult } from '@modelcontextprotocol/sdk/types.js';

export const analyzeDAOGovernancePrompt = {
  schema: {
    daoName: z.string().describe('The name of the DAO to analyze (e.g., "Wormhole", "Arbitrum", "Uniswap")'),
    includeComparison: z.string().optional().describe('Whether to compare with other similar DAOs (true/false)')
  },
  handler: ({ daoName, includeComparison }: { daoName: string; includeComparison?: string }): GetPromptResult => {
    const shouldCompare = includeComparison === 'true';
    return {
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Analyze the governance health of "${daoName}" DAO. Please:

**STEP 0 - Find the DAO**: 
First, use list_organizations to search for "${daoName}". Look through the results to find the organization with a matching or similar name. Use the organization ID from the search results for all subsequent queries.

**STEP 1 - Organization Overview**: 
Use get_organization with the found organization ID to understand the DAO's basic info, timelocks, and treasury structure.

**STEP 2 - Active Governance**: 
Use get_active_proposals with the organization ID to see current voting activity.

**STEP 3 - Delegate Analysis**: 
Use get_delegates with the organization ID to examine voting power distribution.

**STEP 4 - Proposal History**: 
Use list_proposals with the organization ID to understand proposal patterns and success rates.

**Analysis Focus:**
- Governance participation rates and trends
- Voting power concentration vs. decentralization  
- Proposal quality and community engagement
- Delegate activity and representation
- Treasury and timelock infrastructure
${shouldCompare ? '\n- **Peer Comparison**: Use list_organizations to find similar DAOs for benchmarking' : ''}

**Remember**: All vote counts are in raw token units - use the token decimal information to convert to human-readable amounts when analyzing voting data.

Provide actionable insights about "${daoName}"'s governance strengths and areas for improvement.`
        }
      }]
    };
  }
};