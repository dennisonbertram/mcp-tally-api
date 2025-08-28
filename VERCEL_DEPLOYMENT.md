# Vercel Deployment Guide for MCP Tally API

## 🚀 Quick Deploy

### Option 1: One-Click Deploy
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fdennisonbertram%2Fmcp-tally-api&env=TALLY_API_KEY&envDescription=Get%20your%20free%20API%20key%20from%20Tally.xyz)

### Option 2: Vercel CLI Deploy

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy the project
vercel --prod

# Set environment variables
vercel env add TALLY_API_KEY
```

## 📋 Prerequisites

1. **Tally API Key**: Get your free API key from [Tally.xyz](https://tally.xyz)
2. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)

## ⚙️ Configuration

### Environment Variables
Set these in your Vercel dashboard or via CLI:

```bash
TALLY_API_KEY=your_api_key_here
ENABLE_SSE=true
TRANSPORT_MODE=http
NODE_ENV=production
```

### vercel.json Configuration
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "functions": {
    "api/mcp.js": {
      "memory": 1024,
      "maxDuration": 30,
      "runtime": "nodejs22.x"
    }
  },
  "regions": ["iad1"],
  "env": {
    "TALLY_API_KEY": "@tally-api-key",
    "ENABLE_SSE": "true",
    "TRANSPORT_MODE": "http",
    "NODE_ENV": "production"
  }
}
```

## 🔗 API Endpoints

Once deployed, your MCP server will be available at:

- **Production**: `https://your-deployment.vercel.app/api/mcp`
- **Preview**: `https://your-deployment-preview.vercel.app/api/mcp`

### Usage Examples

#### Initialize MCP Session
```bash
curl -X POST https://your-deployment.vercel.app/api/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {"tools": {}, "resources": {}},
      "clientInfo": {"name": "test-client", "version": "1.0.0"}
    }
  }'
```

#### Call MCP Tools
```bash
curl -X POST https://your-deployment.vercel.app/api/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "get_server_info",
      "arguments": {}
    }
  }'
```

## 🏗️ Architecture

### Serverless Function Structure
```
api/
└── mcp.js              # Main Vercel Function
    ├── Handles POST    # Tool calls & initialization
    ├── Handles GET     # SSE streaming (if enabled)
    └── Handles DELETE  # Session cleanup
```

### Features Supported
- ✅ **All 12 MCP Tools** - Complete governance API access
- ✅ **7 Resources** - Dynamic data resources  
- ✅ **6 Prompts** - Interactive governance prompts
- ✅ **Stateless Mode** - Optimized for serverless
- ✅ **Auto-scaling** - Handles traffic spikes automatically
- ✅ **Global CDN** - Low latency worldwide

## 📊 Performance & Limits

### Vercel Function Limits
- **Memory**: 1024 MB (configurable up to 3008 MB)
- **Timeout**: 30 seconds (configurable up to 300s on Pro)
- **Cold Start**: ~100ms (faster than traditional servers)
- **Concurrent**: 1000+ requests per second

### Cost Optimization
- **Hobby Plan**: 100GB-hrs free monthly
- **Pro Plan**: $20/month + usage
- **Pay-per-use**: Only charged for execution time

## 🔧 Development

### Local Testing
```bash
# Install Vercel CLI
npm install -g vercel

# Start development server
vercel dev

# Test the function locally
curl http://localhost:3000/api/mcp
```

### Build Process
```bash
# Build the project
npm run build

# Preview deployment
vercel --prod --dry-run
```

## 🛡️ Security

### Environment Variables
- All sensitive data stored in Vercel environment variables
- API keys encrypted at rest and in transit
- No secrets in code or version control

### CORS Configuration
- Configured for MCP protocol compatibility
- Supports all required MCP headers
- Allows GET, POST, DELETE methods

## 📈 Monitoring

### Vercel Analytics
- Real-time function metrics
- Performance insights
- Error tracking and logs

### Custom Monitoring
```javascript
// Add to your function for custom metrics
console.log('MCP Tool Called:', toolName, {
  sessionId,
  timestamp: new Date().toISOString(),
  executionTime: performance.now() - startTime
});
```

## 🚀 Advanced Configuration

### Multiple Regions
```json
{
  "regions": ["iad1", "sfo1", "fra1"]
}
```

### Function-Specific Memory
```json
{
  "functions": {
    "api/mcp.js": {
      "memory": 2048,
      "maxDuration": 60
    }
  }
}
```

### Custom Headers
```json
{
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {"key": "X-MCP-Version", "value": "1.2.0"}
      ]
    }
  ]
}
```

## 📚 Resources

- [Vercel Functions Documentation](https://vercel.com/docs/functions)
- [MCP Protocol Specification](https://spec.modelcontextprotocol.io)
- [Tally API Documentation](https://docs.tally.xyz)

## 💡 Tips

1. **Cold Starts**: Use `vercel --prod` for production deployment to minimize cold starts
2. **Caching**: Leverage Vercel's Edge Cache for frequently accessed data
3. **Regions**: Deploy to regions closest to your users for best performance
4. **Monitoring**: Set up alerts for function errors and timeouts

## 🐛 Troubleshooting

### Common Issues

#### "Function timeout after 30s"
- Increase `maxDuration` in `vercel.json`
- Optimize database queries
- Consider caching for heavy operations

#### "API Key not found"
- Verify `TALLY_API_KEY` is set in Vercel dashboard
- Run `vercel env pull` to sync locally

#### "CORS errors"
- Check headers configuration in `vercel.json`
- Verify client is sending correct `Content-Type`

### Debug Logs
```bash
# View function logs
vercel logs your-deployment-url

# Stream real-time logs
vercel logs --follow
```

---

**🎉 Your MCP Tally API server is now running on Vercel's global edge network!**