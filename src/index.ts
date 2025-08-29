#!/usr/bin/env node

import express, { Request, Response } from 'express';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolResult,
  GetPromptResult,
  ReadResourceResult,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// Import our tool implementations
import { AuthManager } from './auth.js';
import { TallyGraphQLClient } from './graphql-client.js';
import { registerGetServerInfoTool } from './tools/get-server-info.js';
import { registerListOrganizationsTool } from './tools/list-organizations.js';
import { registerGetOrganizationTool } from './tools/get-organization.js';
import { registerGetOrganizationsWithActiveProposalsTool } from './tools/get-organizations-with-active-proposals.js';
import { registerListProposalsTool } from './tools/list-proposals.js';
import { registerGetProposalTool } from './tools/get-proposal.js';
import { registerGetActiveProposalsTool } from './tools/get-active-proposals.js';
import { registerGetUserProfileTool } from './tools/get-user-profile.js';
import { registerGetDelegateStatementTool } from './tools/get-delegate-statement.js';
import { registerGetDAOParticipantsTool } from './tools/get-dao-participants.js';
import { registerGetDelegatesTool } from './tools/get-delegates.js';
import { registerExecuteGraphQLQueryTool } from './tools/execute-graphql-query.js';
import {
  listOrganizations,
  getOrganization,
  getOrganizationsWithActiveProposals,
} from './organization-tools.js';
import {
  listProposals,
  getProposal,
  getActiveProposals,
} from './proposal-tools.js';
import { registerServerInfoResource } from './resources/server-info.js';
import { registerPopularDaosResource } from './resources/popular-daos.js';
import { registerOrganizationOverviewResource } from './resources/organization-overview.js';
import { registerProposalOverviewResource } from './resources/proposal-overview.js';
import { registerUserOverviewResource } from './resources/user-overview.js';
import { registerTrendingProposalsResource } from './resources/trending-proposals.js';
import { registerTallyApiSchemaResource } from './resources/tally-api-schema.js';
import { governancePrompts } from './prompts/governance-prompts.js';

/**
 * MCP Tally API Server
 *
 * This server provides access to Tally's blockchain governance API
 * through the Model Context Protocol (MCP).
 */

// Environment configuration
const TALLY_API_URL =
  process.env.TALLY_API_URL || 'https://api.tally.xyz/query';
const TALLY_API_KEY = process.env.TALLY_API_KEY;
const PORT = parseInt(process.env.PORT || '3000', 10);
const TRANSPORT_MODE = process.env.TRANSPORT_MODE || 'stdio'; // 'stdio', 'sse', or 'http'

class TallyMcpServer {
  private server: McpServer;
  private authManager: AuthManager;
  private graphqlClient: TallyGraphQLClient | null = null;

  constructor() {
    this.server = new McpServer(
      {
        name: 'mcp-tally-api',
        version: '1.1.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
          logging: {},
        },
      }
    );

    // Initialize auth manager (GraphQL client will be created after initialization)
    this.authManager = new AuthManager(TRANSPORT_MODE as 'stdio' | 'sse');

