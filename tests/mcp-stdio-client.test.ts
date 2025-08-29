/**
 * MCP STDIO Client Test Suite
 * 
 * This test suite validates the MCP stdio client implementation
 * following strict TDD methodology (RED-GREEN-REFACTOR)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MCPStdioClient } from './helpers/mcp-stdio-client';

describe('MCP STDIO Client', () => {
  let client: MCPStdioClient;

  describe('Client Initialization', () => {
    beforeAll(async () => {
      client = new MCPStdioClient();
      await client.start();
    });

    afterAll(async () => {
      if (client) {
        await client.stop();
      }
    });

    // TDD Cycle 2: RED Phase - Test for client creation
    it('should create an MCP stdio client instance', () => {
      expect(client).toBeDefined();
      expect(client).toBeInstanceOf(MCPStdioClient);
    });

    // TDD Cycle 3: RED Phase - Test for server startup
    it('should start the MCP server process', async () => {
      expect(client.isRunning()).toBe(true);
    });

    // TDD Cycle 4: RED Phase - Test for MCP initialization
    it('should perform MCP initialization handshake', async () => {
      const initResponse = await client.initialize();
      
      expect(initResponse).toBeDefined();
      expect(initResponse.protocolVersion).toBe('2024-11-05');
      expect(initResponse.capabilities).toBeDefined();
      expect(initResponse.serverInfo).toMatchObject({
        name: 'mcp-tally-api',
        version: '1.1.0'
      });
    });
  });

  describe('JSON-RPC 2.0 Communication', () => {
    let rpcClient: MCPStdioClient;

    beforeAll(async () => {
      rpcClient = new MCPStdioClient();
      await rpcClient.start();
      await rpcClient.initialize();
    });

    afterAll(async () => {
      if (rpcClient) {
        await rpcClient.stop();
      }
    });

    // TDD Cycle 5: RED Phase - Test for request/response
    it('should send JSON-RPC 2.0 requests and receive responses', async () => {
      const response = await rpcClient.request('tools/list', {});
      
      expect(response).toBeDefined();
      expect(response.tools).toBeInstanceOf(Array);
      expect(response.tools.length).toBe(12);
    });

    // TDD Cycle 6: RED Phase - Test for error handling
    it('should handle JSON-RPC errors gracefully', async () => {
      await expect(
        rpcClient.request('invalid/method', {})
      ).rejects.toThrow('Method not found');
    });
  });
});