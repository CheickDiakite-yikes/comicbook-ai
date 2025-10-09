import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MultiPageConsistencyTracker } from '../MultiPageConsistencyTracker';
import { PanelVisualAnalysisService } from '../services/PanelVisualAnalysisService';
import { VisualContinuityService } from '../services/VisualContinuityService';

describe('MultiPageConsistencyTracker', () => {
  let tracker: MultiPageConsistencyTracker;

  beforeEach(() => {
    tracker = new MultiPageConsistencyTracker();
  });

  it('accumulates character appearance records across multiple panels', () => {
    tracker.updateCharacterAppearance('Hero', 1, 'panel-1', {
      imageUrl: 'https://example.com/panel-1.png',
      prompt: 'Hero introduction',
      consistencyScore: 95,
    });

    tracker.updateCharacterAppearance('Hero', 2, 'panel-2', {
      imageUrl: 'https://example.com/panel-2.png',
      prompt: 'Hero confronts villain',
      consistencyScore: 92,
    });

    tracker.updateCharacterAppearance('Hero', 3, 'panel-3', {
      imageUrl: 'https://example.com/panel-3.png',
      prompt: 'Hero victorious',
      consistencyScore: 93,
    });

    const history = tracker.getCharacterHistory('Hero');
    expect(history).toHaveLength(3);
    expect(history[2].panelId).toBe('panel-3');

    const summary = tracker.getSummary();
    const heroSummary = summary.characters.find(character => character.characterName === 'Hero');
    expect(heroSummary?.totalAppearances).toBe(3);
    expect(heroSummary?.averageScore).toBeGreaterThanOrEqual(90);
    expect(summary.overallHealth === 'excellent' || summary.overallHealth === 'good').toBe(true);

    tracker.updateCharacterAppearance('Hero', 4, 'panel-4', {
      imageUrl: 'https://example.com/panel-4.png',
      prompt: 'Hero exhausted',
      consistencyScore: 60,
    });

    const trend = tracker.getAllTrends().get('Hero');
    expect(trend?.flaggedPages).toContain(4);
  });
});

describe('PanelVisualAnalysisService integration with MultiPageConsistencyTracker', () => {
  const panelId = 'panel-hero-1';
  const imageUrl = 'https://example.com/panel.png';
  const characterId = 'character-hero';
  const pageId = 'page-1';
  let analyzeSpy: jest.SpiedFunction<VisualContinuityService['analyzeCharacterAppearances']>;

  const analysisTimestamp = new Date();

  const analysisResponse = {
    success: true,
    totalPanelsAnalyzed: 1,
    panelAnalyses: [
      {
        panelNumber: 2,
        imageUrl,
        analysisSuccess: true,
        characters: [
          {
            characterName: 'Hero',
            isPresent: true,
            confidence: 90,
            visualDetails: {
              clothing: {
                upperBody: 'armor',
                lowerBody: 'boots',
                outerwear: 'cape',
                accessories: [],
                colors: ['blue'],
                style: 'heroic',
              },
              hair: {
                color: 'blonde',
                style: 'short',
                length: 'short',
                texture: 'straight',
              },
              physicalAppearance: {
                skinTone: 'fair',
                eyeColor: 'blue',
                facialExpression: 'determined',
                bodyLanguage: 'ready',
                pose: 'leaping',
              },
              accessories: {
                jewelry: [],
                glasses: false,
                hat: undefined,
                other: [],
              },
              location: {
                position: 'center',
                interaction: 'jumping',
              },
            },
          },
        ],
        overallScene: {
          setting: 'rooftop',
          lighting: 'bright',
          mood: 'heroic',
        },
        analysisTimestamp,
      },
    ],
    characterSummary: [
      {
        characterName: 'Hero',
        appearedInPanels: [2],
        consistencyScore: 88,
        commonAppearance: {
          mostCommonClothing: 'armor',
          mostCommonHairStyle: 'short',
          consistentFeatures: ['cape'],
        },
        variations: [],
      },
    ],
    overallInsights: {
      settingConsistency: 'stable',
      notablePatterns: [],
    },
  };

  beforeEach(() => {
    analyzeSpy = jest
      .spyOn(VisualContinuityService.prototype, 'analyzeCharacterAppearances')
      .mockResolvedValue(analysisResponse as any);
  });

  afterEach(() => {
    analyzeSpy.mockRestore();
  });

  it('records tracker entries with real page metadata and consistency score', async () => {
    const tracker = new MultiPageConsistencyTracker();

    const storedStates = [
      {
        id: 'state-1',
        panelId,
        characterId,
        isPresent: true,
        confidenceScore: 90,
        visualAnalysisPerformed: true,
      },
    ];

    const mockStorage = {
      getPanelCharacterStates: jest.fn().mockResolvedValue(storedStates),
      storeVisualAnalysisResults: jest.fn().mockResolvedValue(storedStates),
      markVisualAnalysisComplete: jest.fn(),
      getPanel: jest.fn().mockResolvedValue({
        id: panelId,
        pageId,
        panelNumber: 2,
        prompt: 'Hero leaps across the skyline',
        imageUrl,
      }),
      getPage: jest.fn().mockResolvedValue({
        id: pageId,
        projectId: 'project-1',
        pageNumber: 5,
        layoutTemplate: 'grid',
      }),
    } as any;

    const service = new PanelVisualAnalysisService(mockStorage, tracker);

    await service.captureVisualAnalysis(
      panelId,
      imageUrl,
      [{ id: characterId, name: 'Hero' }],
      { skipIfExists: false, retryOnFailure: false }
    );

    const history = tracker.getCharacterHistory('Hero');
    expect(history).toHaveLength(1);
    expect(history[0].pageNumber).toBe(5);
    expect(history[0].panelId).toBe(panelId);
    expect(history[0].consistencyScore).toBe(88);
    expect(history[0].prompt).toBe('Hero leaps across the skyline');
  });
});
