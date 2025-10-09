import { CreatePanelVideoRequest } from "@shared/schema";
import { PanelContinuityContext } from "./ContinuityContextService";

export interface PromptOrchestrationResult {
  prompt: string;
  metadata: Record<string, unknown>;
}

export class PromptOrchestrator {
  buildPanelAnimationPrompt(
    context: PanelContinuityContext,
    request: CreatePanelVideoRequest,
  ): PromptOrchestrationResult {
    const lines: string[] = [];

    if (context.project) {
      lines.push(`Project: ${context.project.title}`);
      if (context.project.genre) {
        lines.push(`Genre: ${context.project.genre}`);
      }
      if (context.project.description) {
        lines.push(`Story overview: ${context.project.description}`);
      }
    }

    if (context.page) {
      lines.push(`Page number: ${context.page.pageNumber}`);
    }

    lines.push(`Panel prompt: ${context.panel.prompt ?? "N/A"}`);

    if (context.characterStates.length > 0) {
      const characterSummaries = context.characterStates
        .map(character => {
          const descriptors = [
            character.detectedUpperBody,
            character.detectedLowerBody,
            character.detectedHairStyle,
            character.detectedHairColor,
          ]
            .filter(Boolean)
            .join(", ");

          return `${character.characterId}${descriptors ? ` (${descriptors})` : ""}`;
        })
        .join("; ");

      lines.push(`Characters on panel: ${characterSummaries}`);
    }

    if (context.sharedContext?.styleRules) {
      lines.push(`Style rules: ${context.sharedContext.styleRules}`);
    }

    if (request.narrativeFocus) {
      lines.push(`Narrative focus: ${request.narrativeFocus}`);
    }

    if (request.cameraPrompts?.length) {
      lines.push(`Camera directives: ${request.cameraPrompts.join(" | ")}`);
    }

    const prompt = lines.join("\n");

    return {
      prompt,
      metadata: {
        durationSeconds: request.durationSeconds,
        motionPreset: request.motionPreset,
        soundtrackMood: request.soundtrackMood,
        includeSubtitles: request.includeSubtitles ?? false,
        stylePreset: request.stylePreset,
      },
    };
  }
}

export const promptOrchestrator = new PromptOrchestrator();
import {
  BrandStyleHints,
  BrandStyleHintsSchema,
  ContextBundle,
  ContextBundleSchema,
  PromptBlueprint,
  PromptBlueprintSchema,
  SafetyDirectives,
  UserPromptEdits,
  UserPromptEditsSchema,
} from '@shared/promptOrchestrator';
import { ObjectStorageService } from '../objectStorage';

interface PromptOrchestratorOptions {
  objectStorageService?: ObjectStorageService;
  maxDurationMs?: number;
  defaultDurationMs?: number;
  versionTag?: string;
  signedUrlTtlMs?: number;
  sanitizePositive?: (value: string) => string;
  sanitizeNegative?: (value: string) => string;
}

interface BuildPromptOptions {
  context: ContextBundle;
  brandStyleHints?: BrandStyleHints;
  userEdits?: UserPromptEdits;
  additionalNegativePrompts?: string[];
  panelArtPath?: string;
}

const DEFAULT_VERSION_TAG = '2025-01-01';
const DEFAULT_DURATION_MS = 8000;
const DEFAULT_MAX_DURATION_MS = 30000;
const DEFAULT_SIGNED_URL_TTL_MS = 5 * 60 * 1000; // five minutes

export class PromptOrchestrator {
  private readonly objectStorage?: ObjectStorageService;
  private readonly maxDurationMs: number;
  private readonly defaultDurationMs: number;
  private readonly versionTag: string;
  private readonly signedUrlTtlMs: number;
  private readonly positiveSanitizer: (value: string) => string;
  private readonly negativeSanitizer: (value: string) => string;

  constructor(options: PromptOrchestratorOptions = {}) {
    this.objectStorage = options.objectStorageService;
    this.maxDurationMs = options.maxDurationMs ?? DEFAULT_MAX_DURATION_MS;
    this.defaultDurationMs = options.defaultDurationMs ?? DEFAULT_DURATION_MS;
    this.versionTag = options.versionTag ?? DEFAULT_VERSION_TAG;
    this.signedUrlTtlMs = options.signedUrlTtlMs ?? DEFAULT_SIGNED_URL_TTL_MS;
    this.positiveSanitizer = options.sanitizePositive ?? ((value: string) => value);
    this.negativeSanitizer = options.sanitizeNegative ?? ((value: string) => value);
  }

