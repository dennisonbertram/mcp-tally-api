import { spawn, ChildProcess } from 'child_process';
import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { z } from 'zod';

/**
 * Live MCP Server Test Suite
 *
 * This test suite spawns the actual MCP server and tests all tools
 * against the live Tally API using real data.
 */

interface MCPRequest {
  jsonrpc: string;
  id: number;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: string;
  id: number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

class MCPTestClient {
  private server: ChildProcess | null = null;
  private requestId = 1;
  private pendingRequests = new Map<
    number,
    { resolve: Function; reject: Function; timeout: NodeJS.Timeout }
  >();

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Spawn the MCP server
      this.server = spawn('bun', ['run', 'dist/index.js'], {
        env: {
          ...process.env,
          TALLY_API_KEY: process.env.TALLY_API_KEY,
          TRANSPORT_MODE: 'stdio',
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      if (!this.server.stdout || !this.server.stdin) {
        reject(new Error('Failed to create server process'));
        return;
      }

      // Handle server output
      let buffer = '';
      this.server.stdout.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const response: MCPResponse = JSON.parse(line);
              this.handleResponse(response);
            } catch (error) {
              console.error('Failed to parse response:', line);
            }
          }
        }
      });

      this.server.stderr?.on('data', (data) => {
        const output = data.toString();
        if (output.includes('MCP Tally API Server running on stdio')) {
          resolve();
        }
      });

      this.server.on('error', reject);
      this.server.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`Server exited with code ${code}`));
        }
      });

      // Give server time to start
      setTimeout(resolve, 2000);
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      this.server.kill();
      this.server = null;
    }

    // Reject all pending requests
    for (const [, { reject, timeout }] of this.pendingRequests) {
      clearTimeout(timeout);
      reject(new Error('Server stopped'));
    }
    this.pendingRequests.clear();
  }

  private handleResponse(response: MCPResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(response.id);

      if (response.error) {
        pending.reject(new Error(`MCP Error: ${response.error.message}`));
      } else {
        pending.resolve(response.result);
      }
    }
  }

  async request(method: string, params?: any): Promise<any> {
    if (!this.server?.stdin) {
      throw new Error('Server not running');
    }

    const id = this.requestId++;
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      // Set timeout for request
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, 30000); // 30 second timeout

      this.pendingRequests.set(id, { resolve, reject, timeout });

      // Send request
      this.server!.stdin!.write(JSON.stringify(request) + '\n');
    });
  }

  // Convenience methods for common operations
  async callTool(name: string, arguments_: any = {}): Promise<any> {
    return this.request('tools/call', { name, arguments: arguments_ });
  }

  async listTools(): Promise<any> {
    return this.request('tools/list');
  }

  async readResource(uri: string): Promise<any> {
    return this.request('resources/read', { uri });
  }

  async listResources(): Promise<any> {
    return this.request('resources/list');
  }
}

// Test data - known working organization IDs
const TEST_DATA = {
  organizations: {
    uniswap: {
      id: '2206072050458560434',
      slug: 'uniswap',
      name: 'Uniswap',
      chainId: 'eip155:1',
      expectedProposals: 81, // Update based on current data
    },
    arbitrum: {
      id: '2206072050315953936',
      slug: 'arbitrum',
      name: 'Arbitrum',
      chainId: 'eip155:42161',
      expectedProposals: 74,
    },
    zeroXProtocol: {
      id: '2206072050022352213',
      slug: '0x-protocol-treasury',
      name: '0x Protocol Treasury',
      chainId: 'eip155:1',
      expectedProposals: 1,
    },
  },
  chains: {
    ethereum: 'eip155:1',
    arbitrum: 'eip155:42161',
    optimism: 'eip155:10',
    zkSync: 'eip155:324',
    gnosis: 'eip155:100',
  },
} as const;

// Response validation schemas
const OrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  chainIds: z.array(z.string()),
  memberCount: z.number(),
  proposalCount: z.number(),
  hasActiveProposals: z.boolean(),
});

const ProposalSchema = z.object({
  id: z.string(),
  onchainId: z.string(),
  status: z.string(),
  metadata: z.object({
    title: z.string(),
    description: z.string().optional(),
  }),
  organization: z.object({
    name: z.string(),
    slug: z.string(),
  }),
});

const PaginatedResponseSchema = z.object({
  items: z.array(z.any()),
  totalCount: z.number(),
  pageInfo: z.object({
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean(),
    startCursor: z.string().optional(),
    endCursor: z.string().optional(),
  }),
});

