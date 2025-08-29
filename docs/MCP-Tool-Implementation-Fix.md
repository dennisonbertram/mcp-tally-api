# MCP Tool Implementation Fix - Critical Reference

## Problem Summary

The MCP SDK version 1.12.0 tool handlers were not receiving arguments correctly. Tool calls were failing because the handler function signature and parameter schema definition were incorrect.

## Root Cause

The issue was using the wrong API pattern for defining MCP tools. The tool handler was receiving only `{ signal: {}, requestId: 1 }` instead of the actual arguments from the JSON-RPC call.

## Key Fix Required

### ❌ WRONG - Old Pattern (Doesn't Work)

```typescript
// DON'T USE - This pattern fails in MCP SDK 1.12.0
this.server.tool(
  'tool_name',
  'Description',
  {
    param1: {
      type: 'string',
      description: 'Description',
    },
    param2: {
      type: 'number',
      description: 'Description',
    },
  },
  async (request): Promise<CallToolResult> => {
    // request only contains { signal: {}, requestId: 1 }
    // Arguments are NOT accessible here
    const args = request.arguments; // undefined
  }
);
```

### ✅ CORRECT - New Pattern (Works)

```typescript
import { z } from 'zod';

// USE THIS - Correct pattern for MCP SDK 1.12.0
this.server.tool(
  'tool_name',
  'Description',
  {
    param1: z.string().optional().describe('Description'),
    param2: z.number().optional().describe('Description'),
  },
  async ({ param1, param2 }): Promise<CallToolResult> => {
    // Arguments are destructured directly from first parameter
    // param1 and param2 are now accessible!
  }
);
```

## Required Changes

### 1. Import Zod

```typescript
import { z } from 'zod';
```

### 2. Use Zod Schemas for Parameters

```typescript
// Replace plain objects with Zod schemas
{
  page: z.number().optional().describe('Page number (default: 1)'),
  pageSize: z.number().optional().describe('Number of organizations per page'),
  nameFilter: z.string().optional().describe('Filter by name or description'),
  sortBy: z.string().optional().describe('Sort field'),
  sortOrder: z.string().optional().describe('Sort order: asc or desc'),
}
```

### 3. Destructure Parameters in Handler

```typescript
async ({
  page,
  pageSize,
  nameFilter,
  sortBy,
  sortOrder,
}): Promise<CallToolResult> => {
  // Parameters are directly accessible as destructured variables
  const mappedArgs = {
    page,
    pageSize,
    filter: nameFilter, // Can map/rename as needed
    sortBy,
    sortOrder,
  };

  // Rest of implementation...
};
```

## Testing Verification

### Before Fix

```bash
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "list_organizations", "arguments": {"page": 1, "pageSize": 5}}}' | bun run start
# Result: Returns all 20 organizations (parameters ignored)
```

### After Fix

```bash
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "list_organizations", "arguments": {"page": 1, "pageSize": 5}}}' | bun run start
# Result: Returns exactly 5 organizations (parameters working!)
```

## Key Insights

1. **MCP SDK 1.12.0 requires Zod schemas** - Plain object parameter definitions don't work
2. **Arguments are destructured from first parameter** - Not accessible via request object
3. **Second parameter contains MCP context** - Like `{ sendNotification }` for advanced features
4. **Debug logs interfere with MCP protocol** - Remove all console.log/console.error from handlers

## Reference Implementation

See `SimpleStatelessStreamable.txt` for the canonical example:

```typescript
server.tool(
  'start-notification-stream',
  'Description',
  {
    interval: z.number().describe('Interval in milliseconds').default(100),
    count: z.number().describe('Number of notifications').default(10),
  },
  async (
    { interval, count },
    { sendNotification }
  ): Promise<CallToolResult> => {
    // interval and count are directly accessible
    // sendNotification is available from MCP context
  }
);
```

## Apply This Pattern to All Tools

This fix must be applied to ALL remaining tools:

- `get_organization`
- `get_organizations_with_active_proposals`
- `list_proposals`
- `get_proposal`
- `get_active_proposals`
- `get_user_profile`
- `get_dao_participants`
- `get_delegate_statement`
- `get_delegates`
- `execute_graphql_query`

