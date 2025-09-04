# Development Plan: Improve LLM Tool Usability

## Task Details
Update all MCP Tally API tools to be more intuitive for LLMs by:
1. Shortening tool descriptions to <10 words
2. Removing warnings from descriptions (move to runtime errors)
3. Renaming execute_graphql_query to custom_query and marking as "Advanced"
4. Simplifying parameter structures
5. Adding smart defaults and educational error messages

## Success Criteria
- [x] All tool descriptions are <10 words and action-oriented
- [x] No warnings in tool descriptions
- [x] execute_graphql_query renamed to custom_query and marked as advanced
- [x] Parameters simplified where possible
- [x] Educational error messages with examples (moved to runtime)
- [x] Server starts correctly after changes
- [x] Tests pass for all modified tools

## Implementation Plan

### Phase 1: Research & Analysis
- [x] Review existing tool implementations
- [x] Identify the pattern from browse-daos-improved.ts
- [x] Document current vs. desired state for each tool

### Phase 2: Tool Updates (TDD Approach)
Tools to update:
1. [x] list-organizations.ts - Simplify description and parameters
2. [x] get-organization.ts - Simplify description
3. [x] get-organizations-with-active-proposals.ts - Remove warnings
4. [x] list-proposals.ts - Simplify parameters
5. [x] get-proposal.ts - Simplify description
6. [x] get-active-proposals.ts - Remove warning from description
7. [x] get-user-profile.ts - Simplify
8. [x] get-delegate-statement.ts - Simplify
9. [x] get-dao-participants.ts - Simplify
10. [x] get-delegates.ts - Simplify
11. [x] execute-graphql-query.ts - Rename to custom_query, mark as advanced

### Phase 3: Integration
- [x] Update src/index.ts for any tool name changes
- [x] Verify server starts correctly
- [x] Run all tests

## TDD Cycles Log

### Cycle 1: Research and Analysis
**RED**: Need to understand current state
**GREEN**: Document analysis complete
**REFACTOR**: N/A

## Progress Tracking
- Started: 2025-01-04
- Current Phase: Research & Analysis
- Blockers: None

## Observed Issues (Not in scope)
- None yet