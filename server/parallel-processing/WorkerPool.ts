import EventEmitter from 'events';
import { GenerateImageRequest, GenerateImageResponse, geminiService } from '../gemini';

export interface WorkerPoolOptions {
  maxWorkers: number;
  idleTimeout: number;
  taskTimeout: number;
}

export interface WorkerTask {
  id: string;
  sessionId: string;
  type: 'panel' | 'page' | 'background' | 'cover';
  payload: GenerateImageRequest;
  priority: number;
  timeout: number;
  retryStrategy: 'exponential' | 'linear' | 'none';
  maxRetries: number;
  createdAt: Date;
  startedAt?: Date;
  retriesCount: number;
}

export interface Worker {
  id: string;
  status: 'idle' | 'busy' | 'terminated';
  currentTask?: WorkerTask;
  startTime: Date;
  lastActivity: Date;
  tasksCompleted: number;
  tasksLocked: boolean;
}

export class WorkerPool extends EventEmitter {
  private workers: Map<string, Worker> = new Map();
  private taskQueue: WorkerTask[] = [];
  private options: WorkerPoolOptions;
  private isShuttingDown = false;
  private processingInterval?: NodeJS.Timeout;

  constructor(options: WorkerPoolOptions) {
    super();
    this.options = options;
    this.initializeWorkers();
    this.startTaskProcessor();
  }

  private initializeWorkers(): void {
    for (let i = 0; i < this.options.maxWorkers; i++) {
      const workerId = `worker_${i}_${Date.now()}`;
      const worker: Worker = {
        id: workerId,
        status: 'idle',
        startTime: new Date(),
        lastActivity: new Date(),
        tasksCompleted: 0,
        tasksLocked: false
      };
      this.workers.set(workerId, worker);
    }
  }

  private startTaskProcessor(): void {
    this.processingInterval = setInterval(() => {
      this.processTaskQueue();
      this.cleanupIdleWorkers();
    }, 1000); // Process every second
  }

  async submitTask(task: Omit<WorkerTask, 'createdAt' | 'retriesCount'>): Promise<void> {
    if (this.isShuttingDown) {
      throw new Error('Worker pool is shutting down');
    }

    const fullTask: WorkerTask = {
      ...task,
      createdAt: new Date(),
      retriesCount: 0
    };

    // Insert task in priority order
    this.insertTaskByPriority(fullTask);
    this.emit('taskQueued', task.id, fullTask);
  }

  private insertTaskByPriority(task: WorkerTask): void {
    let insertIndex = this.taskQueue.length;
    
    // Find the correct position based on priority (higher priority first)
    for (let i = 0; i < this.taskQueue.length; i++) {
      if (task.priority > this.taskQueue[i].priority) {
        insertIndex = i;
        break;
      }
    }
    
    this.taskQueue.splice(insertIndex, 0, task);
  }

  private processTaskQueue(): void {
    if (this.taskQueue.length === 0) return;

    const availableWorkers = Array.from(this.workers.values())
      .filter(worker => worker.status === 'idle' && !worker.tasksLocked);

    if (availableWorkers.length === 0) return;

    // Assign tasks to available workers
    for (const worker of availableWorkers) {
      if (this.taskQueue.length === 0) break;

      const task = this.taskQueue.shift()!;
      this.assignTaskToWorker(worker, task);
    }
  }

  private async assignTaskToWorker(worker: Worker, task: WorkerTask): Promise<void> {
    worker.status = 'busy';
    worker.currentTask = task;
    worker.lastActivity = new Date();
    task.startedAt = new Date();

    this.emit('taskStarted', task.id, worker.id);

    try {
      // Set up timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Task timeout')), task.timeout);
      });

      // Process the task
      const resultPromise = this.processTask(task);
      
      // Race between task completion and timeout
      const result = await Promise.race([resultPromise, timeoutPromise]);

