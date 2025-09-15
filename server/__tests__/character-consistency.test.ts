/**
 * CRITICAL TESTS: Character Consistency Verification
 * 
 * These tests verify that the character consistency system actually works
 * and maintains visual consistency across parallel processing operations.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SharedStateManager } from '../parallel-processing/SharedStateManager';
import { DependencyTracker } from '../parallel-processing/DependencyTracker';

// Mock storage with proper typing
const mockStorage = {
  getProject: jest.fn() as jest.MockedFunction<(projectId: string) => Promise<{ id: string; title?: string; artStyle?: string }>>,
  getProjectCharacters: jest.fn() as jest.MockedFunction<(projectId: string) => Promise<Array<{ id: string; name: string; visualDescriptors: string; alwaysTraits?: string; neverTraits?: string; colorScheme?: string }>>>,
};

describe('Character Consistency Tests', () => {
  let sharedStateManager: SharedStateManager;
  let dependencyTracker: DependencyTracker;

  beforeEach(() => {
    sharedStateManager = new SharedStateManager();
    dependencyTracker = new DependencyTracker();
    jest.clearAllMocks();
  });

  describe('CRITICAL: Character State Management', () => {
    it('should initialize project character states correctly', async () => {
      const projectId = 'test-project';
      
      mockStorage.getProject.mockResolvedValue({
        id: projectId,
        title: 'Test Comic',
        artStyle: 'anime'
      });

      mockStorage.getProjectCharacters.mockResolvedValue([
        {
          id: 'char1',
          name: 'Hero',
          visualDescriptors: 'tall, blonde hair, blue eyes',
          alwaysTraits: 'confident posture, bright smile',
          neverTraits: 'slouching, frowning',
          colorScheme: 'blue and gold'
        },
        {
          id: 'char2', 
          name: 'Villain',
          visualDescriptors: 'dark cloak, red eyes',
          alwaysTraits: 'menacing stance',
          neverTraits: 'friendly expression',
          colorScheme: 'black and red'
        }
      ]);

      await sharedStateManager.initializeProject(projectId, mockStorage as any);

      // Verify character states were initialized
      const heroState = sharedStateManager.getCharacterState(projectId, 'Hero');
      const villainState = sharedStateManager.getCharacterState(projectId, 'Villain');

      expect(heroState).toBeDefined();
      expect(heroState?.name).toBe('Hero');
      expect(heroState?.consistencyRules.alwaysTraits).toContain('confident posture');
      expect(heroState?.consistencyRules.neverTraits).toContain('slouching');

      expect(villainState).toBeDefined();
      expect(villainState?.name).toBe('Villain');
      expect(villainState?.consistencyRules.colorScheme).toBe('black and red');
    });

    it('should provide shared context for AI generation', async () => {
      const projectId = 'test-project';
      
      mockStorage.getProject.mockResolvedValue({
        id: projectId,
        title: 'Test Comic',
        artStyle: 'realistic'
      });

      mockStorage.getProjectCharacters.mockResolvedValue([
        {
          id: 'char1',
          name: 'Protagonist',
          visualDescriptors: 'athletic build, brown hair',
          alwaysTraits: 'determined expression',
          colorScheme: 'earth tones'
        }
      ]);

      await sharedStateManager.initializeProject(projectId, mockStorage as any);
      const context = await sharedStateManager.getSharedContext(projectId);

      expect(context.characters).toHaveLength(1);
      expect(context.characters[0].name).toBe('Protagonist');
      expect(context.characters[0].alwaysTraits).toContain('determined expression');
      expect(context.styleRules).toContain('realistic');
    });

    it('should manage character locking for consistency', async () => {
      const projectId = 'test-project';
      const characterName = 'Hero';

      mockStorage.getProject.mockResolvedValue({ id: projectId });
      mockStorage.getProjectCharacters.mockResolvedValue([]);

      await sharedStateManager.initializeProject(projectId, mockStorage as any);

      // Test character locking
      const lockSuccess = await sharedStateManager.lockCharacter(projectId, characterName);
      expect(lockSuccess).toBe(true);

      // Test duplicate lock prevention
      const duplicateLock = await sharedStateManager.lockCharacter(projectId, characterName);
      expect(duplicateLock).toBe(false);

      // Test unlocking
      const unlockSuccess = sharedStateManager.unlockCharacter(projectId, characterName);
      expect(unlockSuccess).toBe(true);
    });

    it('should handle lock timeouts automatically', (done) => {
      const projectId = 'test-project';
      const characterName = 'Hero';

      sharedStateManager.on('lockTimeout', (proj, char) => {
        expect(proj).toBe(projectId);
        expect(char).toBe(characterName);
        done();
      });

      // Lock with very short timeout
      sharedStateManager.lockCharacter(projectId, characterName, 50);
    }, 1000);
  });

  describe('CRITICAL: Dependency Management', () => {
    it('should build dependency graphs correctly', () => {
      const tasks = [
        {
          id: 'panel1',
          type: 'panel' as const,
          priority: 1,
          dependencies: [],
          payload: {} as any
        },
        {
          id: 'panel2', 
          type: 'panel' as const,
          priority: 2,
          dependencies: ['panel1'],
          payload: {} as any
        },
        {
          id: 'panel3',
          type: 'panel' as const,
          priority: 3,
          dependencies: ['panel1', 'panel2'],
          payload: {} as any
        }
      ];

      const sessionId = dependencyTracker.buildDependencyGraph(tasks);
      
      expect(sessionId).toBeDefined();
      
      const readyTasks = dependencyTracker.getReadyTasks(sessionId);
      expect(readyTasks).toHaveLength(1);
      expect(readyTasks[0].id).toBe('panel1');
    });

    it('should detect circular dependencies', () => {
      const tasksWithCycle = [
        {
          id: 'panel1',
          type: 'panel' as const,
          priority: 1,
          dependencies: ['panel2'],
          payload: {} as any
        },
        {
          id: 'panel2',
          type: 'panel' as const, 
          priority: 1,
          dependencies: ['panel1'],
          payload: {} as any
        }
      ];

      expect(() => {
        dependencyTracker.buildDependencyGraph(tasksWithCycle);
      }).toThrow('Circular dependency detected');
    });

    it('should resolve dependencies as tasks complete', () => {
      const tasks = [
        {
          id: 'panel1',
          type: 'panel' as const,
          priority: 1,
          dependencies: [],
          payload: {} as any
        },
        {
          id: 'panel2',
          type: 'panel' as const,
          priority: 2, 
          dependencies: ['panel1'],
          payload: {} as any
        }
      ];

      const sessionId = dependencyTracker.buildDependencyGraph(tasks);
      
      // Mark first task as running
      dependencyTracker.markTaskRunning(sessionId, 'panel1');
      
      // Complete first task
      const newlyReady = dependencyTracker.resolveTask(sessionId, 'panel1');
      
      expect(newlyReady).toHaveLength(1);
      expect(newlyReady[0].id).toBe('panel2');
    });

    it('should cascade failures to dependent tasks', () => {
      const tasks = [
        {
          id: 'panel1',
          type: 'panel' as const,
          priority: 1,
          dependencies: [],
          payload: {} as any
        },
        {
          id: 'panel2',
          type: 'panel' as const,
          priority: 2,
          dependencies: ['panel1'],
          payload: {} as any
        }
      ];

      const sessionId = dependencyTracker.buildDependencyGraph(tasks);
      
      // Fail the first task
      dependencyTracker.failTask(sessionId, 'panel1');
      
      const status = dependencyTracker.getDependencyStatus(sessionId);
      expect(status.failedTasks).toBe(2); // Both tasks should be failed
    });

    it('should calculate critical path correctly', () => {
      const tasks = [
        { id: 'start', type: 'panel' as const, priority: 1, dependencies: [], payload: {} as any },
        { id: 'middle1', type: 'panel' as const, priority: 2, dependencies: ['start'], payload: {} as any },
        { id: 'middle2', type: 'panel' as const, priority: 2, dependencies: ['start'], payload: {} as any },
        { id: 'end', type: 'panel' as const, priority: 3, dependencies: ['middle1', 'middle2'], payload: {} as any }
      ];

      const sessionId = dependencyTracker.buildDependencyGraph(tasks);
      const criticalPath = dependencyTracker.getCriticalPath(sessionId);
      
      expect(criticalPath).toContain('start');
      expect(criticalPath).toContain('end');
      expect(criticalPath.length).toBeGreaterThan(2);
    });
  });

  describe('CRITICAL: Character Consistency Integration', () => {
    it('should update character states after task completion', async () => {
      const projectId = 'test-project';
      const taskId = `project_${projectId}_panel_123`;
      
      mockStorage.getProject.mockResolvedValue({ id: projectId });
      mockStorage.getProjectCharacters.mockResolvedValue([
        {
          id: 'char1',
          name: 'Hero',
          visualDescriptors: 'initial appearance'
        }
      ]);

      await sharedStateManager.initializeProject(projectId, mockStorage as any);

      const result = {
        status: 'completed' as const,
        imageUrl: 'generated-image-url',
        panelId: 'panel_123'
      };

      // Update character states
      await sharedStateManager.updateCharacterStates(taskId, result);

      const heroState = sharedStateManager.getCharacterState(projectId, 'Hero');
      expect(heroState?.lastSeenPanelId).toBe(taskId);
      expect(heroState?.lastUpdated).toBeDefined();
    });

    it('should provide consistency statistics', () => {
      const stats = sharedStateManager.getStats();
      
      expect(stats).toHaveProperty('totalProjects');
      expect(stats).toHaveProperty('totalCharacters');
      expect(stats).toHaveProperty('activeLocks');
      expect(typeof stats.totalProjects).toBe('number');
    });

    it('should clean up project resources', async () => {
      const projectId = 'cleanup-test';
      
      mockStorage.getProject.mockResolvedValue({ id: projectId });
      mockStorage.getProjectCharacters.mockResolvedValue([]);

      await sharedStateManager.initializeProject(projectId, mockStorage as any);
      await sharedStateManager.lockCharacter(projectId, 'TestChar');
      
      expect(sharedStateManager.getStats().activeLocks).toBe(1);
      
      sharedStateManager.cleanupProject(projectId);
      
      expect(sharedStateManager.getStats().activeLocks).toBe(0);
    });
  });
});