#!/usr/bin/env node

// Simple manual test for MCP Tally API tools
import { spawn } from 'child_process';
import { createReadStream } from 'fs';

const TEST_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'; // vitalik.eth

const tests = [
  {
    name: 'get_voter_profile',
    args: { address: TEST_ADDRESS }
  },
  {
    name: 'get_proposal_votes', 
    args: { proposalId: '2603270889042610039', limit: 5 }
  },
  {
    name: 'get_vote_history',
    args: { address: TEST_ADDRESS, limit: 10 }
  },
  {
    name: 'get_delegation_status',
    args: { address: TEST_ADDRESS }
  }
];

async function testTool(toolName, args) {
  return new Promise((resolve, reject) => {
    console.log(`\n🧪 Testing ${toolName}...`);
    
    const child = spawn('node', ['dist/index.js'], { stdio: 'pipe' });
    
    let output = '';
    let errorOutput = '';
    
    child.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Process failed with code ${code}: ${errorOutput}`));
        return;
      }
      
      try {
        const lines = output.trim().split('\n');
        const responseLines = lines.filter(line => line.startsWith('{"jsonrpc'));
        
        if (responseLines.length === 0) {
          reject(new Error('No valid JSON-RPC response found'));
          return;
        }
        
        const response = JSON.parse(responseLines[responseLines.length - 1]);
        
        if (response.error) {
          reject(new Error(`Tool error: ${response.error.message}`));
          return;
        }
        
        resolve(response.result);
      } catch (e) {
        reject(new Error(`Failed to parse response: ${e.message}\nOutput: ${output}`));
      }
    });
    
    // Send initialization
    const initRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: { roots: { listChanged: true }, sampling: {} },
        clientInfo: { name: 'manual-test', version: '1.0.0' }
      }
    };
    
    child.stdin.write(JSON.stringify(initRequest) + '\n');
    
    // Send tool call after a brief delay
    setTimeout(() => {
      const toolRequest = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        }
      };
      
      child.stdin.write(JSON.stringify(toolRequest) + '\n');
      child.stdin.end();
    }, 100);
    
    // Timeout after 30 seconds
    setTimeout(() => {
      child.kill();
      reject(new Error('Test timeout'));
    }, 30000);
  });
}

async function runTests() {
  console.log('🚀 Starting manual MCP tool tests...\n');
  
  const results = {};
  
  for (const test of tests) {
    try {
      const result = await testTool(test.name, test.args);
      results[test.name] = { success: true, data: result };
      console.log(`✅ ${test.name}: SUCCESS`);
      
      // Log first few characters of response to verify it's working
      if (result && result.content && result.content[0] && result.content[0].text) {
        const preview = result.content[0].text.substring(0, 200);
        console.log(`   Preview: ${preview}${preview.length < result.content[0].text.length ? '...' : ''}`);
      }
      
    } catch (error) {
      results[test.name] = { success: false, error: error.message };
      console.log(`❌ ${test.name}: FAILED - ${error.message}`);
    }
  }
  
  console.log('\n📊 Test Summary:');
  console.log('================');
  
  let passed = 0;
  let total = tests.length;
  
  for (const [tool, result] of Object.entries(results)) {
    if (result.success) {
      passed++;
      console.log(`✅ ${tool}`);
    } else {
      console.log(`❌ ${tool}: ${result.error}`);
    }
  }
  
  console.log(`\nResult: ${passed}/${total} tools working (${Math.round(passed/total*100)}% success rate)`);
}

runTests().catch(console.error);