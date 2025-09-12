import type { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { contentSafetyService } from "./services/ContentSafetyService";
import type { ContentRating } from "@shared/schema";
import { randomUUID } from "crypto";

// Helper function to get user ID from different auth providers
function getUserId(user: any): string | null {
  if (!user) return null;
  if (user.provider === 'google') {
    return user.id;
  }
  // Replit Auth
  return user.claims?.sub || null;
}

// Calculate age from birth month and year
function calculateAge(birthMonth: number, birthYear: number): number {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1; // getMonth() returns 0-11

  let age = currentYear - birthYear;
  
  // If birthday hasn't occurred this year, subtract 1
  if (currentMonth < birthMonth) {
    age--;
  }
  
  return age;
}

export interface SecurityContext {
  userId?: string;
  userAge?: number;
  isAgeVerified: boolean;
  ageVerifiedAt?: Date;
  ipAddress: string;
  userAgent: string;
  sessionId?: string;
  requestId: string;
}

export interface SecurityMiddlewareOptions {
  operationType: string; // "panel_generation", "character_creation", etc.
  requireAuth?: boolean; // default true
  skipRateLimit?: boolean; // for admin users
  skipContentScan?: boolean; // for trusted content
  maxRequestsPerHour?: number; // custom rate limit
  allowedContentRatings?: ContentRating[]; // default ["General"]
  getResourceId?: (req: any) => string | undefined; // extract project/panel ID
  getMetadata?: (req: any) => any; // extract metadata for logging
}

/**
 * Enterprise-grade security middleware that provides comprehensive protection
 * for content generation endpoints. Includes:
 * 
 * 1. Content safety scanning of all text inputs
 * 2. Age verification based on content classification
 * 3. Persistent audit logging with tamper-evident records
 * 4. Rate limiting with IP and user-based throttling
 * 5. Input validation and sanitization
 * 6. Suspicious activity detection
 */
export const createEnterpriseSecurityMiddleware = (options: SecurityMiddlewareOptions) => {
  return async (req: any, res: Response, next: NextFunction) => {
    const requestId = randomUUID();
    const startTime = Date.now();
    
    try {
      // Extract security context
      const context: SecurityContext = {
        userId: getUserId(req.user),
        ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        sessionId: req.sessionID,
        requestId,
        isAgeVerified: false,
      };

      console.log(`🛡️ Enterprise Security Check [${requestId}]: ${req.method} ${req.path} - User: ${context.userId || 'anonymous'}`);

      // Step 1: Authentication check
      if (options.requireAuth !== false && !context.userId) {
        await logSecurityEvent(context, req, 'DENIED', 'authentication_required', {
          reason: 'No authenticated user found',
          endpoint: req.path,
        });
        
        return res.status(401).json({
          error: "Authentication required",
          code: "AUTH_REQUIRED",
          requestId
        });
      }

      // Step 2: Get user data for age verification
      let user = null;
      let userAge = 0;
      if (context.userId) {
        try {
          user = await storage.getUser(context.userId);
          if (user) {
            context.isAgeVerified = user.isAgeVerified || false;
            context.ageVerifiedAt = user.ageVerifiedAt || undefined;
            
            if (user.birthMonth && user.birthYear) {
              userAge = calculateAge(user.birthMonth, user.birthYear);
              context.userAge = userAge;
            }
          }
        } catch (error) {
          console.error(`Failed to fetch user data for ${context.userId}:`, error);
        }
      }

      // Step 3: Rate limiting check
      if (!options.skipRateLimit && !await isAdminUser(context.userId)) {
        const rateLimitStatus = await storage.getRateLimitingStatus(
          context.userId, 
          context.ipAddress, 
          req.path
        );

        if (rateLimitStatus.isLimited) {
          await logSecurityEvent(context, req, 'DENIED', 'rate_limit_exceeded', {
            currentCount: rateLimitStatus.currentCount,
            limit: rateLimitStatus.limit,
            windowStart: rateLimitStatus.windowStart,
          });

          // Update rate limiting log
          await storage.updateRateLimitingLog({
            userId: context.userId,
            ipAddress: context.ipAddress,
            endpoint: req.path,
            requestCount: 1,
            windowStart: rateLimitStatus.windowStart,
            windowEnd: rateLimitStatus.windowEnd,
            limitExceeded: true,
          });

          return res.status(429).json({
            error: "Rate limit exceeded",
            code: "RATE_LIMIT_EXCEEDED",
            retryAfter: Math.ceil((rateLimitStatus.windowEnd.getTime() - Date.now()) / 1000),
            requestId
          });
        }

        // Update rate limiting log for successful request
        await storage.updateRateLimitingLog({
          userId: context.userId,
          ipAddress: context.ipAddress,
          endpoint: req.path,
          requestCount: 1,
          windowStart: rateLimitStatus.windowStart,
          windowEnd: rateLimitStatus.windowEnd,
          limitExceeded: false,
        });
      }

      // Step 4: Content safety scanning
      let contentClassification = null;
      if (!options.skipContentScan) {
        try {
          contentClassification = await contentSafetyService.analyzeRequestContent(
            req.body,
            `${options.operationType} request`
          );

          console.log(`🔍 Content Classification [${requestId}]: ${contentClassification.rating} (Score: ${contentClassification.safetyScore})`);

          // Check if content is blocked due to safety concerns
          if (contentClassification.safetyScore < 30) {
            await logSecurityEvent(context, req, 'BLOCKED', 'content_violation', {
              contentRating: contentClassification.rating,
              safetyScore: contentClassification.safetyScore,
              blockedKeywords: contentClassification.blockedKeywords,
              categories: contentClassification.categories,
            });

            return res.status(403).json({
              error: "Content violates safety guidelines",
              code: "CONTENT_VIOLATION",
              details: contentClassification.explanation,
              blockedKeywords: contentClassification.blockedKeywords.length > 0 
                ? ["Content contains restricted terms"] 
                : undefined,
              requestId
            });
          }
        } catch (error) {
          console.error(`Content scanning error [${requestId}]:`, error);
          
          // On error, fail securely for sensitive operations
          if (options.operationType.includes('generation')) {
            await logSecurityEvent(context, req, 'BLOCKED', 'content_scan_error', {
              error: error instanceof Error ? error.message : 'Unknown error',
            });

            return res.status(500).json({
              error: "Content safety check failed",
              code: "CONTENT_SCAN_ERROR", 
              requestId
            });
          }
        }
      }

      // Step 5: Age verification based on content classification
      const requiredRating = contentClassification?.rating || "General";
      const ageVerificationResult = await verifyAgeForContent(
        user,
        context,
        requiredRating,
        options.allowedContentRatings || ["General"]
      );

      if (!ageVerificationResult.allowed) {
        await logSecurityEvent(context, req, 'DENIED', ageVerificationResult.reason, {
          contentRating: requiredRating,
          userAge: context.userAge,
          isAgeVerified: context.isAgeVerified,
          requiredAge: ageVerificationResult.requiredAge,
        });

        return res.status(403).json({
          error: ageVerificationResult.message,
          code: ageVerificationResult.code,
          requiredAge: ageVerificationResult.requiredAge,
          contentRating: requiredRating,
          requestId
        });
      }

      // Step 6: Suspicious activity detection
      const suspiciousActivity = await detectSuspiciousActivity(context, req);
      
      // Step 7: Log successful access
      await logSecurityEvent(context, req, 'GRANTED', undefined, {
        contentRating: requiredRating,
        contentSafetyScore: contentClassification?.safetyScore,
        operationType: options.operationType,
        resourceId: options.getResourceId?.(req),
        metadata: options.getMetadata?.(req),
        processingTime: Date.now() - startTime,
        suspiciousActivity: suspiciousActivity.isSuspicious,
        alertLevel: suspiciousActivity.alertLevel,
      });

      // Add security context to request for use by route handlers
      req.securityContext = {
        ...context,
        contentClassification,
        requestId,
        operationType: options.operationType,
      };

      // Proceed to route handler
      next();

    } catch (error) {
      console.error(`Enterprise Security Middleware Error [${requestId}]:`, error);
      
      // Log security middleware error
      await logSecurityEvent({
        userId: getUserId(req.user),
        ipAddress: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        requestId,
        isAgeVerified: false,
      }, req, 'BLOCKED', 'middleware_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      return res.status(500).json({
        error: "Security check failed",
        code: "SECURITY_MIDDLEWARE_ERROR",
        requestId
      });
    }
  };
};

