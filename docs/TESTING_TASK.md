# Comprehensive MCP Server Testing Task

## **Objective**

Create a comprehensive test suite for the MCP Tally API server that tests all tools against a live production server, verifying filters, sorting, pagination, and proper MCP compliance.

## **Critical Learnings & Context**

### **🔧 MCP Tool Implementation Pattern (CRITICAL)**

**❌ WRONG Pattern (Pre-1.12.0):**

```typescript
this.server.tool(
  'tool_name',
  'Description',
  {
    param1: { type: 'string', description: 'Description' },
  },
  async (request): Promise<CallToolResult> => {
    // Arguments NOT accessible - only receives { signal: {}, requestId: 1 }
  }
);
```

**✅ CORRECT Pattern (MCP SDK 1.12.0+):**

```typescript
import { z } from 'zod';

this.server.tool(
  'tool_name',
  'Description',
  {
    param1: z.string().optional().describe('Description'),
    param2: z.number().optional().describe('Number parameter'),
  },
  async ({ param1, param2 }): Promise<CallToolResult> => {
    // Arguments destructured directly from Zod schema
  }
);
```

**Key Requirements:**

- ✅ Use Zod schemas for all parameters
- ✅ Destructure arguments directly in callback
- ✅ Import `z` from 'zod'
- ✅ Use `.describe()` for parameter documentation

### **🧪 Testing Methodology**

**Live Server Testing via JSON-RPC:**

```bash
# Template for testing tools
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "TOOL_NAME", "arguments": {ARGS}}}' | TALLY_API_KEY=YOUR_KEY TRANSPORT_MODE=stdio bun run start

# Resource testing
echo '{"jsonrpc": "2.0", "id": 1, "method": "resources/read", "params": {"uri": "tally://RESOURCE_NAME"}}' | TALLY_API_KEY=YOUR_KEY TRANSPORT_MODE=stdio bun run start

# List available tools
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | TALLY_API_KEY=YOUR_KEY TRANSPORT_MODE=stdio bun run start
```

**Debugging via MCP Inspector:**

```bash
# Start MCP Inspector for interactive testing
bunx @modelcontextprotocol/inspector
# Navigate to http://127.0.0.1:6274
```

### **🚨 Critical MCP Compliance Issues Found**

1. **Integer Precision Loss**: Large organizationIds (like `2206072050022352213`) lose precision with `parseInt()`. Always keep as strings.

2. **Client-Side Processing Violations**:

   - ❌ `.filter()`, `.sort()`, `.slice()` operations
   - ❌ Business logic processing in MCP server
   - ✅ Only API-side filtering, sorting, pagination

3. **GraphQL Variable Handling**:
   - ❌ Duplicate variables (organizationId in both filters and root)
   - ✅ Proper variable structure matching API schema

## **Testing Task Breakdown**

### **Phase 1: Tool Verification & Debugging**

#### **1.1 Verify All Tools Are Exposed**

- [ ] Run `tools/list` and verify all 12 expected tools are present
- [ ] Check each tool has proper schema documentation
- [ ] Verify tool descriptions match functionality

**Expected Tools:**

1. `execute_graphql_query`
2. `get_active_proposals`
3. `get_dao_participants`
4. `get_delegate_statement`
5. `get_delegates`
6. `get_organization`
7. `get_organizations_with_active_proposals`
8. `get_proposal`
9. `get_server_info`
10. `get_user_profile`
11. `list_organizations`
12. `list_proposals`

#### **1.2 Fix Non-Working Tools**

Based on our experience, likely issues:

- [ ] **Zod Schema Issues**: Convert any remaining old-style parameter definitions
- [ ] **Argument Destructuring**: Ensure all tools use `({ param1, param2 }) =>` pattern
- [ ] **Type Validation**: Fix TypeScript compilation errors
- [ ] **GraphQL Query Issues**: Verify API schema compatibility

### **Phase 2: Organization Tools Testing**

#### **2.1 list_organizations**

Test all API-supported filters and sorting:

