import EventEmitter from 'events';

export interface UserResourceLimits {
  maxConcurrentSessions: number;
  maxPanelsPerSession: number;
  maxSessionsPerHour: number;
  maxWorkerTimePerSession: number; // in seconds
  sessionTimeoutMs: number;
}

export interface ResourceUsage {
  userId: string;
  activeSessions: number;
  sessionsThisHour: number;
  totalWorkerTimeUsed: number;
  lastSessionStart: Date;
  sessionHistory: Array<{
    sessionId: string;
    startTime: Date;
    endTime?: Date;
    panelCount: number;
    workerTimeUsed: number;
  }>;
}

export class ResourceManager extends EventEmitter {
  private userLimits: Map<string, UserResourceLimits> = new Map();
  private userUsage: Map<string, ResourceUsage> = new Map();
  private sessionTimeouts: Map<string, NodeJS.Timeout> = new Map();
  
  // Default limits for regular users
  private readonly DEFAULT_LIMITS: UserResourceLimits = {
    maxConcurrentSessions: 3,
    maxPanelsPerSession: 20,
    maxSessionsPerHour: 10,
    maxWorkerTimePerSession: 600, // 10 minutes
    sessionTimeoutMs: 1800000, // 30 minutes
  };

  // Premium limits for paying users
  private readonly PREMIUM_LIMITS: UserResourceLimits = {
    maxConcurrentSessions: 10,
    maxPanelsPerSession: 100,
    maxSessionsPerHour: 50,
    maxWorkerTimePerSession: 3600, // 1 hour
    sessionTimeoutMs: 7200000, // 2 hours
  };

  constructor() {
    super();
    this.startCleanupInterval();
  }

  private startCleanupInterval(): void {
    // Clean up old session history every hour
    setInterval(() => {
      this.cleanupOldSessions();
    }, 3600000); // 1 hour
  }

  private cleanupOldSessions(): void {
    const oneHourAgo = new Date(Date.now() - 3600000);
    
    for (const [userId, usage] of Array.from(this.userUsage)) {
      // Remove sessions older than 1 hour from history
      usage.sessionHistory = usage.sessionHistory.filter(
        (session: { sessionId: string; startTime: Date; endTime?: Date; panelCount: number; workerTimeUsed: number }) => session.startTime > oneHourAgo
      );
      
      // Recalculate sessions this hour
      usage.sessionsThisHour = usage.sessionHistory.length;
      
      // If no recent activity, remove user from tracking
      if (usage.activeSessions === 0 && usage.sessionHistory.length === 0) {
        this.userUsage.delete(userId);
      }
    }
  }

  getUserLimits(userId: string): UserResourceLimits {
    return this.userLimits.get(userId) || this.DEFAULT_LIMITS;
  }

  setUserLimits(userId: string, limits: UserResourceLimits): void {
    this.userLimits.set(userId, limits);
    this.emit('userLimitsUpdated', userId, limits);
  }

  setPremiumUser(userId: string): void {
    this.setUserLimits(userId, this.PREMIUM_LIMITS);
  }

  private getUserUsage(userId: string): ResourceUsage {
    if (!this.userUsage.has(userId)) {
      this.userUsage.set(userId, {
        userId,
        activeSessions: 0,
        sessionsThisHour: 0,
        totalWorkerTimeUsed: 0,
        lastSessionStart: new Date(0),
        sessionHistory: []
      });
    }
    return this.userUsage.get(userId)!;
  }

  async canStartSession(
    userId: string, 
    sessionId: string, 
    panelCount: number
  ): Promise<{ canStart: boolean; reason?: string; limits?: any }> {
    const limits = this.getUserLimits(userId);
    const usage = this.getUserUsage(userId);

    // Check concurrent sessions
    if (usage.activeSessions >= limits.maxConcurrentSessions) {
      return {
        canStart: false,
        reason: `Maximum concurrent sessions reached (${limits.maxConcurrentSessions})`,
        limits: { maxConcurrentSessions: limits.maxConcurrentSessions, current: usage.activeSessions }
      };
    }

    // Check panels per session
    if (panelCount > limits.maxPanelsPerSession) {
      return {
        canStart: false,
        reason: `Too many panels for session (${panelCount}/${limits.maxPanelsPerSession})`,
        limits: { maxPanelsPerSession: limits.maxPanelsPerSession, requested: panelCount }
      };
    }

    // Check sessions per hour
    if (usage.sessionsThisHour >= limits.maxSessionsPerHour) {
      return {
        canStart: false,
        reason: `Hourly session limit reached (${limits.maxSessionsPerHour})`,
        limits: { maxSessionsPerHour: limits.maxSessionsPerHour, current: usage.sessionsThisHour }
      };
    }

    return { canStart: true };
  }

