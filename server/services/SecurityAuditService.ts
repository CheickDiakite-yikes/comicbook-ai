import { storage } from "../storage";
import type { ContentClassification } from "./ContentSafetyService";
import type { ContentRating } from "@shared/schema";

export interface SecurityAuditEvent {
  userId?: string;
  sessionId?: string;
  ipAddress: string;
  userAgent?: string;
  endpoint: string;
  httpMethod: string;
  requestId?: string;
  
  // Content classification results
  contentRating?: ContentRating;
  safetyScore?: number;
  contentFlags?: Record<string, boolean>;
  blockedKeywords?: string[];
  
  // Event details
  eventType: 'generation_request' | 'age_verification' | 'content_block' | 'rate_limit' | 'suspicious_activity' | 'age_verification_reset';
  severity: 'info' | 'warning' | 'critical';
  metadata?: Record<string, any>;
  
  // Security context
  wasBlocked: boolean;
  blockReason?: string;
  userAge?: number;
  isAgeVerified?: boolean;
  
  timestamp?: Date;
}

/**
 * Enterprise-grade security audit service that provides persistent, 
 * tamper-evident logging of all security-relevant events.
 * 
 * Replaces console.log calls with structured database writes
 * for compliance, monitoring, and incident response.
 */
export class SecurityAuditService {
  
  /**
   * Log a security event to persistent storage with full audit trail
   */
  async logSecurityEvent(event: SecurityAuditEvent): Promise<void> {
    try {
      await storage.createSecurityAuditLog({
        userId: event.userId || null,
        sessionId: event.sessionId || null,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent || null,
        endpoint: event.endpoint,
        httpMethod: event.httpMethod,
        requestId: event.requestId || null,
        
        // Content classification - match schema field names
        contentRating: event.contentRating || null,
        contentSafetyScore: event.safetyScore || null,
        contentFlags: event.contentFlags || null,
        contentCategories: event.categories || null,
        
        // Security context
        userAge: event.userAge || null,
        isAgeVerified: event.isAgeVerified || false,
        
        // Access decision - required field
        accessDecision: event.wasBlocked ? "DENIED" : "GRANTED",
        denialReason: event.blockReason || null,
        
        // Operation context
        operationType: event.metadata?.operationType || null,
        resourceId: event.metadata?.resourceId || null,
        
        // Security flags
        isSuspiciousActivity: event.eventType === 'suspicious_activity',
        alertLevel: event.severity === 'critical' ? 'critical' : 
                   event.severity === 'warning' ? 'high' : 'low',
        
        createdAt: event.timestamp || new Date(),
      });
      
      // Also log critical events to console for immediate monitoring
      if (event.severity === 'critical' || event.wasBlocked) {
        console.log(`🚨 SECURITY ALERT [${event.severity.toUpperCase()}]:`, {
          eventType: event.eventType,
          endpoint: event.endpoint,
          userId: event.userId,
          reason: event.blockReason,
          ip: event.ipAddress,
          timestamp: event.timestamp || new Date()
        });
      }
      
    } catch (error) {
      // Critical: If audit logging fails, we must not silently continue
      console.error("🔥 CRITICAL: Security audit logging failed:", error);
      console.error("🔥 Failed to log event:", JSON.stringify(event, null, 2));
      
      // In production, this should trigger alerts/monitoring
      throw new Error("Security audit system failure - operation cannot continue");
    }
  }

  /**
   * Log content classification result for audit trail
   */
  async logContentClassification(
    userId: string | undefined,
    endpoint: string,
    content: string,
    classification: ContentClassification,
    wasBlocked: boolean,
    requestId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logSecurityEvent({
      userId,
      ipAddress: ipAddress || 'unknown',
      userAgent,
      endpoint,
      httpMethod: 'POST', // content generation is typically POST
      requestId,
      
      contentRating: classification.rating,
      safetyScore: classification.safetyScore,
      contentFlags: classification.flags,
      blockedKeywords: classification.blockedKeywords,
      
      eventType: wasBlocked ? 'content_block' : 'generation_request',
      severity: wasBlocked ? 'warning' : 'info',
      metadata: {
        contentLength: content.length,
        detectedCategories: classification.categories,
        classification: classification.explanation,
        analysisInput: content.substring(0, 200) + (content.length > 200 ? '...' : '')
      },
      
      wasBlocked,
      blockReason: wasBlocked ? `Content rated ${classification.rating} (Score: ${classification.safetyScore})` : undefined,
    });
  }

  /**
   * Log age verification events with full context
   */
  async logAgeVerificationEvent(
    userId: string,
    eventType: 'age_verification' | 'age_verification_reset',
    endpoint: string,
    metadata: Record<string, any>,
    ipAddress: string,
    userAgent?: string,
    severity: 'info' | 'warning' | 'critical' = 'info'
  ): Promise<void> {
    await this.logSecurityEvent({
      userId,
      ipAddress,
      userAgent,
      endpoint,
      httpMethod: 'POST',
      
      eventType,
      severity,
      metadata,
      
      wasBlocked: false, // verification events aren't blocked
    });
  }

  /**
   * Log rate limiting events
   */
  async logRateLimitEvent(
    userId: string | undefined,
    endpoint: string,
    ipAddress: string,
    wasLimited: boolean,
    requestCount: number,
    limitThreshold: number,
    windowMinutes: number,
    userAgent?: string
  ): Promise<void> {
    await this.logSecurityEvent({
      userId,
      ipAddress,
      userAgent,
      endpoint,
      httpMethod: 'ANY',
      
      eventType: 'rate_limit',
      severity: wasLimited ? 'warning' : 'info',
      metadata: {
        requestCount,
        limitThreshold,
        windowMinutes,
        exceededBy: Math.max(0, requestCount - limitThreshold)
      },
      
      wasBlocked: wasLimited,
      blockReason: wasLimited ? `Rate limit exceeded: ${requestCount}/${limitThreshold} requests in ${windowMinutes} minutes` : undefined,
    });
  }

  /**
   * Log suspicious activity detection
   */
  async logSuspiciousActivity(
    userId: string | undefined,
    endpoint: string,
    ipAddress: string,
    suspiciousIndicators: string[],
    riskScore: number,
    wasBlocked: boolean,
    userAgent?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logSecurityEvent({
      userId,
      ipAddress,
      userAgent,
      endpoint,
      httpMethod: 'ANY',
      
      eventType: 'suspicious_activity',
      severity: wasBlocked ? 'critical' : 'warning',
      metadata: {
        ...metadata,
        suspiciousIndicators,
        riskScore,
        automaticBlocking: wasBlocked
      },
      
      wasBlocked,
      blockReason: wasBlocked ? `Suspicious activity detected (Risk: ${riskScore}): ${suspiciousIndicators.join(', ')}` : undefined,
    });
  }

  /**
   * Clean up old audit logs to prevent unbounded growth
   * Keep logs for 90 days for compliance
   */
  async cleanupOldLogs(): Promise<number> {
    try {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      
      const deletedCount = await storage.deleteOldSecurityAuditLogs(ninetyDaysAgo);
      
      if (deletedCount > 0) {
        console.log(`🧹 Security Audit Cleanup: Removed ${deletedCount} logs older than 90 days`);
      }
      
      return deletedCount;
    } catch (error) {
      console.error("Error cleaning up security audit logs:", error);
      throw error;
    }
  }
}

// Export singleton instance
export const securityAuditService = new SecurityAuditService();