      // Task completed successfully
      this.handleTaskSuccess(worker, task, result);

    } catch (error) {
      // Task failed - handle retry logic
      await this.handleTaskFailure(worker, task, error as Error);
    }
  }

  private async processTask(task: WorkerTask): Promise<GenerateImageResponse> {
    switch (task.type) {
      case 'panel':
        return await geminiService.generatePanelImage(task.payload);
      
      case 'background':
        return await geminiService.generateBackground(task.payload);
      
      case 'cover':
        return await geminiService.generateCoverArt(task.payload);
      
      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }

  private handleTaskSuccess(worker: Worker, task: WorkerTask, result: GenerateImageResponse): void {
    worker.status = 'idle';
    worker.currentTask = undefined;
    worker.tasksCompleted++;
    worker.lastActivity = new Date();

    const resolvedCharacters = (task.payload.projectContext?.characters || []).map(character => ({
      name: character.name,
      role: character.role,
      bio: character.bio,
      visualDescriptors: character.visualDescriptors,
      alwaysTraits: character.alwaysTraits,
      neverTraits: character.neverTraits,
      colorScheme: character.colorScheme,
      referenceImageUrl: character.referenceImageUrl,
    }));

    const enrichedResult: GenerateImageResponse = {
      ...result,
      originalPrompt: result.originalPrompt ?? task.payload.prompt,
      resolvedCharacters: result.resolvedCharacters ?? resolvedCharacters,
    };

    this.emit('taskCompleted', task.id, enrichedResult);
  }

  private async handleTaskFailure(worker: Worker, task: WorkerTask, error: Error): Promise<void> {
    worker.status = 'idle';
    worker.currentTask = undefined;
    worker.lastActivity = new Date();

    // Check if we should retry
    if (task.retriesCount < task.maxRetries && task.retryStrategy !== 'none') {
      await this.scheduleRetry(task, error);
    } else {
      // Max retries reached or no retry strategy
      this.emit('taskFailed', task.id, error);
    }
  }

  private async scheduleRetry(task: WorkerTask, error: Error): Promise<void> {
    task.retriesCount++;
    
    let delayMs = 0;
    
    switch (task.retryStrategy) {
      case 'exponential':
        delayMs = Math.pow(2, task.retriesCount) * 1000; // 2^n seconds
        break;
      case 'linear':
        delayMs = task.retriesCount * 5000; // n * 5 seconds
        break;
    }

    this.emit('taskRetry', task.id, task.retriesCount, delayMs);

    setTimeout(() => {
      this.insertTaskByPriority(task);
    }, delayMs);
  }

  async cancelTasksBySession(sessionId: string): Promise<number> {
    let cancelledCount = 0;

    // Remove tasks from queue
    this.taskQueue = this.taskQueue.filter(task => {
      if (task.sessionId === sessionId) {
        this.emit('taskCancelled', task.id);
        cancelledCount++;
        return false;
      }
      return true;
    });

    // Cancel running tasks
    for (const worker of this.workers.values()) {
      if (worker.currentTask?.sessionId === sessionId) {
        worker.tasksLocked = true; // Prevent task completion from processing
        worker.status = 'idle';
        
        if (worker.currentTask) {
          this.emit('taskCancelled', worker.currentTask.id);
          cancelledCount++;
        }
        
        worker.currentTask = undefined;
        worker.tasksLocked = false;
      }
    }

    return cancelledCount;
  }

  private cleanupIdleWorkers(): void {
    const now = new Date().getTime();
    
    for (const [workerId, worker] of [...this.workers.entries()]) {
      if (worker.status === 'idle') {
        const idleTime = now - worker.lastActivity.getTime();
        
        if (idleTime > this.options.idleTimeout) {
          // Worker has been idle too long, but keep minimum workers
          if (this.workers.size > Math.max(1, this.options.maxWorkers / 2)) {
            worker.status = 'terminated';
            this.workers.delete(workerId);
            this.emit('workerTerminated', workerId);
          }
        }
      }
    }
  }

  getStats(): {
    totalWorkers: number;
    idleWorkers: number;
    busyWorkers: number;
    queueLength: number;
    tasksCompleted: number;
  } {
    const workers = [...this.workers.values()];
    
    return {
      totalWorkers: workers.length,
      idleWorkers: workers.filter(w => w.status === 'idle').length,
      busyWorkers: workers.filter(w => w.status === 'busy').length,
      queueLength: this.taskQueue.length,
      tasksCompleted: workers.reduce((sum, w) => sum + w.tasksCompleted, 0)
    };
  }

  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    // Wait for all running tasks to complete or timeout
    const runningTasks = Array.from(this.workers.values())
      .filter(w => w.status === 'busy')
      .map(w => w.currentTask?.id)
      .filter(Boolean);

    if (runningTasks.length > 0) {
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          const stillRunning = Array.from(this.workers.values())
            .some(w => w.status === 'busy');
          
          if (!stillRunning) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 1000);

        // Force shutdown after 30 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve();
        }, 30000);
      });
    }

    // Clear all data
    this.workers.clear();
    this.taskQueue = [];
    
    this.emit('shutdown');
  }
}