Each tool needs:

1. Zod schema parameter definitions
2. Destructured parameter handler signature
3. Removal of any debug console statements
4. Testing with actual JSON-RPC calls to verify arguments work

## Success Criteria

✅ **Filtering works**: `nameFilter: "test"` returns only organizations with "test" in name/description
✅ **Pagination works**: `pageSize: 5` returns exactly 5 results with correct pagination metadata  
✅ **Sorting works**: `sortBy: "memberCount", sortOrder: "desc"` sorts correctly
✅ **No debug interference**: Clean MCP protocol communication without console logs

## 🎯 **Critical Filtering & Performance Fix**

### Problem with Client-Side Filtering

Originally implemented client-side filtering where the MCP server would:

1. Fetch data from API
2. Apply filtering in JavaScript
3. Return filtered results

This approach is **fundamentally wrong** because:

- **Performance**: Fetches unnecessary data from API
- **Scalability**: Doesn't scale with large datasets
- **Resource waste**: Network bandwidth and processing overhead
- **Limited results**: May miss matching items in later pages

### ✅ **Correct Solution: API-Side Filtering**

**Rule**: All filtering, sorting, and processing should happen at the API level, never in the MCP server.

**Before (Wrong)**:

```typescript
// ❌ DON'T DO THIS - Client-side filtering
const allData = await api.getAllData();
const filtered = allData.filter((item) => item.name.includes(filter));
return paginate(filtered);
```

**After (Correct)**:

```typescript
// ✅ DO THIS - API-side filtering
const result = await api.getData({
  filters: { name: filter },
  sort: { sortBy: 'name', isDescending: false },
  page: { limit: 20 },
});
return result; // Pre-filtered by API
```

### Implementation Details

**Tally API Supported Filters**:

- `chainId`: Filter by blockchain (e.g., "eip155:1" for Ethereum)
- `hasLogo`: Filter by whether organization has logo
- `address`: Filter by specific address
- `isMember`: Filter by user membership
- `roles`: Filter by user roles

**Tally API Supported Sorting**:

- `id`: Sort by date (default)
- `name`: Sort alphabetically
- `explore`: Sort by activity (live proposals + voters)
- `popular`: Sort by popularity (no live proposal priority)

### Key Learnings

1. **Always check API capabilities first** - Use GraphQL introspection to see available filters
2. **Remove unsupported client-side features** - Don't implement what the API doesn't support
3. **Document limitations clearly** - Be explicit about what filtering is available
4. **Performance over features** - API-side filtering is always better than client-side

### Testing Verification

```bash
# ✅ API-side chain filtering works
curl ... -d '{"query": "{ organizations(input: { filters: { chainId: \"eip155:1\" } }) { ... } }"}'

# ✅ API-side sorting works
curl ... -d '{"query": "{ organizations(input: { sort: { sortBy: name, isDescending: false } }) { ... } }"}'
```

## 🚨 **Critical Zod Schema Issue Discovered**

### Problem

While the Zod schema pattern from `SimpleStatelessStreamable.txt` works for basic cases, there are compatibility issues with the MCP SDK 1.12.0:

1. **"Type instantiation is excessively deep and possibly infinite"** errors
2. **"No overload matches this call"** errors for some tools
3. **Parameter type mismatches** between Zod schemas and handler functions

### Root Cause

The MCP SDK expects either:

- Plain object schemas (the old format that wasn't working)
- Properly typed Zod schemas with exact type inference

### Current Status

- **Tools are functionally working** (as verified by CLI testing)
- **Parameters are being exposed** in the JSON schema correctly
- **Type errors persist** in TypeScript compilation
- **Some tools may fail** due to schema/handler mismatches

### Recommended Solution

For production use, consider either:

1. **Downgrade to object-based schemas** (if parameter access can be fixed)
2. **Update MCP SDK version** (if newer version has better Zod support)
3. **Use type assertions** to bypass TypeScript errors temporarily
4. **Implement custom schema conversion** layer

### Impact

- ✅ Functionality works in practice
- ❌ TypeScript compilation issues
- ❌ Potential runtime errors for some tools
- ❌ Maintenance difficulties

---
