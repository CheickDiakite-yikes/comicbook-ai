import { describe, expect, it, jest } from '@jest/globals';
import { ContinuityContextService, type ContinuityContextStorage } from '../ContinuityContextService';

const panel = {
  id: 'panel-1',
  pageId: 'page-1',
  panelNumber: 2,
  globalPanelNumber: 2,
  prompt: null,
  imageUrl: 'https://cdn.test/panel-1.png',
  speechBubbles: null,
  isGenerated: true,
  generationStatus: 'completed',
  createdAt: new Date('2024-01-01T08:00:00Z'),
  updatedAt: new Date('2024-01-01T09:00:00Z'),
} as const;

const page = {
  id: 'page-1',
  projectId: 'project-1',
  pageNumber: 4,
  layoutTemplate: 'grid',
  backgroundImageUrl: null,
  panels: null,
  scriptSnippet: null,
  createdAt: new Date('2024-01-01T07:00:00Z'),
  updatedAt: new Date('2024-01-01T07:30:00Z'),
} as const;

const project = {
  id: 'project-1',
  userId: 'user-1',
  title: 'Amazing Adventures',
  description: null,
  genre: 'Superhero',
  userSelectedGenres: null,
  artStyle: 'Comic',
  script: null,
  settings: null,
  canonRules: null,
  coverArt: null,
  isPublic: false,
  publicDescription: null,
  createdAt: new Date('2024-01-01T06:00:00Z'),
  updatedAt: new Date('2024-01-01T06:30:00Z'),
} as const;

const structuredScript = {
  id: 'script-1',
  projectId: 'project-1',
  title: 'Script Title',
  logline: null,
  version: 1,
  isActive: true,
  createdAt: new Date('2023-12-31T23:00:00Z'),
  updatedAt: new Date('2023-12-31T23:05:00Z'),
  pages: [
    {
      id: 'script-page-1',
      structuredScriptId: 'script-1',
      pageNumber: 4,
      title: 'Page 4',
      setting: 'Rooftop at night',
      mood: 'tense',
      timeOfDay: 'night',
      location: 'New York Rooftop',
      weatherConditions: 'clear',
      createdAt: new Date('2023-12-31T23:01:00Z'),
      updatedAt: new Date('2023-12-31T23:02:00Z'),
      panels: [
        {
          id: 'script-panel-1',
          scriptPageId: 'script-page-1',
          panelNumber: 2,
          action: 'Spider-Man swings into the panel.',
          sceneDescription: 'Spider-Man leaps between skyscrapers.',
          visualNotes: 'High contrast lighting',
          characters: ['Spider-Man'],
          mood: 'intense',
          locationSpecifics: 'Skyscraper rooftop',
          interiorExterior: 'exterior',
          roomType: null,
          architecturalStyle: 'modern',
          setDressing: ['ventilation ducts'],
          props: ['web shooters'],
          backgroundElements: ['city skyline'],
          atmosphere: 'energetic',
          environmentalSoundscape: ['traffic hum'],
          primaryLightSource: 'moonlight',
          timeOfDay: 'night',
          lightingMood: 'dramatic',
          lightDirection: 'back_lit',
          shadowIntensity: 'medium',
          colorTemperature: 'cool_blue',
          lightingEffects: ['rim_lighting'],
          practicalLights: ['city lights'],
          weatherCondition: 'clear',
          precipitation: 'none',
          windCondition: 'moderate_wind',
          temperature: 'cool',
          humidity: 'normal',
          visibility: 'clear',
          atmosphericEffects: ['mist'],
          seasonalContext: 'summer',
          cameraAngle: 'low_angle',
          shotType: 'wide',
          cameraMovement: 'tracking',
          frameComposition: 'rule_of_thirds',
          depthOfField: 'medium',
          focusPoint: 'Spider-Man',
          perspectiveType: 'two_point',
          visualStyle: 'comic_book',
          colorGrading: 'cool_tones',
          characterPositions: { 'Spider-Man': 'foreground' },
          proxemics: 'personal',
          spatialRelationships: ['Spider-Man_above_city'],
          physicalInteractions: ['web_swinging'],
          characterFocus: 'single_character',
          eyelineDirections: ['Spider-Man_looking_forward'],
          gestureDescriptions: ['dynamic pose'],
          pacing: 'fast',
          timing: 'real_time',
          transitionType: 'cut',
          panelBorders: 'standard',
          visualEffects: ['motion_blur'],
          specialEffects: ['energy_glow'],
          stylizedElements: ['halftone'],
          soundEffects: ['whoosh'],
          detailedSoundEffects: { whoosh: { volume: 'medium' } },
          ambientSounds: ['traffic'],
          musicCues: 'dramatic',
          voiceOverText: null,
          voiceOverCharacter: null,
          dialoguePlacement: 'top_panel',
          silenceEmphasis: false,
          soundPerspective: 'close_intimate',
          generationPrompt: 'Detailed prompt',
          negativePrompt: null,
          promptWeight: null,
          consistencyNotes: 'Keep skyline consistent.',
          referenceImages: ['image-ref'],
          createdAt: new Date('2023-12-31T23:02:00Z'),
          updatedAt: new Date('2023-12-31T23:02:30Z'),
          dialogue: [
            {
              id: 'dialogue-1',
              scriptPanelId: 'script-panel-1',
              character: 'Spider-Man',
              text: 'Time to swing into action!',
              tone: 'confident',
              bubbleType: 'speech',
              emotionalState: 'determined',
              orderIndex: 0,
              createdAt: new Date('2023-12-31T23:02:05Z'),
            },
          ],
        },
      ],
    },
  ],
} as const;

