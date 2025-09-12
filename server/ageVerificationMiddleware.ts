import type { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import type { ContentRating } from "@shared/schema";
import { ContentSafetyService } from "./services/ContentSafetyService";
import { securityAuditService } from "./services/SecurityAuditService";
import { randomUUID } from "crypto";

// Initialize content safety service
const contentSafetyService = new ContentSafetyService();

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

// Map outfit types to content ratings
const OUTFIT_TYPE_RATINGS: Record<string, ContentRating> = {
  // General content
  "shirt": "General",
  "dress": "General", 
  "pants": "General",
  "skirt": "General",
  "jacket": "General",
  "coat": "General",
  "shoes": "General",
  "hat": "General",
  "accessories": "General",
  "casual_wear": "General",
  "business_suit": "General",
  "evening_wear": "General",
  "athletic_wear": "General",
  "fantasy_clothing": "General",
  "vintage_clothing": "General",
  "futuristic_clothing": "General",
  "traditional_clothing": "General",
  "uniform": "General",
  "cosplay": "General",
  "seasonal_wear": "General",
  "party_outfit": "General",
  
  // Mature content
  "swimwear": "Mature",
  "sleepwear": "Mature",
  
  // Adult content - requires age verification
  "lingerie": "Adult",
  "fetish_wear": "Adult",
  "revealing_outfit": "Adult",
};

// Age verification middleware
export const requireAgeVerification = (requiredRating: ContentRating) => {
  return async (req: any, res: Response, next: NextFunction) => {
    try {
      // General content always allowed
      if (requiredRating === "General") {
        return next();
      }

      const userId = getUserId(req.user);
      if (!userId) {
        return res.status(401).json({ 
          error: "Authentication required",
          code: "AUTH_REQUIRED"
        });
      }

      // Get user data from database
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ 
          error: "User not found",
          code: "USER_NOT_FOUND"
        });
      }

      // For mature content, require age 16+
      if (requiredRating === "Mature") {
        if (!user.birthMonth || !user.birthYear) {
          return res.status(403).json({
            error: "Age verification required. Please verify your age to access mature content.",
            code: "AGE_VERIFICATION_REQUIRED",
            requiredAge: 16,
            contentRating: "Mature"
          });
        }

        const age = calculateAge(user.birthMonth, user.birthYear);
        if (age < 16) {
          return res.status(403).json({
            error: "Content restricted. Must be 16 or older to access mature content.",
            code: "AGE_RESTRICTED", 
            userAge: age,
            requiredAge: 16,
            contentRating: "Mature"
          });
        }
      }

      // For adult content, require age verification AND age 18+
      if (requiredRating === "Adult") {
        if (!user.isAgeVerified || !user.birthMonth || !user.birthYear) {
          return res.status(403).json({
            error: "Age verification required. Please verify your age to access adult content.",
            code: "AGE_VERIFICATION_REQUIRED",
            requiredAge: 18,
            contentRating: "Adult"
          });
        }

        const age = calculateAge(user.birthMonth, user.birthYear);
        if (age < 18) {
          return res.status(403).json({
            error: "Content restricted. Must be 18 or older to access adult content.",
            code: "AGE_RESTRICTED",
            userAge: age,
            requiredAge: 18,
            contentRating: "Adult"
          });
        }

        // Check if age verification is recent (within 30 days)
        if (user.ageVerifiedAt) {
          const verificationAge = (Date.now() - user.ageVerifiedAt.getTime()) / (1000 * 60 * 60 * 24);
          if (verificationAge > 30) {
            return res.status(403).json({
              error: "Age verification expired. Please verify your age again.",
              code: "AGE_VERIFICATION_EXPIRED",
              lastVerified: user.ageVerifiedAt,
              contentRating: "Adult"
            });
          }
        }
      }

      next();
    } catch (error) {
      console.error("Age verification middleware error:", error);
      res.status(500).json({ 
        error: "Internal server error during age verification",
        code: "VERIFICATION_ERROR"
      });
    }
  };
};

// Content validation middleware for redress requests
export const validateRedressContent = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { outfit, presetRating, presetCategory } = req.body;

    // Determine content rating from outfit type or preset
    let contentRating: ContentRating = "General";
    
    if (presetRating) {
      contentRating = presetRating;
    } else if (outfit?.type) {
      contentRating = OUTFIT_TYPE_RATINGS[outfit.type] || "General";
    }

    // Block Adult category presets explicitly
    if (presetCategory === "Adult") {
      contentRating = "Adult";
    }

    // Store rating in request for audit logging
    req.contentRating = contentRating;
    req.outfitType = outfit?.type;
    req.presetCategory = presetCategory;

    // Apply age verification for the determined rating
    return requireAgeVerification(contentRating)(req, res, next);
  } catch (error) {
    console.error("Content validation error:", error);
    res.status(500).json({ 
      error: "Internal server error during content validation",
      code: "CONTENT_VALIDATION_ERROR"
    });
  }
};

// Audit logging for content access
export const auditContentAccess = (req: any, res: Response, next: NextFunction) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Log the request details
    const userId = getUserId(req.user);
    const logData = {
      userId,
      timestamp: new Date().toISOString(),
      endpoint: req.path,
      method: req.method,
      contentRating: req.contentRating,
      outfitType: req.outfitType,
      presetCategory: req.presetCategory,
      statusCode: res.statusCode,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    };

    // Only log if content rating was mature or adult
    if (req.contentRating === "Mature" || req.contentRating === "Adult") {
      console.log("🔍 Content Access Audit:", JSON.stringify(logData));
    }

    return originalSend.call(this, data);
  };

  next();
};