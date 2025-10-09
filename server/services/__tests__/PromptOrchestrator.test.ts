import { describe, expect, it, jest } from '@jest/globals';
import { PromptOrchestrator } from '../PromptOrchestrator';
import { ContextBundleSchema, PromptBlueprintSchema } from '@shared/promptOrchestrator';
import { ObjectStorageService } from '../../objectStorage';

const baseContext = ContextBundleSchema.parse({
  panel: {
    id: 'panel-1',
    number: 1,
    title: 'Dawn Raid',
    summary: 'Hero leaps into the plaza with determination.',
    script: 'Hero: "We strike now!"',
    location: 'Neon-lit plaza',
    timeOfDay: 'Dawn',
    durationMs: 12000,
  },
  storyBeats: [
    'Show dynamic motion trails wrapping around the hero.',
    'Highlight the stunned crowd reaction in the foreground.',
  ],
  environmentDescriptors: [
    'Electric sparks from damaged signage.',
    'Faint fog hugging the ground level.',
  ],
  continuityNotes: ['Maintain the cracked visor from previous panel.'],
  characters: [
    {
      id: 'hero',
      name: 'Captain Example',
      role: 'Protagonist',
      visualTraits: ['Red cape', 'Blue armor plates'],
      emotionalBeat: 'Steely determination',
      actions: ['Descending from the sky', 'Fist clenched forward'],
    },
    {
      id: 'support',
      name: 'Signal',
      role: 'Support strategist',
      visualTraits: ['Chromatic visor', 'Floating drone companion'],
      emotionalBeat: 'Alert and analytical',
      actions: [],
    },
  ],
  brandVoice: ['Keep cinematic framing with high contrast lighting.'],
  negativePrompts: ['low quality'],
  safety: {
    disallowedTerms: ['gore'],
    replacements: {
      blood: 'sparks',
    },
  },
});

describe('PromptOrchestrator', () => {
  it('builds a schema-compliant blueprint with merged context and brand hints', async () => {
    const orchestrator = new PromptOrchestrator();

    const payload = await orchestrator.buildPromptPayload({
      context: baseContext,
      brandStyleHints: {
        palettes: ['ruby red', 'obsidian black'],
        lighting: 'dramatic rim light',
        composition: ['Hero centered with diagonal motion lines'],
        keywords: ['Dynamic comic shading'],
      },
    });

    expect(PromptBlueprintSchema.safeParse(payload).success).toBe(true);
    expect(payload.metadata.panelId).toBe('panel-1');
    expect(payload.instructions.brand).toEqual(
      expect.arrayContaining([
        'Palette: ruby red, obsidian black',
        'Lighting: dramatic rim light',
        'Composition: Hero centered with diagonal motion lines',
        'Dynamic comic shading',
      ]),
    );
    expect(payload.prompt.positive).toEqual(
      expect.arrayContaining([
        'Dawn Raid: Hero leaps into the plaza with determination.',
        'Keep cinematic framing with high contrast lighting.',
      ]),
    );
  });

  it('caps duration to the configured maximum', async () => {
    const orchestrator = new PromptOrchestrator({ maxDurationMs: 5000 });

    const payload = await orchestrator.buildPromptPayload({
      context: {
        ...baseContext,
        panel: {
          ...baseContext.panel,
          durationMs: 120000,
        },
      },
    });

    expect(payload.controls.durationMs).toBe(5000);
  });

  it('applies negative prompt sanitation and respects user edits', async () => {
    const orchestrator = new PromptOrchestrator({
      sanitizeNegative: value => value.replace(/gore/gi, 'graphic violence'),
    });

    const payload = await orchestrator.buildPromptPayload({
      context: {
        ...baseContext,
        negativePrompts: ['low quality', 'gory detail'],
      },
      userEdits: {
        addNegative: ['blurry'],
        removeNegative: ['low quality'],
      },
      additionalNegativePrompts: ['unsafe gore'],
    });

    expect(payload.prompt.negative).toContain('blurry');
    expect(payload.prompt.negative).not.toContain('low quality');
    expect(payload.prompt.negative).toContain('unsafe graphic violence');
    expect(payload.prompt.negative).toContain('Avoid graphic violence');
  });

  it('signs panel art references using the object storage service', async () => {
    const getSignedUrl = jest.fn(
      async (_options: { action: string; expires: number }) =>
        ['https://signed.example/panel.png'] as [string],
    );

    const normalizeObjectEntityPath = jest
      .fn((path: string) => '/objects/panels/panel.png');

    const getObjectEntityFile = jest.fn(async () => ({ getSignedUrl }));

    const objectStorage = {
      normalizeObjectEntityPath,
      getObjectEntityFile,
    } as unknown as ObjectStorageService;

    const orchestrator = new PromptOrchestrator({ objectStorageService: objectStorage });

    const payload = await orchestrator.buildPromptPayload({
      context: baseContext,
      panelArtPath: '/objects/panels/panel.png',
    });

    expect(normalizeObjectEntityPath).toHaveBeenCalledWith('/objects/panels/panel.png');
    expect(getSignedUrl).toHaveBeenCalledWith({
      action: 'read',
      expires: expect.any(Number),
    });
    expect(payload.assets.image_reference).toBe('https://signed.example/panel.png');
  });
});
