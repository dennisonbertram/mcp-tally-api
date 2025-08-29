/**
 * Compare governance metrics between multiple DAOs
 */

import { z } from 'zod';
import type { GetPromptResult } from '@modelcontextprotocol/sdk/types.js';

export const compareDAOGovernancePrompt = {
  schema: {
    dao1Name: z.string().describe('First DAO name (e.g., "Arbitrum", "Wormhole")'),
    dao2Name: z.string().describe('Second DAO name (e.g., "Uniswap", "Compound")'),
    aspect: z.string().describe('Specific aspect to focus the comparison on (overall, delegates, proposals, activity)')
  },
  handler: ({ dao1Name, dao2Name, aspect }: { dao1Name: string; dao2Name: string; aspect: string }): GetPromptResult => {
    const aspectInstructions = {
      overall: 'Compare all governance aspects including participation, delegate distribution, proposal activity, and community engagement',
      delegates: 'Focus on delegate ecosystems: voting power distribution, delegate activity, and representation quality',
      proposals: 'Compare proposal patterns: success rates, types, community engagement, and voting participation',
      activity: 'Focus on governance activity levels: proposal frequency, voting participation, and community engagement trends'
    };

    const instruction = aspectInstructions[aspect as keyof typeof aspectInstructions] || aspectInstructions.overall;

    return {
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Compare the governance of "${dao1Name}" and "${dao2Name}", focusing on ${aspect}.

**STEP 0 - Find Both DAOs**:
1. Use list_organizations to search for "${dao1Name}" and note its organization ID
2. Use list_organizations to search for "${dao2Name}" and note its organization ID

**STEP 1 - Gather Data for Both DAOs**:
- Use get_organization for each DAO (with their respective organization IDs) to get basic metrics, timelocks, and treasury info
- Use get_delegates for each DAO to analyze voting power distribution  
- Use list_proposals for each DAO to review recent governance activity
- Use get_active_proposals for each DAO to check current activity levels

**STEP 2 - Analysis Focus**: ${instruction}

**STEP 3 - Comparison Framework**:
- Quantitative metrics (member counts, proposal counts, voting participation)
- Qualitative assessment (governance quality, community health)
- Structural differences (governance models, voting mechanisms, treasury management)
- Token economics and voting power distribution

**STEP 4 - Insights & Recommendations**:
- Which DAO has stronger governance practices and why
- What each DAO could learn from the other
- Specific actionable recommendations for improvement

**Remember**: Convert all raw token amounts using the respective token decimals for accurate comparison.

Present your findings in a clear, structured format with supporting data.`
        }
      }]
    };
  }
};