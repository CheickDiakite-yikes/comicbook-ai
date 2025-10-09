import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { PanelVideoQAService, type PanelVideoQAStorage } from '../PanelVideoQAService';
import { VisualContinuityService, VideoVersionAnalysis } from '../VisualContinuityService';

interface PanelVideoVersionRecord {
  id: string;
  panelId: string;
  versionLabel: string | null;
  storageKey: string | null;
  posterFrameUrl: string;
  thumbnailUrls: string[];
  durationMs: number | null;
  frameRate: number | null;
  timelineOrder: number | null;
  metadata: Record<string, unknown> | null;
  requestId: string;
  videoPath: string;
  posterPath: string;
  videoPrimedAt: Date | null;
  posterPrimedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface PanelVideoQaResultRecord {
  id: string;
  videoVersionId: string;
  qualityScore: number;
  driftWarnings: unknown;
  issues: unknown;
  continuityContextSnapshot: unknown;
  createdAt: Date;
  updatedAt: Date;
}

type UpsertPanelVideoVersionParams = {
  id?: string;
  panelId: string;
  versionLabel?: string | null;
  storageKey?: string | null;
  posterFrameUrl: string;
  thumbnailUrls?: string[];
  durationMs?: number | null;
  frameRate?: number | null;
  timelineOrder?: number | null;
  metadata?: Record<string, unknown> | null;
};

type StorePanelVideoQaResultParams = {
  videoVersionId: string;
  qualityScore: number;
  continuityContextSnapshot: unknown;
  driftWarnings?: unknown;
  issues?: unknown;
};

describe('PanelVideoQAService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('persists QA results with continuity snapshots', async () => {
    const upsertPanelVideoVersion = jest.fn(
      async (input: UpsertPanelVideoVersionParams): Promise<PanelVideoVersionRecord> => ({
        id: input.id ?? 'v1',
        panelId: input.panelId,
        versionLabel: input.versionLabel ?? null,
        storageKey: input.storageKey ?? null,
        posterFrameUrl: input.posterFrameUrl,
        thumbnailUrls: input.thumbnailUrls ?? [],
        durationMs: input.durationMs ?? null,
        frameRate: input.frameRate ?? null,
        timelineOrder: input.timelineOrder ?? null,
        metadata: input.metadata ?? null,
        requestId: 'req-1',
        videoPath: '/videos/v1.mp4',
        posterPath: '/videos/v1.jpg',
        videoPrimedAt: null,
        posterPrimedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    );

    const storePanelVideoQaResult = jest.fn(
      async ({
        videoVersionId,
        qualityScore,
        continuityContextSnapshot,
        driftWarnings,
        issues,
      }: StorePanelVideoQaResultParams): Promise<PanelVideoQaResultRecord> => ({
        id: 'qa-1',
        videoVersionId,
        qualityScore,
        driftWarnings: driftWarnings ?? [],
        issues: issues ?? [],
        continuityContextSnapshot,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    );

    const storage: PanelVideoQAStorage = {
      upsertPanelVideoVersion,
      storePanelVideoQaResult,
      getPanelVideoVersionsWithQA: jest.fn(async () => []),
    };

    const visualService = new VisualContinuityService();

    const analysis: VideoVersionAnalysis = {
      versionId: 'v1',
      panelNumber: 3,
      posterFrameUrl: 'poster.png',
      thumbnailsAnalyzed: 2,
      durationMs: 3200,
      frameRate: 12,
      timelineOrder: 1,
      qualityScore: 68,
      driftDetected: true,
      warnings: [
        {
          characterName: 'Hero',
          issue: 'Visual drift detected across animation frames',
          severity: 'warning',
          frameIndices: [1],
        },
      ],
      perCharacterScores: { Hero: 68 },
      frameAnalyses: [
        {
          frameIndex: 0,
          frameUrl: 'poster.png',
          characters: [
            {
              characterName: 'Hero',
              isPresent: true,
              confidence: 95,
            },
          ],
        },
        {
          frameIndex: 1,
          frameUrl: 'thumb.png',
          characters: [
            {
              characterName: 'Hero',
              isPresent: true,
              confidence: 90,
            },
          ],
        },
      ],
      continuityContextSnapshot: {
        frames: [
          {
            frameIndex: 0,
            frameUrl: 'poster.png',
            characters: [{ characterName: 'Hero', isPresent: true, confidence: 95 }],
          },
          {
            frameIndex: 1,
            frameUrl: 'thumb.png',
            characters: [{ characterName: 'Hero', isPresent: true, confidence: 90 }],
          },
        ],
      },
    };

    jest
      .spyOn(visualService, 'analyzeCharacterAppearances')
      .mockResolvedValue({
        success: true,
        totalPanelsAnalyzed: 0,
        panelAnalyses: [],
        characterSummary: [],
        overallInsights: { settingConsistency: 'n/a', notablePatterns: [] },
        videoVersionAnalyses: [analysis],
      });

    const service = new PanelVideoQAService(storage, visualService);

    const results = await service.runQA({
      panelId: 'panel-123',
      projectCharacters: [{ id: 'hero', name: 'Hero' }],
      projectContext: { title: 'Test Project' },
      videoVersions: [
        {
          versionId: 'v1',
          panelNumber: 3,
          posterFrameUrl: 'poster.png',
          thumbnailUrls: ['thumb.png'],
          versionLabel: 'Alpha',
          timelineOrder: 1,
        },
      ],
    });

    expect(visualService.analyzeCharacterAppearances).toHaveBeenCalled();
    expect(upsertPanelVideoVersion).toHaveBeenCalledWith({
      id: 'v1',
      panelId: 'panel-123',
      posterFrameUrl: 'poster.png',
      thumbnailUrls: ['thumb.png'],
      durationMs: null,
      frameRate: null,
      timelineOrder: 1,
      versionLabel: 'Alpha',
      storageKey: null,
      metadata: null,
    });

    expect(storePanelVideoQaResult).toHaveBeenCalledWith({
      videoVersionId: 'v1',
      qualityScore: 68,
      continuityContextSnapshot: analysis.continuityContextSnapshot,
      driftWarnings: analysis.warnings,
      issues: [
        {
          type: 'perCharacterScores',
          data: analysis.perCharacterScores,
        },
      ],
    });

    expect(results).toHaveLength(1);
    expect(results[0].qaResult.qualityScore).toBe(68);
  });
});