  async buildPromptPayload(options: BuildPromptOptions): Promise<PromptBlueprint> {
    const context = ContextBundleSchema.parse(options.context);
    const safety = context.safety ?? { disallowedTerms: [], replacements: {} };

    let payload = this.createBaseBlueprint(context, safety);

    if (options.brandStyleHints) {
      payload = this.mergeBrandStyleHints(payload, options.brandStyleHints, safety);
    }

    const aggregatedNegativePrompts: string[] = [
      ...context.negativePrompts,
      ...(options.additionalNegativePrompts ?? []),
    ];

    payload = this.applyNegativePrompts(payload, aggregatedNegativePrompts, safety);

    if (options.userEdits) {
      payload = this.mergeUserEdits(payload, options.userEdits, safety);
    }

    if (options.panelArtPath) {
      const reference = await this.resolveImageReference(options.panelArtPath);
      if (reference) {
        payload = {
          ...payload,
          assets: {
            ...payload.assets,
            image_reference: reference,
          },
        };
      }
    }

    return PromptBlueprintSchema.parse(payload);
  }

  private createBaseBlueprint(context: ContextBundle, safety: SafetyDirectives): PromptBlueprint {
    const generatedAt = new Date().toISOString();

    const contextInstructions = this.sanitizeCollection(
      [
        `${context.panel.title}: ${context.panel.summary}`,
        ...context.storyBeats,
        ...context.continuityNotes.map(note => `Continuity: ${note}`),
      ],
      safety,
      this.positiveSanitizer,
    );

    const characterNotes = this.sanitizeCollection(
      context.characters.map(character =>
        [
          character.name,
          character.role ? `(${character.role})` : undefined,
          character.visualTraits.length ? `Traits: ${character.visualTraits.join(', ')}` : undefined,
          character.emotionalBeat ? `Emotion: ${character.emotionalBeat}` : undefined,
          character.actions.length ? `Actions: ${character.actions.join(', ')}` : undefined,
        ]
          .filter(Boolean)
          .join(' ')
      ),
      safety,
      this.positiveSanitizer,
    );

    const environmentNotes = this.sanitizeCollection(
      [
        context.panel.location ? `Location: ${context.panel.location}` : undefined,
        context.panel.timeOfDay ? `Time of day: ${context.panel.timeOfDay}` : undefined,
        ...context.environmentDescriptors,
      ],
      safety,
      this.positiveSanitizer,
    );

    const brandNotes = this.sanitizeCollection(
      context.brandVoice,
      safety,
      this.positiveSanitizer,
    );

    const positiveSeeds = this.dedupe([
      ...contextInstructions,
      ...characterNotes,
      ...environmentNotes,
      ...brandNotes,
    ]);

    const durationMs = this.clampDuration(context.panel.durationMs);

    const blueprint: PromptBlueprint = {
      version: this.versionTag,
      metadata: {
        orchestrator: 'PromptOrchestrator',
        generatedAt,
        panelId: context.panel.id,
        panelNumber: context.panel.number,
        panelTitle: context.panel.title,
      },
      instructions: {
        context: contextInstructions,
        characters: characterNotes,
        environment: environmentNotes,
        brand: brandNotes,
        user: [],
      },
      prompt: {
        positive: positiveSeeds,
        negative: [],
      },
      assets: {},
      controls: {
        durationMs,
        allowUnsafeContent: false,
      },
    };

    return PromptBlueprintSchema.parse(blueprint);
  }

  private mergeBrandStyleHints(
    payload: PromptBlueprint,
    hintsInput: BrandStyleHints,
    safety: SafetyDirectives,
  ): PromptBlueprint {
    const hints = BrandStyleHintsSchema.parse(hintsInput);

    const aggregatedHints = [
      ...(hints.palettes?.length ? [`Palette: ${hints.palettes.join(', ')}`] : []),
      ...(hints.lighting ? [`Lighting: ${hints.lighting}`] : []),
      ...(hints.composition ?? []).map(value => `Composition: ${value}`),
      ...(hints.textures ?? []).map(value => `Texture: ${value}`),
      ...(hints.keywords ?? []),
    ];

    if (aggregatedHints.length === 0) {
      return payload;
    }

    const sanitizedHints = this.sanitizeCollection(
      aggregatedHints,
      safety,
      this.positiveSanitizer,
    );

    const brand = this.dedupe([...payload.instructions.brand, ...sanitizedHints]);
    const positive = this.dedupe([...payload.prompt.positive, ...sanitizedHints]);

    return {
      ...payload,
      instructions: {
        ...payload.instructions,
        brand,
      },
      prompt: {
        ...payload.prompt,
        positive,
      },
    };
  }

