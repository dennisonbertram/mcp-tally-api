// Minimal app.js to satisfy Vercel auto-detection
// All functionality is in api/mcp.js
export default function handler(req, res) {
  // Redirect all requests to the MCP API endpoint
  res.writeHead(302, { Location: '/api/mcp' });
  res.end();
}