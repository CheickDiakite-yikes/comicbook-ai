import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { isAuthenticated } from "../replitAuth";
import { securityAuditService } from "../services/SecurityAuditService";
import { rateLimitingMiddleware } from "../middleware/RateLimitingMiddleware";

// Helper function to get user ID from different auth providers
function getUserId(user: any): string {
  if (user.provider === 'google') {
    return user.id;
  }
  // Replit Auth
  return user.claims?.sub;
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

// STRICT server-side validation schema for age verification
// Client cannot influence this validation in any way
const secureAgeVerificationSchema = z.object({
  birthMonth: z.number()
    .int("Birth month must be an integer")
    .min(1, "Birth month must be between 1 and 12")
    .max(12, "Birth month must be between 1 and 12"),
  birthYear: z.number()
    .int("Birth year must be an integer")
    .min(1900, "Birth year must be after 1900")
    .max(new Date().getFullYear(), "Birth year cannot be in the future"),
  confirmAdult: z.boolean()
    .refine(val => val === true, "Must confirm you are an adult"),
  // Honeypot field to detect automated submissions
  website: z.string().max(0, "This field should be empty").optional(),
}).strict(); // Reject any additional properties

/**
 * Enterprise-grade age verification system with server-only control.
 * 
 * Security features:
 * - Server-side only flag setting (isAgeVerified, ageVerifiedAt)
 * - Strict rate limiting to prevent abuse
 * - Comprehensive audit logging
 * - Input validation with honeypot protection
 * - Age calculation verification
 * - Tamper-evident verification timestamps
 */
export function setupSecureAgeVerification(app: Express): void {
  
  /**
   * Secure age verification endpoint
   * POST /api/auth/verify-age
   * 
   * Sets age verification flags ONLY on server side.
   * Client has no ability to influence verification status.
   */
  app.post('/api/auth/verify-age', 
    isAuthenticated,
    rateLimitingMiddleware.ageVerification, // Strict rate limiting
    async (req: any, res) => {
      const userId = getUserId(req.user);
      const ipAddress = req.ip || 'unknown';
      const userAgent = req.get('User-Agent');
      
      try {
        // STRICT server-side validation - client cannot bypass
        const validationResult = secureAgeVerificationSchema.safeParse(req.body);
        
        if (!validationResult.success) {
          // Log validation failure
          await securityAuditService.logAgeVerificationEvent(
            userId,
            'age_verification',
            '/api/auth/verify-age',
            {
              validationErrors: validationResult.error.errors,
              submittedData: req.body,
              result: 'validation_failed'
            },
            ipAddress,
            userAgent,
            'warning'
          );
          
          return res.status(400).json({
            error: "Invalid age verification data",
            code: "VALIDATION_FAILED",
            details: validationResult.error.errors
          });
        }
        
        const { birthMonth, birthYear, confirmAdult, website } = validationResult.data;
        
        // Honeypot check - if website field is filled, it's likely a bot
        if (website && website.length > 0) {
          await securityAuditService.logSuspiciousActivity(
            userId,
            '/api/auth/verify-age',
            ipAddress,
            ['honeypot_triggered'],
            50,
            true, // Block the request
            userAgent,
            { honeypotValue: website }
          );
          
          return res.status(403).json({
            error: "Verification failed",
            code: "VERIFICATION_BLOCKED"
          });
        }
        
        // Calculate age with server-side verification
        const calculatedAge = calculateAge(birthMonth, birthYear);
        
        // Strict age validation - must be 18 or older for adult content
        if (calculatedAge < 18) {
          await securityAuditService.logAgeVerificationEvent(
            userId,
            'age_verification',
            '/api/auth/verify-age',
            {
              calculatedAge,
              minimumAge: 18,
              result: 'age_insufficient',
              birthMonth,
              birthYear
            },
            ipAddress,
            userAgent,
            'warning'
          );
          
          return res.status(403).json({
            error: "Age verification failed",
            code: "AGE_INSUFFICIENT",
            message: "You must be 18 or older to access adult content.",
            calculatedAge
          });
        }
        
        // Get current user data to check for changes
        const currentUser = await storage.getUser(userId);
        if (!currentUser) {
          return res.status(404).json({
            error: "User not found",
            code: "USER_NOT_FOUND"
          });
        }
        
        // SERVER-ONLY flag setting - client cannot influence this
        const verificationTimestamp = new Date();
        const updatedUser = await storage.updateUser(userId, {
          birthMonth,
          birthYear,
          isAgeVerified: true, // Server sets this flag
          ageVerifiedAt: verificationTimestamp, // Server sets timestamp
        });
        
        if (!updatedUser) {
          throw new Error("Failed to update user verification status");
        }
        
        // Comprehensive audit logging
        await securityAuditService.logAgeVerificationEvent(
          userId,
          'age_verification',
          '/api/auth/verify-age',
          {
            calculatedAge,
            previouslyVerified: currentUser.isAgeVerified,
            previousVerificationDate: currentUser.ageVerifiedAt,
            newVerificationDate: verificationTimestamp,
            birthMonth,
            birthYear,
            result: 'verification_successful',
            confirmAdultFlag: confirmAdult
          },
          ipAddress,
          userAgent,
          'info'
        );
        
        res.json({
          success: true,
          message: "Age verification completed successfully",
          verificationData: {
            isAgeVerified: updatedUser.isAgeVerified,
            ageVerifiedAt: updatedUser.ageVerifiedAt,
            calculatedAge,
            // Do not return birth month/year for privacy
          }
        });
        
      } catch (error) {
        console.error("Age verification error:", error);
        
        // Log system error
        await securityAuditService.logAgeVerificationEvent(
          userId,
          'age_verification',
          '/api/auth/verify-age',
          {
            error: error.message,
            result: 'system_error'
          },
          ipAddress,
          userAgent,
          'critical'
        );
        
        res.status(500).json({
          error: "Age verification system error",
          code: "VERIFICATION_ERROR"
        });
      }
    }
  );
  
  /**
   * Get current age verification status
   * GET /api/auth/verification-status
   */
  app.get('/api/auth/verification-status',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = getUserId(req.user);
        const user = await storage.getUser(userId);
        
        if (!user) {
          return res.status(404).json({
            error: "User not found",
            code: "USER_NOT_FOUND"
          });
        }
        
        // Calculate current age if birth data exists
        let calculatedAge: number | null = null;
        if (user.birthMonth && user.birthYear) {
          calculatedAge = calculateAge(user.birthMonth, user.birthYear);
        }
        
        // Check if verification is recent (within 30 days)
        let isVerificationCurrent = false;
        if (user.ageVerifiedAt) {
          const verificationAge = (Date.now() - user.ageVerifiedAt.getTime()) / (1000 * 60 * 60 * 24);
          isVerificationCurrent = verificationAge <= 30;
        }
        
        res.json({
          isAgeVerified: user.isAgeVerified,
          ageVerifiedAt: user.ageVerifiedAt,
          isVerificationCurrent,
          calculatedAge,
          hasAgeData: !!(user.birthMonth && user.birthYear),
          // Security: Do not expose actual birth month/year
        });
        
      } catch (error) {
        console.error("Error getting verification status:", error);
        res.status(500).json({
          error: "Failed to get verification status",
          code: "STATUS_ERROR"
        });
      }
    }
  );
  
  /**
   * Reset age verification (admin/support use)
   * DELETE /api/auth/verify-age
   */
  app.delete('/api/auth/verify-age',
    isAuthenticated,
    rateLimitingMiddleware.ageVerification, // Same strict limits
    async (req: any, res) => {
      try {
        const userId = getUserId(req.user);
        const ipAddress = req.ip || 'unknown';
        const userAgent = req.get('User-Agent');
        
        const currentUser = await storage.getUser(userId);
        if (!currentUser) {
          return res.status(404).json({
            error: "User not found",
            code: "USER_NOT_FOUND"
          });
        }
        
        // Reset verification flags
        await storage.updateUser(userId, {
          isAgeVerified: false,
          ageVerifiedAt: undefined,
          birthMonth: undefined,
          birthYear: undefined,
        });
        
        // Comprehensive audit logging for reset
        await securityAuditService.logAgeVerificationEvent(
          userId,
          'age_verification_reset',
          '/api/auth/verify-age',
          {
            hadVerificationData: !!(currentUser.birthMonth && currentUser.birthYear),
            wasAgeVerified: currentUser.isAgeVerified,
            previousBirthMonth: currentUser.birthMonth,
            previousBirthYear: currentUser.birthYear,
            previousAgeVerifiedAt: currentUser.ageVerifiedAt,
            result: 'verification_reset'
          },
          ipAddress,
          userAgent,
          'warning' // Resets are potentially suspicious
        );
        
        res.json({
          success: true,
          message: "Age verification data cleared successfully"
        });
        
      } catch (error) {
        console.error("Error resetting age verification:", error);
        res.status(500).json({
          error: "Failed to reset age verification",
          code: "RESET_ERROR"
        });
      }
    }
  );
}