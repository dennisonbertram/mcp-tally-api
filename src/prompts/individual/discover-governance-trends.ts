/**
 * Discover trending governance activity across the ecosystem
 */

import { z } from 'zod';
import type { GetPromptResult } from '@modelcontextprotocol/sdk/types.js';

export const discoverGovernanceTrendsPrompt = {
  schema: {
    timeframe: z.string().describe('Time focus for trend analysis (current, recent, emerging)'),
    category: z.string().optional().describe('Category of DAOs to focus on (all, defi, infrastructure, social)')
  },
  handler: ({ timeframe, category }: { timeframe: string; category?: string }): GetPromptResult => {
    const timeframeInstructions = {
      current: 'Focus on active proposals and immediate governance activity happening right now',
      recent: 'Analyze recent governance patterns and completed proposals from the past few weeks',
      emerging: 'Identify new DAOs, emerging governance patterns, and innovative approaches'
    };

    const instruction = timeframeInstructions[timeframe as keyof typeof timeframeInstructions] || timeframeInstructions.current;

    return {
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Discover and analyze ${timeframe} governance trends across the DAO ecosystem${category && category !== 'all' ? ` in the ${category} category` : ''}.

**Discovery Process:**

1. **Active Governance Scan**: Use get_organizations_with_active_proposals to find DAOs with active governance, then use get_active_proposals with specific organizationId to see current activity
2. **Organization Landscape**: Use list_organizations with explore sorting to find most active DAOs
3. **Delegate Ecosystem**: Use get_delegates across top DAOs to understand leadership trends
4. **Proposal Patterns**: Use list_proposals to analyze recent governance themes

**Analysis Focus**: ${instruction}

**Trend Categories to Explore:**
- **Governance Innovation**: New voting mechanisms, delegation models, or participation incentives
- **Hot Topics**: Common themes across multiple DAO proposals
- **Participation Patterns**: Changes in voter engagement and delegate activity
- **Cross-DAO Movements**: Shared initiatives or coordinated governance actions
${category ? `- **${category.charAt(0).toUpperCase() + category.slice(1)} Specific**: Trends unique to ${category} DAOs` : ''}

**Deliverable**: A trend report highlighting the most significant governance developments, with specific examples and data to support your findings.`
        }
      }]
    };
  }
};