const panelStates = [
  {
    id: 'state-1',
    panelId: 'panel-1',
    characterId: 'char-1',
    clothingStateId: null,
    isPresent: true,
    confidenceScore: 95,
    detectedUpperBody: 'red suit',
    detectedLowerBody: 'blue pants',
    detectedOuterwear: null,
    detectedClothingColors: ['red', 'blue'],
    detectedClothingStyle: 'heroic',
    detectedClothingAccessories: ['web shooters'],
    detectedHairColor: 'brown',
    detectedHairStyle: 'short',
    detectedHairLength: 'short',
    detectedHairTexture: 'straight',
    detectedSkinTone: 'tan',
    detectedEyeColor: 'brown',
    detectedJewelry: ['ring'],
    detectedGlasses: false,
    detectedHat: null,
    detectedOtherAccessories: ['mask'],
    emotion: 'determined',
    facialExpression: 'focused',
    bodyLanguage: 'athletic',
    position: 'foreground',
    pose: 'ready stance',
    detectedPose: 'dynamic action pose',
    facingDirection: 'front',
    visibility: 'full_body',
    screenPosition: 'center',
    detectedScreenPosition: 'center',
    detectedInteraction: 'swinging',
    lightingCondition: 'dramatic',
    visualEffects: ['motion_blur'],
    temporaryChanges: ['mask on'],
    injuriesVisible: ['cut on arm'],
    interactingWith: ['villain'],
    proximityToOthers: 'close',
    generationPrompt: 'A heroic shot of Spider-Man.',
    consistencyNotes: 'Keep suit colors consistent.',
    visualAnalysisPerformed: true,
    visualAnalysisTimestamp: new Date('2024-01-01T10:00:00Z'),
    visualAnalysisRawData: {
      characters: [
        {
          characterName: 'Spider-Man',
          isPresent: true,
          confidence: 95,
          visualDetails: {
            clothing: {
              upperBody: 'red suit',
              lowerBody: 'blue pants',
              outerwear: 'none',
              accessories: ['web shooters'],
              colors: ['red', 'blue'],
              style: 'heroic',
            },
            hair: {
              color: 'brown',
              style: 'short',
              length: 'short',
              texture: 'straight',
            },
            physicalAppearance: {
              skinTone: 'tan',
              eyeColor: 'brown',
              facialExpression: 'focused',
              bodyLanguage: 'athletic',
              pose: 'dynamic',
            },
            accessories: {
              jewelry: ['ring'],
              glasses: false,
              hat: null,
              other: ['mask'],
            },
            location: {
              position: 'foreground',
              interaction: 'swinging',
            },
          },
        },
      ],
      overallScene: {
        setting: 'New York skyline',
        lighting: 'dramatic night lighting',
        mood: 'tense',
        timeOfDay: 'night',
        notablePatterns: ['consistent skyline silhouettes'],
      },
      camera: {
        angle: 'low_angle',
        shotType: 'dynamic_wide',
        movement: 'tracking',
        frameComposition: 'rule_of_thirds',
        focus: 'character_face',
        depthOfField: 'medium',
        perspective: 'two_point',
      },
      analysisTimestamp: '2024-01-01T10:00:00.000Z',
    },
    consistencyViolations: null,
    createdAt: new Date('2024-01-01T09:45:00Z'),
    updatedAt: new Date('2024-01-01T09:55:00Z'),
  } as const,
];

