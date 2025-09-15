import EventEmitter from 'events';
import { GenerateImageRequest, GenerateImageResponse } from '../gemini';
import { IStorage } from '../storage';
import { WorkerPool } from './WorkerPool';
import { SharedStateManager } from './SharedStateManager';
import { DependencyTracker } from './DependencyTracker';
import { ProgressTracker } from './ProgressTracker';

export interface ParallelGenerationRequest {
  id: string;
  tasks: ParallelGenerationTask[];
  projectId: string;
  userId: string;
  options: ParallelGenerationOptions;
}

export interface ParallelGenerationTask {
  id: string;
  type: 'panel' | 'page' | 'background' | 'cover';
  priority: number;
  dependencies: string[]; // IDs of tasks this depends on
  payload: GenerateImageRequest;
  retryCount?: number;
  maxRetries?: number;
}

export interface ParallelGenerationOptions {
  maxConcurrency: number;
  batchSize: number;
  enableDependencyTracking: boolean;
  enableCharacterConsistency: boolean;
  enableProgressTracking: boolean;
  timeoutMs: number;
  retryStrategy: 'exponential' | 'linear' | 'none';
  priorityMode: 'fifo' | 'priority' | 'dependency';
}

export interface ParallelGenerationResult {
  sessionId: string;
  userId: string; // SECURITY: Track session ownership
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  results: Map<string, GenerateImageResponse>;
  errors: Map<string, Error>;
  status: 'pending' | 'running' | 'completed' | 'cancelled' | 'failed';
  startTime: Date;
  endTime?: Date;
  estimatedTimeRemaining?: number;
}

export class ParallelGenerationManager extends EventEmitter {
  private workerPool: WorkerPool;
  private stateManager: SharedStateManager;
  private dependencyTracker: DependencyTracker;
  private progressTracker: ProgressTracker;
  private activeSessions: Map<string, ParallelGenerationResult> = new Map();
  private storage: IStorage;

  constructor(storage: IStorage) {
    super();
    this.storage = storage;
    this.workerPool = new WorkerPool({
      maxWorkers: 10,
      idleTimeout: 30000,
      taskTimeout: 120000
    });
    this.stateManager = new SharedStateManager();
    this.dependencyTracker = new DependencyTracker();
    this.progressTracker = new ProgressTracker();

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.workerPool.on('taskCompleted', (taskId: string, result: any) => {
      this.handleTaskCompletion(taskId, result);
    });

    this.workerPool.on('taskFailed', (taskId: string, error: Error) => {
      this.handleTaskFailure(taskId, error);
    });

    this.progressTracker.on('progressUpdate', (sessionId: string, progress: any) => {
      this.emit('progressUpdate', sessionId, progress);
    });
  }

  /**
   * Start a parallel generation session
   */
  async startParallelGeneration(request: ParallelGenerationRequest): Promise<string> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Initialize session result
    const result: ParallelGenerationResult = {
      sessionId,
      userId: request.userId, // SECURITY: Track session ownership
      totalTasks: request.tasks.length,
      completedTasks: 0,
      failedTasks: 0,
      results: new Map(),
      errors: new Map(),
      status: 'pending',
      startTime: new Date()
    };

    this.activeSessions.set(sessionId, result);

