/**
 * MCP STDIO Client Implementation
 * 
 * A comprehensive client for testing MCP servers via stdio transport
 * following the JSON-RPC 2.0 protocol specification.
 * 
 * Features:
 * - Full JSON-RPC 2.0 support with request/response correlation
 * - Automatic server process management
 * - Timeout handling for all requests
 * - Buffer management for streaming JSON responses
 * - Proper error propagation
 */

import { spawn, ChildProcess } from 'child_process';

interface MCPRequest {
  jsonrpc: string;
  id: number | string;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: string;
  id: number | string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

interface InitializeResult {
  protocolVersion: string;
  capabilities: {
    tools?: {};
    resources?: {};
    prompts?: {};
  };
  serverInfo: {
    name: string;
    version: string;
  };
}

export class MCPStdioClient {
  private server: ChildProcess | null = null;
  private requestId = 1;
  private pendingRequests = new Map<
    number | string,
    { resolve: Function; reject: Function; timeout: NodeJS.Timeout }
  >();
  private buffer = '';
  private initialized = false;
  
  // Configuration constants
  private readonly REQUEST_TIMEOUT_MS = 30000;
  private readonly SERVER_START_TIMEOUT_MS = 2000;
  private readonly JSON_RPC_VERSION = '2.0';
  private readonly MCP_PROTOCOL_VERSION = '2024-11-05';

  constructor() {
    // Constructor doesn't start the server yet
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Spawn the MCP server process
      this.server = spawn('bun', ['src/index.ts'], {
        env: {
          ...process.env,
          TRANSPORT_MODE: 'stdio',
        },
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd(),
      });

      if (!this.server.stdout || !this.server.stdin) {
        reject(new Error('Failed to create server process'));
        return;
      }

      // Handle server stdout (JSON-RPC responses)
      this.server.stdout.on('data', (data) => {
        this.buffer += data.toString();
        this.processBuffer();
      });

      // Handle server stderr (logging)
      this.server.stderr?.on('data', (data) => {
        const output = data.toString();
        // Check for server ready message
        if (output.includes('MCP Tally API Server running on stdio')) {
          resolve();
        }
      });

      this.server.on('error', (error) => {
        reject(error);
      });

      this.server.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          reject(new Error(`Server exited with code ${code}`));
        }
      });

      // Give server time to start if no ready message
      setTimeout(() => resolve(), this.SERVER_START_TIMEOUT_MS);
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      this.server.kill();
      this.server = null;
      this.initialized = false;
    }
  }

  isRunning(): boolean {
    return this.server !== null && !this.server.killed;
  }

  async initialize(): Promise<InitializeResult> {
    if (this.initialized) {
      throw new Error('Client already initialized');
    }

    const response = await this.request('initialize', {
      protocolVersion: this.MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: {
        name: 'mcp-stdio-test-client',
        version: '1.0.0',
      },
    });

    this.initialized = true;
    
    // Send initialized notification
    await this.notify('initialized', {});

    return response as InitializeResult;
  }

  async request(method: string, params?: any): Promise<any> {
    if (!this.isRunning()) {
      throw new Error('Server is not running');
    }

    const id = this.requestId++;
    const request: MCPRequest = {
      jsonrpc: this.JSON_RPC_VERSION,
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout for method: ${method}`));
      }, this.REQUEST_TIMEOUT_MS);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      // Send the request
      this.server!.stdin!.write(JSON.stringify(request) + '\n');
    });
  }

  async notify(method: string, params?: any): Promise<void> {
    if (!this.isRunning()) {
      throw new Error('Server is not running');
    }

    const notification = {
      jsonrpc: this.JSON_RPC_VERSION,
      method,
      params,
    };

    this.server!.stdin!.write(JSON.stringify(notification) + '\n');
  }

  private processBuffer(): void {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        try {
          const message: MCPResponse = JSON.parse(line);
          this.handleResponse(message);
        } catch (error) {
          console.error('Failed to parse JSON-RPC message:', line);
        }
      }
    }
  }

  private handleResponse(response: MCPResponse): void {
    if ('id' in response && response.id !== null && response.id !== undefined) {
      const pending = this.pendingRequests.get(response.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(response.id);

        if (response.error) {
          pending.reject(new Error(response.error.message));
        } else {
          pending.resolve(response.result);
        }
      }
    }
  }
}