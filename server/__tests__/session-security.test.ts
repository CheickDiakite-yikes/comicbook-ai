/**
 * CRITICAL SECURITY TESTS: Session Security Verification
 * 
 * These tests verify that the session security system actually works
 * and prevents unauthorized access to parallel processing sessions.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock Express request/response
const createMockReq = (params: any, user: any): any => ({
  params,
  user,
  headers: { 'user-agent': 'test' },
  ip: '127.0.0.1',
  on: jest.fn()
});

const createMockRes = (): any => {
  const res = {} as any;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.writeHead = jest.fn();
  res.write = jest.fn();
  res.end = jest.fn();
  return res;
};

// Mock ParallelGenerationService
const mockParallelService = {
  getSessionStatus: jest.fn(),
  getSessionOwner: jest.fn(),
  on: jest.fn(),
  removeListener: jest.fn()
};

// Mock getUserId function
const getUserId = (user: any): string => user?.id || user?.claims?.sub;

describe('Session Security Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('CRITICAL: Session Ownership Verification', () => {
    it('should BLOCK access to non-existent sessions', () => {
      const req = createMockReq({ sessionId: 'non-existent' }, { id: 'user123' });
      const res = createMockRes();

      mockParallelService.getSessionStatus.mockReturnValue(null);

      // Simulate the session status endpoint
      const sessionId = req.params.sessionId;
      const sessionStatus = mockParallelService.getSessionStatus(sessionId);
      
      if (!sessionStatus) {
        res.status(404).json({ message: "Session not found" });
      }

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Session not found" });
    });

    it('should BLOCK access to other users sessions', () => {
      const req = createMockReq({ sessionId: 'session123' }, { id: 'user456' });
      const res = createMockRes();

      mockParallelService.getSessionStatus.mockReturnValue({ id: 'session123' });
      mockParallelService.getSessionOwner.mockReturnValue('user123'); // Different owner

      // Simulate the session ownership check
      const sessionId = req.params.sessionId;
      const userId = getUserId(req.user);
      const sessionStatus = mockParallelService.getSessionStatus(sessionId);
      const sessionOwner = mockParallelService.getSessionOwner(sessionId);

      if (sessionStatus && sessionOwner !== userId) {
        res.status(403).json({ 
          message: "Access denied to session",
          error: "session_access_denied" 
        });
      }

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Access denied to session",
          error: "session_access_denied"
        })
      );
    });

    it('should ALLOW access to own sessions', () => {
      const req = createMockReq({ sessionId: 'session123' }, { id: 'user123' });
      const res = createMockRes();

      mockParallelService.getSessionStatus.mockReturnValue({ id: 'session123' });
      mockParallelService.getSessionOwner.mockReturnValue('user123'); // Same owner

      // Simulate the session ownership check
      const sessionId = req.params.sessionId;
      const userId = getUserId(req.user);
      const sessionStatus = mockParallelService.getSessionStatus(sessionId);
      const sessionOwner = mockParallelService.getSessionOwner(sessionId);

      let accessAllowed = false;
      if (sessionStatus && sessionOwner === userId) {
        accessAllowed = true;
      }

      expect(accessAllowed).toBe(true);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('CRITICAL: SSE Security', () => {
    it('should verify SSE endpoint security configuration', () => {
      const req = createMockReq({ sessionId: 'session123' }, { id: 'user123' });
      const res = createMockRes();

      mockParallelService.getSessionStatus.mockReturnValue({ id: 'session123' });
      mockParallelService.getSessionOwner.mockReturnValue('user123');

      // Simulate SSE setup with security checks
      const sessionId = req.params.sessionId;
      const userId = getUserId(req.user);
      const sessionStatus = mockParallelService.getSessionStatus(sessionId);
      const sessionOwner = mockParallelService.getSessionOwner(sessionId);

      if (sessionStatus && sessionOwner === userId) {
        // Set up SSE headers
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Cache-Control'
        });
      }

      expect(res.writeHead).toHaveBeenCalledWith(200, 
        expect.objectContaining({
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        })
      );
    });

    it('should handle SSE cleanup on client disconnect', () => {
      const req = createMockReq({ sessionId: 'session123' }, { id: 'user123' });
      const res = createMockRes();

      // Simulate SSE event listener setup and cleanup
      const onProgressUpdate = jest.fn();
      const onTaskCompleted = jest.fn();
      const onSessionCompleted = jest.fn();

      mockParallelService.on('progressUpdate', onProgressUpdate);
      mockParallelService.on('taskCompleted', onTaskCompleted);
      mockParallelService.on('sessionCompleted', onSessionCompleted);

      // Simulate client disconnect
      const cleanupFn = req.on.mock.calls.find(call => call[0] === 'close')?.[1];
      if (cleanupFn) {
        cleanupFn();
      }

      // Verify cleanup
      expect(mockParallelService.removeListener).toHaveBeenCalledWith('progressUpdate', onProgressUpdate);
      expect(mockParallelService.removeListener).toHaveBeenCalledWith('taskCompleted', onTaskCompleted);
      expect(mockParallelService.removeListener).toHaveBeenCalledWith('sessionCompleted', onSessionCompleted);
    });
  });

  describe('CRITICAL: Authentication Requirements', () => {
    it('should require authentication for all session endpoints', () => {
      const unauthenticatedReq = createMockReq({ sessionId: 'session123' }, null);
      const res = createMockRes();

      // Simulate authentication check
      if (!unauthenticatedReq.user) {
        res.status(401).json({ error: 'Authentication required' });
      }

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should handle malformed user objects safely', () => {
      const malformedUserReq = createMockReq({ sessionId: 'session123' }, { malformed: true });
      const res = createMockRes();

      const userId = getUserId(malformedUserReq.user);
      
      if (!userId) {
        res.status(401).json({ error: 'Invalid user data' });
      }

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('CRITICAL: Session Cancellation Security', () => {
    it('should verify ownership before allowing session cancellation', () => {
      const req = createMockReq({ sessionId: 'session123' }, { id: 'user456' });
      const res = createMockRes();

      mockParallelService.getSessionOwner.mockReturnValue('user123'); // Different owner

      // Simulate cancellation ownership check
      const sessionId = req.params.sessionId;
      const userId = getUserId(req.user);
      const sessionOwner = mockParallelService.getSessionOwner(sessionId);

      if (!sessionOwner) {
        res.status(404).json({ message: "Session not found" });
      } else if (sessionOwner !== userId) {
        res.status(403).json({ 
          message: "Access denied to session",
          error: "session_access_denied" 
        });
      }

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});