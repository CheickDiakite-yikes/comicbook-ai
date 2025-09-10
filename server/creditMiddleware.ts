import { RequestHandler } from "express";
import { storage } from "./storage";

// Define credit costs for different AI operations
export const CREDIT_COSTS = {
  // Panel and image generation
  panel_generation: 1,
  background_generation: 1,
  cover_art_generation: 2,
  
  // Script and story generation
  script_generation: 3,
  structured_script_generation: 5,
  complete_story_generation: 8,
  
  // Character and text generation
  character_generation: 2,
  text_generation: 1,
  
  // Full page generation (generates multiple panels)
  full_page_generation: 4,
} as const;

export type CreditOperationType = keyof typeof CREDIT_COSTS;

interface CreditMiddlewareOptions {
  operationType: CreditOperationType;
  getResourceId?: (req: any) => string | undefined;
  getMetadata?: (req: any) => any;
}

/**
 * Middleware to check and deduct AI credits before allowing operations
 */
export function requireCredits(options: CreditMiddlewareOptions): RequestHandler {
  return async (req: any, res: any, next: any) => {
    try {
      const userId = req.user?.claims?.sub;
      
      if (!userId) {
        return res.status(401).json({ 
          message: "Unauthorized - user not found",
          error: "authentication_required"
        });
      }

      // Check if user is admin (unlimited credits)
      const isAdmin = req.user?.claims?.email === "zorovt18@gmail.com";
      if (isAdmin) {
        console.log(`🔑 Admin user ${userId} bypassing credit check for ${options.operationType}`);
        return next();
      }

      const creditsRequired = CREDIT_COSTS[options.operationType];
      
      // Check if user has enough credits
      const hasEnoughCredits = await storage.hasEnoughCredits(userId, creditsRequired);
      if (!hasEnoughCredits) {
        const currentCredits = await storage.getCurrentMonthCredits(userId);
        const remainingCredits = currentCredits.monthlyLimit - currentCredits.creditsUsed;
        
        console.log(`❌ Credit check failed for user ${userId}: ${creditsRequired} required, ${remainingCredits} remaining`);
        
        return res.status(402).json({
          message: "Insufficient AI credits",
          error: "insufficient_credits",
          creditsRequired,
          remainingCredits,
          monthlyLimit: currentCredits.monthlyLimit,
          operationType: options.operationType,
        });
      }

      // Prepare resource ID and metadata
      const resourceId = options.getResourceId ? options.getResourceId(req) : undefined;
      const metadata = options.getMetadata ? options.getMetadata(req) : undefined;

      // Deduct credits
      const result = await storage.deductCredits(
        userId,
        options.operationType,
        creditsRequired,
        resourceId,
        metadata
      );

      if (!result.success) {
        console.log(`❌ Credit deduction failed for user ${userId}: ${options.operationType}`);
        return res.status(500).json({
          message: "Failed to deduct credits",
          error: "credit_deduction_failed"
        });
      }

      console.log(`✅ Credits deducted for user ${userId}: ${creditsRequired} credits for ${options.operationType}, ${result.remainingCredits} remaining`);

      // Add credit info to request for logging
      req.creditInfo = {
        operationType: options.operationType,
        creditsDeducted: creditsRequired,
        remainingCredits: result.remainingCredits,
      };

      next();
    } catch (error) {
      console.error("Credit middleware error:", error);
      res.status(500).json({
        message: "Credit system error",
        error: "credit_system_error"
      });
    }
  };
}

/**
 * Helper to get project ID from request parameters
 */
export function getProjectIdFromParams(req: any): string | undefined {
  return req.params.projectId || req.body.projectId;
}

/**
 * Helper to get panel ID from request body
 */
export function getPanelIdFromBody(req: any): string | undefined {
  return req.body.panelId;
}

/**
 * Helper to get page ID from request parameters or body
 */
export function getPageIdFromRequest(req: any): string | undefined {
  return req.params.pageId || req.body.pageId || req.body.currentPageId;
}

/**
 * Helper to create metadata for operations
 */
export function createOperationMetadata(req: any, additionalData?: any): any {
  const baseMetadata = {
    userAgent: req.headers['user-agent'],
    ip: req.ip,
    timestamp: new Date().toISOString(),
  };

  if (additionalData) {
    return { ...baseMetadata, ...additionalData };
  }

  return baseMetadata;
}