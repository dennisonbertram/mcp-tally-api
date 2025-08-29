/**
 * Rate Limiter Utility for API Testing
 * 
 * Prevents hitting Tally API rate limits during testing
 * by adding delays between consecutive API calls
 */

export class RateLimiter {
  private lastCallTime: number = 0;
  private readonly minDelay: number;
  
  constructor(delayMs: number = 2000) {
    this.minDelay = delayMs;
  }

  /**
   * Ensures minimum delay between API calls
   * Call this before making any API request
   */
  async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCallTime;
    
    if (timeSinceLastCall < this.minDelay) {
      const waitTime = this.minDelay - timeSinceLastCall;
      console.log(`⏳ Rate limiting: waiting ${waitTime}ms before next API call`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastCallTime = Date.now();
  }

  /**
   * Reset the rate limiter (useful between test suites)
   */
  reset(): void {
    this.lastCallTime = 0;
  }
}

// Global rate limiter instance to share across all tests
export const globalRateLimiter = new RateLimiter(3000); // 3 second delay between calls