import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  GenerateVideosConfig,
  GenerateVideosOperation,
  GenerateVideosParameters,
} from '@google/genai';
import { AppLogger } from '../../logger';
import { Veo3JobService } from '../Veo3JobService';

type Veo3JobServiceDependencies = Exclude<
  ConstructorParameters<typeof Veo3JobService>[0],
  undefined
>;
type Veo3JobRepository = NonNullable<Veo3JobServiceDependencies['repository']>;
type PanelVideoRequestRecord = Awaited<ReturnType<Veo3JobRepository['createRequest']>>;
type PanelVideoVersionRecord = Awaited<ReturnType<Veo3JobRepository['createVersion']>>;

class FakeRepository implements Veo3JobRepository {
  public requests = new Map<string, PanelVideoRequestRecord>();
  public versions: PanelVideoVersionRecord[] = [];
  private requestCounter = 0;
  private versionCounter = 0;

  async createRequest(values: any): Promise<PanelVideoRequestRecord> {
    const now = new Date();
    const id = values.id ?? `req-${++this.requestCounter}`;
    const record: PanelVideoRequestRecord = {
      id,
      panelId: values.panelId,
      model: values.model,
      modelVariant: values.modelVariant ?? null,
      prompt: values.prompt ?? '',
      operationName: values.operationName ?? null,
      status: values.status ?? 'queued',
      retryCount: values.retryCount ?? 0,
      maxRetries: values.maxRetries ?? 3,
      failureReason: values.failureReason ?? null,
      requestConfig: values.requestConfig ?? null,
      requestPayload: values.requestPayload ?? null,
      nextPollAt: values.nextPollAt ?? null,
      lastPolledAt: values.lastPolledAt ?? null,
      completedAt: values.completedAt ?? null,
      createdAt: values.createdAt ?? now,
      updatedAt: values.updatedAt ?? now,
    };
    this.requests.set(record.id, record);
    return record;
  }

  async updateRequest(id: string, updates: Partial<PanelVideoRequestRecord>) {
    const existing = this.requests.get(id);
    if (!existing) {
      return undefined;
    }
    const updated: PanelVideoRequestRecord = {
      ...existing,
      ...updates,
      updatedAt: updates.updatedAt ?? new Date(),
    };
    this.requests.set(id, updated);
    return updated;
  }

