import type { NextFunction, Request, Response } from 'express';
import { storage } from '../storage';
import { resolveUserId } from '../utils/authHelpers';

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = resolveUserId((req as any).user);
    const user = await storage.getUser(userId);

    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Administrator privileges required.' });
    }

    return next();
  } catch (error) {
    return next(error);
  }
}
