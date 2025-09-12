import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { securityAuditService } from "../services/SecurityAuditService";

// Helper function to get user ID from different auth providers
function getUserId(user: any): string | null {
  if (!user) return null;
  if (user.provider === 'google') {
    return user.id;
  }
  // Replit Auth
  return user.claims?.sub || null;
}

export interface RateLimitOptions {
  windowMinutes: number; // Time window for rate limiting
  maxRequests: number; // Maximum requests allowed in window
  keyGenerator?: (req: any) => string; // Custom key generation
  skipSuccessfulRequests?: boolean; // Only count failed requests
  message?: string; // Custom error message
  onLimitReached?: (req: any, res: Response) => void; // Custom handler
}

/**
 * Enterprise-grade rate limiting middleware with persistent storage
 * and comprehensive audit logging.
 * 
 * Features:
 * - Per-user and per-IP rate limiting
 * - Sliding window algorithm
 * - Persistent storage with automatic cleanup
 * - Detailed audit logging
 * - Configurable limits per endpoint
 * - Suspicious activity detection
 */
export class RateLimitingMiddleware {
  
  /**
   * Create rate limiting middleware with specified options
   */
  static create(options: RateLimitOptions) {
    return async (req: any, res: Response, next: NextFunction) => {
      try {
        const userId = getUserId(req.user);
        const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
        const userAgent = req.get('User-Agent');
        const endpoint = req.path;
        
        // Generate rate limiting key
        const key = options.keyGenerator 
          ? options.keyGenerator(req)
          : userId || ipAddress; // Prefer user-based, fallback to IP
        
        // Calculate time window
        const windowStart = new Date();
        windowStart.setMinutes(windowStart.getMinutes() - options.windowMinutes);
        const windowEnd = new Date();
        
        // Get current request count in window
        const requestCount = await storage.getRateLimitCount(
          key,
          endpoint,
          windowStart,
          windowEnd
        );
        
        // Check if limit exceeded
        const isLimitExceeded = requestCount >= options.maxRequests;
        
        // Log rate limiting event
        await securityAuditService.logRateLimitEvent(
          userId || undefined,
          endpoint,
          ipAddress,
          isLimitExceeded,
          requestCount + 1, // Include current request
          options.maxRequests,
          options.windowMinutes,
          userAgent
        );
        
        // Record this request attempt
        await storage.createRateLimitingLog({
          userId,
          ipAddress,
          endpoint,
          requestCount: requestCount + 1,
          windowStart,
          windowEnd,
          limitExceeded: isLimitExceeded,
        });
        
        if (isLimitExceeded) {
          // Custom handler for limit reached
          if (options.onLimitReached) {
            return options.onLimitReached(req, res);
          }
          
          // Detect potential abuse patterns
          await this.detectSuspiciousActivity(
            userId,
            ipAddress,
            endpoint,
            requestCount,
            options.maxRequests,
            userAgent
          );
          
          // Return rate limit error
          res.status(429).json({
            error: options.message || "Rate limit exceeded",
            code: "RATE_LIMIT_EXCEEDED",
            retryAfter: options.windowMinutes * 60, // seconds
            details: {
              limit: options.maxRequests,
              windowMinutes: options.windowMinutes,
              requestCount: requestCount + 1,
            }
          });
          return;
        }
        
        // Add rate limit headers
        res.set({
          'X-RateLimit-Limit': options.maxRequests.toString(),
          'X-RateLimit-Remaining': Math.max(0, options.maxRequests - requestCount - 1).toString(),
          'X-RateLimit-Reset': new Date(windowEnd.getTime() + (options.windowMinutes * 60 * 1000)).toISOString(),
        });
        
        next();
        
      } catch (error) {
        console.error("Rate limiting middleware error:", error);
        // Fail open for availability, but log the error
        await securityAuditService.logSecurityEvent({
          userId: getUserId(req.user),
          ipAddress: req.ip || 'unknown',
          userAgent: req.get('User-Agent'),
          endpoint: req.path,
          httpMethod: req.method,
          eventType: 'suspicious_activity',
          severity: 'critical',
          metadata: {
            error: error instanceof Error ? error.message : 'Unknown error',
            rateLimitingSystemFailure: true
          },
          wasBlocked: false,
          blockReason: "Rate limiting system failure - failing open"
        });
        next();
      }
    };
  }
  