    try {
      // Setup shared state for character consistency
      if (request.options.enableCharacterConsistency) {
        await this.stateManager.initializeProject(request.projectId, this.storage);
      }

      // Build dependency graph
      if (request.options.enableDependencyTracking) {
        this.dependencyTracker.buildDependencyGraph(request.tasks);
      }

      // Initialize progress tracking
      if (request.options.enableProgressTracking) {
        this.progressTracker.initializeSession(sessionId, request.tasks);
      }

      // Start processing tasks
      result.status = 'running';
      this.activeSessions.set(sessionId, result);

      // Schedule initial tasks (those with no dependencies)
      const initialTasks = request.options.enableDependencyTracking 
        ? this.dependencyTracker.getReadyTasks(sessionId)
        : request.tasks;

      await this.scheduleTasks(sessionId, initialTasks, request.options);

      this.emit('sessionStarted', sessionId, result);
      return sessionId;

    } catch (error) {
      result.status = 'failed';
      result.endTime = new Date();
      this.activeSessions.set(sessionId, result);
      throw error;
    }
  }

  /**
   * Cancel a parallel generation session
   */
  async cancelSession(sessionId: string): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.status === 'completed' || session.status === 'cancelled') {
      return false;
    }

    session.status = 'cancelled';
    session.endTime = new Date();

    // Cancel all pending tasks
    await this.workerPool.cancelTasksBySession(sessionId);
    
    // Cleanup resources
    this.stateManager.cleanupProject(sessionId);
    this.dependencyTracker.cleanupSession(sessionId);
    this.progressTracker.cleanupSession(sessionId);

    this.emit('sessionCancelled', sessionId, session);
    return true;
  }

  /**
   * Get the status of a parallel generation session
   */
  getSessionStatus(sessionId: string): ParallelGenerationResult | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * SECURITY: Get the owner of a session for authorization
   */
  getSessionOwner(sessionId: string): string | undefined {
    const session = this.activeSessions.get(sessionId);
    return session?.userId;
  }

  /**
   * Get all active sessions for a user
   */
  getUserSessions(userId: string): ParallelGenerationResult[] {
    return Array.from(this.activeSessions.values()).filter(session => 
      // You'd need to track userId in session, adding it to the interface
      true // Placeholder - implement user filtering
    );
  }

  /**
   * Schedule tasks for execution
   */
  private async scheduleTasks(
    sessionId: string, 
    tasks: ParallelGenerationTask[], 
    options: ParallelGenerationOptions
  ): Promise<void> {
    // Sort tasks by priority if enabled
    if (options.priorityMode === 'priority') {
      tasks.sort((a, b) => b.priority - a.priority);
    }

    // Process in batches to manage concurrency
    const batches = this.createBatches(tasks, options.batchSize);
    
    for (const batch of batches) {
      await this.processBatch(sessionId, batch, options);
    }
  }

  /**
   * Create batches of tasks for processing
   */
  private createBatches<T>(tasks: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < tasks.length; i += batchSize) {
      batches.push(tasks.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Process a batch of tasks
   */
  private async processBatch(
    sessionId: string,
    batch: ParallelGenerationTask[],
    options: ParallelGenerationOptions
  ): Promise<void> {
    const batchPromises = batch.map(task => 
      this.processTask(sessionId, task, options)
    );

    await Promise.allSettled(batchPromises);
  }

  /**
   * Process a single task
   */
  private async processTask(
    sessionId: string,
    task: ParallelGenerationTask,
    options: ParallelGenerationOptions
  ): Promise<void> {
    try {
      // Get shared state for character consistency
      const sharedContext = options.enableCharacterConsistency 
        ? await this.stateManager.getSharedContext(task.payload.projectContext.title)
        : null;

      // Enhance task payload with shared context
      const enhancedPayload = sharedContext 
        ? this.enhancePayloadWithSharedContext(task.payload, sharedContext)
        : task.payload;

      // Submit to worker pool
      await this.workerPool.submitTask({
        id: task.id,
        sessionId,
        type: task.type,
        payload: enhancedPayload,
        priority: task.priority,
        timeout: options.timeoutMs,
        retryStrategy: options.retryStrategy,
        maxRetries: task.maxRetries || 3
      });

    } catch (error) {
      this.handleTaskFailure(task.id, error as Error);
    }
  }

  /**
   * Enhance payload with shared context for consistency
   */
  private enhancePayloadWithSharedContext(
    payload: GenerateImageRequest,
    sharedContext: any
  ): GenerateImageRequest {
    return {
      ...payload,
      projectContext: {
        ...payload.projectContext,
        characters: sharedContext.characters || payload.projectContext.characters,
        settings: sharedContext.settings || payload.projectContext.settings,
        styleConsistencyRules: sharedContext.styleRules || payload.projectContext.styleConsistencyRules
      },
      characterContext: sharedContext.characterStates || payload.characterContext
    };
  }

  /**
   * Handle task completion
   */
  private handleTaskCompletion(taskId: string, result: GenerateImageResponse): void {
    // Find the session for this task
    const sessionId = this.findSessionByTaskId(taskId);
    if (!sessionId) return;

    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    // Update session results
    session.results.set(taskId, result);
    session.completedTasks++;

    // Update shared state with result
    if (result.status === 'completed') {
      this.stateManager.updateCharacterStates(taskId, result);
    }

    // Update progress
    this.progressTracker.updateTaskProgress(sessionId, taskId, 'completed');

    // Check for dependency resolution
    const readyTasks = this.dependencyTracker.resolveTask(sessionId, taskId);
    if (readyTasks.length > 0) {
      // Schedule newly ready tasks
      const session_request = this.getSessionRequest(sessionId);
      if (session_request) {
        this.scheduleTasks(sessionId, readyTasks, session_request.options);
      }
    }

    // Check if session is complete
    if (session.completedTasks + session.failedTasks >= session.totalTasks) {
      this.completeSession(sessionId);
    }

    this.emit('taskCompleted', sessionId, taskId, result);
  }

  /**
   * Handle task failure
   */
  private handleTaskFailure(taskId: string, error: Error): void {
    const sessionId = this.findSessionByTaskId(taskId);
    if (!sessionId) return;

    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    session.errors.set(taskId, error);
    session.failedTasks++;

    // Update progress
    this.progressTracker.updateTaskProgress(sessionId, taskId, 'failed');

    // Check if session should fail or continue
    const failureThreshold = 0.5; // 50% failure rate
    const failureRate = session.failedTasks / session.totalTasks;
    
    if (failureRate > failureThreshold) {
      this.failSession(sessionId, new Error(`Session failed due to high failure rate: ${failureRate * 100}%`));
    } else if (session.completedTasks + session.failedTasks >= session.totalTasks) {
      this.completeSession(sessionId);
    }

    this.emit('taskFailed', sessionId, taskId, error);
  }

  /**
   * Complete a session
   */
  private completeSession(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    session.status = 'completed';
    session.endTime = new Date();

    // Cleanup resources
    this.stateManager.cleanupProject(sessionId);
    this.dependencyTracker.cleanupSession(sessionId);
    this.progressTracker.cleanupSession(sessionId);

    this.emit('sessionCompleted', sessionId, session);
  }

  /**
   * Fail a session
   */
  private failSession(sessionId: string, error: Error): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    session.status = 'failed';
    session.endTime = new Date();

    // Cancel remaining tasks
    this.workerPool.cancelTasksBySession(sessionId);

    // Cleanup resources
    this.stateManager.cleanupProject(sessionId);
    this.dependencyTracker.cleanupSession(sessionId);
    this.progressTracker.cleanupSession(sessionId);

    this.emit('sessionFailed', sessionId, session, error);
  }

  /**
   * Utility methods
   */
  private findSessionByTaskId(taskId: string): string | undefined {
    // Implementation would track task -> session mapping
    // For now, parse from task ID if it includes session info
    return taskId.split('_')[0];
  }

  private getSessionRequest(sessionId: string): ParallelGenerationRequest | undefined {
    // You'd need to store original requests
    // This is a placeholder
    return undefined;
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    // Cancel all active sessions
    for (const sessionId of this.activeSessions.keys()) {
      await this.cancelSession(sessionId);
    }

    // Shutdown worker pool
    await this.workerPool.shutdown();

    // Clear all data
    this.activeSessions.clear();
  }
}