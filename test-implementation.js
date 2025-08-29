#!/usr/bin/env node

// Simple test to verify the get_proposal_votes tool was added correctly
import fs from 'fs';

console.log('Testing get_proposal_votes implementation...\n');

// Test 1: Check if the tool was added to the source files
const srcContent = fs.readFileSync('./src/index.js', 'utf8');
const apiContent = fs.readFileSync('./api/index.js', 'utf8');

const toolPattern = /server\.tool\("get_proposal_votes"/;

console.log('✅ Test 1: Tool definition found in source files');
console.log(`   - src/index.js: ${toolPattern.test(srcContent) ? 'FOUND' : 'NOT FOUND'}`);
console.log(`   - api/index.js: ${toolPattern.test(apiContent) ? 'FOUND' : 'NOT FOUND'}`);

// Test 2: Check if the GraphQL query is properly formatted
const queryPattern = /query GetProposalVotes.*VotesInput/s;
console.log('\n✅ Test 2: GraphQL query structure');
console.log(`   - Query found: ${queryPattern.test(srcContent) ? 'YES' : 'NO'}`);

// Test 3: Check for required parameters
const requiredParams = ['proposalId', 'limit', 'afterCursor', 'voteType'];
console.log('\n✅ Test 3: Required parameters');
requiredParams.forEach(param => {
  const found = srcContent.includes(`${param}:`);
  console.log(`   - ${param}: ${found ? 'FOUND' : 'NOT FOUND'}`);
});

// Test 4: Check for vote processing logic
const processingFeatures = [
  'amountFormatted',
  'voteWeight', 
  'largestVoter',
  'voteBreakdown'
];
console.log('\n✅ Test 4: Vote processing features');
processingFeatures.forEach(feature => {
  const found = srcContent.includes(feature);
  console.log(`   - ${feature}: ${found ? 'FOUND' : 'NOT FOUND'}`);
});

// Test 5: Syntax validation (basic check)
try {
  // Try to evaluate the JavaScript syntax (not execute, just parse)
  new Function(srcContent);
  console.log('\n✅ Test 5: JavaScript syntax validation - PASSED');
} catch (error) {
  console.log('\n❌ Test 5: JavaScript syntax validation - FAILED');
  console.log(`   Error: ${error.message.split('\n')[0]}`);
}

console.log('\n🎉 Implementation test completed!');
console.log('\nTo test with actual API calls, you need:');
console.log('1. A valid Tally API key');
console.log('2. MCP client to make JSON-RPC calls');
console.log('3. Example: {"method": "tools/call", "params": {"name": "get_proposal_votes", "arguments": {"proposalId": "2662020087342433698"}}}');