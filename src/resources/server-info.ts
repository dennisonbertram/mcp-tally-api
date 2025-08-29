/**
 * Server Info Resource
 *
 * This resource provides static information about the MCP Tally API server,
 * including version, status, and operational metadata.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * Register the server info resource with the MCP server
 * 
 * @param server - The McpServer instance to register the resource with
 */
export function registerServerInfoResource(server: McpServer): void {
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
}