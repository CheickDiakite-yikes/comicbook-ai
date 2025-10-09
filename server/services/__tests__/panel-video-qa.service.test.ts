import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { PanelVideoQAService } from '../PanelVideoQAService';
import { VisualContinuityService, VideoVersionAnalysis } from '../VisualContinuityService';
import type { IStorage } from '../../storage';
import type { PanelVideoVersion, PanelVideoQaResult } from '@shared/schema';

describe('PanelVideoQAService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('persists QA results with continuity snapshots', async () => {
    const upsertPanelVideoVersion = jest.fn<Promise<PanelVideoVersion>, any[]>(async (input) => ({
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
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const storePanelVideoQaResult = jest.fn<Promise<PanelVideoQaResult>, any[]>(async ({
      videoVersionId,
      qualityScore,
      continuityContextSnapshot,
      driftWarnings,
      issues,
    }) => ({
      id: 'qa-1',
      videoVersionId,
      qualityScore,
      driftWarnings,
      issues,
      continuityContextSnapshot,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const storage = {
      upsertPanelVideoVersion,
      storePanelVideoQaResult,
      getPanelVideoVersionsWithQA: jest.fn(),
    } as unknown as IStorage;

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
