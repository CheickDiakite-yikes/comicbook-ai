import { EventEmitter } from "node:events";
import {
  AnimationJobHistoryEntry,
  AnimationJobRecord,
  AnimationJobUpdate,
} from "@shared/events";

export type AnimationJobListener = (job: AnimationJobRecord) => void;

export class AnimationJobError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message);
    this.name = "AnimationJobError";
  }
}

function deriveProgress(update: AnimationJobUpdate, existing?: AnimationJobRecord) {
  if (update.progress) {
    return update.progress;
  }

  if (update.status === "completed") {
    const hasResultUrl = typeof update.metadata?.["resultUrl"] === "string";
    return {
      percentage: 100,
      stage: "Completed",
      message: hasResultUrl ? "Render ready" : "Render finished",
    };
  }

  if (update.status === "queued") {
    return {
      percentage: 0,
      stage: "Queued",
      message: "Awaiting available renderer",
    };
  }

  return existing?.progress;
}

export class Veo3JobService {
  private readonly jobs = new Map<string, AnimationJobRecord>();
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(0);
  }

  subscribe(listener: AnimationJobListener): () => void {
    this.emitter.on("status", listener);
    return () => {
      this.emitter.off("status", listener);
    };
  }

  getJob(jobId: string): AnimationJobRecord | undefined {
    return this.jobs.get(jobId);
  }

  getJobsForUser(userId: string): AnimationJobRecord[] {
    return Array.from(this.jobs.values())
      .filter((job) => job.userId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  queueJob(update: Omit<AnimationJobUpdate, "status"> & { status?: AnimationJobUpdate["status"] }): AnimationJobRecord {
    return this.pushUpdate({ ...update, status: "queued" });
  }

  updateJobStatus(update: AnimationJobUpdate): AnimationJobRecord {
    return this.pushUpdate(update);
  }

  pushUpdate(update: AnimationJobUpdate): AnimationJobRecord {
    const now = new Date().toISOString();
    const existing = this.jobs.get(update.jobId);

    const progress = deriveProgress(update, existing);

    const historyEntry: AnimationJobHistoryEntry = {
      status: update.status,
      timestamp: now,
      progress,
      error: update.status === "error" ? update.error : undefined,
    };

    if (!existing) {
      const record: AnimationJobRecord = {
        jobId: update.jobId,
        userId: update.userId,
        panelId: update.panelId,
        versionId: update.versionId,
        status: update.status,
        progress,
        error: update.status === "error" ? update.error : undefined,
        attempts: 1,
        metadata: update.metadata ? { ...update.metadata } : undefined,
        createdAt: now,
        updatedAt: now,
        history: [historyEntry],
      };

      this.jobs.set(record.jobId, record);
      this.emit(record);
      return record;
    }

    if (existing.userId !== update.userId) {
      throw new AnimationJobError("Job ownership mismatch", 403);
    }

    const attempts =
      update.status === "queued" && existing.status === "error"
        ? existing.attempts + 1
        : existing.attempts;

    const metadata = update.metadata
      ? { ...(existing.metadata ?? {}), ...update.metadata }
      : existing.metadata;

    const record: AnimationJobRecord = {
      ...existing,
      status: update.status,
      progress,
      error: update.status === "error" ? update.error ?? existing.error : undefined,
      metadata,
      attempts,
      updatedAt: now,
      history: [...existing.history, historyEntry].slice(-50),
    };

    this.jobs.set(record.jobId, record);
    this.emit(record);
    return record;
  }

  retryJob(jobId: string, userId: string, metadata?: Record<string, unknown>): AnimationJobRecord {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new AnimationJobError("Animation job not found", 404);
    }

    if (job.userId !== userId) {
      throw new AnimationJobError("You do not have permission to retry this job", 403);
    }

    return this.pushUpdate({
      jobId,
      userId,
      panelId: job.panelId,
      versionId: job.versionId,
      status: "queued",
      progress: {
        percentage: 0,
        stage: "Re-queued",
        message: "Retry requested",
      },
      metadata: {
        ...(metadata ?? {}),
        lastAction: "retry",
        attempts: job.attempts + 1,
      },
    });
  }

  clearCompletedJobsForUser(userId: string, olderThanMs = 1000 * 60 * 60 * 24): void {
    const cutoff = Date.now() - olderThanMs;
    for (const job of this.jobs.values()) {
      if (job.userId === userId && job.status === "completed" && new Date(job.updatedAt).getTime() < cutoff) {
        this.jobs.delete(job.jobId);
      }
    }
  }

  private emit(job: AnimationJobRecord): void {
    this.emitter.emit("status", job);
  }
}

export const veo3JobService = new Veo3JobService();
