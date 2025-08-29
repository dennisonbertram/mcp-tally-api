/**
 * Research and profile a specific delegate
 */

import { z } from 'zod';
import type { GetPromptResult } from '@modelcontextprotocol/sdk/types.js';

export const analyzeDelegateProfilePrompt = {
  schema: {
    address: z.string().describe('Ethereum address of the delegate'),
    daoName: z.string().optional().describe('Specific DAO name to focus on (optional, e.g., "Arbitrum")')
  },
  handler: ({ address, daoName }: { address: string; daoName?: string }): GetPromptResult => ({
    messages: [{
      role: "user" as const,
      content: {
        type: "text" as const,
        text: `Analyze the governance profile and activity of delegate ${address}${daoName ? ` in "${daoName}" DAO` : ' across all DAOs'}.

**Research Steps:**

${daoName ? `**STEP 0 - Find the DAO**: Use list_organizations to search for "${daoName}" and note its organization ID for focused analysis.

` : ''}**STEP 1 - Delegate Overview**: Use get_user_profile to understand their overall DAO participation across all DAOs.

${daoName ? `**STEP 2 - Specific DAO Analysis**: Use get_delegate_statement with the organization ID to get their statement and positions in "${daoName}".` : '**STEP 2 - Cross-DAO Analysis**: Review their participation across multiple DAOs from the user profile.'}

**STEP 3 - Voting Power Analysis**: Check their current voting power and delegation status across DAOs.

**STEP 4 - Activity Assessment**: Evaluate their governance participation and engagement patterns.

**Analysis Framework:**
- **Governance Experience**: How long have they been active? Which DAOs?
- **Voting Power**: Current delegation and influence level (convert raw amounts using token decimals)
- **Participation Quality**: Voting consistency, proposal engagement
- **Community Standing**: Delegate statements, community recognition
- **Specialization**: Any particular focus areas or expertise
- **Cross-DAO Activity**: Patterns across different governance systems

**Output**: Provide a comprehensive delegate profile that would help token holders make informed delegation decisions${daoName ? ` in "${daoName}"` : ' across the ecosystem'}.`
      }
    }]
  })
};