  async startSession(userId: string, sessionId: string, panelCount: number): Promise<boolean> {
    const canStart = await this.canStartSession(userId, sessionId, panelCount);
    if (!canStart.canStart) {
      this.emit('sessionRejected', userId, sessionId, canStart.reason);
      return false;
    }

    const usage = this.getUserUsage(userId);
    const limits = this.getUserLimits(userId);
    const now = new Date();

    // Update usage
    usage.activeSessions++;
    usage.sessionsThisHour++;
    usage.lastSessionStart = now;
    usage.sessionHistory.push({
      sessionId,
      startTime: now,
      panelCount,
      workerTimeUsed: 0
    });

    // Set session timeout
    const timeout = setTimeout(() => {
      this.forceEndSession(userId, sessionId, 'timeout');
    }, limits.sessionTimeoutMs);
    
    this.sessionTimeouts.set(sessionId, timeout);

    this.emit('sessionStarted', userId, sessionId, panelCount);
    return true;
  }

  async endSession(userId: string, sessionId: string, workerTimeUsed: number = 0): Promise<void> {
    const usage = this.getUserUsage(userId);
    const now = new Date();

    // Update usage
    if (usage.activeSessions > 0) {
      usage.activeSessions--;
    }
    
    usage.totalWorkerTimeUsed += workerTimeUsed;

    // Update session history
    const sessionIndex = usage.sessionHistory.findIndex(s => s.sessionId === sessionId);
    if (sessionIndex >= 0) {
      usage.sessionHistory[sessionIndex].endTime = now;
      usage.sessionHistory[sessionIndex].workerTimeUsed = workerTimeUsed;
    }

    // Clear timeout
    const timeout = this.sessionTimeouts.get(sessionId);
    if (timeout) {
      clearTimeout(timeout);
      this.sessionTimeouts.delete(sessionId);
    }

    this.emit('sessionEnded', userId, sessionId, workerTimeUsed);
  }

  private forceEndSession(userId: string, sessionId: string, reason: string): void {
    this.endSession(userId, sessionId, 0);
    this.emit('sessionForcedEnd', userId, sessionId, reason);
  }

  async cancelSession(userId: string, sessionId: string): Promise<void> {
    await this.endSession(userId, sessionId, 0);
    this.emit('sessionCancelled', userId, sessionId);
  }

  getUserStats(userId: string): {
    limits: UserResourceLimits;
    usage: ResourceUsage;
    quotaUsage: {
      concurrentSessionsUsed: number;
      concurrentSessionsMax: number;
      sessionsThisHour: number;
      maxSessionsPerHour: number;
      workerTimeUsedToday: number;
    };
  } {
    const limits = this.getUserLimits(userId);
    const usage = this.getUserUsage(userId);

    // Calculate worker time used today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const workerTimeUsedToday = usage.sessionHistory
      .filter(session => session.startTime >= todayStart)
      .reduce((sum, session) => sum + session.workerTimeUsed, 0);

    return {
      limits,
      usage,
      quotaUsage: {
        concurrentSessionsUsed: usage.activeSessions,
        concurrentSessionsMax: limits.maxConcurrentSessions,
        sessionsThisHour: usage.sessionsThisHour,
        maxSessionsPerHour: limits.maxSessionsPerHour,
        workerTimeUsedToday
      }
    };
  }

  getAllUserStats(): Map<string, any> {
    const stats = new Map();
    for (const userId of Array.from(this.userUsage.keys())) {
      stats.set(userId, this.getUserStats(userId));
    }
    return stats;
  }

  // Admin functions
  forceStopUserSessions(userId: string): number {
    const usage = this.getUserUsage(userId);
    const activeSessions = usage.sessionHistory
      .filter(session => !session.endTime)
      .map(session => session.sessionId);

    for (const sessionId of activeSessions) {
      this.forceEndSession(userId, sessionId, 'admin_force_stop');
    }

    return activeSessions.length;
  }

  getSystemStats(): {
    totalActiveUsers: number;
    totalActiveSessions: number;
    totalSessionsThisHour: number;
    systemLoadPercentage: number;
  } {
    let totalActiveSessions = 0;
    let totalSessionsThisHour = 0;
    
    for (const usage of Array.from(this.userUsage.values())) {
      totalActiveSessions += usage.activeSessions;
      totalSessionsThisHour += usage.sessionsThisHour;
    }

    // Calculate system load as percentage of theoretical max
    const maxPossibleConcurrentSessions = this.userUsage.size * this.DEFAULT_LIMITS.maxConcurrentSessions;
    const systemLoadPercentage = maxPossibleConcurrentSessions > 0 
      ? Math.round((totalActiveSessions / maxPossibleConcurrentSessions) * 100)
      : 0;

    return {
      totalActiveUsers: this.userUsage.size,
      totalActiveSessions,
      totalSessionsThisHour,
      systemLoadPercentage
    };
  }

  shutdown(): void {
    // Clear all timeouts
    for (const timeout of Array.from(this.sessionTimeouts.values())) {
      clearTimeout(timeout);
    }
    this.sessionTimeouts.clear();
    
    // Force end all active sessions
    for (const [userId, usage] of Array.from(this.userUsage)) {
      const activeSessions = usage.sessionHistory
        .filter((session: { sessionId: string; startTime: Date; endTime?: Date; panelCount: number; workerTimeUsed: number }) => !session.endTime)
        .map((session: { sessionId: string; startTime: Date; endTime?: Date; panelCount: number; workerTimeUsed: number }) => session.sessionId);
        
      for (const sessionId of activeSessions) {
        this.forceEndSession(userId, sessionId, 'system_shutdown');
      }
    }

    this.emit('systemShutdown');
  }
}