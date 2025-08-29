/**
 * Governance-focused prompt templates for Tally API MCP server
 * 
 * These prompts help LLMs effectively analyze DAO governance using our tools and resources
 */

import { analyzeDAOGovernancePrompt } from './individual/analyze-dao-governance.js';
import { compareDAOGovernancePrompt } from './individual/compare-dao-governance.js';
import { analyzeDelegateProfilePrompt } from './individual/analyze-delegate-profile.js';
import { discoverGovernanceTrendsPrompt } from './individual/discover-governance-trends.js';
import { findDAOToJoinPrompt } from './individual/find-dao-to-join.js';
import { analyzeProposalPrompt } from './individual/analyze-proposal.js';

export const governancePrompts = {
  'analyze-dao-governance': analyzeDAOGovernancePrompt,
  'compare-dao-governance': compareDAOGovernancePrompt,
  'analyze-delegate-profile': analyzeDelegateProfilePrompt,
  'discover-governance-trends': discoverGovernanceTrendsPrompt,
  'find-dao-to-join': findDAOToJoinPrompt,
  'analyze-proposal': analyzeProposalPrompt
}; 