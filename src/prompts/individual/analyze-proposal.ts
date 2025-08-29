/**
 * Analyze a specific proposal in detail
 */

import { z } from 'zod';
import type { GetPromptResult } from '@modelcontextprotocol/sdk/types.js';

export const analyzeProposalPrompt = {
  schema: {
    daoName: z.string().describe('Name of the DAO (e.g., "Wormhole", "Arbitrum")'),
    proposalTitle: z.string().describe('Title or description of the proposal to analyze')
  },
  handler: ({ daoName, proposalTitle }: { daoName: string; proposalTitle: string }): GetPromptResult => ({
    messages: [{
      role: "user" as const,
      content: {
        type: "text" as const,
        text: `Provide a comprehensive analysis of the "${proposalTitle}" proposal in "${daoName}" DAO.

**STEP 0 - Find the DAO and Proposal**:
1. Use list_organizations to search for "${daoName}" and note its organization ID
2. Use list_proposals with the organization ID to find proposals matching "${proposalTitle}"
3. Identify the specific proposal ID for detailed analysis

**STEP 1 - Proposal Details**: Use get_proposal with the organization ID and proposal ID to get full proposal information, including timelock operations and token context.

**STEP 2 - Organization Context**: Use get_organization to understand the DAO's background, governance structure, and treasury setup.

**STEP 3 - Voting Analysis**: Examine current voting patterns and participation (convert raw vote counts using token decimals).

**STEP 4 - Delegate Positions**: Use get_delegates to see how key delegates might vote and their influence levels.

**STEP 5 - Historical Context**: Use list_proposals to compare with similar past proposals in this DAO.

**Analysis Framework:**

**Proposal Overview:**
- What is being proposed and why?
- What are the potential impacts and implications?
- How does this fit into the DAO's broader strategy?
- What treasury/timelock operations are involved?

**Voting Dynamics:**
- Current voting trends and participation levels (in human-readable token amounts)
- Key delegate positions and influence
- Likelihood of passage based on current data

**Risk Assessment:**
- Potential benefits and drawbacks
- Implementation challenges
- Community sentiment and concerns
- Treasury impact and execution risks

**Recommendation:**
- Should token holders support this proposal?
- What questions should voters consider?
- How does this align with the DAO's long-term interests?

Provide a balanced, data-driven analysis that helps inform voting decisions on "${proposalTitle}" in "${daoName}".`
      }
    }]
  })
};