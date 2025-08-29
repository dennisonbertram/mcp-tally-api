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
import { getPopularDAOsData } from './resources/popular-daos.js';
import { getOrganizationOverview } from './resources/organization-overview.js';
import { getProposalOverview } from './resources/proposal-overview.js';
import { getUserOverview } from './resources/user-overview.js';
import { getTrendingProposalsOverview } from './resources/trending-proposals.js';
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

    this.setupTools();
    this.setupResources();
    this.setupPrompts();
    this.setupErrorHandling();
  }

  async initialize() {
    await this.authManager.initialize();
    this.graphqlClient = new TallyGraphQLClient(this.authManager);

    // Note: Popular DAOs resource now loads data synchronously when requested
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
    // Server info resource
    this.server.resource(
      'server-info',
      'tally://server/info',
      { mimeType: 'application/json' },
      async (): Promise<ReadResourceResult> => {
        return {
          contents: [
            {
              uri: 'tally://server/info',
              mimeType: 'application/json',
              text: JSON.stringify(
                {
                  name: 'mcp-tally-api',
                  version: '1.1.0',
                  description: 'MCP server for Tally blockchain governance API',
                  status: 'operational',
                  timestamp: new Date().toISOString(),
                },
                null,
                2
              ),
            },
          ],
        };
      }
    );

    // Popular DAOs resource
    this.server.resource(
      'popular-daos',
      'tally://popular-daos',
      { mimeType: 'application/json' },
      async (): Promise<ReadResourceResult> => {
        if (!this.graphqlClient) {
          throw new Error('Server not properly initialized');
        }
        
        const response = await getPopularDAOsData(this.graphqlClient);

        return {
          contents: [
            {
              uri: 'tally://popular-daos',
              mimeType: 'application/json',
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      }
    );

    // Organization overview resource template
    this.server.resource(
      'organization-overview',
      new ResourceTemplate('tally://org/{organizationId}', { list: undefined }),
      async (uri, params): Promise<ReadResourceResult> => {
        if (!this.graphqlClient) {
          throw new Error('Server not properly initialized');
        }
        
        const organizationId = Array.isArray(params.organizationId) ? params.organizationId[0] : params.organizationId;
        
        if (!organizationId) {
          throw new Error('Organization ID parameter is required');
        }
        
        const response = await getOrganizationOverview(this.graphqlClient, organizationId);

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

    // Proposal overview resource template
    this.server.resource(
      'proposal-overview',
      new ResourceTemplate('tally://org/{organizationId}/proposal/{proposalId}', { list: undefined }),
      async (uri, params): Promise<ReadResourceResult> => {
        if (!this.graphqlClient) {
          throw new Error('Server not properly initialized');
        }
        
        const organizationId = Array.isArray(params.organizationId) ? params.organizationId[0] : params.organizationId;
        const proposalId = Array.isArray(params.proposalId) ? params.proposalId[0] : params.proposalId;
        
        if (!organizationId || !proposalId) {
          throw new Error('Both organizationId and proposalId are required');
        }
        
        const response = await getProposalOverview(this.graphqlClient, organizationId, proposalId);

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

    // User overview resource template
    this.server.resource(
      'user-overview',
      new ResourceTemplate('tally://user/{address}', { list: undefined }),
      async (uri, params): Promise<ReadResourceResult> => {
        if (!this.graphqlClient) {
          throw new Error('Server not properly initialized');
        }
        
        const address = Array.isArray(params.address) ? params.address[0] : params.address;
        
        if (!address) {
          throw new Error('Address parameter is required');
        }
        
        const response = await getUserOverview(this.graphqlClient, address);

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

    // Trending proposals resource
    this.server.resource(
      'trending-proposals',
      'tally://trending/proposals',
      { mimeType: 'text/markdown' },
      async (): Promise<ReadResourceResult> => {
        if (!this.graphqlClient) {
          throw new Error('Server not properly initialized');
        }
        
        const response = await getTrendingProposalsOverview(this.graphqlClient);

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

    // GraphQL schema resource
    this.server.resource(
      'tally-api-schema',
      'tally://api/schema',
      { mimeType: 'application/json' },
      async (): Promise<ReadResourceResult> => {
        try {
          // GraphQL introspection query to get the full schema
          const introspectionQuery = `
            query IntrospectionQuery {
              __schema {
                types {
                  name
                  kind
                  description
                  fields {
                    name
                    description
                    type {
                      name
                      kind
                      ofType {
                        name
                        kind
                      }
                    }
                    args {
                      name
                      description
                      type {
                        name
                        kind
                        ofType {
                          name
                          kind
                        }
                      }
                    }
                  }
                  inputFields {
                    name
                    description
                    type {
                      name
                      kind
                      ofType {
                        name
                        kind
                      }
                    }
                  }
                  interfaces {
                    name
                    kind
                  }
                  enumValues {
                    name
                    description
                  }
                  possibleTypes {
                    name
                    kind
                  }
                }
                queryType {
                  name
                }
                mutationType {
                  name
                }
                subscriptionType {
                  name
                }
                directives {
                  name
                  description
                  locations
                  args {
                    name
                    description
                    type {
                      name
                      kind
                    }
                  }
                }
              }
            }
          `;

          const schemaData = await this.graphqlClient.query(introspectionQuery);

          return {
            contents: [
              {
                uri: 'tally://api/schema',
                mimeType: 'application/json',
                text: JSON.stringify({
                  description: 'Tally GraphQL API Schema',
                  timestamp: new Date().toISOString(),
                  schema: schemaData,
                }, null, 2),
              },
            ],
          };
        } catch (error) {
          // If introspection fails, return basic schema information
          return {
            contents: [
              {
                uri: 'tally://api/schema',
                mimeType: 'application/json',
                text: JSON.stringify({
                  description: 'Tally GraphQL API Schema (Basic Info)',
                  timestamp: new Date().toISOString(),
                  error: `Schema introspection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                  endpoint: this.graphqlClient.getEndpoint(),
                  note: 'Use the execute_graphql_query tool to run custom queries against this API',
                }, null, 2),
              },
            ],
          };
        }
      }
    );
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
    // Server info resource
    server.resource(
      'server-info',
      'tally://server/info',
      { mimeType: 'application/json' },
      async (): Promise<ReadResourceResult> => {
        return {
          contents: [
            {
              uri: 'tally://server/info',
              mimeType: 'application/json',
              text: JSON.stringify(
                {
                  name: 'mcp-tally-api',
                  version: '1.1.0',
                  description: 'MCP server for Tally blockchain governance API',
                  status: 'operational',
                  timestamp: new Date().toISOString(),
                },
                null,
                2
              ),
            },
          ],
        };
      }
    );

    // Popular DAOs resource
    server.resource(
      'popular-daos',
      'tally://popular-daos',
      { mimeType: 'application/json' },
      async (): Promise<ReadResourceResult> => {
        if (!graphqlClient) {
          throw new Error('Server not properly initialized');
        }
        
        const response = await getPopularDAOsData(graphqlClient);

        return {
          contents: [
            {
              uri: 'tally://popular-daos',
              mimeType: 'application/json',
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      }
    );

    // Organization overview resource template
    server.resource(
      'organization-overview',
      new ResourceTemplate('tally://org/{organizationId}', { list: undefined }),
      async (uri, params): Promise<ReadResourceResult> => {
        if (!graphqlClient) {
          throw new Error('Server not properly initialized');
        }
        
        const organizationId = Array.isArray(params.organizationId) ? params.organizationId[0] : params.organizationId;
        
        if (!organizationId) {
          throw new Error('Organization ID parameter is required');
        }
        
        const response = await getOrganizationOverview(graphqlClient, organizationId);

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

    // Proposal overview resource template
    server.resource(
      'proposal-overview',
      new ResourceTemplate('tally://org/{organizationId}/proposal/{proposalId}', { list: undefined }),
      async (uri, params): Promise<ReadResourceResult> => {
        if (!graphqlClient) {
          throw new Error('Server not properly initialized');
        }
        
        const organizationId = Array.isArray(params.organizationId) ? params.organizationId[0] : params.organizationId;
        const proposalId = Array.isArray(params.proposalId) ? params.proposalId[0] : params.proposalId;
        
        if (!organizationId || !proposalId) {
          throw new Error('Both organizationId and proposalId are required');
        }
        
        const response = await getProposalOverview(graphqlClient, organizationId, proposalId);

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

    // User overview resource template
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

    // Trending proposals resource
    server.resource(
      'trending-proposals',
      'tally://trending/proposals',
      { mimeType: 'text/markdown' },
      async (): Promise<ReadResourceResult> => {
        if (!graphqlClient) {
          throw new Error('Server not properly initialized');
        }
        
        const response = await getTrendingProposalsOverview(graphqlClient);

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

    // GraphQL schema resource
    server.resource(
      'tally-api-schema',
      'tally://api/schema',
      { mimeType: 'application/json' },
      async (): Promise<ReadResourceResult> => {
        try {
          // GraphQL introspection query to get the full schema
          const introspectionQuery = `
            query IntrospectionQuery {
              __schema {
                types {
                  name
                  kind
                  description
                  fields {
                    name
                    description
                    type {
                      name
                      kind
                      ofType {
                        name
                        kind
                      }
                    }
                    args {
                      name
                      description
                      type {
                        name
                        kind
                        ofType {
                          name
                          kind
                        }
                      }
                    }
                  }
                  inputFields {
                    name
                    description
                    type {
                      name
                      kind
                      ofType {
                        name
                        kind
                      }
                    }
                  }
                  interfaces {
                    name
                    kind
                  }
                  enumValues {
                    name
                    description
                  }
                  possibleTypes {
                    name
                    kind
                  }
                }
                queryType {
                  name
                }
                mutationType {
                  name
                }
                subscriptionType {
                  name
                }
                directives {
                  name
                  description
                  locations
                  args {
                    name
                    description
                    type {
                      name
                      kind
                    }
                  }
                }
              }
            }
          `;

          const schemaData = await graphqlClient.query(introspectionQuery);

          return {
            contents: [
              {
                uri: 'tally://api/schema',
                mimeType: 'application/json',
                text: JSON.stringify({
                  description: 'Tally GraphQL API Schema',
                  timestamp: new Date().toISOString(),
                  schema: schemaData,
                }, null, 2),
              },
            ],
          };
        } catch (error) {
          // If introspection fails, return basic schema information
          return {
            contents: [
              {
                uri: 'tally://api/schema',
                mimeType: 'application/json',
                text: JSON.stringify({
                  description: 'Tally GraphQL API Schema (Basic Info)',
                  timestamp: new Date().toISOString(),
                  error: `Schema introspection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                  endpoint: graphqlClient.getEndpoint(),
                  note: 'Use the execute_graphql_query tool to run custom queries against this API',
                }, null, 2),
              },
            ],
          };
        }
      }
    );
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
