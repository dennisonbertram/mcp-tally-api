// Minimal server.js for Vercel deployment
// The actual MCP server functionality is in /api/mcp

console.log('MCP Tally API Server - Use /api/mcp for MCP functionality');

export default function handler(req, res) {
  // Basic health check endpoint
  if (req.url === '/health') {
    return res.json({ status: 'ok', timestamp: new Date().toISOString() });
  }
  
  // Redirect to API documentation
  res.writeHead(302, { Location: '/api/mcp' });
  res.end();
}