import { RequestHandler } from "express";
import { storage } from "./storage";
import { logger } from "./logger";

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
  
  // Script validation
  script_validation: 2,
  
  // Visual analysis
  visual_analysis: 1,
} as const;

export type CreditOperationType = keyof typeof CREDIT_COSTS;

interface CreditMiddlewareOptions {
  operationType: CreditOperationType;
  getResourceId?: (req: any) => string | undefined;
  getMetadata?: (req: any) => any;
  getRenderCount?: (req: any) => number;
}

function attachCreditInfoResponder(req: any, res: any) {
  if ((res as any)._creditInfoWrapped) {
    return;
  }

  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    const creditInfo = res.locals?.creditInfo ?? req.creditInfo;
    if (
      creditInfo &&
      body &&
      typeof body === "object" &&
      !Array.isArray(body) &&
      !("creditInfo" in body)
    ) {
      return originalJson({ ...body, creditInfo });
    }

    return originalJson(body);
  };

  (res as any)._creditInfoWrapped = true;
}

function extractModelVariant(req: any): string | undefined {
  return (
    req.body?.modelVariant ||
    req.body?.model ||
    req.body?.engine ||
    req.query?.modelVariant ||
    req.query?.model ||
    req.body?.modelVersion
  );
}

/**
 * Middleware to check and deduct AI credits before allowing operations
 */
export function requireCredits(options: CreditMiddlewareOptions): RequestHandler {
  return async (req: any, res: any, next: any) => {
    attachCreditInfoResponder(req, res);
    const startTime = process.hrtime.bigint();
    const modelVariant = extractModelVariant(req);
    let resolvedUserId: string | undefined;

    res.on("finish", () => {
      const creditInfo = res.locals?.creditInfo ?? req.creditInfo;
      if (!creditInfo) {
        return;
      }

      const durationMs = Number(process.hrtime.bigint() - startTime) / 1_000_000;

      logger.info("AI operation usage", {
        operationType: creditInfo.operationType,
        creditsDeducted: creditInfo.creditsDeducted,
        remainingCredits: creditInfo.remainingCredits,
        renderCount: creditInfo.renderCount ?? 1,
        durationMs,
        modelVariant,
        userId: resolvedUserId,
        statusCode: res.statusCode,
      });
    });

    try {
      // Handle both Google OAuth and Replit OAuth user structures
      const userId = req.user?.id || req.user?.claims?.sub;
      const userEmail = req.user?.profile?.emails?.[0]?.value || req.user?.claims?.email;
      resolvedUserId = userId;

      console.log(`🔑 Credit middleware: userId=${userId}, userEmail=${userEmail}, provider=${req.user?.provider}`);

      if (!userId) {
        console.log(`🔑 Credit middleware: No user ID found in req.user:`, req.user);
        return res.status(401).json({ 
          message: "Unauthorized - user not found",
          error: "authentication_required"
        });
      }

      // Check if user is admin (unlimited credits)
      const isAdmin = userEmail === "zorovt18@gmail.com";
      if (isAdmin) {
        console.log(`🔑 Admin user ${userId} bypassing credit check for ${options.operationType}`);
        res.setHeader("X-Remaining-Credits", "unlimited");
        res.setHeader("X-Monthly-Credit-Limit", "unlimited");
        return next();
      }

      const rawRenderCount = options.getRenderCount ? options.getRenderCount(req) : 1;
      const renderCount = Number.isFinite(rawRenderCount) && rawRenderCount > 0
        ? Math.max(1, Math.floor(rawRenderCount))
        : 1;
      const baseCost = CREDIT_COSTS[options.operationType];
      const creditsRequired = baseCost * renderCount;

      const monthlyRecord = await storage.getCurrentMonthCredits(userId);
      const remainingCreditsBefore = monthlyRecord.monthlyLimit - monthlyRecord.creditsUsed;

      // Check if user has enough credits
      if (remainingCreditsBefore < creditsRequired) {
        const remainingCredits = Math.max(0, remainingCreditsBefore);

        console.log(`❌ Credit check failed for user ${userId}: ${creditsRequired} required, ${remainingCredits} remaining`);

        res.setHeader("X-Remaining-Credits", String(remainingCredits));
        res.setHeader("X-Monthly-Credit-Limit", String(monthlyRecord.monthlyLimit));

        res.locals.creditInfo = {
          operationType: options.operationType,
          creditsDeducted: 0,
          remainingCredits,
          renderCount,
        };

        return res.status(402).json({
          message: "Insufficient AI credits",
          error: "insufficient_credits",
          creditsRequired,
          remainingCredits,
          monthlyLimit: monthlyRecord.monthlyLimit,
          operationType: options.operationType,
        });
      }

      // Prepare resource ID and metadata
      const resourceId = options.getResourceId ? options.getResourceId(req) : undefined;
      const metadata = options.getMetadata ? options.getMetadata(req) : undefined;
      const creditMetadata = {
        ...(metadata ?? {}),
        renderCount,
        ...(modelVariant ? { modelVariant } : {}),
      };

      // Deduct credits
      const result = await storage.deductCredits(
        userId,
        options.operationType,
        creditsRequired,
        resourceId,
        creditMetadata
      );

      if (!result.success) {
        console.log(`❌ Credit deduction failed for user ${userId}: ${options.operationType}`);
        return res.status(500).json({
          message: "Failed to deduct credits",
          error: "credit_deduction_failed"
        });
      }

      console.log(`✅ Credits deducted for user ${userId}: ${creditsRequired} credits for ${options.operationType}, ${result.remainingCredits} remaining`);

      res.setHeader("X-Remaining-Credits", String(result.remainingCredits));
      res.setHeader("X-Monthly-Credit-Limit", String(monthlyRecord.monthlyLimit));

      // Add credit info to request for logging
      req.creditInfo = {
        operationType: options.operationType,
        creditsDeducted: creditsRequired,
        remainingCredits: result.remainingCredits,
        renderCount,
      };
      res.locals.creditInfo = req.creditInfo;

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
 * Helper to get project ID from request body (for parallel processing routes)
 */
export function getProjectIdFromBody(req: any): string | undefined {
  return req.body?.projectId;
}

/**
 * Helper to calculate credits for parallel operations based on item count
 */
export function calculateParallelCredits(operationType: CreditOperationType, itemCount: number): number {
  const baseCost = CREDIT_COSTS[operationType];
  // Apply scaling for parallel operations
  if (operationType === 'panel_generation') {
    return Math.max(itemCount * baseCost, 1); // Minimum 1 credit
  }
  return itemCount * baseCost;
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