  private mergeUserEdits(
    payload: PromptBlueprint,
    editsInput: UserPromptEdits,
    safety: SafetyDirectives,
  ): PromptBlueprint {
    const edits = UserPromptEditsSchema.parse(editsInput);
    let working = { ...payload };

    const userInstructions = new Set(working.instructions.user);

    if (edits.addPositive?.length) {
      const additions = this.sanitizeCollection(
        edits.addPositive,
        safety,
        this.positiveSanitizer,
      );
      const positive = this.dedupe([...working.prompt.positive, ...additions]);
      working = {
        ...working,
        prompt: {
          ...working.prompt,
          positive,
        },
      };
      additions.forEach(value => userInstructions.add(`Emphasize: ${value}`));
    }

    if (edits.removePositive?.length) {
      const removals = this.sanitizeCollection(
        edits.removePositive,
        safety,
        this.positiveSanitizer,
      );
      const positiveSet = new Set(working.prompt.positive);
      removals.forEach(value => positiveSet.delete(value));
      working = {
        ...working,
        prompt: {
          ...working.prompt,
          positive: Array.from(positiveSet),
        },
      };
    }

    if (edits.addNegative?.length) {
      working = this.applyNegativePrompts(working, edits.addNegative, safety);
      const sanitizedNegative = this.sanitizeCollection(
        edits.addNegative,
        safety,
        this.negativeSanitizer,
        { filterDisallowed: false },
      );
      sanitizedNegative.forEach(value => userInstructions.add(`Avoid: ${value}`));
    }

    if (edits.removeNegative?.length) {
      const removals = this.sanitizeCollection(
        edits.removeNegative,
        safety,
        this.negativeSanitizer,
        { filterDisallowed: false },
      );
      const negativeSet = new Set(working.prompt.negative);
      removals.forEach(value => negativeSet.delete(value));
      working = {
        ...working,
        prompt: {
          ...working.prompt,
          negative: Array.from(negativeSet),
        },
      };
    }

    return {
      ...working,
      instructions: {
        ...working.instructions,
        user: Array.from(userInstructions),
      },
    };
  }

  private applyNegativePrompts(
    payload: PromptBlueprint,
    prompts: string[],
    safety: SafetyDirectives,
  ): PromptBlueprint {
    const safetyPrompts = safety.disallowedTerms.map(term => `Avoid ${term}`);
    const sanitized = this.sanitizeCollection(
      [...prompts, ...safetyPrompts],
      safety,
      this.negativeSanitizer,
      { filterDisallowed: false },
    );

    if (sanitized.length === 0) {
      return payload;
    }

    const negative = this.dedupe([...payload.prompt.negative, ...sanitized]);

    return {
      ...payload,
      prompt: {
        ...payload.prompt,
        negative,
      },
    };
  }

  private async resolveImageReference(objectPath: string): Promise<string | undefined> {
    if (!objectPath) {
      return undefined;
    }

    if (!this.objectStorage) {
      return objectPath;
    }

    const normalized = this.objectStorage.normalizeObjectEntityPath(objectPath);
    if (!normalized.startsWith('/')) {
      return normalized;
    }

    const file = await this.objectStorage.getObjectEntityFile(normalized);
    const getSignedUrl = (file as unknown as { getSignedUrl?: Function }).getSignedUrl;

    if (typeof getSignedUrl === 'function') {
      const [signedUrl] = await getSignedUrl.call(file, {
        action: 'read',
        expires: Date.now() + this.signedUrlTtlMs,
      });
      return signedUrl;
    }

    return normalized;
  }

  private sanitizeCollection(
    values: Array<string | undefined>,
    safety: SafetyDirectives,
    sanitizer: (value: string) => string,
    options: { filterDisallowed?: boolean } = {},
  ): string[] {
    const filterDisallowed = options.filterDisallowed ?? true;

    const normalized = values
      .map(value => value?.trim())
      .filter((value): value is string => Boolean(value))
      .map(value => sanitizer(value))
      .map(value => this.applySafety(value, safety, filterDisallowed))
      .map(value => value.trim())
      .filter(value => value.length > 0);

    return this.dedupe(normalized);
  }

  private applySafety(
    value: string,
    safety: SafetyDirectives,
    filterDisallowed: boolean,
  ): string {
    let sanitized = value;

    const replacementEntries = Object.entries(safety.replacements ?? {});
    for (const [term, replacement] of replacementEntries) {
      if (!term) {
        continue;
      }
      const expression = new RegExp(this.escapeRegExp(term), 'gi');
      sanitized = sanitized.replace(expression, replacement);
    }

    if (!filterDisallowed) {
      return sanitized;
    }

    for (const disallowed of safety.disallowedTerms ?? []) {
      if (!disallowed) {
        continue;
      }
      if (sanitized.toLowerCase().includes(disallowed.toLowerCase())) {
        return '';
      }
    }

    return sanitized;
  }

  private clampDuration(durationMs?: number): number {
    const desired = durationMs ?? this.defaultDurationMs;
    const positive = Math.max(desired, 1000);
    return Math.min(positive, this.maxDurationMs);
  }

  private dedupe(values: string[]): string[] {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const value of values) {
      if (!seen.has(value)) {
        seen.add(value);
        ordered.push(value);
      }
    }
    return ordered;
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