  /**
   * Detect suspicious activity patterns based on rate limiting violations
   */
  private static async detectSuspiciousActivity(
    userId: string | null,
    ipAddress: string,
    endpoint: string,
    requestCount: number,
    limit: number,
    userAgent?: string
  ): Promise<void> {
    const suspiciousIndicators: string[] = [];
    let riskScore = 0;
    
    // Check for excessive rate limit violations
    const excessFactor = requestCount / limit;
    if (excessFactor > 5) {
      suspiciousIndicators.push("extreme_rate_limit_violation");
      riskScore += 30;
    } else if (excessFactor > 2) {
      suspiciousIndicators.push("significant_rate_limit_violation");
      riskScore += 15;
    }
    
    // Check for automation indicators
    if (!userAgent || userAgent.toLowerCase().includes('bot') || userAgent.toLowerCase().includes('curl')) {
      suspiciousIndicators.push("automated_client");
      riskScore += 20;
    }
    
    // Check for generation endpoint abuse
    if (endpoint.includes('/generate') || endpoint.includes('/redress')) {
      suspiciousIndicators.push("generation_endpoint_abuse");
      riskScore += 25;
    }
    
    // Check for unauthenticated abuse
    if (!userId) {
      suspiciousIndicators.push("unauthenticated_rate_abuse");
      riskScore += 15;
    }
    
    // Log suspicious activity if risk score is high enough
    if (riskScore >= 30 || suspiciousIndicators.length >= 2) {
      await securityAuditService.logSuspiciousActivity(
        userId,
        endpoint,
        ipAddress,
        suspiciousIndicators,
        riskScore,
        riskScore >= 50, // Auto-block if very high risk
        userAgent,
        {
          requestCount,
          limit,
          excessFactor,
          autoBlocked: riskScore >= 50
        }
      );
    }
  }
}

// Pre-configured rate limiting middleware for common use cases
export const rateLimitingMiddleware = {
  
  // Strict rate limiting for age verification (prevents verification abuse)
  ageVerification: RateLimitingMiddleware.create({
    windowMinutes: 60, // 1 hour window
    maxRequests: 5, // Only 5 verification attempts per hour
    message: "Too many age verification attempts. Please wait before trying again.",
    onLimitReached: async (req: any, res: Response) => {
      // Log potential verification abuse
      await securityAuditService.logSecurityEvent({
        userId: getUserId(req.user),
        ipAddress: req.ip || 'unknown',
        userAgent: req.get('User-Agent'),
        endpoint: req.path,
        httpMethod: req.method,
        eventType: 'suspicious_activity',
        severity: 'warning',
        metadata: {
          verificationAbuse: true,
          rateLimitType: 'age_verification'
        },
        wasBlocked: true,
        blockReason: "Age verification rate limit exceeded"
      });
      
      res.status(429).json({
        error: "Too many age verification attempts",
        code: "AGE_VERIFICATION_RATE_LIMIT",
        retryAfter: 3600, // 1 hour
        message: "For security, age verification is limited. Please wait 1 hour before trying again."
      });
    }
  }),
  
  // Moderate rate limiting for content generation
  contentGeneration: RateLimitingMiddleware.create({
    windowMinutes: 10, // 10 minute window
    maxRequests: 20, // 20 generation requests per 10 minutes
    message: "Generation rate limit exceeded. Please wait before generating more content."
  }),
  
  // Very strict rate limiting for redress operations (high compute cost)
  redressGeneration: RateLimitingMiddleware.create({
    windowMinutes: 60, // 1 hour window
    maxRequests: 10, // Only 10 redress operations per hour
    message: "Redress generation rate limit exceeded. This feature has usage limits."
  }),
  
  // General API rate limiting
  general: RateLimitingMiddleware.create({
    windowMinutes: 15, // 15 minute window
    maxRequests: 100, // 100 requests per 15 minutes
    message: "API rate limit exceeded. Please reduce request frequency."
  })
};