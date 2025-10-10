import { GoogleGenAI } from '@google/genai';
import type { AnimationRenderJob, InsertAnimationRenderJob } from '@shared/schema';
import { storage, type IStorage } from '../storage';
import { logger } from '../logger';
import { getVeoCredentials } from '../utils/secrets';

interface VeoSafetySetting {
  category: string;
  threshold: string;
}

const DEFAULT_SAFETY_SETTINGS: VeoSafetySetting[] = [
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_SEXUAL', threshold: 'BLOCK_ONLY_HIGH' },
];

export interface VeoJobRequest {
  prompt: string;
  safetySettings?: VeoSafetySetting[];
  justification?: string;
  model?: string;
  generationConfig?: Record<string, unknown>;
  tools?: Array<Record<string, unknown>>;
  responseMimeType?: string;
  mediaFormats?: string[];
}

interface VeoGenerateContentParameters {
  model: string;
  contents: Array<{ role?: string; parts: Array<{ text: string }> }>;
  safetySettings?: VeoSafetySetting[];
  generationConfig?: Record<string, unknown>;
  tools?: Array<Record<string, unknown>>;
  responseMimeType?: string;
  mediaFormats?: string[];
}

interface PromptDiff {
  removed?: string;
  added?: string;
  unchangedPrefix?: string;
  unchangedSuffix?: string;
}

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

export class Veo3AnimationRenderJobService {
  private readonly client: GoogleGenAI;
  private readonly storage: IStorage;
  private readonly defaultModel: string;
  private readonly defaultSafetySettings: VeoSafetySetting[];

  constructor(dependencies: { storage?: IStorage } = {}) {
    const credentials = getVeoCredentials();
    this.client = new GoogleGenAI({ apiKey: credentials.apiKey });
    this.storage = dependencies.storage ?? storage;
    this.defaultModel = process.env.VEO_MODEL ?? 'veo-001';
    this.defaultSafetySettings = DEFAULT_SAFETY_SETTINGS;
  }

  private buildJobRecord(userId: string, request: VeoJobRequest, promptDiff: PromptDiff | null): InsertAnimationRenderJob {
    const effectiveSafety = request.safetySettings ?? this.defaultSafetySettings;
    const jobSettings: Record<string, unknown> = { safetySettings: effectiveSafety };
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

    await logger.audit('veo.safety.override', {
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

  async createJob(userId: string, request: VeoJobRequest): Promise<AnimationRenderJob> {
    const previousJob = await this.storage.getMostRecentAnimationRenderJob(userId);
    const promptDiff = computePromptDiff(previousJob?.prompt ?? null, request.prompt);
    const jobRecord = this.buildJobRecord(userId, request, promptDiff);

    const job = await this.storage.createAnimationRenderJob(jobRecord);

    await logger.audit('veo.render.requested', {
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

    try {
      const payload: VeoGenerateContentParameters = {
        model: request.model ?? this.defaultModel,
        contents: [
          {
            role: 'user',
            parts: [{ text: request.prompt }],
          },
        ],
        safetySettings: effectiveSafety,
      };

      if (request.generationConfig) {
        payload.generationConfig = request.generationConfig;
      }
      if (request.tools) {
        payload.tools = request.tools;
      }
      if (request.responseMimeType) {
        payload.responseMimeType = request.responseMimeType;
      }
      if (request.mediaFormats) {
        payload.mediaFormats = request.mediaFormats;
      }

      const response = await (this.client.models.generateContent as any)(payload);

      await this.storage.updateAnimationRenderJobStatus(job.id, 'submitted');
      await logger.audit('veo.render.submitted', {
        userId,
        resourceType: 'animation_render_job',
        resourceId: job.id,
        metadata: {
          model: request.model ?? this.defaultModel,
          candidates: (response as any)?.candidates?.length ?? null,
        },
      });
    } catch (error) {
      await this.storage.updateAnimationRenderJobStatus(job.id, 'failed');
      logger.error('Failed to submit Veo render job', error as Error, { userId, jobId: job.id });
      throw error;
    }

    return job;
  }

  async pollRenderJobStatus(jobId: string, userId: string): Promise<AnimationRenderJob | null> {
    return await this.storage.getAnimationRenderJobById(jobId);
  }
}

export const veo3AnimationRenderJobService = new Veo3AnimationRenderJobService();
