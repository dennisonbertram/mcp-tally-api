Testing MCP servers on STDIO: 

 General STDIO Testing Protocol for MCP Servers

  1. Prerequisites

  - Built MCP server (e.g., npm run build)
  - Required environment variables/API keys set
  - Understanding of your server's capabilities

  2. Basic Testing Pattern

  echo 'JSON_RPC_MESSAGE' | ENV_VARS node path/to/server.js

  3. Essential Test Sequence

  Step 1: Initialize Connection

  echo '{"jsonrpc":"2.0","method":"initialize","id":1,"params":{"protocolVersion":"2024-11-05","capabilities":{},"cl
  ientInfo":{"name":"test-client","version":"1.0.0"}}}' | ENV_VARS node server.js

  Expected: Server responds with capabilities and version info

  Step 2: Discover Server Capabilities

  # List available tools
  echo '{"jsonrpc":"2.0","method":"tools/list","id":2,"params":{}}' | ENV_VARS node server.js

  # List available resources  
  echo '{"jsonrpc":"2.0","method":"resources/list","id":3,"params":{}}' | ENV_VARS node server.js

  # List available prompts
  echo '{"jsonrpc":"2.0","method":"prompts/list","id":4,"params":{}}' | ENV_VARS node server.js

  Step 3: Test Tool Execution

  # Call a simple tool (replace with actual tool name and args)
  echo '{"jsonrpc":"2.0","method":"tools/call","id":5,"params":{"name":"TOOL_NAME","arguments":{"param":"value"}}}'
  | ENV_VARS node server.js

  Step 4: Test Resource Access

  # Read a resource (replace with actual resource URI)
  echo '{"jsonrpc":"2.0","method":"resources/read","id":6,"params":{"uri":"resource://uri"}}' | ENV_VARS node
  server.js

  4. Key Testing Principles

  Message Format Requirements:
  - ✅ Valid JSON-RPC 2.0 format
  - ✅ UTF-8 encoded
  - ✅ Newline terminated
  - ✅ No embedded newlines in message

  Environment Setup:
  - Set all required API keys/tokens as environment variables
  - Use the server's expected transport mode (usually TRANSPORT_MODE=stdio)
  - Ensure server has proper permissions and dependencies

  Success Indicators:
  - Server responds with valid JSON-RPC responses
  - No stderr errors during execution
  - Proper error handling for invalid requests
  - Consistent response format across all endpoints

  5. Debugging Failed Tests

  If server doesn't respond:
  1. Check build: Ensure npm run build succeeded
  2. Verify environment: Confirm all required env vars are set
  3. Test basic startup: Try node server.js --help or similar
  4. Check dependencies: Ensure all packages installed
  5. Validate JSON: Use JSON validator on your test messages

  6. Advanced Testing

  Performance Testing:
  # Test multiple rapid requests
  for i in {1..5}; do echo '{"jsonrpc":"2.0","method":"tools/list","id":'$i',"params":{}}' | ENV_VARS node
  server.js; done

  Error Handling:
  # Test invalid method
  echo '{"jsonrpc":"2.0","method":"invalid_method","id":99,"params":{}}' | ENV_VARS node server.js

  # Test malformed JSON  
  echo '{"invalid":"json"' | ENV_VARS node server.js