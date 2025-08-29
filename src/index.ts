#!/usr/bin/env node

/**
 * MCP Tally API Server - TypeScript Entry Point
 * 
 * This is the main TypeScript entry point for the MCP Tally API server.
 * For Vercel deployment, the pre-compiled JavaScript version is used.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// Import all tools
import * as serverInfoTool from './tools/get-server-info.js';
import * as listOrganizationsTool from './tools/list-organizations.js';
import * as getOrganizationTool from './tools/get-organization.js';
import * as getActiveProposalsTool from './tools/get-active-proposals.js';
import * as listProposalsTool from './tools/list-proposals.js';
import * as getProposalTool from './tools/get-proposal.js';
import * as getUserProfileTool from './tools/get-user-profile.js';
import * as getDelegatesTool from './tools/get-delegates.js';
import * as getDaoParticipantsTool from './tools/get-dao-participants.js';
import * as getDelegateStatementTool from './tools/get-delegate-statement.js';
import * as getOrganizationsWithActiveProposalsTool from './tools/get-organizations-with-active-proposals.js';
import * as executeGraphqlQueryTool from './tools/execute-graphql-query.js';

// Import additional refactored tools
import * as daoVotingStatsTool from './tools/dao-voting-stats.js';
import * as delegateLeaderboardTool from './tools/delegate-leaderboard.js';
import * as delegationStatusTool from './tools/delegation-status.js';
import * as proposalSummaryTool from './tools/proposal-summary.js';
import * as proposalTimelineTool from './tools/proposal-timeline.js';
import * as recentVotesTool from './tools/recent-votes.js';
import * as voteHistoryTool from './tools/vote-history.js';
import * as voterProfileTool from './tools/voter-profile.js';

// Import resources
import * as serverInfoResource from './resources/server-info.js';
import * as tallyApiSchemaResource from './resources/tally-api-schema.js';

// Import prompts
import * as analyzeDao from './prompts/individual/analyze-dao-governance.js';
import * as analyzeDelegateProfile from './prompts/individual/analyze-delegate-profile.js';
import * as analyzeProposal from './prompts/individual/analyze-proposal.js';
import * as compareDaoGovernance from './prompts/individual/compare-dao-governance.js';
import * as discoverTrends from './prompts/individual/discover-governance-trends.js';
import * as findDao from './prompts/individual/find-dao-to-join.js';

/**
 * Main server setup and execution
 */
async function main() {
  const server = new Server(
    {
      name: 'mcp-tally-api',
      version: '1.2.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    }
  );

  // Register all tools
  const tools = [
    serverInfoTool,
    listOrganizationsTool,
    getOrganizationTool,
    getActiveProposalsTool,
    listProposalsTool,
    getProposalTool,
    getUserProfileTool,
    getDelegatesTool,
    getDaoParticipantsTool,
    getDelegateStatementTool,
    getOrganizationsWithActiveProposalsTool,
    executeGraphqlQueryTool,
    daoVotingStatsTool,
    delegateLeaderboardTool,
    delegationStatusTool,
    proposalSummaryTool,
    proposalTimelineTool,
    recentVotesTool,
    voteHistoryTool,
    voterProfileTool,
  ];

  tools.forEach(tool => {
    if (tool.setupTool) {
      tool.setupTool(server);
    }
  });

  // Register resources
  const resources = [serverInfoResource, tallyApiSchemaResource];
  resources.forEach(resource => {
    if (resource.setupResource) {
      resource.setupResource(server);
    }
  });

  // Register prompts
  const prompts = [
    analyzeDao,
    analyzeDelegateProfile,
    analyzeProposal,
    compareDaoGovernance,
    discoverTrends,
    findDao,
  ];

  prompts.forEach(prompt => {
    if (prompt.setupPrompt) {
      prompt.setupPrompt(server);
    }
  });

  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP Tally API Server running on stdio transport');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Server error:', error);
    process.exit(1);
  });
}

export { main };