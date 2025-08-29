// Minimal entry point to satisfy Vercel's detection
// Actual MCP functionality is at /api/mcp

export default function handler(req, res) {
  // Redirect to the MCP API endpoint
  res.writeHead(302, { Location: '/api/mcp' });
  res.end('MCP Server - Use /api/mcp endpoint');
}