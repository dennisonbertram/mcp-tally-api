/**
 * MCP Error Handling System
 *
 * This module provides structured error types and utilities for the MCP Tally API server.
 * All errors follow JSON-RPC 2.0 error code conventions where applicable.
 */

/**
 * Base MCP error class that extends Error with additional properties
 * for error codes and structured data.
 */
export class McpError extends Error {
  public readonly code: number;
  public readonly data?: any;

  constructor(message: string, code: number, data?: any) {
    super(message);
    this.name = 'McpError';
    this.code = code;
    this.data = data;

    // Maintain proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, McpError);
    }
  }

  /**
   * Custom JSON serialization to include error properties
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      data: this.data,
      stack: this.stack,
    };
  }
}

/**
 * Validation error for invalid input parameters
 * JSON-RPC code: -32602 (Invalid params)
 */
export class ValidationError extends McpError {
  constructor(message: string, data?: any) {
    super(message, -32602, data);
    this.name = 'ValidationError';
  }
}

/**
 * Transport layer error for connection issues
 * Custom code: -32001
 */
export class TransportError extends McpError {
  constructor(message: string, data?: any) {
    super(message, -32001, data);
    this.name = 'TransportError';
  }
}

/**
 * Protocol error for MCP protocol violations
 * Custom code: -32002
 */
export class ProtocolError extends McpError {
  constructor(message: string, data?: any) {
    super(message, -32002, data);
    this.name = 'ProtocolError';
  }
}

/**
 * Tool not found error
 * JSON-RPC code: -32601 (Method not found)
 */
export class ToolNotFoundError extends McpError {
  constructor(toolName: string) {
    super(`Tool not found: ${toolName}`, -32601, { tool: toolName });
    this.name = 'ToolNotFoundError';
  }
}

/**
 * Resource not found error
 * Custom code: -32603 (using internal error code for resources)
 */
export class ResourceNotFoundError extends McpError {
  constructor(uri: string) {
    super(`Resource not found: ${uri}`, -32603, { uri });
    this.name = 'ResourceNotFoundError';
  }
}

/**
 * Prompt not found error
 * Custom code: -32604
 */
export class PromptNotFoundError extends McpError {
  constructor(promptName: string) {
    super(`Prompt not found: ${promptName}`, -32604, { prompt: promptName });
    this.name = 'PromptNotFoundError';
  }
}

/**
 * Invalid request error for malformed requests
 * JSON-RPC code: -32600 (Invalid Request)
 */
export class InvalidRequestError extends McpError {
  constructor(message: string, data?: any) {
    super(message, -32600, data);
    this.name = 'InvalidRequestError';
  }
}

/**
 * Authentication error for API key issues
 * Custom code: -32003
 */
export class AuthenticationError extends McpError {
  constructor(message: string, data?: any) {
    super(message, -32003, data);
    this.name = 'AuthenticationError';
  }
}

/**
 * Rate limit error for API throttling
 * Custom code: -32004
 */
export class RateLimitError extends McpError {
  constructor(retryAfter: number, limit: number) {
    super(`Rate limit exceeded. Retry after ${retryAfter} seconds`, -32004, {
      retryAfter,
      limit,
    });
    this.name = 'RateLimitError';
  }
}

/**
 * Format any error for JSON-RPC response
 */
export function formatMcpError(error: any): {
  code: number;
  message: string;
  data?: any;
} {
  // Handle null/undefined
  if (error == null) {
    return {
      code: -32603,
      message: 'Internal error',
      data: undefined,
    };
  }

  // Handle known MCP errors
  if (error instanceof McpError) {
    return {
      code: error.code,
      message: error.message,
      data: error.data,
    };
  }

  // Handle generic Error objects
  if (error instanceof Error) {
    return {
      code: -32603,
      message: 'Internal error',
      data: {
        originalMessage: error.message,
      },
    };
  }

  // Handle unknown error types
  return {
    code: -32603,
    message: 'Internal error',
    data: {
      error,
    },
  };
}

/**
 * Type guard to check if an error is a known MCP error
 */
export function isKnownError(error: any): error is McpError {
  return error instanceof McpError;
}
