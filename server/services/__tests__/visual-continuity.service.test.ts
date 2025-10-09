import { afterEach, describe, expect, it } from '@jest/globals';
import { CharacterAppearanceAnalysis, VisualContinuityService } from '../VisualContinuityService';

describe('VisualContinuityService.extractCharacterAnalyses', () => {
  it('matches characters regardless of casing and preserves canonical names', () => {
    const service = new VisualContinuityService();
    const characterNames = ['Spider-Man', 'Mary Jane Watson'];

    const analysisData = {
      characters: [
        { characterName: 'spider-man', isPresent: true, confidence: 92 },
        { characterName: 'MARY JANE WATSON', isPresent: true, confidence: 87 },
        { characterName: 'Green Goblin', isPresent: true, confidence: 55 }
      ]
    };

    const results = (service as any).extractCharacterAnalyses(
      analysisData,
      characterNames
    ) as CharacterAppearanceAnalysis[];

    expect(results).toHaveLength(2);

    const spiderMan = results.find(result => result.characterName === 'Spider-Man');
    const maryJane = results.find(result => result.characterName === 'Mary Jane Watson');

    expect(spiderMan).toBeDefined();
    expect(spiderMan?.isPresent).toBe(true);
    expect(spiderMan?.confidence).toBe(92);

    expect(maryJane).toBeDefined();
    expect(maryJane?.isPresent).toBe(true);
    expect(maryJane?.confidence).toBe(87);
  });
});

describe('VisualContinuityService video QA analysis', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('flags temporal drift when poster frames diverge', async () => {
    const service = new VisualContinuityService();

    const heroFrame: CharacterAppearanceAnalysis = {
      characterName: 'Hero',
      isPresent: true,
      confidence: 96,
      visualDetails: {
        clothing: {
          upperBody: 'red jacket',
          lowerBody: 'black pants',
          outerwear: undefined,
          accessories: ['utility belt'],
          colors: ['red', 'black'],
          style: 'action-ready',
        },
        hair: {
          color: 'brown',
          style: 'spiky',
          length: 'short',
          texture: 'straight',
        },
        physicalAppearance: {
          skinTone: 'medium',
          eyeColor: 'green',
          facialExpression: 'focused',
          bodyLanguage: 'ready stance',
          pose: 'heroic',
        },
        accessories: {
          jewelry: [],
          glasses: false,
          hat: undefined,
          other: ['visor'],
        },
        location: {
          position: 'center',
          interaction: 'charging forward',
        },
      },
    };

    const alteredFrame: CharacterAppearanceAnalysis = {
      ...heroFrame,
      visualDetails: {
        ...heroFrame.visualDetails!,
        clothing: {
          ...heroFrame.visualDetails!.clothing,
          upperBody: 'blue coat',
          style: 'formal',
        },
        hair: {
          color: 'blonde',
          style: 'slicked back',
          length: 'medium',
          texture: 'wavy',
        },
      },
    };

    jest
      .spyOn(service as any, 'analyzeFrameCharacters')
      .mockResolvedValueOnce([heroFrame])
      .mockResolvedValueOnce([alteredFrame]);

    const response = await service.analyzeCharacterAppearances({
      panelImageUrls: [],
      panelVideoVersions: [
        {
          versionId: 'video-1',
          panelNumber: 5,
          posterFrameUrl: 'frame-1.png',
          thumbnailUrls: ['frame-2.png'],
        },
      ],
      characterNames: ['Hero'],
    });

    expect(response.videoVersionAnalyses).toBeDefined();
    expect(response.videoVersionAnalyses).toHaveLength(1);

    const analysis = response.videoVersionAnalyses![0];
    expect(analysis.driftDetected).toBe(true);
    expect(analysis.qualityScore).toBeLessThan(80);
    expect(analysis.warnings.some(warning => warning.characterName === 'Hero')).toBe(true);
  });
});
