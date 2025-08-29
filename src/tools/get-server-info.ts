import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * Tool for getting information about the MCP Tally API server
 * 
 * This tool provides basic server information including:
 * - Server name and version
 * - Transport mode
 * - API configuration status
 * - Current timestamp
 */

// Environment configuration
const TALLY_API_URL = process.env.TALLY_API_URL || 'https://api.tally.xyz/query';
const TALLY_API_KEY = process.env.TALLY_API_KEY;
const TRANSPORT_MODE = process.env.TRANSPORT_MODE || 'stdio';

/**
 * Registers the get_server_info tool with an MCP server instance
 * 
 * @param server - The MCP server instance to register the tool with
 */
export function registerGetServerInfoTool(server: McpServer): void {
  server.tool(
    'get_server_info',
    'Get information about the MCP Tally API server',
    {},
    async (): Promise<CallToolResult> => {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                name: 'mcp-tally-api',
                version: '1.1.0',
                transport: TRANSPORT_MODE,
                tally_api_url: TALLY_API_URL,
                api_key_configured: !!TALLY_API_KEY,
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