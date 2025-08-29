/**
 * Help users find the right DAO to participate in
 */

import { z } from 'zod';
import type { GetPromptResult } from '@modelcontextprotocol/sdk/types.js';

export const findDAOToJoinPrompt = {
  schema: {
    interests: z.string().describe('User interests or focus areas (comma-separated, e.g., "DeFi,gaming,social impact")'),
    participationLevel: z.string().describe('Desired level of participation (observer, voter, delegate, contributor)'),
    experience: z.string().describe('Governance experience level (beginner, intermediate, expert)')
  },
  handler: ({ interests, participationLevel, experience }: { interests: string; participationLevel: string; experience: string }): GetPromptResult => {
    const interestArray = interests.split(',').map(i => i.trim());
    
    return {
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Help find the best DAO(s) for someone interested in: ${interestArray.join(', ')}, wanting to participate as a ${participationLevel}, with ${experience} governance experience.

**Discovery Process:**

1. **DAO Landscape Survey**: Use list_organizations to explore available DAOs
2. **Activity Assessment**: Use get_organizations_with_active_proposals to find DAOs with healthy governance activity
3. **Community Analysis**: Use get_delegates to understand the delegate ecosystem and entry barriers
4. **Governance Culture**: Use list_proposals to assess proposal quality and community engagement

**Matching Criteria:**
- **Interest Alignment**: DAOs working in relevant areas (${interestArray.join(', ')})
- **Participation Opportunities**: Suitable for ${participationLevel} level engagement
- **Experience Fit**: Appropriate complexity for ${experience} governance participants
- **Community Health**: Active, welcoming, and well-functioning governance

**For ${participationLevel}s specifically:**
${participationLevel === 'observer' ? '- Focus on DAOs with transparent governance and educational resources' : ''}
${participationLevel === 'voter' ? '- Look for DAOs with regular proposals and clear voting processes' : ''}
${participationLevel === 'delegate' ? '- Identify DAOs needing quality delegates with growth opportunities' : ''}
${participationLevel === 'contributor' ? '- Find DAOs with active working groups and contribution opportunities' : ''}

**Recommendations**: Provide 3-5 specific DAO recommendations with rationale for each, including how to get started and what to expect.`
        }
      }]
    };
  }
};