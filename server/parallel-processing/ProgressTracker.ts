import EventEmitter from 'events';
import { ParallelGenerationTask } from './ParallelGenerationManager';

export interface TaskProgress {
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime?: Date;
  endTime?: Date;
  progress: number; // 0-100
  estimatedTimeRemaining?: number;
  error?: string;
  retryCount: number;
}

export interface SessionProgress {
  sessionId: string;
  totalTasks: number;
  tasksProgress: Map<string, TaskProgress>;
  overallProgress: number; // 0-100
  estimatedTimeRemaining?: number;
  startTime: Date;
  endTime?: Date;
  status: 'pending' | 'running' | 'completed' | 'cancelled' | 'failed';
  throughput: {
    tasksPerMinute: number;
    averageTaskTime: number;
    peakConcurrency: number;
  };
  milestones: {
    quarter: Date | null;
    half: Date | null;
    threeQuarter: Date | null;
  };
}

export class ProgressTracker extends EventEmitter {
  private sessions: Map<string, SessionProgress> = new Map();
  private progressInterval?: NodeJS.Timeout;
  private updateIntervalMs = 1000; // Update every second

  constructor() {
    super();
    this.startProgressUpdater();
  }

  initializeSession(sessionId: string, tasks: ParallelGenerationTask[]): void {
    const now = new Date();
    
    const tasksProgress = new Map<string, TaskProgress>();
    for (const task of tasks) {
      tasksProgress.set(task.id, {
        taskId: task.id,
        status: 'pending',
        progress: 0,
        retryCount: 0
      });
    }

    const session: SessionProgress = {
      sessionId,
      totalTasks: tasks.length,
      tasksProgress,
      overallProgress: 0,
      startTime: now,
      status: 'pending',
      throughput: {
        tasksPerMinute: 0,
        averageTaskTime: 0,
        peakConcurrency: 0
      },
      milestones: {
        quarter: null,
        half: null,
        threeQuarter: null
      }
    };

    this.sessions.set(sessionId, session);
    this.emit('sessionInitialized', sessionId, session);
  }

  updateTaskProgress(
    sessionId: string, 
    taskId: string, 
    status: TaskProgress['status'], 
    progress?: number,
    error?: string
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    const taskProgress = session.tasksProgress.get(taskId);
    if (!taskProgress) {
      return;
    }

    const now = new Date();
    const previousStatus = taskProgress.status;

    // Update task progress
    taskProgress.status = status;
    if (progress !== undefined) {
      taskProgress.progress = Math.max(0, Math.min(100, progress));
    }
    if (error) {
      taskProgress.error = error;
    }

    // Handle status transitions
    switch (status) {
      case 'running':
        if (previousStatus === 'pending') {
          taskProgress.startTime = now;
          this.updateThroughput(session);
        }
        break;
      
      case 'completed':
        if (!taskProgress.endTime) {
          taskProgress.endTime = now;
          taskProgress.progress = 100;
          this.updateThroughput(session);
        }
        break;
      
      case 'failed':
      case 'cancelled':
        if (!taskProgress.endTime) {
          taskProgress.endTime = now;
        }
        break;
    }

    // Update session progress
    this.updateSessionProgress(session);

    this.emit('taskProgressUpdated', sessionId, taskId, taskProgress);
  }

  private updateSessionProgress(session: SessionProgress): void {
    const tasks = Array.from(session.tasksProgress.values());
    
    // Calculate overall progress
    const totalProgress = tasks.reduce((sum, task) => sum + task.progress, 0);
    session.overallProgress = Math.round(totalProgress / session.totalTasks);

    // Update session status
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const failedTasks = tasks.filter(t => t.status === 'failed').length;
    const cancelledTasks = tasks.filter(t => t.status === 'cancelled').length;
    const runningTasks = tasks.filter(t => t.status === 'running').length;

    if (completedTasks === session.totalTasks) {
      session.status = 'completed';
      session.endTime = new Date();
    } else if (failedTasks + cancelledTasks === session.totalTasks) {
      session.status = 'failed';
      session.endTime = new Date();
    } else if (runningTasks > 0) {
      session.status = 'running';
    }

    // Update milestones
    this.updateMilestones(session, completedTasks);

    // Estimate time remaining
    this.updateTimeEstimate(session);

    this.emit('sessionProgressUpdated', session.sessionId, session);
  }

  private updateMilestones(session: SessionProgress, completedTasks: number): void {
    const now = new Date();
    const progressRatio = completedTasks / session.totalTasks;

    if (progressRatio >= 0.25 && !session.milestones.quarter) {
      session.milestones.quarter = now;
      this.emit('milestoneReached', session.sessionId, 'quarter', now);
    }
    
    if (progressRatio >= 0.5 && !session.milestones.half) {
      session.milestones.half = now;
      this.emit('milestoneReached', session.sessionId, 'half', now);
    }
    
    if (progressRatio >= 0.75 && !session.milestones.threeQuarter) {
      session.milestones.threeQuarter = now;
      this.emit('milestoneReached', session.sessionId, 'threeQuarter', now);
    }
  }

