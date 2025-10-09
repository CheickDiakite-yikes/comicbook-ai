import { z } from 'zod';

export const PanelContextSchema = z.object({
  id: z.string().min(1, 'panel id is required'),
  number: z.number().int().positive('panel number must be positive'),
  title: z.string().min(1, 'panel title is required'),
  summary: z.string().min(1, 'panel summary is required'),
  script: z.string().optional(),
  location: z.string().optional(),
  timeOfDay: z.string().optional(),
  durationMs: z.number().int().positive().optional(),
});

export const CharacterPromptContextSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'character name is required'),
  role: z.string().optional(),
  visualTraits: z.array(z.string()).default([]),
  emotionalBeat: z.string().optional(),
  actions: z.array(z.string()).default([]),
});

export const SafetyDirectivesSchema = z.object({
  disallowedTerms: z.array(z.string()).default([]),
  replacements: z.record(z.string()).default({}),
});

export const ContextBundleSchema = z.object({
  panel: PanelContextSchema,
  storyBeats: z.array(z.string()).default([]),
  environmentDescriptors: z.array(z.string()).default([]),
  continuityNotes: z.array(z.string()).default([]),
  characters: z.array(CharacterPromptContextSchema).default([]),
  brandVoice: z.array(z.string()).default([]),
  negativePrompts: z.array(z.string()).default([]),
  safety: SafetyDirectivesSchema.default({
    disallowedTerms: [],
    replacements: {},
  }),
});

export const BrandStyleHintsSchema = z.object({
  palettes: z.array(z.string()).optional(),
  lighting: z.string().optional(),
  composition: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  textures: z.array(z.string()).optional(),
});

export const UserPromptEditsSchema = z.object({
  addPositive: z.array(z.string()).optional(),
  removePositive: z.array(z.string()).optional(),
  addNegative: z.array(z.string()).optional(),
  removeNegative: z.array(z.string()).optional(),
});

export const PromptInstructionSectionsSchema = z.object({
  context: z.array(z.string()),
  characters: z.array(z.string()),
  environment: z.array(z.string()),
  brand: z.array(z.string()),
  user: z.array(z.string()),
});

export const PromptBlueprintSchema = z.object({
  version: z.string(),
  metadata: z.object({
    orchestrator: z.literal('PromptOrchestrator'),
    generatedAt: z.string(),
    panelId: z.string(),
    panelNumber: z.number().int().positive(),
    panelTitle: z.string(),
  }),
  instructions: PromptInstructionSectionsSchema,
  prompt: z.object({
    positive: z.array(z.string()),
    negative: z.array(z.string()),
  }),
  assets: z.object({
    image_reference: z.string().optional(),
  }),
  controls: z.object({
    durationMs: z.number().int().nonnegative(),
    allowUnsafeContent: z.boolean(),
  }),
});

export type PanelContext = z.infer<typeof PanelContextSchema>;
export type CharacterPromptContext = z.infer<typeof CharacterPromptContextSchema>;
export type SafetyDirectives = z.infer<typeof SafetyDirectivesSchema>;
export type ContextBundle = z.infer<typeof ContextBundleSchema>;
export type BrandStyleHints = z.infer<typeof BrandStyleHintsSchema>;
export type UserPromptEdits = z.infer<typeof UserPromptEditsSchema>;
export type PromptInstructionSections = z.infer<typeof PromptInstructionSectionsSchema>;
export type PromptBlueprint = z.infer<typeof PromptBlueprintSchema>;
