/**
 * Tally GraphQL Client
 *
 * This module provides a GraphQL client for interacting with the Tally API,
 * including query validation, error handling, caching, and retry logic.
 */

import { parse } from 'graphql';
import { AuthManager } from './auth';
import { AuthenticationError } from './errors';

/**
 * GraphQL client error for query-related issues
 */
export class GraphQLClientError extends Error {
  constructor(
    message: string,
    public errors?: any[]
  ) {
    super(message);
    this.name = 'GraphQLClientError';
  }
}

/**
 * GraphQL network error for connection issues
 */
export class GraphQLNetworkError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = 'GraphQLNetworkError';
  }
}

/**
 * GraphQL validation error for invalid queries
 */
export class GraphQLValidationError extends Error {
  constructor(
    message: string,
    public validationErrors?: any[]
  ) {
    super(message);
    this.name = 'GraphQLValidationError';
  }
}

/**
 * Rate limit error for API throttling
 */
export class RateLimitError extends Error {
  constructor(
    message: string,
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/**
 * Cache entry interface
 */
export interface CacheEntry {
  data: any;
  timestamp: number;
  maxAge: number;
}

/**
 * Cache statistics interface
 */
export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
}

/**
 * Query cache implementation
 */
export class QueryCache {
  private cache = new Map<string, CacheEntry>();
  private stats = { hits: 0, misses: 0 };

  constructor(private defaultMaxAge: number = 300000) {} // 5 minutes default

  /**
   * Get cached data for a key
   */
  get(key: string): any | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.maxAge) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.data;
  }

  /**
   * Set cached data for a key
   */
  set(key: string, data: any, maxAge?: number): void {
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      maxAge: maxAge || this.defaultMaxAge,
    };

    this.cache.set(key, entry);
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
    };
  }
}

/**
 * Rate limiter implementation
 */
export class RateLimiter {
  private requests: number[] = [];
  private lastReset: number = Date.now();

  constructor(
    private maxRequests: number = 50,
    private windowMs: number = 60000 // 1 minute
  ) {}

  /**
   * Check if request can be made
   */
  canMakeRequest(): boolean {
    this.cleanup();
    return this.requests.length < this.maxRequests;
  }

  /**
   * Record a request
   */
  recordRequest(): void {
    this.cleanup();
    this.requests.push(Date.now());
  }

  /**
   * Get time until next available request
   */
  getRetryAfter(): number {
    if (this.canMakeRequest()) {
      return 0;
    }

    const oldestRequest = this.requests[0];
    const retryAfter = oldestRequest + this.windowMs - Date.now();
    return Math.max(0, Math.ceil(retryAfter / 1000)); // Return seconds
  }

  /**
   * Clean up old requests outside the window
   */
  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    this.requests = this.requests.filter((time) => time > cutoff);
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.requests = [];
    this.lastReset = Date.now();
  }
}

/**
 * Client configuration options
 */
export interface TallyClientOptions {
  endpoint?: string;
  enableCache?: boolean;
  cacheMaxAge?: number;
  validateQueries?: boolean;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  enableRateLimit?: boolean;
  maxRequestsPerMinute?: number;
}

/**
 * TallyGraphQLClient class for interacting with the Tally API
 */
export class TallyGraphQLClient {
  private endpoint: string;
  private authManager: AuthManager;
  private cache?: QueryCache;
  private rateLimiter?: RateLimiter;
  private options: Required<TallyClientOptions>;

  constructor(authManager: AuthManager, options: TallyClientOptions = {}) {
    // Ensure auth manager is initialized
    if (!authManager.hasApiKey()) {
      throw new AuthenticationError(
        'AuthManager must be initialized before creating GraphQL client'
      );
    }

    this.authManager = authManager;
    this.options = {
      endpoint: 'https://api.tally.xyz/query',
      enableCache: true,
      cacheMaxAge: 300000, // 5 minutes
      validateQueries: false,
      timeout: 30000, // 30 seconds
      retryAttempts: 0,
      retryDelay: 1000,
      enableRateLimit: true,
      maxRequestsPerMinute: 30, // Conservative limit
      ...options,
    };

    this.endpoint = this.options.endpoint;

    if (this.options.enableCache) {
      this.cache = new QueryCache(this.options.cacheMaxAge);
    }

    if (this.options.enableRateLimit) {
      this.rateLimiter = new RateLimiter(
        this.options.maxRequestsPerMinute,
        60000
      );
    }
  }

  /**
   * Get the GraphQL endpoint
   */
  getEndpoint(): string {
    return this.endpoint;
  }

  /**
   * Check if caching is enabled
   */
  isCachingEnabled(): boolean {
    return this.options.enableCache;
  }