const projectCharacters = [
  {
    id: 'char-1',
    projectId: 'project-1',
    userId: null,
    name: 'Spider-Man',
    role: 'Hero',
    bio: null,
    visualDescriptors: null,
    alwaysTraits: null,
    neverTraits: null,
    referenceImageUrl: null,
    colorScheme: null,
    isLibraryCharacter: false,
    createdAt: new Date('2023-12-30T10:00:00Z'),
  } as const,
];

const videoVersions = [
  {
    id: 'video-1',
    panelId: 'panel-1',
    videoUrl: 'https://cdn.test/video.mp4',
    thumbnailUrl: 'https://cdn.test/thumb.jpg',
    approvedAt: '2024-01-02T12:00:00Z',
    versionLabel: 'v2 approved',
    durationSeconds: 12,
    aspectRatio: '16:9',
  },
];

describe('ContinuityContextService.buildContextBundle', () => {
  it('builds a continuity bundle with script, visual analysis, and video assets', async () => {
    const mockStorage: ContinuityContextStorage = {
      getPanel: jest.fn().mockResolvedValue(panel),
      getPage: jest.fn().mockResolvedValue(page),
      getProject: jest.fn().mockResolvedValue(project),
      getProjectStructuredScript: jest.fn().mockResolvedValue(structuredScript),
      getPanelCharacterStates: jest.fn().mockResolvedValue(panelStates),
      getProjectCharacters: jest.fn().mockResolvedValue(projectCharacters),
      getLatestApprovedVideoVersions: jest.fn().mockResolvedValue(videoVersions),
    };

    const service = new ContinuityContextService(mockStorage);
    const bundle = await service.buildContextBundle('panel-1');

    expect(bundle.panel.id).toBe('panel-1');
    expect(bundle.project.title).toBe('Amazing Adventures');
    expect(bundle.script?.dialogue[0].text).toBe('Time to swing into action!');

    expect(bundle.continuity.characters).toHaveLength(1);
    const [character] = bundle.continuity.characters;
    expect(character.name).toBe('Spider-Man');
    expect(character.appearance.clothing.upper).toBe('red suit');
    expect(character.appearance.clothing.colors).toEqual(['red', 'blue']);
    expect(character.positioning.position).toBe('foreground');
    expect(character.notes.generationPrompt).toBe('A heroic shot of Spider-Man.');

    expect(bundle.continuity.environment.setting).toBe('New York skyline');
    expect(bundle.continuity.environment.mood).toBe('tense');
    expect(bundle.continuity.camera.angle).toBe('low_angle');
    expect(bundle.continuity.camera.perspective).toBe('two_point');

    expect(bundle.assets.videos).toHaveLength(1);
    expect(bundle.assets.videos[0].videoUrl).toBe('https://cdn.test/video.mp4');
    expect(bundle.assets.videos[0].approvedAt).toBe('2024-01-02T12:00:00.000Z');

    expect(bundle.metadata.hasVisualAnalysis).toBe(true);
    expect(bundle.metadata.sources.panelStates).toBe(1);
    expect(bundle.metadata.sources.visualAnalysis).toBe(true);
    expect(bundle.metadata.sources.videos).toBe(1);
    expect(bundle.metadata.generatedAt).toBe('2024-01-01T10:00:00.000Z');
  });

  it('handles missing script and video metadata gracefully', async () => {
    const storageWithoutScript: ContinuityContextStorage = {
      getPanel: jest.fn().mockResolvedValue(panel),
      getPage: jest.fn().mockResolvedValue(page),
      getProject: jest.fn().mockResolvedValue(project),
      getProjectStructuredScript: jest.fn().mockResolvedValue(undefined),
      getPanelCharacterStates: jest.fn().mockResolvedValue([]),
      getProjectCharacters: jest.fn().mockResolvedValue(projectCharacters),
    };

    const service = new ContinuityContextService(storageWithoutScript);
    const bundle = await service.buildContextBundle('panel-1');

    expect(bundle.script).toBeUndefined();
    expect(bundle.continuity.characters).toHaveLength(0);
    expect(bundle.assets.videos).toHaveLength(0);
    expect(bundle.metadata.sources.script).toBe(false);
    expect(bundle.metadata.sources.videos).toBe(0);
    expect(bundle.metadata.hasVisualAnalysis).toBe(false);
  });
});