```bash
# Test cases to implement:
# Basic pagination
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "list_organizations", "arguments": {"pageSize": 5}}}' | TALLY_API_KEY=KEY TRANSPORT_MODE=stdio bun run start

# Chain filtering (Ethereum)
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "list_organizations", "arguments": {"pageSize": 5, "chainId": "eip155:1"}}}' | TALLY_API_KEY=KEY TRANSPORT_MODE=stdio bun run start

# Chain filtering (Arbitrum)
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "list_organizations", "arguments": {"pageSize": 5, "chainId": "eip155:42161"}}}' | TALLY_API_KEY=KEY TRANSPORT_MODE=stdio bun run start

# Logo filtering
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "list_organizations", "arguments": {"pageSize": 5, "hasLogo": true}}}' | TALLY_API_KEY=KEY TRANSPORT_MODE=stdio bun run start

# Popularity sorting (desc)
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "list_organizations", "arguments": {"pageSize": 5, "sortBy": "popular", "sortOrder": "desc"}}}' | TALLY_API_KEY=KEY TRANSPORT_MODE=stdio bun run start

# Name sorting (asc)
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "list_organizations", "arguments": {"pageSize": 5, "sortBy": "name", "sortOrder": "asc"}}}' | TALLY_API_KEY=KEY TRANSPORT_MODE=stdio bun run start

# Combined filters
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "list_organizations", "arguments": {"pageSize": 3, "chainId": "eip155:1", "hasLogo": true, "sortBy": "popular", "sortOrder": "desc"}}}' | TALLY_API_KEY=KEY TRANSPORT_MODE=stdio bun run start
```

**Validation Criteria:**

- [ ] Returns different results for different chains
- [ ] Popularity sorting shows highest member counts first
- [ ] Logo filtering excludes organizations without logos
- [ ] Page size is respected
- [ ] No client-side filtering artifacts

#### **2.2 get_organization**

```bash
# Test by ID (Arbitrum DAO)
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "get_organization", "arguments": {"organizationId": "2206072050315953936"}}}' | TALLY_API_KEY=KEY TRANSPORT_MODE=stdio bun run start

# Test by slug
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "get_organization", "arguments": {"organizationSlug": "arbitrum"}}}' | TALLY_API_KEY=KEY TRANSPORT_MODE=stdio bun run start

# Test precision handling (large ID)
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "get_organization", "arguments": {"organizationId": "2206072050022352213"}}}' | TALLY_API_KEY=KEY TRANSPORT_MODE=stdio bun run start
```

**Validation Criteria:**

- [ ] Returns same result for ID vs slug lookup
- [ ] Large organization IDs handled without precision loss
- [ ] Detailed organization information included

#### **2.3 get_organizations_with_active_proposals**

```bash
# Basic test
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "get_organizations_with_active_proposals", "arguments": {"pageSize": 5}}}' | TALLY_API_KEY=KEY TRANSPORT_MODE=stdio bun run start

# Chain filtering
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "get_organizations_with_active_proposals", "arguments": {"pageSize": 5, "chainId": "eip155:1"}}}' | TALLY_API_KEY=KEY TRANSPORT_MODE=stdio bun run start
```

### **Phase 3: Proposal Tools Testing**

#### **3.1 list_proposals**

```bash
# Basic test (Arbitrum DAO)
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "list_proposals", "arguments": {"organizationId": "2206072050315953936", "pageSize": 5}}}' | TALLY_API_KEY=KEY TRANSPORT_MODE=stdio bun run start

# Test sorting (ascending by date)
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "list_proposals", "arguments": {"organizationId": "2206072050315953936", "pageSize": 5, "sortOrder": "asc"}}}' | TALLY_API_KEY=KEY TRANSPORT_MODE=stdio bun run start

# Test with 0x Protocol Treasury (has 1 proposal)
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "list_proposals", "arguments": {"organizationId": "2206072050022352213", "pageSize": 5}}}' | TALLY_API_KEY=KEY TRANSPORT_MODE=stdio bun run start
```

**Known Working Organization IDs:**

- `2206072050315953936` - Arbitrum (74 proposals)
- `2206072050022352213` - 0x Protocol Treasury (1 proposal)
- `2206072050458560434` - Uniswap (81 proposals)

#### **3.2 get_proposal**

```bash
# Test with known proposal ID from list_proposals results
# (Use actual proposal ID from list_proposals output)
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "get_proposal", "arguments": {"organizationId": "2206072050022352213", "proposalId": "ACTUAL_PROPOSAL_ID"}}}' | TALLY_API_KEY=KEY TRANSPORT_MODE=stdio bun run start
```

#### **3.3 get_active_proposals**

```bash
# Cross-organization active proposals
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "get_active_proposals", "arguments": {"pageSize": 5}}}' | TALLY_API_KEY=KEY TRANSPORT_MODE=stdio bun run start

# Chain-specific active proposals
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "get_active_proposals", "arguments": {"pageSize": 5, "chainId": "eip155:1"}}}' | TALLY_API_KEY=KEY TRANSPORT_MODE=stdio bun run start
```

### **Phase 4: User & Delegation Tools Testing**

**Note**: These tools may need GraphQL schema updates based on actual Tally API structure.

#### **4.1 Basic Functionality Tests**

