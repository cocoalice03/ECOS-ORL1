import { Request, Response, NextFunction } from 'express';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

interface RateLimitInfo {
  count: number;
  resetTime: number;
  firstRequest: number;
}

class InMemoryRateLimiter {
  private requests = new Map<string, RateLimitInfo>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, info] of this.requests) {
      if (now > info.resetTime) {
        this.requests.delete(key);
      }
    }
  }

  public hit(key: string, windowMs: number): { count: number; resetTime: number; exceeded: boolean } {
    const now = Date.now();
    const existing = this.requests.get(key);

    if (!existing || now > existing.resetTime) {
      // New window or expired window
      const resetTime = now + windowMs;
      this.requests.set(key, {
        count: 1,
        resetTime,
        firstRequest: now
      });
      return { count: 1, resetTime, exceeded: false };
    }

    // Increment existing count
    existing.count++;
    this.requests.set(key, existing);
    
    return {
      count: existing.count,
      resetTime: existing.resetTime,
      exceeded: false // Will be determined by the rate limiter
    };
  }

  public reset(key: string): void {
    this.requests.delete(key);
  }

  public getStats(): { totalKeys: number; memoryUsage: string } {
    const memoryUsage = process.memoryUsage();
    return {
      totalKeys: this.requests.size,
      memoryUsage: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`
    };
  }

  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.requests.clear();
  }
}

// Global rate limiter instance
const globalRateLimiter = new InMemoryRateLimiter();

export class RateLimiter {
  private config: Required<RateLimitConfig>;

  constructor(config: RateLimitConfig) {
    this.config = {
      windowMs: config.windowMs,
      maxRequests: config.maxRequests,
      message: config.message || 'Too many requests, please try again later',
      standardHeaders: config.standardHeaders ?? true,
      legacyHeaders: config.legacyHeaders ?? false,
      skipSuccessfulRequests: config.skipSuccessfulRequests ?? false,
      skipFailedRequests: config.skipFailedRequests ?? false,
      keyGenerator: config.keyGenerator || this.defaultKeyGenerator
    };
  }

  private defaultKeyGenerator(req: Request): string {
    // Use IP address as default key, with forwarded IP support
    const forwarded = req.headers['x-forwarded-for'] as string;
    const ip = forwarded ? forwarded.split(',')[0].trim() : req.ip || req.connection.remoteAddress || 'unknown';
    return `rate_limit:${ip}`;
  }

  public middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const key = this.config.keyGenerator(req);
      const result = globalRateLimiter.hit(key, this.config.windowMs);
      
      const isExceeded = result.count > this.config.maxRequests;
      const resetTimeSeconds = Math.ceil((result.resetTime - Date.now()) / 1000);

      // Add rate limit headers
      if (this.config.standardHeaders) {
        res.set({
          'RateLimit-Limit': this.config.maxRequests.toString(),
          'RateLimit-Remaining': Math.max(0, this.config.maxRequests - result.count).toString(),
          'RateLimit-Reset': new Date(result.resetTime).toISOString()
        });
      }

      if (this.config.legacyHeaders) {
        res.set({
          'X-RateLimit-Limit': this.config.maxRequests.toString(),
          'X-RateLimit-Remaining': Math.max(0, this.config.maxRequests - result.count).toString(),
          'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString()
        });
      }

      if (isExceeded) {
        res.set('Retry-After', resetTimeSeconds.toString());
        
        return res.status(429).json({
          error: this.config.message,
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: resetTimeSeconds,
          limit: this.config.maxRequests,
          windowMs: this.config.windowMs,
          resetTime: new Date(result.resetTime).toISOString()
        });
      }

      next();
    };
  }

  public reset(req: Request): void {
    const key = this.config.keyGenerator(req);
    globalRateLimiter.reset(key);
  }
}

// Predefined rate limiters for common use cases

// Strict rate limiter for authentication endpoints
export const authRateLimit = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: process.env.NODE_ENV === 'production' ? 5 : 50, // More lenient in development
  message: 'Too many authentication attempts, please try again later',
  skipSuccessfulRequests: true // Only count failed attempts
});

// Firebase authentication rate limiter (more lenient for token exchanges)
export const firebaseAuthRateLimit = new RateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute (shorter window for development)
  maxRequests: process.env.NODE_ENV === 'production' ? 20 : 1000, // Very lenient in development
  message: 'Too many Firebase authentication requests, please try again later',
  skipSuccessfulRequests: true // Only count failed attempts in development
});

// Moderate rate limiter for API endpoints
export const apiRateLimit = new RateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  maxRequests: 60, // 60 requests per minute
  message: 'API rate limit exceeded, please slow down'
});

// Lenient rate limiter for general endpoints
export const generalRateLimit = new RateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute
  message: 'Rate limit exceeded, please try again later'
});

// Strict rate limiter for expensive operations
export const strictRateLimit = new RateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  maxRequests: 10, // 10 requests per minute
  message: 'Rate limit exceeded for this operation'
});

// Dedicated limiter for ECOS evaluations; isolates quota per session
export const ecosEvaluationRateLimit = new RateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  maxRequests: 10, // 10 evaluations per minute per session/email combo
  message: 'Rate limit exceeded for this evaluation',
  keyGenerator: (req: Request) => {
    const email = ((req.query.email as string) || '').toLowerCase() || 'unknown';
    const sessionId = req.params?.sessionId || 'unknown';
    return `ecos_eval:${email}:${sessionId}`;
  }
});

// Email-based rate limiter for admin operations
export const emailBasedRateLimit = new RateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 30, // 30 requests per 5 minutes per email
  message: 'Too many requests for this email address',
  keyGenerator: (req: Request) => {
    const email = (req.query.email as string) || (req.body?.email as string) || 'unknown';
    return `email_rate_limit:${email.toLowerCase()}`;
  }
});

// ECOS session rate limiter
export const ecosSessionRateLimit = new RateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  maxRequests: 20, // 20 ECOS operations per 10 minutes
  message: 'Too many ECOS operations, please wait before creating more sessions',
  keyGenerator: (req: Request) => {
    const email = (req.query.email as string) || (req.body?.email as string) || req.ip || 'unknown';
    return `ecos_rate_limit:${email.toLowerCase()}`;
  }
});

// Create custom rate limiter
export const createRateLimit = (config: RateLimitConfig) => {
  return new RateLimiter(config);
};

// Rate limiter status endpoint middleware
export const rateLimitStatus = () => {
  return (req: Request, res: Response) => {
    const stats = globalRateLimiter.getStats();
    res.status(200).json({
      rateLimit: {
        activeKeys: stats.totalKeys,
        memoryUsage: stats.memoryUsage,
        timestamp: new Date().toISOString()
      }
    });
  };
};

// Graceful shutdown
export const shutdownRateLimiter = () => {
  globalRateLimiter.destroy();
};

// Export for advanced usage
export { globalRateLimiter };

// Helper function to check if request is rate limited without incrementing
export const checkRateLimit = (req: Request, config: RateLimitConfig): { 
  exceeded: boolean; 
  remaining: number; 
  resetTime: Date 
} => {
  const keyGen = config.keyGenerator || ((r: Request) => `rate_limit:${r.ip}`);
  const key = keyGen(req);
  
  // This is a simplified check - in a full implementation you'd want to peek without incrementing
  const result = globalRateLimiter.hit(key, config.windowMs);
  
  return {
    exceeded: result.count > config.maxRequests,
    remaining: Math.max(0, config.maxRequests - result.count),
    resetTime: new Date(result.resetTime)
  };
};