  /**
   * Get request headers
   */
  getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Api-Key': this.authManager.getApiKey(),
    };
  }

  /**
   * Validate GraphQL query syntax
   */
  validateQuery(query: string): boolean {
    try {
      parse(query);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate query variables (basic validation)
   */
  validateVariables(query: string, variables: Record<string, any>): boolean {
    try {
      const document = parse(query);

      // Extract variable definitions from the query
      const operation = document.definitions[0];
      if (operation.kind !== 'OperationDefinition') {
        return true; // No variables to validate
      }

      const variableDefinitions = operation.variableDefinitions || [];

      // Check if all required variables are provided
      for (const varDef of variableDefinitions) {
        const varName = varDef.variable.name.value;
        const isRequired = varDef.type.kind === 'NonNullType';

        if (isRequired && !(varName in variables)) {
          return false;
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate cache key for query and variables
   */
  private generateCacheKey(
    query: string,
    variables?: Record<string, any>
  ): string {
    const normalizedQuery = query.replace(/\s+/g, ' ').trim();
    const variablesStr = variables ? JSON.stringify(variables) : '';
    return `${normalizedQuery}:${variablesStr}`;
  }

  /**
   * Execute GraphQL query with retry logic
   */
  private async executeWithRetry(
    query: string,
    variables?: Record<string, any>,
    attempt = 0
  ): Promise<any> {
    try {
      // Check rate limit before making request
      if (this.rateLimiter && !this.rateLimiter.canMakeRequest()) {
        const retryAfter = this.rateLimiter.getRetryAfter();
        throw new RateLimitError(
          `Rate limit exceeded. Please retry after ${retryAfter} seconds.`,
          retryAfter
        );
      }

      // Record the request
      if (this.rateLimiter) {
        this.rateLimiter.recordRequest();
      }

      return await this.executeQuery(query, variables);
    } catch (error) {
      // Handle rate limit errors from the API
      if (error instanceof GraphQLNetworkError && error.status === 429) {
        const retryAfter = this.rateLimiter?.getRetryAfter() || 60;
        throw new RateLimitError(
          `API rate limit exceeded. Please retry after ${retryAfter} seconds.`,
          retryAfter
        );
      }

      if (
        attempt < this.options.retryAttempts &&
        error instanceof GraphQLNetworkError &&
        error.status !== 429 // Don't retry rate limit errors
      ) {
        // Wait before retrying
        await new Promise((resolve) =>
          setTimeout(resolve, this.options.retryDelay)
        );
        return this.executeWithRetry(query, variables, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Execute a single GraphQL query
   */
  private async executeQuery(
    query: string,
    variables?: Record<string, any>
  ): Promise<any> {
    const apiKey = await this.authManager.getApiKey();
    if (!apiKey) {
      throw new Error(
        'Tally API key not configured. Please set TALLY_API_KEY environment variable.'
      );
    }

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': apiKey,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new GraphQLNetworkError(
        `HTTP ${response.status}: ${response.statusText}`,
        response.status
      );
    }

    const result = await response.json();

    if (result.errors) {
      const errorMessages = result.errors
        .map((err: any) => err.message)
        .join(', ');
      throw new GraphQLClientError(
        `GraphQL errors: ${errorMessages}`,
        result.errors
      );
    }

    return result.data;
  }

  /**
   * Execute GraphQL query
   */
  async query<T = any>(
    query: string,
    variables?: Record<string, any>
  ): Promise<T> {
    // Validate query if enabled
    if (this.options.validateQueries && !this.validateQuery(query)) {
      throw new GraphQLValidationError('Invalid GraphQL query syntax');
    }

    // Validate variables if provided
    if (variables && !this.validateVariables(query, variables)) {
      throw new GraphQLValidationError('Invalid query variables');
    }

    // Check cache first
    if (this.cache) {
      const cacheKey = this.generateCacheKey(query, variables);
      const cachedResult = this.cache.get(cacheKey);

      if (cachedResult !== null) {
        return cachedResult;
      }
    }

    // Execute query
    const result = await this.executeWithRetry(query, variables);

    // Cache result if caching is enabled
    if (this.cache) {
      const cacheKey = this.generateCacheKey(query, variables);
      this.cache.set(cacheKey, result);
    }

    return result;
  }

  /**
   * Clear query cache
   */
  clearCache(): void {
    if (this.cache) {
      this.cache.clear();
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    if (this.cache) {
      return this.cache.getStats();
    }

    return { size: 0, hits: 0, misses: 0 };
  }
}

/**
 * Factory function to create TallyGraphQLClient
 */
export function createTallyClient(
  authManager: AuthManager,
  options?: TallyClientOptions
): TallyGraphQLClient {
  return new TallyGraphQLClient(authManager, options);
}
