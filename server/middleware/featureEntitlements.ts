import type { NextFunction, Request, Response } from 'express';
import { storage } from '../storage';
import { resolveUserId } from '../utils/authHelpers';
import { logger } from '../logger';

interface FeatureEntitlementOptions {
  allowedPlans?: string[];
}

export function requireFeatureEntitlement(featureKey: string, options: FeatureEntitlementOptions = {}) {
  const allowedPlans = options.allowedPlans ?? [];

  return async function requireFeatureEntitlementMiddleware(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = resolveUserId((req as any).user);
      const hasAccess = await storage.hasFeatureAccess(userId, featureKey, allowedPlans);

      if (!hasAccess) {
        await logger.audit('feature.access.denied', {
          userId,
          resourceType: 'feature',
          resourceId: featureKey,
          metadata: { allowedPlans },
        });
        return res.status(403).json({ error: 'You do not have access to this feature.' });
      }

      await logger.audit('feature.access.granted', {
        userId,
        resourceType: 'feature',
        resourceId: featureKey,
        metadata: { allowedPlans },
      });

      return next();
    } catch (error) {
      return next(error);
    }
  };
}
