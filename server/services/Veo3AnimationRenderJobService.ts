import { GoogleGenAI, type GenerateVideosOperation, type GenerateVideosParameters } from '@google/genai';
import type { AnimationRenderJob, InsertAnimationRenderJob } from '@shared/schema';
import { DEFAULT_VEO_SAFETY_SETTINGS, type VeoJobRequest, type VeoSafetySetting } from '@shared/veo';
import { storage, type IStorage } from '../storage';
import { logger as appLogger } from '../logger';
import { getVeoCredentials } from '../utils/secrets';

interface PromptDiff {
  removed?: string;
  added?: string;
  unchangedPrefix?: string;
  unchangedSuffix?: string;
}

interface OperationTracker {
  jobId: string;
  userId: string;
  operationName: string;
  request: VeoJobRequest;
  safetySettings: VeoSafetySetting[];
  attempts: number;
  baseSettings: Record<string, unknown>;
  timer?: NodeJS.Timeout;
}

const INITIAL_POLL_DELAY_MS = 5_000;
const BASE_POLL_INTERVAL_MS = 7_500;
const MAX_POLL_INTERVAL_MS = 45_000;
const MAX_POLL_ATTEMPTS = 120;

function normaliseSafetySettings(settings: VeoSafetySetting[]): VeoSafetySetting[] {
  return [...settings].sort((a, b) => `${a.category}:${a.threshold}`.localeCompare(`${b.category}:${b.threshold}`));
}

