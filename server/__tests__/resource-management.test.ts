/**
 * CRITICAL SECURITY TESTS: Resource Management Verification
 * 
 * These tests verify that the resource management system actually works
 * and enforces proper limits on parallel processing operations.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ResourceManager } from '../parallel-processing/ResourceManager';

describe('Resource Management Security Tests', () => {
  let resourceManager: ResourceManager;

  beforeEach(() => {
    resourceManager = new ResourceManager();
  });

  afterEach(() => {
    resourceManager.shutdown();
  });

  describe('CRITICAL: User Session Limits', () => {
    it('should BLOCK users from exceeding concurrent session limits', async () => {
      const userId = 'user123';
      const limits = resourceManager.getUserLimits(userId);
      
      // Start sessions up to the limit
      const sessions: string[] = [];
      for (let i = 0; i < limits.maxConcurrentSessions; i++) {
        const sessionId = `session_${i}`;
        const result = await resourceManager.startSession(userId, sessionId, 5);
        expect(result).toBe(true);
        sessions.push(sessionId);
      }

      // Attempt to start one more session (should be blocked)
      const canStartAnother = await resourceManager.canStartSession(userId, 'session_overflow', 5);
      
      expect(canStartAnother.canStart).toBe(false);
      expect(canStartAnother.reason).toContain('Maximum concurrent sessions reached');
    });

    it('should BLOCK users from exceeding panels per session limit', async () => {
      const userId = 'user123';
      const limits = resourceManager.getUserLimits(userId);
      
      const canStart = await resourceManager.canStartSession(
        userId, 
        'session_large', 
        limits.maxPanelsPerSession + 1
      );
      
      expect(canStart.canStart).toBe(false);
      expect(canStart.reason).toContain('Too many panels for session');
    });

    it('should BLOCK users from exceeding hourly session limit', async () => {
      const userId = 'user123';
      const limits = resourceManager.getUserLimits(userId);
      
      // Start sessions up to hourly limit
      for (let i = 0; i < limits.maxSessionsPerHour; i++) {
        await resourceManager.startSession(userId, `session_hourly_${i}`, 1);
        await resourceManager.endSession(userId, `session_hourly_${i}`, 0);
      }

      // Attempt to start one more session this hour (should be blocked)
      const canStartAnother = await resourceManager.canStartSession(userId, 'session_hourly_overflow', 1);
      
      expect(canStartAnother.canStart).toBe(false);
      expect(canStartAnother.reason).toContain('Hourly session limit reached');
    });

    it('should enforce session timeouts automatically', (done) => {
      const userId = 'user123';
      const sessionId = 'timeout_test_session';
      
      // Set very short timeout for testing
      resourceManager.setUserLimits(userId, {
        maxConcurrentSessions: 5,
        maxPanelsPerSession: 20,
        maxSessionsPerHour: 10,
        maxWorkerTimePerSession: 600,
        sessionTimeoutMs: 100 // 100ms timeout
      });

      resourceManager.startSession(userId, sessionId, 5);

      // Listen for forced timeout
      resourceManager.on('sessionForcedEnd', (endedUserId, endedSessionId, reason) => {
        expect(endedUserId).toBe(userId);
        expect(endedSessionId).toBe(sessionId);
        expect(reason).toBe('timeout');
        done();
      });
    }, 5000);
  });

  describe('CRITICAL: Resource Tracking', () => {
    it('should accurately track user resource usage', async () => {
      const userId = 'user123';
      
      // Start a session
      await resourceManager.startSession(userId, 'session1', 10);
      
      const stats = resourceManager.getUserStats(userId);
      
      expect(stats.usage.activeSessions).toBe(1);
      expect(stats.usage.sessionsThisHour).toBe(1);
      expect(stats.quotaUsage.concurrentSessionsUsed).toBe(1);
    });

    it('should clean up resources when session ends', async () => {
      const userId = 'user123';
      const sessionId = 'cleanup_test';
      
      await resourceManager.startSession(userId, sessionId, 5);
      expect(resourceManager.getUserStats(userId).usage.activeSessions).toBe(1);
      
      await resourceManager.endSession(userId, sessionId, 30);
      expect(resourceManager.getUserStats(userId).usage.activeSessions).toBe(0);
    });

    it('should provide system-wide resource statistics', async () => {
      const user1 = 'user1';
      const user2 = 'user2';
      
      await resourceManager.startSession(user1, 'session1', 5);
      await resourceManager.startSession(user2, 'session2', 3);
      
      const systemStats = resourceManager.getSystemStats();
      
      expect(systemStats.totalActiveUsers).toBe(2);
      expect(systemStats.totalActiveSessions).toBe(2);
    });
  });

  describe('CRITICAL: Premium User Limits', () => {
    it('should provide higher limits for premium users', () => {
      const userId = 'premium_user';
      
      resourceManager.setPremiumUser(userId);
      const limits = resourceManager.getUserLimits(userId);
      
      expect(limits.maxConcurrentSessions).toBeGreaterThan(3);
      expect(limits.maxPanelsPerSession).toBeGreaterThan(20);
      expect(limits.maxSessionsPerHour).toBeGreaterThan(10);
    });
  });

  describe('CRITICAL: Admin Controls', () => {
    it('should allow admins to force stop user sessions', async () => {
      const userId = 'target_user';
      
      // Start some sessions
      await resourceManager.startSession(userId, 'session1', 5);
      await resourceManager.startSession(userId, 'session2', 3);
      
      expect(resourceManager.getUserStats(userId).usage.activeSessions).toBe(2);
      
      const stoppedCount = resourceManager.forceStopUserSessions(userId);
      
      expect(stoppedCount).toBe(2);
      expect(resourceManager.getUserStats(userId).usage.activeSessions).toBe(0);
    });
  });
});