// Simple entrypoint for Vercel Node.js deployment
export default function handler(req, res) {
  res.json({
    name: 'MCP Tally API',
    version: '1.2.0',
    message: 'MCP server is running',
    endpoints: {
      mcp: '/api/mcp'
    }
  });
}