function areSafetySettingsEqual(a: VeoSafetySetting[], b: VeoSafetySetting[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  const normalisedA = normaliseSafetySettings(a);
  const normalisedB = normaliseSafetySettings(b);

  return normalisedA.every((setting, index) => {
    const comparison = normalisedB[index];
    return setting.category === comparison.category && setting.threshold === comparison.threshold;
  });
}

function computePromptDiff(previous: string | undefined | null, next: string): PromptDiff | null {
  if (!previous) {
    return { added: next };
  }

  if (previous === next) {
    return null;
  }

  let start = 0;
  while (start < previous.length && start < next.length && previous[start] === next[start]) {
    start++;
  }

  let endPrev = previous.length - 1;
  let endNext = next.length - 1;

  while (endPrev >= start && endNext >= start && previous[endPrev] === next[endNext]) {
    endPrev--;
    endNext--;
  }

  const removed = previous.slice(start, endPrev + 1);
  const added = next.slice(start, endNext + 1);

  return {
    removed: removed || undefined,
    added: added || undefined,
    unchangedPrefix: start > 0 ? previous.slice(0, start) : undefined,
    unchangedSuffix: endPrev + 1 < previous.length ? previous.slice(endPrev + 1) : undefined,
  };
}

function buildOperationSettingsPatch(patch: Record<string, unknown>): Record<string, unknown> {
  return {
    operation: {
      ...patch,
    },
  };
}

export class Veo3AnimationRenderJobService {
  private readonly client: GoogleGenAI;
  private readonly storage: IStorage;
  private readonly defaultModel: string;
  private readonly defaultSafetySettings: VeoSafetySetting[];
  private readonly operations = new Map<string, OperationTracker>();
  private readonly log = appLogger.child({ scope: 'Veo3AnimationRenderJobService' });

  constructor(dependencies: { storage?: IStorage } = {}) {
    const credentials = getVeoCredentials();
    this.client = new GoogleGenAI({ apiKey: credentials.apiKey });
    this.storage = dependencies.storage ?? storage;
    this.defaultModel = process.env.VEO_MODEL ?? 'veo-3.0-generate-001';
    this.defaultSafetySettings = DEFAULT_VEO_SAFETY_SETTINGS;
  }

  private buildJobRecord(userId: string, request: VeoJobRequest, promptDiff: PromptDiff | null): InsertAnimationRenderJob {
    const jobSettings: Record<string, unknown> = {
      safetySettings: request.safetySettings ?? this.defaultSafetySettings,
    };
    if (request.generationConfig) {
      jobSettings.generationConfig = request.generationConfig;
    }
    if (request.tools) {
      jobSettings.tools = request.tools;
    }
    if (request.responseMimeType) {
      jobSettings.responseMimeType = request.responseMimeType;
    }
    if (request.mediaFormats) {
      jobSettings.mediaFormats = request.mediaFormats;
    }

    return {
      userId,
      prompt: request.prompt,
      promptDiff: promptDiff ?? null,
      model: request.model ?? this.defaultModel,
      settings: jobSettings,
      status: 'pending',
      resultAssetUri: null,
    };
  }

  private buildInitialSettings(
    request: VeoJobRequest,
    safety: VeoSafetySetting[],
    operationName: string | null,
  ): Record<string, unknown> {
    const base: Record<string, unknown> = {
      safetySettings: safety,
      generationConfig: request.generationConfig ?? null,
      tools: request.tools ?? null,
      responseMimeType: request.responseMimeType ?? null,
      mediaFormats: request.mediaFormats ?? null,
      operation: {
        name: operationName,
        status: 'submitted',
        attempts: 0,
        lastPolledAt: null,
        submittedAt: new Date().toISOString(),
      },
    };

    return base;
  }

  private mergeSettings(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
    const next = { ...base };
    for (const [key, value] of Object.entries(patch)) {
      if (key === 'operation') {
        const existingOperation = (next.operation as Record<string, unknown> | undefined) ?? {};
        next.operation = { ...existingOperation, ...(value as Record<string, unknown>) };
      } else {
        next[key] = value;
      }
    }
    return next;
  }

  private async persistSafetyOverride(
    job: AnimationRenderJob,
    userId: string,
    request: VeoJobRequest,
    effectiveSafety: VeoSafetySetting[],
  ) {
    if (!request.safetySettings) {
      return;
    }

    if (areSafetySettingsEqual(request.safetySettings, this.defaultSafetySettings)) {
      return;
    }

    if (!request.justification) {
      throw new Error('Safety setting overrides require an audit justification.');
    }

    await this.storage.logVeoSafetyOverride({
      renderJobId: job.id,
      userId,
      justification: request.justification,
      requestedSettings: request.safetySettings,
      defaultSettings: this.defaultSafetySettings,
    });

    await appLogger.audit('veo.safety.override', {
      userId,
      resourceType: 'animation_render_job',
      resourceId: job.id,
      metadata: {
        justification: request.justification,
        requestedSettings: request.safetySettings,
        effectiveSafety,
      },
    });
  }

  private createVideoPayload(request: VeoJobRequest, safetySettings: VeoSafetySetting[]): GenerateVideosParameters {
    const payload: GenerateVideosParameters = {
      model: request.model ?? this.defaultModel,
      source: { prompt: request.prompt },
      safetySettings,
    } as GenerateVideosParameters;

    if (request.generationConfig) {
      (payload as any).config = request.generationConfig;
    }
    if (request.tools) {
      (payload as any).tools = request.tools;
    }
    if (request.responseMimeType) {
      (payload as any).responseMimeType = request.responseMimeType;
    }
    if (request.mediaFormats) {
      (payload as any).mediaFormats = request.mediaFormats;
    }

    return payload;
  }

  private registerOperation(tracker: OperationTracker) {
    this.operations.set(tracker.jobId, tracker);
    this.schedulePoll(tracker.jobId, INITIAL_POLL_DELAY_MS);
  }

  private schedulePoll(jobId: string, delayMs: number) {
    const tracker = this.operations.get(jobId);
    if (!tracker) {
      return;
    }

    if (tracker.timer) {
      clearTimeout(tracker.timer);
    }

    tracker.timer = setTimeout(() => {
      this.pollOperation(jobId).catch(error => {
        this.log.error('Veo3 poll failed', error as Error, { jobId });
      });
    }, delayMs);

    if (typeof tracker.timer.unref === 'function') {
      tracker.timer.unref();
    }
  }

  private async pollOperation(jobId: string) {
    const tracker = this.operations.get(jobId);
    if (!tracker) {
      return;
    }

    if (tracker.attempts >= MAX_POLL_ATTEMPTS) {
      this.log.warn('Maximum poll attempts reached', { jobId, operationName: tracker.operationName });
      await this.failOperation(tracker, 'Maximum polling attempts exceeded.');
      return;
    }

    tracker.attempts += 1;

    try {
      const operation = (await (this.client.operations.getVideosOperation as any)({
        operation: { name: tracker.operationName } as GenerateVideosOperation,
      })) as GenerateVideosOperation;

      tracker.baseSettings = this.mergeSettings(tracker.baseSettings, buildOperationSettingsPatch({
        lastPolledAt: new Date().toISOString(),
        attempts: tracker.attempts,
      }));

      if (!operation.done) {
        await this.storage.updateAnimationRenderJobStatus(tracker.jobId, 'processing', {
          settings: tracker.baseSettings,
        });

        const nextDelay = Math.min(
          BASE_POLL_INTERVAL_MS * Math.pow(1.25, tracker.attempts),
          MAX_POLL_INTERVAL_MS,
        );
        this.schedulePoll(tracker.jobId, nextDelay);
        return;
      }

      if ((operation as any)?.error) {
        const message = (operation as any).error?.message ?? 'Veo3 operation failed.';
        await this.failOperation(tracker, message);
        return;
      }

      await this.completeOperation(tracker, operation);
    } catch (error) {
      this.log.error('Polling Veo3 operation failed', error as Error, {
        jobId: tracker.jobId,
        operationName: tracker.operationName,
        attempt: tracker.attempts,
      });

      const nextDelay = Math.min(
        BASE_POLL_INTERVAL_MS * Math.pow(1.5, tracker.attempts),
        MAX_POLL_INTERVAL_MS,
      );

      this.schedulePoll(tracker.jobId, nextDelay);
    }
  }

  private async completeOperation(tracker: OperationTracker, operation: GenerateVideosOperation) {
    const generated = operation.response?.generatedVideos ?? [];
    const primary = generated[0] as any;
    const videoUri: string | null = primary?.video?.uri ?? null;
    const posterUri: string | null = primary?.posterUri ?? null;

    tracker.baseSettings = this.mergeSettings(tracker.baseSettings, buildOperationSettingsPatch({
      status: 'completed',
      completedAt: new Date().toISOString(),
      result: {
        videoUri,
        posterUri,
        downloadUri: primary?.video?.downloadUri ?? null,
      },
    }));

    await this.storage.updateAnimationRenderJobStatus(tracker.jobId, 'completed', {
      resultAssetUri: videoUri,
      settings: tracker.baseSettings,
    });

    await appLogger.audit('veo.render.completed', {
      userId: tracker.userId,
      resourceType: 'animation_render_job',
      resourceId: tracker.jobId,
      metadata: {
        operationName: tracker.operationName,
        videoUri,
      },
    });

    if (tracker.timer) {
      clearTimeout(tracker.timer);
    }
    this.operations.delete(tracker.jobId);
  }

  private async failOperation(tracker: OperationTracker, message: string) {
    tracker.baseSettings = this.mergeSettings(tracker.baseSettings, buildOperationSettingsPatch({
      status: 'failed',
      error: message,
      completedAt: new Date().toISOString(),
    }));

    await this.storage.updateAnimationRenderJobStatus(tracker.jobId, 'failed', {
      settings: tracker.baseSettings,
    });

    await appLogger.audit('veo.render.failed', {
      userId: tracker.userId,
      resourceType: 'animation_render_job',
      resourceId: tracker.jobId,
      metadata: {
        operationName: tracker.operationName,
        message,
      },
    });

    if (tracker.timer) {
      clearTimeout(tracker.timer);
    }
    this.operations.delete(tracker.jobId);
  }

  async createJob(userId: string, request: VeoJobRequest): Promise<AnimationRenderJob> {
    const previousJob = await this.storage.getMostRecentAnimationRenderJob(userId);
    const promptDiff = computePromptDiff(previousJob?.prompt ?? null, request.prompt);
    const jobRecord = this.buildJobRecord(userId, request, promptDiff);

    const job = await this.storage.createAnimationRenderJob(jobRecord);

    await appLogger.audit('veo.render.requested', {
      userId,
      resourceType: 'animation_render_job',
      resourceId: job.id,
      metadata: {
        promptDiff,
        model: job.model,
      },
    });

    const effectiveSafety = request.safetySettings ?? this.defaultSafetySettings;
    await this.persistSafetyOverride(job, userId, request, effectiveSafety);

    const payload = this.createVideoPayload(request, effectiveSafety);
    let operation: GenerateVideosOperation | undefined;

    try {
      operation = await this.client.models.generateVideos(payload);
    } catch (error) {
      const baseSettings = (job.settings ?? {}) as Record<string, unknown>;
      await this.storage.updateAnimationRenderJobStatus(job.id, 'failed', {
        settings: this.mergeSettings(baseSettings, buildOperationSettingsPatch({
          status: 'failed',
          error: (error as Error).message,
        })),
      });
      this.log.error('Failed to submit Veo3 video job', error as Error, { jobId: job.id });
      throw error;
    }

    const operationName = operation?.name ?? null;
    const initialSettings = this.buildInitialSettings(request, effectiveSafety, operationName);

    await this.storage.updateAnimationRenderJobStatus(job.id, 'submitted', {
      settings: initialSettings,
    });

    await appLogger.audit('veo.render.submitted', {
      userId,
      resourceType: 'animation_render_job',
      resourceId: job.id,
      metadata: {
        model: request.model ?? this.defaultModel,
        operationName,
      },
    });

    if (operationName) {
      this.registerOperation({
        jobId: job.id,
        userId,
        operationName,
        request,
        safetySettings: effectiveSafety,
        attempts: 0,
        baseSettings: initialSettings,
      });
    }

    return {
      ...job,
      settings: initialSettings,
      status: 'submitted',
    };
  }

  async listJobsForUser(userId: string, options: { limit?: number } = {}): Promise<AnimationRenderJob[]> {
    return this.storage.listAnimationRenderJobsForUser(userId, options);
  }

  async getJobForUser(jobId: string, userId: string): Promise<AnimationRenderJob | null> {
    const job = await this.storage.getAnimationRenderJobById(jobId);
    if (!job || job.userId !== userId) {
      return null;
    }
    return job;
  }

  async pollRenderJobStatus(jobId: string, userId: string): Promise<AnimationRenderJob | null> {
    return this.getJobForUser(jobId, userId);
  }
}

export const veo3AnimationRenderJobService = new Veo3AnimationRenderJobService();