```bash
# Test with known addresses (use addresses from proposal data)
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "get_user_daos", "arguments": {"address": "REAL_ADDRESS"}}}' | TALLY_API_KEY=KEY TRANSPORT_MODE=stdio bun run start

echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "get_delegates", "arguments": {"organizationId": "2206072050315953936", "pageSize": 5}}}' | TALLY_API_KEY=KEY TRANSPORT_MODE=stdio bun run start
```

### **Phase 5: Resource Testing**

#### **5.1 Popular DAOs Resource**

```bash
# Test resource access
echo '{"jsonrpc": "2.0", "id": 1, "method": "resources/read", "params": {"uri": "tally://popular-daos"}}' | TALLY_API_KEY=KEY TRANSPORT_MODE=stdio bun run start

# Test server info resource
echo '{"jsonrpc": "2.0", "id": 1, "method": "resources/read", "params": {"uri": "tally://server/info"}}' | TALLY_API_KEY=KEY TRANSPORT_MODE=stdio bun run start
```

**Validation Criteria:**

- [ ] Popular DAOs resource contains 27 DAOs
- [ ] Multi-chain coverage (5 networks)
- [ ] No testnet chains included
- [ ] Proper JSON structure with metadata

### **Phase 6: Error Handling & Edge Cases**

#### **6.1 Invalid Parameters**

```bash
# Invalid organization ID
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "get_organization", "arguments": {"organizationId": "invalid_id"}}}' | TALLY_API_KEY=KEY TRANSPORT_MODE=stdio bun run start

# Invalid chain ID
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "list_organizations", "arguments": {"chainId": "invalid:chain"}}}' | TALLY_API_KEY=KEY TRANSPORT_MODE=stdio bun run start

# Page size too large
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "list_organizations", "arguments": {"pageSize": 200}}}' | TALLY_API_KEY=KEY TRANSPORT_MODE=stdio bun run start
```

#### **6.2 Empty Results**

```bash
# Organization with no proposals
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "list_proposals", "arguments": {"organizationId": "EMPTY_ORG_ID", "pageSize": 5}}}' | TALLY_API_KEY=KEY TRANSPORT_MODE=stdio bun run start
```

## **Implementation Requirements**

### **Test Suite Structure**

Create `tests/live-server.test.ts` with:

- [ ] Jest/Vitest test framework
- [ ] Organized test suites by tool category
- [ ] Real API key configuration
- [ ] Timeout handling for network requests
- [ ] Response validation schemas
- [ ] Error case testing

### **Test Data Management**

- [ ] Use known working organization IDs from popular-daos resource
- [ ] Extract real addresses from API responses for user testing
- [ ] Document expected response structures
- [ ] Track changes in API behavior

### **Continuous Integration**

- [ ] Environment variable configuration for CI
- [ ] Rate limiting considerations
- [ ] Test result reporting
- [ ] Performance benchmarking

## **Success Criteria**

### **Tool Functionality (12/12 tools working)**

- [ ] All tools respond without errors
- [ ] Parameter validation works correctly
- [ ] API-side filtering/sorting verified
- [ ] No client-side processing violations

### **Data Quality**

- [ ] Responses match expected schemas
- [ ] Multi-chain data properly segregated
- [ ] Precision handling for large numbers
- [ ] Proper error messages for edge cases

### **Performance**

- [ ] Response times under 5 seconds
- [ ] Proper pagination behavior
- [ ] Resource usage monitoring
- [ ] No memory leaks in long-running tests

### **MCP Compliance**

- [ ] 100% API-side processing verified
- [ ] No client-side filtering artifacts
- [ ] Proper resource format compliance
- [ ] Tool schema validation

## **Debugging Procedures**

### **When Tools Don't Work**

1. **Check Tool Registration**: Use `tools/list` to verify tool exists
2. **Validate Schema**: Ensure Zod schemas are properly defined
3. **Test Arguments**: Use MCP Inspector for interactive debugging
4. **Check GraphQL**: Test raw GraphQL queries with cURL
5. **Verify API Key**: Ensure TALLY_API_KEY is valid and has permissions

### **API Issues**

1. **Schema Validation**: Use GraphQL introspection to verify field availability
2. **Variable Handling**: Check variable structure matches API expectations
3. **Type Conversion**: Ensure proper string/number handling for IDs
4. **Rate Limiting**: Implement backoff strategies for API limits

### **Performance Issues**

1. **Query Optimization**: Use only required fields in GraphQL queries
2. **Pagination**: Implement proper page size limits
3. **Caching**: Consider response caching for static data
4. **Connection Pooling**: Optimize HTTP connection handling

This comprehensive testing task will ensure the MCP Tally API server is production-ready with full functionality verification and compliance validation.
