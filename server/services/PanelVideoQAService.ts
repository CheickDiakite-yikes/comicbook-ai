import { VisualContinuityService, PanelVideoVersionInput, VideoVersionAnalysis } from './VisualContinuityService';
import { IStorage } from '../storage';
import type { PanelVideoVersion, PanelVideoQaResult } from '@shared/schema';

export interface PanelVideoQAParams {
  panelId: string;
  videoVersions: Array<PanelVideoVersionInput & {
    versionLabel?: string;
    storageKey?: string;
  }>;
  projectCharacters: Array<{ id: string; name: string }>;
  projectContext?: { title: string; genre?: string; artStyle?: string };
}

export interface PersistedVideoQAResult {
  version: PanelVideoVersion;
  qaResult: PanelVideoQaResult;
  analysis: VideoVersionAnalysis;
}

export class PanelVideoQAService {
  constructor(
    private readonly storage: IStorage,
    private readonly visualContinuityService: VisualContinuityService = new VisualContinuityService()
  ) {}

  async runQA(params: PanelVideoQAParams): Promise<PersistedVideoQAResult[]> {
    if (!params.videoVersions || params.videoVersions.length === 0) {
      return [];
    }

    const characterNames = params.projectCharacters.map(character => character.name);

    const analysisResponse = await this.visualContinuityService.analyzeCharacterAppearances({
      panelImageUrls: [],
      panelVideoVersions: params.videoVersions.map(version => ({
        versionId: version.versionId,
        panelNumber: version.panelNumber,
        posterFrameUrl: version.posterFrameUrl,
        thumbnailUrls: version.thumbnailUrls,
        versionLabel: version.versionLabel,
        storageKey: version.storageKey,
        durationMs: version.durationMs,
        frameRate: version.frameRate,
        timelineOrder: version.timelineOrder,
        metadata: version.metadata,
      })),
      characterNames,
      projectContext: params.projectContext,
      analysisOptions: {
        focusOnConsistency: true,
        detailLevel: 'detailed'
      }
    });

    if (!analysisResponse.success) {
      console.warn(
        `PanelVideoQAService: visual continuity analysis failed for panel ${params.panelId}: ${analysisResponse.error}`
      );
      return [];
    }

    const videoAnalyses = analysisResponse.videoVersionAnalyses ?? [];
    const persistedResults: PersistedVideoQAResult[] = [];

    for (const analysis of videoAnalyses) {
      const source = params.videoVersions.find(version => version.versionId === analysis.versionId);
      if (!source) {
        continue;
      }

      const versionRecord = await this.storage.upsertPanelVideoVersion({
        id: source.versionId,
        panelId: params.panelId,
        versionLabel: source.versionLabel ?? null,
        storageKey: source.storageKey ?? null,
        posterFrameUrl: source.posterFrameUrl,
        thumbnailUrls: source.thumbnailUrls,
        durationMs: source.durationMs ?? null,
        frameRate: source.frameRate ?? null,
        timelineOrder: source.timelineOrder ?? null,
        metadata: source.metadata ?? null,
      });

      const qaRecord = await this.storage.storePanelVideoQaResult({
        videoVersionId: versionRecord.id,
        qualityScore: analysis.qualityScore,
        continuityContextSnapshot: analysis.continuityContextSnapshot,
        driftWarnings: analysis.warnings,
        issues: [
          {
            type: 'perCharacterScores',
            data: analysis.perCharacterScores
          }
        ]
      });

      persistedResults.push({
        version: versionRecord,
        qaResult: qaRecord,
        analysis
      });
    }

    return persistedResults;
  }

  async getTimeline(panelId: string) {
    return await this.storage.getPanelVideoVersionsWithQA(panelId);
  }
}
