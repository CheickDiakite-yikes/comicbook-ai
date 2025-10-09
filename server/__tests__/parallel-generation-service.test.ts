import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { EventEmitter } from 'events';
import { ParallelGenerationService } from '../parallel-processing/ParallelGenerationService';
import { SharedStateManager } from '../parallel-processing/SharedStateManager';
import type { GenerateImageResponse } from '../gemini';
import type { IStorage } from '../storage';

describe('ParallelGenerationService integration', () => {
  const storageStub = {} as unknown as IStorage;
  let service: ParallelGenerationService;
  let updateSpy: jest.SpiedFunction<SharedStateManager['updateCharacterStates']>;
  let intervalSpy: jest.SpyInstance<NodeJS.Timeout, Parameters<typeof setInterval>>;

  beforeEach(() => {
    jest.restoreAllMocks();
    intervalSpy = jest
      .spyOn(global, 'setInterval')
      .mockReturnValue({ ref: jest.fn(), unref: jest.fn() } as unknown as NodeJS.Timeout);
    updateSpy = jest
      .spyOn(SharedStateManager.prototype, 'updateCharacterStates')
      .mockResolvedValue();
    service = new ParallelGenerationService(storageStub);
  });

  afterEach(async () => {
    await service.shutdown();
    intervalSpy.mockRestore();
  });

  it('updates shared character state using the project id when a task completes', () => {
    const sessionId = 'session-test';
    const projectId = 'project-123';
    const taskId = 'task-abc';
    const result = { status: 'completed' } as GenerateImageResponse;

    const manager = (service as unknown as { manager: EventEmitter }).manager;

    manager.emit('sessionStarted', sessionId, { projectId });
    manager.emit('taskCompleted', sessionId, taskId, result);

    expect(updateSpy).toHaveBeenCalledWith(projectId, taskId, result);
  });

  it('cleans up session to project mappings after the session completes', () => {
    const sessionId = 'session-cleanup';
    const projectId = 'project-cleanup';
    const now = new Date();
    const sessionProjectMap = (service as unknown as { sessionProjectMap: Map<string, string> }).sessionProjectMap;
    const manager = (service as unknown as { manager: EventEmitter }).manager;

    manager.emit('sessionStarted', sessionId, { projectId });
    expect(sessionProjectMap.get(sessionId)).toBe(projectId);

    manager.emit('sessionCompleted', sessionId, {
      projectId,
      userId: 'user-1',
      totalTasks: 1,
      completedTasks: 1,
      failedTasks: 0,
      startTime: now,
      endTime: new Date(now.getTime() + 1000),
    });

    expect(sessionProjectMap.has(sessionId)).toBe(false);
  });
});