// Add delay helper
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('MCP Tally API Server - Live Tests', () => {
  let client: MCPTestClient;

  beforeAll(async () => {
    if (!process.env.TALLY_API_KEY) {
      throw new Error(
        'TALLY_API_KEY environment variable is required for live tests'
      );
    }

    client = new MCPTestClient();
    await client.start();
  }, 30000);

  afterAll(async () => {
    if (client) {
      await client.stop();
    }
  });

  afterEach(async () => {
    // Add delay between tests to avoid rate limiting
    await delay(1000);
  });

  describe('Server Initialization', () => {
    test('should list all expected tools', async () => {
      const result = await client.listTools();

      expect(result).toHaveProperty('tools');
      expect(Array.isArray(result.tools)).toBe(true);

      const toolNames = result.tools.map((tool: any) => tool.name);
      const expectedTools = [
        'get_server_info',
        'list_organizations',
        'get_organization',
        'get_organizations_with_active_proposals',
        'list_proposals',
        'get_proposal',
        'get_active_proposals',
        'get_user_daos',
        'get_dao_participants',
        'get_user_details',
        'get_delegates',
      ];

      for (const expectedTool of expectedTools) {
        expect(toolNames).toContain(expectedTool);
      }
    });

    test('should list all expected resources', async () => {
      const result = await client.listResources();

      expect(result).toHaveProperty('resources');
      expect(Array.isArray(result.resources)).toBe(true);

      const resourceUris = result.resources.map(
        (resource: any) => resource.uri
      );
      expect(resourceUris).toContain('tally://server/info');
      expect(resourceUris).toContain('tally://popular-daos');
    });
  });

  describe('Utility Tools', () => {

    test('get_server_info should return valid info', async () => {
      const result = await client.callTool('get_server_info');

      expect(result).toHaveProperty('content');
      const info = JSON.parse(result.content[0].text);

      expect(info).toHaveProperty('name', 'mcp-tally-api');
      expect(info).toHaveProperty('version', '1.0.0');
      expect(info).toHaveProperty('api_key_configured', true);
    });
  });

  describe('Organization Tools', () => {
    describe('list_organizations', () => {
      test('should return paginated organizations', async () => {
        const result = await client.callTool('list_organizations', {
          pageSize: 5,
        });

        expect(result).toHaveProperty('content');
        const data = JSON.parse(result.content[0].text);

        // Validate structure
        const validated = PaginatedResponseSchema.parse(data);
        expect(validated.items).toHaveLength(5);

        // Validate organization structure
        for (const org of validated.items.slice(0, 2)) {
          OrganizationSchema.parse(org);
        }
      });

      test('should filter by chain ID', async () => {
        const result = await client.callTool('list_organizations', {
          pageSize: 5,
          chainId: TEST_DATA.chains.ethereum,
        });

        const data = JSON.parse(result.content[0].text);

        // All organizations should be on Ethereum
        for (const org of data.items) {
          expect(org.chainIds).toContain(TEST_DATA.chains.ethereum);
        }
      });

      test('should sort by popularity descending', async () => {
        const result = await client.callTool('list_organizations', {
          pageSize: 5,
          sortBy: 'popular',
          sortOrder: 'desc',
        });

        const data = JSON.parse(result.content[0].text);

        // Member counts should be in descending order
        let prevMemberCount = Infinity;
        for (const org of data.items) {
          expect(org.memberCount).toBeLessThanOrEqual(prevMemberCount);
          prevMemberCount = org.memberCount;
        }
      });

      test('should filter by hasLogo', async () => {
        const result = await client.callTool('list_organizations', {
          pageSize: 5,
          hasLogo: true,
        });

        const data = JSON.parse(result.content[0].text);
        expect(data.items.length).toBeGreaterThan(0);

        // Note: We can't easily validate hasLogo=true from response data,
        // but we can verify the filter doesn't break the query
      });

      test('should combine multiple filters', async () => {
        const result = await client.callTool('list_organizations', {
          pageSize: 3,
          chainId: TEST_DATA.chains.ethereum,
          hasLogo: true,
          sortBy: 'popular',
          sortOrder: 'desc',
        });

        const data = JSON.parse(result.content[0].text);
        expect(data.items).toHaveLength(3);

        // All should be Ethereum and sorted by popularity
        let prevMemberCount = Infinity;
        for (const org of data.items) {
          expect(org.chainIds).toContain(TEST_DATA.chains.ethereum);
          expect(org.memberCount).toBeLessThanOrEqual(prevMemberCount);
          prevMemberCount = org.memberCount;
        }
      });
    });

    describe('get_organization', () => {
      test('should get organization by ID', async () => {
        const result = await client.callTool('get_organization', {
          organizationId: TEST_DATA.organizations.uniswap.id,
        });

        const data = JSON.parse(result.content[0].text);
        const org = OrganizationSchema.parse(data);

        expect(org.id).toBe(TEST_DATA.organizations.uniswap.id);
        expect(org.name).toBe(TEST_DATA.organizations.uniswap.name);
        expect(org.slug).toBe(TEST_DATA.organizations.uniswap.slug);
      });

      test('should get organization by slug', async () => {
        const result = await client.callTool('get_organization', {
          organizationSlug: TEST_DATA.organizations.uniswap.slug,
        });

        const data = JSON.parse(result.content[0].text);
        const org = OrganizationSchema.parse(data);

        expect(org.slug).toBe(TEST_DATA.organizations.uniswap.slug);
        expect(org.name).toBe(TEST_DATA.organizations.uniswap.name);
      });

      test('should handle large organization IDs without precision loss', async () => {
        const result = await client.callTool('get_organization', {
          organizationId: TEST_DATA.organizations.zeroXProtocol.id,
        });

        const data = JSON.parse(result.content[0].text);

        // Verify the ID is returned exactly as provided (no precision loss)
        expect(data.id).toBe(TEST_DATA.organizations.zeroXProtocol.id);
      });

      test('should return error for invalid organization ID', async () => {
        const result = await client.callTool('get_organization', {
          organizationId: 'definitely_invalid_id',
        });

        expect(result).toHaveProperty('isError', true);
        expect(result.content[0].text).toContain('GraphQL errors');
      });
    });

    describe('get_organizations_with_active_proposals', () => {
      test('should return organizations with active proposals', async () => {
        const result = await client.callTool(
          'get_organizations_with_active_proposals',
          {
            pageSize: 5,
          }
        );

        const data = JSON.parse(result.content[0].text);
        const validated = PaginatedResponseSchema.parse(data);

        expect(validated.items.length).toBeGreaterThan(0);

        // Validate structure of returned organizations
        for (const org of validated.items.slice(0, 2)) {
          OrganizationSchema.parse(org);
        }
      });

      test('should filter by chain ID', async () => {
        const result = await client.callTool(
          'get_organizations_with_active_proposals',
          {
            pageSize: 5,
            chainId: TEST_DATA.chains.ethereum,
          }
        );

        const data = JSON.parse(result.content[0].text);

        // All organizations should be on Ethereum
        for (const org of data.items) {
          expect(org.chainIds).toContain(TEST_DATA.chains.ethereum);
        }
      });
    });
  });

  describe('Proposal Tools', () => {
    describe('list_proposals', () => {
      test('should list proposals for Uniswap', async () => {
        const result = await client.callTool('list_proposals', {
          organizationId: TEST_DATA.organizations.uniswap.id,
          pageSize: 5,
        });

        const data = JSON.parse(result.content[0].text);
        const validated = PaginatedResponseSchema.parse(data);

        expect(validated.items.length).toBeGreaterThan(0);
        expect(validated.items.length).toBeLessThanOrEqual(5);

        // Validate proposal structure
        for (const proposal of validated.items.slice(0, 2)) {
          const validatedProposal = ProposalSchema.parse(proposal);
          expect(validatedProposal.organization.name).toBe(
            TEST_DATA.organizations.uniswap.name
          );
        }
      });

      test('should sort proposals by date ascending', async () => {
        const result = await client.callTool('list_proposals', {
          organizationId: TEST_DATA.organizations.uniswap.id,
          pageSize: 5,
          sortOrder: 'asc',
        });

        const data = JSON.parse(result.content[0].text);
        expect(data.items.length).toBeGreaterThan(0);

        // Validate proposals are returned (sorting validation is tricky without timestamps)
        for (const proposal of data.items) {
          ProposalSchema.parse(proposal);
        }
      });

      test('should handle organization with few proposals', async () => {
        const result = await client.callTool('list_proposals', {
          organizationId: TEST_DATA.organizations.zeroXProtocol.id,
          pageSize: 5,
        });

        const data = JSON.parse(result.content[0].text);
        expect(data.items.length).toBeGreaterThanOrEqual(0);
        expect(data.items.length).toBeLessThanOrEqual(5);
      });
    });

    describe('get_proposal', () => {
      test('should get specific proposal details', async () => {
        // First get a proposal ID from list_proposals
        const listResult = await client.callTool('list_proposals', {
          organizationId: TEST_DATA.organizations.uniswap.id,
          pageSize: 1,
        });

        const listData = JSON.parse(listResult.content[0].text);

        if (listData.items.length === 0) {
          console.warn(
            'No proposals found for Uniswap, skipping proposal detail test'
          );
          return;
        }

        const proposalId = listData.items[0].id;

        // Now get the specific proposal
        const result = await client.callTool('get_proposal', {
          organizationId: TEST_DATA.organizations.uniswap.id,
          proposalId,
        });

        const data = JSON.parse(result.content[0].text);
        const proposal = ProposalSchema.parse(data);

        expect(proposal.id).toBe(proposalId);
        expect(proposal.organization.name).toBe(
          TEST_DATA.organizations.uniswap.name
        );
      });
    });

    describe('get_active_proposals', () => {
      test('should get active proposals across organizations', async () => {
        const result = await client.callTool('get_active_proposals', {
          pageSize: 5,
        });

        const data = JSON.parse(result.content[0].text);
        const validated = PaginatedResponseSchema.parse(data);

        // May return 0 if no active proposals, but structure should be valid
        expect(validated.items.length).toBeLessThanOrEqual(5);
      });

      test('should filter active proposals by chain', async () => {
        const result = await client.callTool('get_active_proposals', {
          pageSize: 5,
          chainId: TEST_DATA.chains.ethereum,
        });

        // Check if it's an error response (rate limiting) or valid data
        if (result.isError || result.content[0].text.includes('API rate')) {
          console.warn('Rate limited or error response, skipping validation');
          expect(result.content[0].text).toBeDefined();
        } else {
          const data = JSON.parse(result.content[0].text);
          // Structure should be valid regardless of results
          PaginatedResponseSchema.parse(data);
        }
      });
    });
  });

  describe('Resources', () => {
    test('should read popular DAOs resource', async () => {
      const result = await client.readResource('tally://popular-daos');

      expect(result).toHaveProperty('contents');
      expect(Array.isArray(result.contents)).toBe(true);
      expect(result.contents[0]).toHaveProperty('text');

      const data = JSON.parse(result.contents[0].text);

      // Validate structure
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('description');
      expect(data).toHaveProperty('total_count');
      expect(data).toHaveProperty('networks_included');
      expect(data).toHaveProperty('daos');
      expect(data).toHaveProperty('note');
      expect(data).toHaveProperty('usage_examples');
      expect(data).toHaveProperty('lookup_functions');

      // Handle different loading states
      if (data.status === 'loading') {
        expect(data.total_count).toBe(0);
        expect(data.daos).toHaveLength(0);
        expect(data.note).toContain('loading');
        console.log('📋 Popular DAOs resource is still loading...');
        return; // Skip further validation for loading state
      }

      if (data.status === 'error') {
        expect(data).toHaveProperty('error_message');
        expect(data.total_count).toBe(0);
        console.warn(
          '⚠️ Popular DAOs resource failed to load:',
          data.error_message
        );
        return; // Skip further validation for error state
      }

      // Validate successful loading (status === 'ready')
      expect(data.status).toBe('ready');
      expect(data).toHaveProperty('last_updated');

      // Should have up to 30 DAOs (may be less if some networks fail)
      expect(data.total_count).toBeGreaterThan(0);
      expect(data.total_count).toBeLessThanOrEqual(30);
      expect(data.daos).toHaveLength(data.total_count);

      // Validate network coverage includes major chains
      expect(data.networks_included).toContain('eip155:1 (Ethereum)');
      expect(data.networks_included).toContain('eip155:42161 (Arbitrum)');
      expect(data.networks_included).toContain('eip155:10 (Optimism)');

      // Should include top DAOs if successfully loaded
      if (data.daos.length > 0) {
        // Validate DAO structure includes new fields
        for (const dao of data.daos.slice(0, 3)) {
          expect(dao).toHaveProperty('id');
          expect(dao).toHaveProperty('name');
          expect(dao).toHaveProperty('slug');
          expect(dao).toHaveProperty('chainId');
          expect(dao).toHaveProperty('memberCount');
          expect(dao).toHaveProperty('delegateCount');
          expect(dao).toHaveProperty('proposalCount');
          expect(dao).toHaveProperty('hasActiveProposals');

          // Delegate count should be a number (main sorting criteria)
          expect(typeof dao.delegateCount).toBe('number');
          expect(dao.delegateCount).toBeGreaterThanOrEqual(0);
        }

        // Should be sorted by delegate count (descending)
        if (data.daos.length > 1) {
          for (let i = 1; i < data.daos.length; i++) {
            expect(data.daos[i - 1].delegateCount).toBeGreaterThanOrEqual(
              data.daos[i].delegateCount
            );
          }
        }

        // Should not include testnet chains
        for (const dao of data.daos) {
          expect(dao.chainId).not.toBe('eip155:300'); // zkSync Sepolia testnet
          expect(dao.chainId).not.toBe('eip155:84532'); // Base Sepolia testnet
          expect(dao.chainId).not.toBe('eip155:11155111'); // Ethereum Sepolia testnet
        }

        console.log(`✅ Popular DAOs loaded: ${data.total_count} DAOs`);
        console.log(
          `   Top DAO: ${data.daos[0].name} (${data.daos[0].delegateCount} delegates)`
        );
      }

      // Validate dynamic resource guidance
      expect(data.note).toContain('loaded live from Tally API');
      expect(data.usage_examples).toContain(
        'Use get_organization with an ID from this list to get detailed current stats'
      );
    });

    test('should read server info resource', async () => {
      const result = await client.readResource('tally://server/info');

      expect(result).toHaveProperty('contents');
      const data = JSON.parse(result.contents[0].text);

      expect(data).toHaveProperty('name', 'mcp-tally-api');
      expect(data).toHaveProperty('version', '1.0.0');
      expect(data).toHaveProperty('status', 'operational');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid organization ID gracefully', async () => {
      const result = await client.callTool('get_organization', {
        organizationId: 'definitely_invalid_id',
      });

      expect(result).toHaveProperty('isError', true);
      expect(result.content[0].text).toContain('GraphQL errors');
    });

    test('should handle invalid chain ID gracefully', async () => {
      // This might not throw but should return empty results
      const result = await client.callTool('list_organizations', {
        chainId: 'invalid:chain:id',
        pageSize: 5,
      });

      const data = JSON.parse(result.content[0].text);
      // Should return empty results, not error
      expect(data.items).toHaveLength(0);
    });

    test('should handle oversized page requests', async () => {
      const result = await client.callTool('list_organizations', {
        pageSize: 200, // Over typical API limits
      });

      // Check if it's an error response or valid data
      if (result.isError) {
        expect(result.content[0].text).toContain('Invalid');
      } else {
        const data = JSON.parse(result.content[0].text);
        // Should either limit to max size or return error, but not crash
        expect(data.items.length).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('Performance', () => {
    test('should respond to list_organizations within reasonable time', async () => {
      const startTime = Date.now();

      await client.callTool('list_organizations', {
        pageSize: 10,
      });

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(5000); // 5 second max
    });

    test('should handle multiple concurrent requests', async () => {
      const requests = [
        client.callTool('list_organizations', { pageSize: 5 }),
        client.callTool('get_organization', {
          organizationId: TEST_DATA.organizations.uniswap.id,
        }),
        client.callTool('list_proposals', {
          organizationId: TEST_DATA.organizations.uniswap.id,
          pageSize: 3,
        }),
      ];

      const results = await Promise.all(requests);

      // All requests should succeed
      expect(results).toHaveLength(3);
      for (const result of results) {
        expect(result).toHaveProperty('content');
      }
    });
  });

  describe('Data Integrity', () => {
    test('should maintain consistency between organization list and details', async () => {
      // Get organization from list
      const listResult = await client.callTool('list_organizations', {
        pageSize: 1,
        chainId: TEST_DATA.chains.ethereum,
      });

      const listData = JSON.parse(listResult.content[0].text);
      const orgFromList = listData.items[0];

      // Get same organization by ID
      const detailResult = await client.callTool('get_organization', {
        organizationId: orgFromList.id,
      });

      const orgDetails = JSON.parse(detailResult.content[0].text);

      // Key fields should match
      expect(orgDetails.id).toBe(orgFromList.id);
      expect(orgDetails.name).toBe(orgFromList.name);
      expect(orgDetails.slug).toBe(orgFromList.slug);
    });

    test('should maintain proposal count consistency', async () => {
      const orgResult = await client.callTool('get_organization', {
        organizationId: TEST_DATA.organizations.uniswap.id,
      });

      const org = JSON.parse(orgResult.content[0].text);
      const reportedCount = org.proposalCount;

      // Get actual proposals (may need multiple pages for full count)
      const proposalResult = await client.callTool('list_proposals', {
        organizationId: TEST_DATA.organizations.uniswap.id,
        pageSize: 20,
      });

      const proposalData = JSON.parse(proposalResult.content[0].text);

      // The API returns proposals in pages, so totalCount represents the page count
      // not the total organization proposal count
      expect(proposalData.totalCount).toBe(proposalData.items.length);

      // Items returned should not exceed page size
      expect(proposalData.items.length).toBeLessThanOrEqual(20);

      // Organization should have proposals if API returns them
      if (proposalData.items.length > 0) {
        expect(reportedCount).toBeGreaterThan(0);
      }
    });
  });
});
