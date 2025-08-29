# Testing Approaches for MCP Tally API

This document outlines the various testing methodologies used in the MCP Tally API project and provides guidance on when to use each approach.

## 1. JSON-RPC over stdio Testing (Pipe-based Testing)

### What it is
Direct testing of the Model Context Protocol (MCP) server using stdio transport mode. This simulates exactly how MCP clients (like Cursor or Claude Desktop) communicate with the server.

### Command Structure
```bash
echo '{"jsonrpc": "2.0", "id": 1, "method": "METHOD_NAME", "params": {...}}' | \
TALLY_API_KEY=your_api_key \
TRANSPORT_MODE=stdio \
bun run dist/index.js
```

### Example Commands

#### Test Popular DAOs Resource
```bash
echo '{"jsonrpc": "2.0", "id": 1, "method": "resources/read", "params": {"uri": "tally://popular-daos"}}' | \
TALLY_API_KEY=your_api_key_here \
TRANSPORT_MODE=stdio \
bun run dist/index.js
```

#### Test Organizations Tool
```bash
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "get_organizations_with_active_proposals", "arguments": {}}}' | \
TALLY_API_KEY=your_api_key_here \
TRANSPORT_MODE=stdio \
bun run dist/index.js
```

### Advantages
- ✅ **Direct Protocol Testing** - Tests actual MCP protocol implementation
- ✅ **Fast & Lightweight** - No test setup overhead, ~1-2 second execution
- ✅ **Real-world Simulation** - Exactly mimics MCP client communication
- ✅ **Easy Debugging** - Raw JSON-RPC requests/responses visible
- ✅ **Environment Testing** - Validates environment variable handling
- ✅ **CI/CD Friendly** - Perfect for smoke tests in pipelines

### Disadvantages
- ❌ **Limited Complexity** - Hard to test complex scenarios
- ❌ **Manual Process** - Requires manual command construction
- ❌ **No Test Framework** - No assertions, mocking, or test organization

### When to Use
- Quick validation during development
- Testing MCP protocol compliance
- Debugging transport issues
- CI/CD pipeline smoke tests
- Validating environment configuration

## 2. MCP Inspector (GUI Testing)

### What it is
Visual web interface for testing MCP servers provided by `@modelcontextprotocol/inspector`.

### Setup
```bash
npx @modelcontextprotocol/inspector
# Or with custom command:
npx @modelcontextprotocol/inspector --command bun --args "run dist/index.js"
```

### Access
- Opens web interface at `http://localhost:5173`
- Provides GUI for testing tools, resources, and prompts
- Real-time interaction with MCP server

### Advantages
- ✅ **Visual Interface** - Easy point-and-click testing
- ✅ **Real-time Interaction** - Live server communication
- ✅ **No Command Construction** - GUI handles JSON-RPC formatting
- ✅ **Tool Discovery** - Automatically lists available tools/resources

### Disadvantages
- ❌ **Port Conflicts** - May conflict with other services (5173, 3000)
- ❌ **Setup Overhead** - Requires inspector installation and setup
- ❌ **Not Scriptable** - Manual testing only

### Known Issues
- Port 5173 conflicts (EADDRINUSE errors)
- Environment variable parsing issues with `--env` flag
- Complex setup with custom commands

### When to Use
- Interactive development and exploration
- Manual testing of complex scenarios
- Debugging tool parameter validation
- Demo and presentation purposes

## 3. cURL + Tally API Testing

### What it is
Direct testing against the Tally GraphQL API to validate queries and responses.

### Example Commands

#### Test Chains Query
```bash
curl -X POST https://api.tally.xyz/query \
  -H "Content-Type: application/json" \
  -H "Api-Key: your_api_key" \
  -d '{"query": "query GetAllChains { chains { id name mediumName shortName isTestnet blockTime } }"}'
```

#### Test Organizations Query
```bash
curl -X POST https://api.tally.xyz/query \
  -H "Content-Type: application/json" \
  -H "Api-Key: your_api_key" \
  -d '{"query": "query GetOrganizations { organizations(input: { sort: { sortBy: explore } }) { nodes { ... on Organization { id name hasActiveProposals } } } }"}'
```

### Advantages
- ✅ **API Validation** - Tests actual Tally API integration
- ✅ **Query Development** - Perfect for developing GraphQL queries
- ✅ **Fast Feedback** - Immediate API response validation
- ✅ **Debugging** - Isolates API issues from MCP layer

### When to Use
- Developing new GraphQL queries
- Debugging API integration issues
- Validating API key and permissions
- Understanding API response structures

## 4. Manual Test Suite

### What it is
Custom Node.js script that runs comprehensive tests across all tools and resources.

### Location
`scripts/test-manual.sh` - Shell script that runs JSON-RPC tests

### Example Usage
```bash
chmod +x scripts/test-manual.sh
TALLY_API_KEY=your_api_key ./scripts/test-manual.sh
```

### Coverage
- All 12 MCP tools
- All 2 MCP resources (including popular DAOs)
- Connection testing
- Error handling validation