  private updateThroughput(session: SessionProgress): void {
    const now = new Date();
    const elapsedMinutes = (now.getTime() - session.startTime.getTime()) / (1000 * 60);
    
    const completedTasks = Array.from(session.tasksProgress.values())
      .filter(t => t.status === 'completed').length;
    
    const runningTasks = Array.from(session.tasksProgress.values())
      .filter(t => t.status === 'running').length;

    // Update throughput metrics
    session.throughput.tasksPerMinute = elapsedMinutes > 0 ? completedTasks / elapsedMinutes : 0;
    session.throughput.peakConcurrency = Math.max(session.throughput.peakConcurrency, runningTasks);

    // Calculate average task time
    const completedTasksWithTime = Array.from(session.tasksProgress.values())
      .filter(t => t.status === 'completed' && t.startTime && t.endTime);
    
    if (completedTasksWithTime.length > 0) {
      const totalTime = completedTasksWithTime.reduce((sum, task) => {
        const taskTime = task.endTime!.getTime() - task.startTime!.getTime();
        return sum + taskTime;
      }, 0);
      session.throughput.averageTaskTime = totalTime / completedTasksWithTime.length;
    }
  }

  private updateTimeEstimate(session: SessionProgress): void {
    const runningTasks = Array.from(session.tasksProgress.values())
      .filter(t => t.status === 'running');
    
    const pendingTasks = Array.from(session.tasksProgress.values())
      .filter(t => t.status === 'pending');

    if (session.throughput.averageTaskTime > 0 && session.throughput.tasksPerMinute > 0) {
      // Estimate based on throughput
      const remainingTasks = runningTasks.length + pendingTasks.length;
      const estimatedMinutes = remainingTasks / session.throughput.tasksPerMinute;
      session.estimatedTimeRemaining = estimatedMinutes * 60 * 1000; // Convert to milliseconds
    }
  }

  private startProgressUpdater(): void {
    this.progressInterval = setInterval(() => {
      for (const session of this.sessions.values()) {
        if (session.status === 'running') {
          this.updateSessionProgress(session);
        }
      }
    }, this.updateIntervalMs);
  }

  getSessionProgress(sessionId: string): SessionProgress | undefined {
    return this.sessions.get(sessionId);
  }

  getTaskProgress(sessionId: string, taskId: string): TaskProgress | undefined {
    const session = this.sessions.get(sessionId);
    return session?.tasksProgress.get(taskId);
  }

  getProgressSummary(sessionId: string): {
    progress: number;
    completedTasks: number;
    totalTasks: number;
    estimatedTimeRemaining?: number;
    status: string;
    throughput: SessionProgress['throughput'];
  } | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    const completedTasks = Array.from(session.tasksProgress.values())
      .filter(t => t.status === 'completed').length;

    return {
      progress: session.overallProgress,
      completedTasks,
      totalTasks: session.totalTasks,
      estimatedTimeRemaining: session.estimatedTimeRemaining,
      status: session.status,
      throughput: session.throughput
    };
  }

  cancelSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.status = 'cancelled';
    session.endTime = new Date();

    // Mark all non-completed tasks as cancelled
    for (const taskProgress of session.tasksProgress.values()) {
      if (taskProgress.status === 'pending' || taskProgress.status === 'running') {
        taskProgress.status = 'cancelled';
        taskProgress.endTime = new Date();
      }
    }

    this.updateSessionProgress(session);
    this.emit('sessionCancelled', sessionId, session);
    
    return true;
  }

  cleanupSession(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      this.emit('sessionCleaned', sessionId);
    }
    return deleted;
  }

  generateProgressReport(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return 'Session not found';
    }

    const tasks = Array.from(session.tasksProgress.values());
    const completed = tasks.filter(t => t.status === 'completed').length;
    const failed = tasks.filter(t => t.status === 'failed').length;
    const running = tasks.filter(t => t.status === 'running').length;
    const pending = tasks.filter(t => t.status === 'pending').length;

    let report = `Progress Report for Session: ${sessionId}\n`;
    report += `=================================================\n`;
    report += `Status: ${session.status}\n`;
    report += `Overall Progress: ${session.overallProgress}%\n`;
    report += `Tasks: ${completed}/${session.totalTasks} completed\n`;
    report += `  - Completed: ${completed}\n`;
    report += `  - Running: ${running}\n`;
    report += `  - Pending: ${pending}\n`;
    report += `  - Failed: ${failed}\n\n`;

    report += `Performance Metrics:\n`;
    report += `  - Tasks per minute: ${session.throughput.tasksPerMinute.toFixed(2)}\n`;
    report += `  - Average task time: ${(session.throughput.averageTaskTime / 1000).toFixed(2)}s\n`;
    report += `  - Peak concurrency: ${session.throughput.peakConcurrency}\n\n`;

    if (session.estimatedTimeRemaining) {
      const minutes = Math.round(session.estimatedTimeRemaining / (1000 * 60));
      report += `Estimated time remaining: ${minutes} minutes\n\n`;
    }

    report += `Milestones:\n`;
    if (session.milestones.quarter) {
      report += `  - 25% completed at: ${session.milestones.quarter.toISOString()}\n`;
    }
    if (session.milestones.half) {
      report += `  - 50% completed at: ${session.milestones.half.toISOString()}\n`;
    }
    if (session.milestones.threeQuarter) {
      report += `  - 75% completed at: ${session.milestones.threeQuarter.toISOString()}\n`;
    }

    return report;
  }

  shutdown(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
    }
    this.sessions.clear();
  }
}