    this.setupPrompts();
    this.setupErrorHandling();
  }

  async initialize() {
    await this.authManager.initialize();
    this.graphqlClient = new TallyGraphQLClient(this.authManager);

    // Setup tools and resources after GraphQL client is initialized
    this.setupTools();
    this.setupResources();
  }

  private setupTools() {
    // Get server info tool
    registerGetServerInfoTool(this.server);

    // Organization Management Tools
    registerListOrganizationsTool(this.server, this.graphqlClient!);
    registerGetOrganizationTool(this.server, this.graphqlClient!);
    registerGetOrganizationsWithActiveProposalsTool(this.server, this.graphqlClient!);

    // Proposal Operations Tools
    registerListProposalsTool(this.server, this.graphqlClient!);
    registerGetProposalTool(this.server, this.graphqlClient!);
    registerGetActiveProposalsTool(this.server, this.graphqlClient!);

    // User and Delegation Query Tools
    registerGetUserProfileTool(this.server, this.graphqlClient!);
    registerGetDelegateStatementTool(this.server, this.graphqlClient!);
    registerGetDAOParticipantsTool(this.server, this.graphqlClient!);
    registerGetDelegatesTool(this.server, this.graphqlClient!);

    // Advanced Query Tool
    registerExecuteGraphQLQueryTool(this.server, this.graphqlClient!);
  }

  private setupResources() {
    // Register all resource handlers using the registration functions
    registerServerInfoResource(this.server);
    registerPopularDaosResource(this.server, this.graphqlClient!);
    registerOrganizationOverviewResource(this.server, this.graphqlClient!);
    registerProposalOverviewResource(this.server, this.graphqlClient!);
    registerUserOverviewResource(this.server, this.graphqlClient!);
    registerTrendingProposalsResource(this.server, this.graphqlClient!);
    registerTallyApiSchemaResource(this.server, this.graphqlClient!);
  }

  private setupPrompts() {
    // Set up all governance-focused prompt templates
    Object.entries(governancePrompts).forEach(([name, prompt]) => {
      this.server.prompt(
        name,
        `Governance analysis prompt: ${name.replace(/-/g, ' ')}`,
        prompt.schema,
        async (args: any): Promise<GetPromptResult> => {
          return prompt.handler(args);
        }
      );
    });
  }

  private setupErrorHandling() {
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async startStdio() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  async startSse() {
    const app = express();
    app.use(express.json());

    // SSE mode implementation will be added in later tasks
    app.post('/mcp', async (req: Request, res: Response) => {
      res.status(501).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'SSE transport not yet implemented',
        },
        id: null,
      });
    });

    app.listen(PORT, () => {
    });
  }

  async startHttp() {
    const app = express();
    app.use(express.json());

    // Handle POST requests for client-to-server communication (stateless mode)
    app.post('/mcp', async (req: Request, res: Response) => {
      try {
        // Check if API key is available
        if (!TALLY_API_KEY) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'TALLY_API_KEY environment variable is required',
            },
            id: req.body?.id || null,
          });
          return;
        }

        // Create a new server instance for each request to ensure complete isolation
        const server = new McpServer(
          {
            name: 'mcp-tally-api',
            version: '1.1.0',
          },
          {
            capabilities: {
              tools: {},
              resources: {},
              prompts: {},
              logging: {},
            },
          }
        );

        // Initialize auth manager and GraphQL client for this request
        const authManager = new AuthManager('http');
        await authManager.initialize();
        const graphqlClient = new TallyGraphQLClient(authManager);

        // Set up the complete server functionality
        await this.setupCompleteServer(server, graphqlClient);

        // Create transport in stateless mode
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined, // Stateless mode
        });

        // Clean up when request closes
        res.on('close', () => {
          transport.close();
          server.close();
        });

        // Connect server to transport
        await server.connect(transport);

        // Handle the request
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Internal server error',
            },
            id: req.body?.id || null,
          });
        }
      }
    });

    // Handle GET requests (not supported in stateless mode)
    app.get('/mcp', async (req: Request, res: Response) => {
      res.writeHead(405).end(JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Method not allowed."
        },
        id: null
      }));
    });

    // Handle DELETE requests (not supported in stateless mode)
    app.delete('/mcp', async (req: Request, res: Response) => {
      res.writeHead(405).end(JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Method not allowed."
        },
        id: null
      }));
    });

    // Start the server
    app.listen(PORT, () => {
      console.log(`MCP Tally API HTTP Server listening on port ${PORT}`);
    });
  }

  // Complete server setup for HTTP mode
  private async setupCompleteServer(server: McpServer, graphqlClient: TallyGraphQLClient) {
    // Set up all tools, resources, and prompts using the existing logic
    // but adapted for the new server instance
    
    // Copy the tool setup logic from setupTools() but for the new server
    this.setupAllTools(server, graphqlClient);
    this.setupAllResources(server, graphqlClient);
    this.setupAllPrompts(server);
  }

  private setupAllTools(server: McpServer, graphqlClient: TallyGraphQLClient) {
    // Get server info tool
    registerGetServerInfoTool(server);

    // Organization Management Tools
    registerListOrganizationsTool(server, graphqlClient);
    registerGetOrganizationTool(server, graphqlClient);
    registerGetOrganizationsWithActiveProposalsTool(server, graphqlClient);

    // Proposal Operations Tools
    registerListProposalsTool(server, graphqlClient);
    registerGetProposalTool(server, graphqlClient);
    registerGetActiveProposalsTool(server, graphqlClient);

    // User and Delegation Query Tools
    registerGetUserProfileTool(server, graphqlClient);
    registerGetDelegateStatementTool(server, graphqlClient);
    registerGetDAOParticipantsTool(server, graphqlClient);
    registerGetDelegatesTool(server, graphqlClient);

    // Advanced Query Tool
    registerExecuteGraphQLQueryTool(server, graphqlClient);
  }

  private setupAllResources(server: McpServer, graphqlClient: TallyGraphQLClient) {
    // Register all resource handlers using the registration functions
    registerServerInfoResource(server);
    registerPopularDaosResource(server, graphqlClient);
    registerOrganizationOverviewResource(server, graphqlClient);
    registerProposalOverviewResource(server, graphqlClient);
    registerUserOverviewResource(server, graphqlClient);
    registerTrendingProposalsResource(server, graphqlClient);
    registerTallyApiSchemaResource(server, graphqlClient);
  }

  private setupAllPrompts(server: McpServer) {
    // Set up all governance-focused prompt templates
    Object.entries(governancePrompts).forEach(([name, prompt]) => {
      server.prompt(
        name,
        `Governance analysis prompt: ${name.replace(/-/g, ' ')}`,
        prompt.schema,
        async (args: any): Promise<GetPromptResult> => {
          return prompt.handler(args);
        }
      );
    });
  }
}

async function main() {
  if (TRANSPORT_MODE === 'stdio') {
    const server = new TallyMcpServer();
    await server.initialize();
    await server.startStdio();
  } else if (TRANSPORT_MODE === 'sse') {
    const server = new TallyMcpServer();
    await server.initialize();
    await server.startSse();
  } else if (TRANSPORT_MODE === 'http') {
    // For HTTP mode, we don't initialize the main server instance
    // Each request creates its own server instance
    const server = new TallyMcpServer();
    await server.startHttp();
  } else {
    throw new Error('Invalid transport mode. Use "stdio", "sse", or "http"');
  }
}

// Error handlers
process.on('uncaughtException', () => {
  process.exit(1);
});

process.on('unhandledRejection', () => {
  process.exit(1);
});

// Start the server
main().catch(() => {
  process.exit(1);
});
