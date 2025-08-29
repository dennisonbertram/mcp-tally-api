#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testMcpServer() {
  console.log('🧪 Testing MCP Tally API Server via stdio...\n');
  
  // Start the server process
  const serverProcess = spawn('node', ['dist/index.js'], {
    env: { ...process.env, TRANSPORT_MODE: 'stdio' },
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: __dirname
  });

  let responses = [];
  let responseBuffer = '';

  // Handle server output
  serverProcess.stdout.on('data', (data) => {
    responseBuffer += data.toString();
    
    // Try to parse JSON responses (they might come in chunks)
    const lines = responseBuffer.split('\n');
    responseBuffer = lines.pop() || ''; // Keep incomplete line
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const response = JSON.parse(line.trim());
          responses.push(response);
          console.log('📥 Received:', JSON.stringify(response, null, 2));
        } catch (e) {
          console.log('📥 Raw output:', line);
        }
      }
    }
  });

  serverProcess.stderr.on('data', (data) => {
    console.log('❌ Server error:', data.toString());
  });

  // Helper function to send JSON-RPC messages
  function sendMessage(message) {
    const jsonMsg = JSON.stringify(message) + '\n';
    console.log('📤 Sending:', JSON.stringify(message, null, 2));
    serverProcess.stdin.write(jsonMsg);
  }

  // Wait a moment for server to start
  await new Promise(resolve => setTimeout(resolve, 1000));

  try {
    // Test 1: Initialize
    console.log('\n🔧 Test 1: Initialize');
    sendMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {
          roots: { listChanged: true },
          sampling: {}
        },
        clientInfo: {
          name: "test-client",
          version: "1.0.0"
        }
      }
    });

    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 2: List tools
    console.log('\n🔧 Test 2: List Tools');
    sendMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list"
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 3: Get server info
    console.log('\n🔧 Test 3: Get Server Info');
    sendMessage({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "get_server_info",
        arguments: {}
      }
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 4: List resources
    console.log('\n🔧 Test 4: List Resources');
    sendMessage({
      jsonrpc: "2.0",
      id: 4,
      method: "resources/list"
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    console.log('\n🏁 Test complete. Cleaning up...');
    serverProcess.kill('SIGTERM');
    
    // Summary
    console.log(`\n📊 Test Summary:`);
    console.log(`   • Total responses received: ${responses.length}`);
    console.log(`   • Server appears to be: ${responses.length > 0 ? '✅ Working' : '❌ Not responding'}`);
    
    process.exit(0);
  }
}

testMcpServer().catch(console.error);