# Manual STDIO Testing Guide

This guide provides exact bash commands for testing the MCP Tally API server via stdio transport.

## Prerequisites

Ensure you have the API key from `.env` file:
```bash
TALLY_API_KEY="a0a1fc409fddd75d86d603c71ba217d7512a7bfaf4e20e0eab97bb32dd84d297"
```

## Test Commands

All commands work perfectly. The stdio transport is fully functional.

### 1. Initialize
```bash
echo '{"jsonrpc":"2.0","method":"initialize","id":1,"params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test-client","version":"1.0.0"}}}' | TALLY_API_KEY="a0a1fc409fddd75d86d603c71ba217d7512a7bfaf4e20e0eab97bb32dd84d297" node dist/index.js
```

### 2. List Tools  
```bash
echo '{"jsonrpc":"2.0","method":"tools/list","id":2,"params":{}}' | TALLY_API_KEY="a0a1fc409fddd75d86d603c71ba217d7512a7bfaf4e20e0eab97bb32dd84d297" node dist/index.js
```

### 3. Call a Tool
```bash
echo '{"jsonrpc":"2.0","method":"tools/call","id":3,"params":{"name":"get_server_info","arguments":{}}}' | TALLY_API_KEY="a0a1fc409fddd75d86d603c71ba217d7512a7bfaf4e20e0eab97bb32dd84d297" node dist/index.js
```

### 4. List Resources
```bash
echo '{"jsonrpc":"2.0","method":"resources/list","id":4,"params":{}}' | TALLY_API_KEY="a0a1fc409fddd75d86d603c71ba217d7512a7bfaf4e20e0eab97bb32dd84d297" node dist/index.js
```

### 5. Read Resource  
```bash
echo '{"jsonrpc":"2.0","method":"resources/read","id":5,"params":{"uri":"tally://server/info"}}' | TALLY_API_KEY="a0a1fc409fddd75d86d603c71ba217d7512a7bfaf4e20e0eab97bb32dd84d297" node dist/index.js
```

### 6. List Prompts
```bash
echo '{"jsonrpc":"2.0","method":"prompts/list","id":6,"params":{}}' | TALLY_API_KEY="a0a1fc409fddd75d86d603c71ba217d7512a7bfaf4e20e0eab97bb32dd84d297" node dist/index.js
```

### 7. Test Advanced Tool - Delegate Leaderboard
```bash
echo '{"jsonrpc":"2.0","method":"tools/call","id":7,"params":{"name":"get_delegate_leaderboard","arguments":{"organizationId":"2206072050315953936","limit":3}}}' | TALLY_API_KEY="a0a1fc409fddd75d86d603c71ba217d7512a7bfaf4e20e0eab97bb32dd84d297" node dist/index.js
```

### 8. Test Delegation Status Tool
```bash
echo '{"jsonrpc":"2.0","method":"tools/call","id":8,"params":{"name":"get_delegation_status","arguments":{"address":"0xb4c064f466931B8d0F637654c916E3F203c46f13","organizationId":"2206072050315953936"}}}' | TALLY_API_KEY="a0a1fc409fddd75d86d603c71ba217d7512a7bfaf4e20e0eab97bb32dd84d297" node dist/index.js
```

## Server Capabilities Verified

✅ **20 Total Tools** - Expanded from original 12  
✅ **4 Enhanced Resources** - Including practical GraphQL examples  
✅ **6 Governance Prompts** - AI-powered analysis templates  
✅ **Full MCP Protocol Compliance** - All methods working  
✅ **Real-time Tally API Integration** - Live governance data  

## Recent Tool Additions

The server now includes these advanced governance tools:
- `get_delegate_leaderboard` - Top delegates with analytics
- `get_voter_profile` - Comprehensive voter analysis  
- `get_recent_votes` - Cross-DAO voting activity
- `get_proposal_summary` - Enhanced proposal analysis
- `get_delegation_status` - Delegation information
- `get_dao_voting_stats` - DAO participation metrics
- `get_proposal_timeline` - Proposal lifecycle tracking
- `get_vote_history` - Historical voting patterns

All commands have been manually tested and work perfectly with the stdio transport.