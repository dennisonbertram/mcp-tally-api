/**
 * JSON-RPC 2.0 Helper Utilities
 * 
 * Provides utilities for creating, validating, and parsing JSON-RPC 2.0 messages
 * according to the specification: https://www.jsonrpc.org/specification
 */

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: any;
  id?: string | number | null;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  result?: any;
  error?: JsonRpcError;
  id: string | number | null;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: any;
}

// Standard JSON-RPC 2.0 error codes
export const JSON_RPC_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  // Server error codes (-32000 to -32099)
  SERVER_ERROR_START: -32099,
  SERVER_ERROR_END: -32000,
} as const;

/**
 * Creates a JSON-RPC 2.0 request
 */
export function createRequest(
  method: string,
  params?: any,
  id?: string | number
): JsonRpcRequest {
  const request: JsonRpcRequest = {
    jsonrpc: '2.0',
    method,
  };

  if (params !== undefined) {
    request.params = params;
  }

  if (id !== undefined) {
    request.id = id;
  }

  return request;
}

/**
 * Creates a JSON-RPC 2.0 notification (request without id)
 */
export function createNotification(
  method: string,
  params?: any
): JsonRpcRequest {
  return createRequest(method, params);
}

/**
 * Creates a JSON-RPC 2.0 success response
 */
export function createSuccessResponse(
  id: string | number | null,
  result: any
): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    result,
    id,
  };
}

/**
 * Creates a JSON-RPC 2.0 error response
 */
export function createErrorResponse(
  id: string | number | null,
  code: number,
  message: string,
  data?: any
): JsonRpcResponse {
  const response: JsonRpcResponse = {
    jsonrpc: '2.0',
    error: {
      code,
      message,
    },
    id,
  };

  if (data !== undefined) {
    response.error!.data = data;
  }

  return response;
}

/**
 * Validates if a message is a valid JSON-RPC 2.0 request
 */
export function isValidRequest(message: any): message is JsonRpcRequest {
  if (typeof message !== 'object' || message === null) {
    return false;
  }

  if (message.jsonrpc !== '2.0') {
    return false;
  }

  if (typeof message.method !== 'string') {
    return false;
  }

  if ('id' in message && 
      message.id !== null && 
      typeof message.id !== 'string' && 
      typeof message.id !== 'number') {
    return false;
  }

  return true;
}

/**
 * Validates if a message is a valid JSON-RPC 2.0 response
 */
export function isValidResponse(message: any): message is JsonRpcResponse {
  if (typeof message !== 'object' || message === null) {
    return false;
  }

  if (message.jsonrpc !== '2.0') {
    return false;
  }

  // Must have either result or error, but not both
  const hasResult = 'result' in message;
  const hasError = 'error' in message;

  if ((!hasResult && !hasError) || (hasResult && hasError)) {
    return false;
  }

  // Must have an id
  if (!('id' in message)) {
    return false;
  }

  // If has error, validate error structure
  if (hasError) {
    const error = message.error;
    if (typeof error !== 'object' || 
        typeof error.code !== 'number' || 
        typeof error.message !== 'string') {
      return false;
    }
  }

  return true;
}

/**
 * Checks if a message is a notification (request without id)
 */
export function isNotification(message: any): boolean {
  return isValidRequest(message) && !('id' in message);
}

/**
 * Parses a JSON string and validates it as a JSON-RPC message
 */
export function parseJsonRpcMessage(jsonString: string): JsonRpcRequest | JsonRpcResponse | null {
  try {
    const message = JSON.parse(jsonString);
    
    if (isValidRequest(message)) {
      return message;
    }
    
    if (isValidResponse(message)) {
      return message;
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Extracts error message from a JSON-RPC error response
 */
export function extractErrorMessage(response: JsonRpcResponse): string | null {
  if (response.error) {
    return response.error.message;
  }
  return null;
}