### Advantages
- ✅ **Comprehensive** - Tests entire MCP interface
- ✅ **Automated** - Single command runs all tests
- ✅ **Fast** - Completes in ~10 seconds
- ✅ **Scriptable** - Can be integrated into CI/CD

### When to Use
- Pre-deployment validation
- Regression testing after changes
- CI/CD pipeline integration
- Full system health checks

## 5. Integration Testing Recommendations

### Unit Tests (Recommended for Future)
```typescript
// Example with Jest/Vitest
describe('TallyGraphQLClient', () => {
  it('should fetch organizations', async () => {
    const client = new TallyGraphQLClient(mockAuth);
    const result = await client.query(organizationsQuery, {});
    expect(result.organizations).toBeDefined();
  });
});
```

### End-to-End Tests (Future Consideration)
```typescript
// Example with Playwright or similar
test('MCP server responds to tools/call', async () => {
  const response = await sendMCPMessage({
    method: 'tools/call',
    params: { name: 'get_server_info', arguments: {} }
  });
  expect(response.result).toBeDefined();
});
```

## Current Project Status

### ✅ Completed Features

#### Popular DAOs Resource (Fully Dynamic)
- **Status**: ✅ Complete and working
- **Features**:
  - Fetches ALL 90 supported chains dynamically from Tally API
  - Loads popular DAOs from 40 production networks (excludes 50 testnets)
  - Provides comprehensive lookup dictionaries (by name, slug, ID)
  - Graceful error handling without server crashes
  - Real-time data loading (no async startup issues)

#### MCP Tools (12 total)
- **Status**: ✅ All working and tested
- **Tools**:
  1. `execute_graphql_query` - Raw GraphQL query execution
  2. `get_active_proposals` - Cross-organization active proposals
  3. `get_dao_participants` - DAO member listing
  4. `get_delegate_statement` - Delegate statement information
  5. `get_delegates` - Delegate information and rankings
  6. `get_organization` - Single organization details
  7. `get_organizations_with_active_proposals` - Active proposal filtering
  8. `get_proposal` - Single proposal details
  9. `get_server_info` - Server metadata
  10. `get_user_profile` - User profile information
  11. `list_organizations` - Organization listing with filters
  12. `list_proposals` - Proposal listing for organizations

#### MCP Resources (2 total)
- **Status**: ✅ Both working
- **Resources**:
  1. `tally://server/info` - Server status and metadata
  2. `tally://popular-daos` - Dynamic popular DAOs data

#### Key Fixes Applied
- ✅ **Removed client-side filtering** (forbidden by MCP rules)
- ✅ **Implemented server-side sorting** using Tally's `explore` sort
- ✅ **Eliminated all console logs** from production code
- ✅ **Fixed Popular DAOs resource** to load dynamically and synchronously
- ✅ **Proper error handling** without server crashes

### 🔧 Technical Debt & Known Issues

#### TypeScript Compilation Warnings
- **Issue**: "Type instantiation is excessively deep and possibly infinite" in `src/index.ts`
- **Location**: Lines 132 and 387 (tool definitions)
- **Impact**: Compilation warnings, no runtime impact
- **Priority**: Low (cosmetic issue)

#### MCP Inspector Issues
- **Issue**: Port conflicts and environment variable parsing
- **Workaround**: Use pipe-based testing instead
- **Priority**: Low (alternative testing methods work fine)

### 🚀 Performance Metrics

#### API Response Times
- **Tally API**: ~200-500ms per query
- **Popular DAOs Resource**: ~3-5 seconds (loads 8 chains × 10 DAOs each)
- **Individual Tools**: ~500ms-2s depending on complexity

#### Data Volumes
- **Total Chains**: 90 (40 production, 50 testnets)
- **Popular DAOs Loaded**: 41 from 6 active chains
- **Lookup Dictionaries**: 3 types (name, slug, ID)

### 🔄 Maintenance & Monitoring

#### Health Checks
- Use `get_server_info` tool for basic health monitoring
- Popular DAOs resource includes error status in response
- All tools include proper error handling and reporting

#### API Key Management
- Required for all operations
- Set via `TALLY_API_KEY` environment variable
- Validated on server startup

#### Logging
- No console logs in production (MCP compliance)
- Errors returned as proper JSON-RPC error responses
- Graceful degradation on API failures

## Best Practices

### Development Workflow
1. **Start with cURL** - Test Tally API queries directly
2. **Use pipe testing** - Quick validation of MCP integration
3. **Run manual test suite** - Comprehensive validation
4. **Deploy incrementally** - Test one tool at a time

### Error Handling
- Always return proper JSON-RPC error responses
- Never crash the server on API failures
- Include helpful error messages for debugging
- Log errors appropriately (not to console in production)

### Performance Considerations
- Popular DAOs resource caches nothing (always fresh data)
- Consider implementing caching for high-frequency tools
- Monitor API rate limits and implement backoff strategies
- Use pagination for large datasets

This comprehensive testing approach ensures robust, reliable MCP server operation while maintaining compliance with MCP protocol requirements and providing excellent developer experience. 