  async findPollableRequests(now: Date, limit: number) {
    const items = Array.from(this.requests.values())
      .filter(
        (request) =>
          (request.status === 'queued' || request.status === 'processing') &&
          (!request.nextPollAt || request.nextPollAt <= now),
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return items.slice(0, limit);
  }

  async createVersion(values: any): Promise<PanelVideoVersionRecord> {
    const id = values.id ?? `ver-${++this.versionCounter}`;
    const record: PanelVideoVersionRecord = {
      id,
      requestId: values.requestId,
      videoPath: values.videoPath,
      posterPath: values.posterPath ?? null,
      durationMs: values.durationMs ?? null,
      metadata: values.metadata ?? null,
      videoPrimedAt: values.videoPrimedAt ?? null,
      posterPrimedAt: values.posterPrimedAt ?? null,
      createdAt: values.createdAt ?? new Date(),
    };
    this.versions.push(record);
    return record;
  }
}

class StubObjectStorageService {
  normalizeObjectEntityPath(rawPath: string): string {
    if (rawPath.startsWith('https://storage.googleapis.com/')) {
      const url = new URL(rawPath);
      return url.pathname;
    }
    return rawPath;
  }
}

type MockGenAiClient = {
  models: { generateVideos: jest.Mock<Promise<GenerateVideosOperation>, [GenerateVideosParameters]> };
  operations: { getVideosOperation: jest.Mock<Promise<GenerateVideosOperation>, [{ operation: { name: string } }]> };
};

describe('Veo3JobService', () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: jest.Mock;
  let repository: FakeRepository;
  let client: MockGenAiClient;
  let service: Veo3JobService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-01T00:00:00Z'));

    fetchMock = jest.fn().mockResolvedValue({ ok: true } as Response);
    (globalThis as any).fetch = fetchMock;

    repository = new FakeRepository();
    client = {
      models: {
        generateVideos: jest.fn(),
      },
      operations: {
        getVideosOperation: jest.fn(),
      },
    };

    service = new Veo3JobService({
      client,
      repository,
      objectStorage: new StubObjectStorageService() as any,
      logger: new AppLogger({ level: 'debug' }),
      options: {
        initialPollDelayMs: 1_000,
        pendingPollIntervalMs: 2_000,
        retryBaseDelayMs: 1_000,
        maxPollIntervalMs: 30_000,
        defaultMaxRetries: 2,
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    if (originalFetch) {
      (globalThis as any).fetch = originalFetch;
    } else {
      delete (globalThis as any).fetch;
    }
  });

  it('creates a job and persists the initial request', async () => {
    client.models.generateVideos.mockResolvedValue({ name: 'operations/123' } as GenerateVideosOperation);

    const record = await service.createJob({
      panelId: 'panel-1',
      prompt: 'A hero leaps into action',
      model: 'veo-3.0',
      version: 'quality',
    });

    expect(client.models.generateVideos).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'veo-3.0',
        source: { prompt: 'A hero leaps into action' },
        config: expect.objectContaining<GenerateVideosConfig>({ resolution: '1080p' }),
      }),
    );

    const stored = repository.requests.get(record.id);
    expect(stored).toBeDefined();
    expect(stored?.operationName).toBe('operations/123');
    expect(stored?.status).toBe('queued');
    expect(stored?.nextPollAt?.getTime()).toBe(new Date('2025-01-01T00:00:01.000Z').getTime());
  });

  it('marks completed jobs and stores video versions', async () => {
    const { id } = await repository.createRequest({
      panelId: 'panel-77',
      model: 'veo-3.0',
      modelVariant: 'quality',
      prompt: 'The city skyline at dusk',
      operationName: 'operations/ready',
      status: 'queued',
      maxRetries: 2,
      requestPayload: { source: { prompt: 'The city skyline at dusk' } },
      nextPollAt: new Date('2024-12-31T23:59:59Z'),
    });

    client.operations.getVideosOperation.mockResolvedValue({
      name: 'operations/ready',
      done: true,
      response: {
        generatedVideos: [
          {
            video: {
              uri: 'https://storage.googleapis.com/demo-bucket/video.mp4',
            },
            posterUri: 'https://storage.googleapis.com/demo-bucket/poster.jpg',
            durationMs: 5400,
          } as any,
        ],
      },
    } as GenerateVideosOperation);

    const processed = await service.pollOutstandingOperations();

    expect(processed).toBe(1);
    const updated = repository.requests.get(id);
    expect(updated?.status).toBe('succeeded');
    expect(repository.versions).toHaveLength(1);
    expect(repository.versions[0].videoPath).toBe('/demo-bucket/video.mp4');
    expect(repository.versions[0].posterPath).toBe('/demo-bucket/poster.jpg');
    expect(fetchMock).toHaveBeenCalled();
  });

  it('retries failed operations within retry limit', async () => {
    const { id } = await repository.createRequest({
      panelId: 'panel-3',
      model: 'veo-3.0',
      modelVariant: 'quality',
      prompt: 'Test prompt',
      operationName: 'operations/fail',
      status: 'queued',
      retryCount: 0,
      maxRetries: 2,
      requestPayload: { source: { prompt: 'Test prompt' } },
      nextPollAt: new Date('2024-12-31T23:59:59Z'),
    });

    client.operations.getVideosOperation.mockResolvedValue({
      name: 'operations/fail',
      done: true,
      error: { message: 'temporary error' },
    } as GenerateVideosOperation);
    client.models.generateVideos.mockResolvedValue({ name: 'operations/retry' } as GenerateVideosOperation);

    await service.pollOutstandingOperations();

    const updated = repository.requests.get(id);
    expect(updated?.status).toBe('queued');
    expect(updated?.retryCount).toBe(1);
    expect(updated?.operationName).toBe('operations/retry');
    expect(updated?.failureReason).toBe('temporary error');
  });

  it('marks jobs as failed when retries are exhausted', async () => {
    const { id } = await repository.createRequest({
      panelId: 'panel-9',
      model: 'veo-3.0',
      prompt: 'Another test',
      operationName: 'operations/exhausted',
      status: 'processing',
      retryCount: 2,
      maxRetries: 2,
      requestPayload: { source: { prompt: 'Another test' } },
      nextPollAt: new Date('2024-12-31T23:59:59Z'),
    });

    client.operations.getVideosOperation.mockResolvedValue({
      name: 'operations/exhausted',
      done: true,
      error: { message: 'final failure' },
    } as GenerateVideosOperation);

    await service.pollOutstandingOperations();

    const updated = repository.requests.get(id);
    expect(updated?.status).toBe('failed');
    expect(updated?.failureReason).toBe('final failure');
    expect(client.models.generateVideos).not.toHaveBeenCalled();
  });
});
