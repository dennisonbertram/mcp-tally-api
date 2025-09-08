/**
 * Authentication System for MCP Tally API Server
 *
 * This module provides authentication management for both stdio and SSE modes,
 * ensuring secure API key handling and validation against the Tally API.
 */

import { AuthenticationError } from './errors';

/**
 * Authentication modes supported by the server
 */
export type AuthMode = 'stdio' | 'sse' | 'http';

/**
 * Authentication middleware function type
 */
export type AuthMiddleware = (
  request: any,
  response: any,
  next: () => void
) => Promise<void>;

/**
 * AuthManager class handles API key management for both stdio and SSE modes
 */
export class AuthManager {
  private apiKey: string | null = null;
  private mode: AuthMode;
  private initialized = false;

  constructor(mode: AuthMode) {
    this.mode = mode;
  }

  /**
   * Get the current authentication mode
   */
  getMode(): AuthMode {
    return this.mode;
  }

  /**
   * Initialize the AuthManager based on the mode
   */
  async initialize(): Promise<void> {
    if (this.mode === 'stdio' || this.mode === 'http') {
      this.apiKey = process.env.TALLY_API_KEY || null;
      if (!this.apiKey) {
        throw new AuthenticationError(
          'Tally API key not found in environment variables'
        );
      }
    }
    // For SSE mode, API key will be provided with each request
    this.initialized = true;
  }

  /**
   * Get the current API key
   */
  getApiKey(): string {
    if ((this.mode === 'stdio' || this.mode === 'http') && !this.initialized) {
      throw new AuthenticationError('API key not initialized');
    }

    if (!this.apiKey) {
      throw new AuthenticationError(
        (this.mode === 'stdio' || this.mode === 'http') ? 'API key not initialized' : 'API key not set'
      );
    }

    return this.apiKey;
  }

  /**
   * Set the API key (primarily for SSE mode)
   */
  setApiKey(key: string): void {
    this.apiKey = key;
  }

  /**
   * Check if an API key is available
   */
  hasApiKey(): boolean {
    return this.apiKey !== null && this.apiKey.length > 0;
  }

  /**
   * Clear the current API key
   */
  clearApiKey(): void {
    this.apiKey = null;
  }

  /**
   * Validate API key format
   */
  isValidApiKeyFormat(key: string): boolean {
    if (!key || typeof key !== 'string') {
      return false;
    }

    const trimmed = key.trim();
    if (trimmed.length === 0 || trimmed.length < 6) {
      return false;
    }

    return true;
  }

  /**
   * Validate API key against Tally API
   */
  async validateApiKey(key?: string): Promise<boolean> {
    const apiKeyToValidate = key || this.apiKey;

    if (!apiKeyToValidate || !this.isValidApiKeyFormat(apiKeyToValidate)) {
      return false;
    }

    try {
      // Make a simple query to Tally API to validate the key
      const response = await fetch('https://api.tally.xyz/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Api-Key': apiKeyToValidate,
        },
        body: JSON.stringify({
          query: `
            query {
              __typename
            }
          `,
        }),
      });

      // If we get a 200 response, the API key is valid
      // If we get 401/403, the API key is invalid
      return response.ok;
    } catch (error) {
      // Network errors or other issues - assume invalid for safety
      return false;
    }
  }

  /**
   * Override toString to prevent API key exposure
   */
  toString(): string {
    return `AuthManager(mode=${this.mode}, hasApiKey=${this.hasApiKey()})`;
  }

  /**
   * Override toJSON to prevent API key exposure in JSON serialization
   */
  toJSON(): object {
    return {
      mode: this.mode,
      hasApiKey: this.hasApiKey(),
      initialized: this.initialized,
    };
  }
}

/**
 * Create authentication middleware for the specified mode
 */
export function createAuthMiddleware(mode: AuthMode): AuthMiddleware {
  const authManager = new AuthManager(mode);

  return async (
    request: any,
    response: any,
    next: () => void
  ): Promise<void> => {
    try {
      if (mode === 'stdio' || mode === 'http') {
        // Initialize auth manager for stdio/http mode
        await authManager.initialize();

        // For stdio/http mode, API key is already validated during initialization
        next();
      } else {
        // SSE mode - extract API key from request
        let apiKey: string | null = null;

        // Try to get API key from params first
        if (request.params && request.params.apiKey) {
          apiKey = request.params.apiKey;
          // Remove API key from params to prevent logging
          delete request.params.apiKey;
        }

        // Try to get API key from headers as fallback
        if (!apiKey && request.headers && request.headers['x-api-key']) {
          apiKey = request.headers['x-api-key'];
        }

        if (!apiKey) {
          throw new AuthenticationError('API key required for SSE mode');
        }

        // Validate API key format
        if (!authManager.isValidApiKeyFormat(apiKey)) {
          throw new AuthenticationError('Invalid API key format');
        }

        // Set the API key for this request
        authManager.setApiKey(apiKey);

        // Continue to next middleware
        next();
      }
    } catch (error) {
      // Ensure we don't log API keys in error scenarios
      if (error instanceof AuthenticationError) {
        throw error;
      } else {
        throw new AuthenticationError('Authentication failed');
      }
    }
  };
}

/**
 * Extract API key from request safely (for SSE mode)
 */
export function extractApiKey(request: any): string | null {
  // Try params first
  if (request.params && request.params.apiKey) {
    return request.params.apiKey;
  }

  // Try headers
  if (request.headers && request.headers['x-api-key']) {
    return request.headers['x-api-key'];
  }

  return null;
}

/**
 * Redact API key from strings for logging safety
 */
export function redactApiKey(text: string, apiKey: string): string {
  if (!apiKey || !text) {
    return text;
  }

  return text.replace(new RegExp(apiKey, 'g'), '[REDACTED]');
}