/**
 * Verify age requirements for content access
 */
async function verifyAgeForContent(
  user: any,
  context: SecurityContext,
  contentRating: ContentRating,
  allowedRatings: ContentRating[]
): Promise<{
  allowed: boolean;
  reason?: string;
  message?: string;
  code?: string;
  requiredAge?: number;
}> {
  
  // Check if content rating is explicitly allowed
  if (!allowedRatings.includes(contentRating)) {
    return {
      allowed: false,
      reason: 'content_rating_not_allowed',
      message: `Content rating ${contentRating} not allowed for this endpoint`,
      code: 'CONTENT_RATING_RESTRICTED',
    };
  }

  // General content is always allowed
  if (contentRating === "General") {
    return { allowed: true };
  }

  // For mature content, require age 16+
  if (contentRating === "Mature") {
    if (!user?.birthMonth || !user?.birthYear) {
      return {
        allowed: false,
        reason: 'age_verification_required',
        message: 'Age verification required to access mature content',
        code: 'AGE_VERIFICATION_REQUIRED',
        requiredAge: 16,
      };
    }

    const age = context.userAge || 0;
    if (age < 16) {
      return {
        allowed: false,
        reason: 'age_restriction',
        message: 'Must be 16 or older to access mature content',
        code: 'AGE_RESTRICTED',
        requiredAge: 16,
      };
    }

    return { allowed: true };
  }

  // For adult content, require age verification AND age 18+
  if (contentRating === "Adult") {
    if (!context.isAgeVerified || !user?.birthMonth || !user?.birthYear) {
      return {
        allowed: false,
        reason: 'age_verification_required',
        message: 'Age verification required to access adult content',
        code: 'AGE_VERIFICATION_REQUIRED', 
        requiredAge: 18,
      };
    }

    const age = context.userAge || 0;
    if (age < 18) {
      return {
        allowed: false,
        reason: 'age_restriction',
        message: 'Must be 18 or older to access adult content',
        code: 'AGE_RESTRICTED',
        requiredAge: 18,
      };
    }

    // Check if age verification is recent (within 30 days)
    if (context.ageVerifiedAt) {
      const verificationAge = (Date.now() - context.ageVerifiedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (verificationAge > 30) {
        return {
          allowed: false,
          reason: 'age_verification_expired',
          message: 'Age verification expired. Please verify your age again.',
          code: 'AGE_VERIFICATION_EXPIRED',
          requiredAge: 18,
        };
      }
    }

    return { allowed: true };
  }

  // Unknown rating - deny access
  return {
    allowed: false,
    reason: 'unknown_content_rating',
    message: 'Unknown content rating',
    code: 'UNKNOWN_CONTENT_RATING',
  };
}

/**
 * Detect suspicious activity patterns
 */
async function detectSuspiciousActivity(context: SecurityContext, req: any): Promise<{
  isSuspicious: boolean;
  alertLevel: string;
  reasons: string[];
}> {
  const reasons: string[] = [];
  let alertLevel = 'low';

  try {
    // Check for rapid requests from same IP
    if (context.ipAddress) {
      const recentLogs = await storage.getSecurityAuditLogs({
        ipAddress: context.ipAddress,
        startDate: new Date(Date.now() - 5 * 60 * 1000), // last 5 minutes
        limit: 50,
      });

      if (recentLogs.length > 20) {
        reasons.push('high_request_frequency');
        alertLevel = 'medium';
      }

      // Check for denied requests from same IP
      const deniedRequests = recentLogs.filter(log => log.accessDecision === 'DENIED').length;
      if (deniedRequests > 5) {
        reasons.push('multiple_access_denials');
        alertLevel = 'high';
      }
    }

    // Check for user agent anomalies
    if (!context.userAgent || context.userAgent === 'unknown' || context.userAgent.length < 10) {
      reasons.push('suspicious_user_agent');
    }

    // Check for mismatched user context (if applicable)
    if (context.userId && !context.userAge && req.body?.adultContent) {
      reasons.push('age_verification_bypass_attempt');
      alertLevel = 'critical';
    }

  } catch (error) {
    console.error('Error detecting suspicious activity:', error);
  }

  return {
    isSuspicious: reasons.length > 0,
    alertLevel,
    reasons,
  };
}

/**
 * Check if user is admin (unlimited access)
 */
async function isAdminUser(userId?: string): Promise<boolean> {
  if (!userId) return false;
  
  try {
    const user = await storage.getUser(userId);
    return user?.email === "zorovt18@gmail.com";
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

/**
 * Log security events to persistent audit trail
 */
async function logSecurityEvent(
  context: SecurityContext,
  req: any,
  accessDecision: string,
  denialReason?: string,
  metadata?: any
): Promise<void> {
  try {
    // Sanitize input content for logging (remove sensitive data)
    const sanitizedInput = sanitizeInputForLogging(req.body);

    await storage.createSecurityAuditLog({
      userId: context.userId || null,
      sessionId: context.sessionId || null,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      endpoint: req.path,
      httpMethod: req.method,
      requestId: context.requestId,
      
      // Content classification results
      contentRating: metadata?.contentRating || null,
      contentCategories: metadata?.categories || null,
      contentSafetyScore: metadata?.contentSafetyScore || null,
      contentFlags: metadata?.contentFlags || null,
      
      // Age verification status
      userAge: context.userAge || null,
      isAgeVerified: context.isAgeVerified,
      ageVerificationDate: context.ageVerifiedAt || null,
      verificationMethod: 'birth_date',
      
      // Access decision
      accessDecision,
      denialReason: denialReason || null,
      
      // Request context
      resourceId: metadata?.resourceId || null,
      operationType: metadata?.operationType || null,
      inputContent: sanitizedInput,
      
      // Security flags
      isSuspiciousActivity: metadata?.suspiciousActivity || false,
      alertLevel: metadata?.alertLevel || 'low',
    });

    // For high-priority security events, also console log immediately
    if (accessDecision === 'BLOCKED' || accessDecision === 'DENIED') {
      console.warn(`🚨 Security Event [${context.requestId}]: ${accessDecision} - ${denialReason} - User: ${context.userId} - IP: ${context.ipAddress}`);
    }

  } catch (error) {
    console.error('Failed to log security event:', error);
    // Don't throw - logging failure shouldn't break the request
  }
}

/**
 * Remove sensitive data from input for safe logging
 */
function sanitizeInputForLogging(input: any): any {
  if (!input || typeof input !== 'object') {
    return input;
  }

  const sanitized = { ...input };
  
  // Remove potentially sensitive fields
  const sensitiveFields = [
    'password', 'token', 'secret', 'key', 'auth', 
    'email', 'phone', 'ssn', 'creditCard'
  ];
  
  const removeFields = (obj: any, fields: string[]): void => {
    if (obj && typeof obj === 'object') {
      fields.forEach(field => {
        if (obj[field]) {
          obj[field] = '[REDACTED]';
        }
      });
      
      // Recursively sanitize nested objects
      Object.keys(obj).forEach(key => {
        if (typeof obj[key] === 'object') {
          removeFields(obj[key], fields);
        }
      });
    }
  };
  
  removeFields(sanitized, sensitiveFields);
  
  return sanitized;
}

// Cleanup job - run periodically to clean up old logs
export async function cleanupSecurityLogs(): Promise<void> {
  try {
    await storage.cleanupExpiredRateLimits();
    console.log('🧹 Security log cleanup completed');
  } catch (error) {
    console.error('Security log cleanup failed:', error);
  }
}