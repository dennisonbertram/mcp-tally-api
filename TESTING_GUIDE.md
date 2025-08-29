# 🧪 **MCP Tally API Server - Testing Guide**

This project includes comprehensive automated testing for all MCP tools, resources, and protocol compliance.

## 🚀 **Quick Start**

### **Prerequisites**
1. **API Key**: Set your Tally API key in `.env`
2. **Dependencies**: Run `npm install`  
3. **Build**: Run `npm run build`

### **Running Tests**

#### **All Tests (Recommended)**
```bash
npm test
```

#### **Specific Test Suites**
```bash
# MCP Protocol Compliance (fast)
npx vitest tests/mcp-protocol-compliance.test.ts

# All 12 Tools Integration (slower - real API calls)  
npx vitest tests/tools-integration.test.ts

# MCP Client Utilities
npx vitest tests/mcp-stdio-client.test.ts
```

## ⚡ **Rate Limiting**

Tests automatically include **3-second delays** between API calls to prevent rate limiting:

```
⏳ Rate limiting: waiting 2847ms before next API call
```

- **Tools tests take ~3 minutes** (12 tools × 3 seconds + processing time)
- **Protocol tests are fast** (no API calls)
- Tests run **sequentially** to avoid parallel API abuse

## 📋 **Test Coverage**

### **✅ All 12 MCP Tools**
1. `get_server_info` - Server metadata
2. `list_organizations` - DAO listing with pagination
3. `get_organization` - Specific DAO details (tests with Aave)
4. `get_organizations_with_active_proposals` - Active proposal filtering
5. `list_proposals` - Proposal listing (tests with Arbitrum)
6. `get_proposal` - Specific proposal details
7. `get_active_proposals` - Currently votable proposals
8. `get_user_profile` - User participation data
9. `get_delegate_statement` - Delegate information
10. `get_dao_participants` - DAO member lists
11. `get_delegates` - Enhanced delegate data with voting power
12. `execute_graphql_query` - Custom GraphQL execution

### **✅ MCP Protocol Compliance**
- JSON-RPC 2.0 initialization handshake
- Capability discovery (tools, resources, prompts)
- Server information validation
- Error handling scenarios

### **✅ Resources Testing**
- `tally://server/info` - Server status
- `tally://popular-daos` - Popular DAOs data
- `tally://trending/proposals` - Trending proposals
- `tally://api/schema` - API schema information

## 🎯 **Performance Benchmarks**

- **Response Time**: < 5 seconds per API call
- **Success Rate**: 100% with proper API key
- **Rate Limit Compliance**: 3-second delays prevent violations

## 🛠 **Troubleshooting**

### **API Key Issues**
```bash
⚠️ TALLY_API_KEY not set - live tests will fail
```
**Solution**: Add your API key to `.env` file

### **Rate Limit Errors**
```bash
SyntaxError: Unexpected token 'A', "API rate l"... is not valid JSON
```
**Solution**: Rate limiter should prevent this. If it persists, increase delay in `tests/helpers/rate-limiter.ts`

### **Test Failures**
1. **Check API key** is valid and set in `.env`
2. **Verify network connectivity** to `api.tally.xyz`
3. **Ensure server builds** with `npm run build`
4. **Run tests individually** to isolate issues

## 📊 **Expected Results**

### **Passing Tests**
```
✓ tests/mcp-protocol-compliance.test.ts (15 tests passing)
✓ tests/tools-integration.test.ts (13 tools tests passing) 
✓ tests/mcp-stdio-client.test.ts (5 client tests passing)
```

### **Test Timing**
- **Protocol tests**: ~10 seconds
- **Tools integration**: ~3-5 minutes (due to rate limiting)
- **Client tests**: ~5 seconds

The slower timing is intentional to ensure reliable API testing without hitting rate limits.

---

**📝 Note**: Tests use **real Tally API data** as benchmarks from manual testing. This ensures accuracy but requires network connectivity and valid API credentials.