import EventEmitter from 'events';
import { randomUUID } from 'node:crypto';
import {
  CreatePanelVideoRequest,
  PanelVideoJob,
  PanelVideoJobApprovalRequest,
  PanelVideoJobStatus,
} from '@shared/schema';

export class PanelAnimationRateLimitError extends Error {
  constructor(public readonly retryAfterMs: number) {
    super('Panel animation rate limit exceeded');
    this.name = 'PanelAnimationRateLimitError';
  }
}

interface PanelVideoJobRecord extends PanelVideoJob {
  metadata: Record<string, unknown>;
}

export interface CreatePanelVideoJobOptions {
  panelId: string;
  projectId: string;
  userId: string;
  prompt: string;
  metadata: Record<string, unknown>;
  request: CreatePanelVideoRequest;
}

export interface PanelVideoJobEvent {
  type: 'queued' | 'rendering' | 'ready' | 'error' | 'approval';
  job: PanelVideoJob;
}

const JOB_EVENT = 'panelVideoJobEvent' as const;

export class PanelVideoJobService extends EventEmitter {
  private readonly jobs = new Map<string, PanelVideoJobRecord>();
  private readonly panelIndex = new Map<string, string[]>();
  private readonly rateLimitBuckets = new Map<string, number[]>();
  private readonly rateLimitWindowMs = 60_000;
  private readonly rateLimitMax = 3;

  constructor() {
    super();
  }

  createJob(options: CreatePanelVideoJobOptions): PanelVideoJob {
    this.ensureWithinRateLimit(options.userId, options.panelId);
    const now = new Date();
    const id = randomUUID();

    const job: PanelVideoJobRecord = {
      id,
      panelId: options.panelId,
      projectId: options.projectId,
      userId: options.userId,
      status: 'queued',
      request: options.request,
      prompt: options.prompt,
      resultUrl: undefined,
      error: undefined,
      approval: undefined,
      history: [
        {
          status: 'queued',
          timestamp: now,
          message: 'Job queued',
        },
      ],
      createdAt: now,
      updatedAt: now,
      metadata: options.metadata,
    };

    this.jobs.set(id, job);
    const panelJobs = this.panelIndex.get(options.panelId) ?? [];
    panelJobs.unshift(id);
    this.panelIndex.set(options.panelId, panelJobs);

    this.emitJobEvent('queued', job);
    this.enqueueProcessing(job.id).catch((error) => {
      console.error('PanelVideoJobService: failed to process job', {
        jobId: job.id,
        error,
      });
    });

    return this.serialize(job);
  }

  getJob(jobId: string, userId: string): PanelVideoJob | undefined {
    const job = this.jobs.get(jobId);
    if (!job || job.userId !== userId) {
      return undefined;
    }
    return this.serialize(job);
  }

  getJobsForPanel(panelId: string, userId: string): PanelVideoJob[] {
    const jobIds = this.panelIndex.get(panelId) ?? [];
    return jobIds
      .map((id) => this.jobs.get(id))
      .filter((record): record is PanelVideoJobRecord => {
        return record !== undefined && record.userId === userId;
      })
      .map((job) => this.serialize(job));
  }

  updateApproval(request: PanelVideoJobApprovalRequest, userId: string): PanelVideoJob {
    const job = this.jobs.get(request.jobId);
    if (!job) {
      throw new Error('Job not found');
    }
    if (job.userId !== userId) {
      throw new Error('Forbidden');
    }

    job.approval = {
      approved: request.approved,
      approvedBy: userId,
      approvedAt: new Date(),
      notes: request.notes,
    };
    job.updatedAt = new Date();
    job.history.push({
      status: job.status,
      timestamp: job.updatedAt,
      message: request.approved ? 'Job approved' : 'Job rejected',
    });

    this.emitJobEvent('approval', job);

    return this.serialize(job);
  }

  subscribe(listener: (event: PanelVideoJobEvent) => void): () => void {
    this.on(JOB_EVENT, listener);
    return () => this.removeListener(JOB_EVENT, listener);
  }

  private async enqueueProcessing(jobId: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 25));
    await this.transition(jobId, 'rendering', 'Rendering started');

    try {
      await new Promise((resolve) => setTimeout(resolve, 250));
      const job = this.jobs.get(jobId);
      if (!job) {
        return;
      }
      job.resultUrl = `/generated/video/${job.id}.mp4`;
      await this.transition(jobId, 'ready', 'Rendering complete');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown rendering error';
      await this.transition(jobId, 'error', message);
    }
  }

  private async transition(jobId: string, status: PanelVideoJobStatus, message?: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return;
    }

    job.status = status;
    job.updatedAt = new Date();
    job.history.push({
      status,
      timestamp: job.updatedAt,
      message,
    });

    if (status === 'error') {
      job.error = {
        message: message ?? 'Unknown error',
        retryable: false,
      };
    }

    this.emitJobEvent(status === 'error' ? 'error' : status, job);
  }

  private emitJobEvent(type: PanelVideoJobEvent['type'], job: PanelVideoJobRecord): void {
    const payload: PanelVideoJobEvent = {
      type,
      job: this.serialize(job),
    };
    this.emit(JOB_EVENT, payload);
  }

  private ensureWithinRateLimit(userId: string, panelId: string): void {
    const key = `${userId}:${panelId}`;
    const now = Date.now();
    const windowStart = now - this.rateLimitWindowMs;
    const entries = (this.rateLimitBuckets.get(key) ?? []).filter((timestamp) => timestamp >= windowStart);

    if (entries.length >= this.rateLimitMax) {
      const oldest = Math.min(...entries);
      const retryAfterMs = Math.max(this.rateLimitWindowMs - (now - oldest), 0);
      throw new PanelAnimationRateLimitError(retryAfterMs);
    }

    entries.push(now);
    this.rateLimitBuckets.set(key, entries);
  }

  private serialize(job: PanelVideoJobRecord): PanelVideoJob {
    const { metadata, ...rest } = job;
    return { ...rest };
  }
}

export const panelVideoJobService = new PanelVideoJobService();
