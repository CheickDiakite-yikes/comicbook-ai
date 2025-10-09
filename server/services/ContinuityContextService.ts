import { Panel, Page, Project, PanelCharacterState } from "@shared/schema";
import { SharedStateManager } from "../parallel-processing/SharedStateManager";
import { IStorage } from "../storage";

export interface PanelContinuityContext {
  panel: Panel;
  page?: Page;
  project?: Project;
  characterStates: PanelCharacterState[];
  sharedContext?: any;
}

export class ContinuityContextService {
  constructor(
    private readonly storage: IStorage,
    private readonly sharedStateManager?: SharedStateManager,
  ) {}

  async buildPanelContext(panelId: string): Promise<PanelContinuityContext> {
    const panel = await this.storage.getPanel(panelId);
    if (!panel) {
      throw new Error(`Panel not found: ${panelId}`);
    }

    const page = await this.storage.getPage(panel.pageId);
    const project = page ? await this.storage.getProject(page.projectId) : undefined;
    const characterStates = await this.storage.getPanelCharacterStates(panelId);

    let sharedContext;
    if (this.sharedStateManager && project) {
      sharedContext = await this.sharedStateManager.getProjectState(project.id);
    }

    return {
      panel,
      page,
      project,
      characterStates,
      sharedContext,
    };
  }
}

interface CharacterSnapshot {
  id: string;
  name: string;
  isPresent: boolean;
  confidence?: number;
  appearance: {
    clothing: {
      upper?: string;
      lower?: string;
      outerwear?: string;
      style?: string;
      colors: string[];
      accessories: string[];
    };
    hair: {
      color?: string;
      style?: string;
      length?: string;
      texture?: string;
    };
    physical: {
      skinTone?: string;
      eyeColor?: string;
      pose?: string;
      bodyLanguage?: string;
    };
    accessories: {
      jewelry: string[];
      glasses?: boolean;
      hat?: string;
      other: string[];
    };
  };
  emotion?: string;
  facialExpression?: string;
  bodyLanguage?: string;
  positioning: {
    position?: string;
    pose?: string;
    screenPosition?: string;
    facingDirection?: string;
    visibility?: string;
    interaction?: string;
    proximity?: string;
  };
  notes: {
    temporaryChanges: string[];
    injuriesVisible: string[];
    generationPrompt?: string | null;
    consistencyNotes?: string | null;
    analysisWarnings: Array<{
      type: string;
      severity: string;
      description: string;
    }>;
  };
  source: "visual-analysis" | "panel-state";
}

export interface EnvironmentSnapshot {
  setting?: string;
  mood?: string;
  lighting?: string;
  timeOfDay?: string;
  weather?: string;
  props: string[];
  backgroundElements: string[];
  notablePatterns: string[];
}

export interface CameraSnapshot {
  angle?: string;
  shotType?: string;
  movement?: string;
  composition?: string;
  focus?: string;
  depthOfField?: string;
  perspective?: string;
  highlightPose?: string;
}

export interface ScriptContext {
  pageNumber: number;
  panelNumber: number;
  action?: string;
  sceneDescription?: string;
  mood?: string;
  timeOfDay?: string;
  location?: string;
  characters: string[];
  dialogue: Array<{
    character: string;
    text: string;
    tone?: string;
    bubbleType?: string;
    emotionalState?: string;
  }>;
  environment: {
    props: string[];
    setDressing: string[];
    background: string[];
    weather?: string;
    atmosphere?: string;
  };
  camera: {
    angle?: string;
    shotType?: string;
    movement?: string;
    composition?: string;
    focus?: string;
    depthOfField?: string;
  };
  notes?: string;
}

export interface ContinuityContextBundle {
  panel: {
    id: string;
    number: number;
    pageNumber: number;
    imageUrl?: string | null;
  };
  project: {
    id: string;
    title: string;
    genre?: string | null;
    artStyle?: string | null;
  };
  script?: ScriptContext;
  continuity: {
    characters: CharacterSnapshot[];
    environment: EnvironmentSnapshot;
    camera: CameraSnapshot;
  };
  assets: {
    videos: ContinuityVideoVersion[];
  };
  metadata: {
    generatedAt?: string;
    hasVisualAnalysis: boolean;
    sources: {
      script: boolean;
      scriptPanelMatched: boolean;
      panelStates: number;
      visualAnalysis: boolean;
      videos: number;
    };
  };
}

export type ContinuityContextStorage = Pick<
  IStorage,
  | "getPanel"
  | "getPage"
  | "getProject"
  | "getProjectStructuredScript"
  | "getPanelCharacterStates"
  | "getProjectCharacters"
> & {
  getLatestApprovedVideoVersions?: (panelId: string) => Promise<unknown>;
};

interface ScriptPanelMatch {
  panel: ScriptPanelWithDialogue;
  page: ScriptPageWithPanels;
}
      throw new Error(`Page ${panel.pageId} not found for panel ${panelId}`);
    }

    const project = await this.storage.getProject(page.projectId);
    if (!project) {
      throw new Error(`Project ${page.projectId} not found for panel ${panelId}`);
    }

    const [script, panelStates, projectCharacters, videoVersions] = await Promise.all([
      this.storage.getProjectStructuredScript(project.id),
      this.storage.getPanelCharacterStates(panelId),
      this.storage.getProjectCharacters(project.id),
      this.getApprovedVideoVersions(panelId),
    ]);

    const scriptMatch = script
      ? this.findScriptPanel(script, page.pageNumber, panel.panelNumber)
      : undefined;

    const scriptContext = scriptMatch ? this.buildScriptContext(scriptMatch) : undefined;

    const charactersById = new Map<string, Character>(
      projectCharacters.map(character => [character.id, character])
    );

    const panelAnalysis = this.extractPanelAnalysis(panelStates);
    const characterSnapshots = this.buildCharacterSnapshots(
      panelStates,
      charactersById,
      panelAnalysis
    );

    const environmentSnapshot = this.buildEnvironmentSnapshot(scriptMatch, panelAnalysis);
    const cameraSnapshot = this.buildCameraSnapshot(scriptMatch, panelAnalysis, panelStates);

    const fallbackTimestamp =
      panelStates.find(state => state.visualAnalysisTimestamp)?.visualAnalysisTimestamp ??
      panelStates.find(state => state.updatedAt)?.updatedAt ??
      panel.updatedAt ??
      panel.createdAt;

    return {
      panel: {
        id: panel.id,
        number: panel.panelNumber,
        pageNumber: page.pageNumber,
        imageUrl: panel.imageUrl,
      },
      project: {
        id: project.id,
        title: project.title,
        genre: project.genre ?? undefined,
        artStyle: project.artStyle ?? undefined,
      },
      script: scriptContext,
      continuity: {
        characters: characterSnapshots,
        environment: environmentSnapshot,
        camera: cameraSnapshot,
      },
      assets: {
        videos: videoVersions,
      },
      metadata: {
        generatedAt: this.normalizeDate(
          (panelAnalysis as Partial<PanelVisualAnalysis> | undefined)?.analysisTimestamp ??
            fallbackTimestamp
        ),
        hasVisualAnalysis:
          Boolean(panelAnalysis) || panelStates.some(state => state.visualAnalysisRawData),
        sources: {
          script: Boolean(script),
          scriptPanelMatched: Boolean(scriptMatch),
          panelStates: panelStates.length,
          visualAnalysis: Boolean(panelAnalysis),
          videos: videoVersions.length,
        },
      },
    };
  }

  private async getApprovedVideoVersions(panelId: string): Promise<ContinuityVideoVersion[]> {
    const maybeFn = this.storage.getLatestApprovedVideoVersions;
    if (typeof maybeFn !== "function") {
      return [];
    }

    const versions = await maybeFn(panelId);
    if (!Array.isArray(versions)) {
      return [];
    }

    const serialized = versions
      .map(version => this.serializeVideoVersion(version, panelId))
      .filter((version): version is ContinuityVideoVersion => Boolean(version));

    serialized.sort((a, b) => {
      if (!a.approvedAt && !b.approvedAt) return 0;
      if (!a.approvedAt) return 1;
      if (!b.approvedAt) return -1;
      return b.approvedAt.localeCompare(a.approvedAt);
    });

    return serialized;
  }

  private serializeVideoVersion(version: unknown, panelId: string): ContinuityVideoVersion | undefined {
    if (!version || typeof version !== "object") {
      return undefined;
    }

    const candidate = version as Record<string, unknown>;
    const videoUrl = this.pickString(candidate, ["videoUrl", "assetUrl", "url"]);
    if (!videoUrl) {
      return undefined;
    }

    const id =
      this.pickString(candidate, ["id", "versionId", "videoId"]) ?? `${panelId}-${videoUrl}`;

    return {
      id,
      videoUrl,
      label: this.pickString(candidate, ["label", "versionLabel", "name", "title"]),
      thumbnailUrl: this.pickString(candidate, ["thumbnailUrl", "previewUrl", "posterUrl"]),
      approvedAt: this.normalizeDate(
        candidate["approvedAt"] ?? candidate["approved_at"] ?? candidate["approvedAtIso"]
      ),
      durationSeconds: this.pickNumber(candidate, ["durationSeconds", "duration"]),
      aspectRatio: this.pickString(candidate, ["aspectRatio", "ratio"]),
    };
  }

  private findScriptPanel(
    script: FullStructuredScript,
    pageNumber: number,
    panelNumber: number
  ): ScriptPanelMatch | undefined {
    for (const page of script.pages ?? []) {
      if (page.pageNumber !== pageNumber) {
        continue;
      }

      const panel = page.panels?.find(candidate => candidate.panelNumber === panelNumber);
      if (panel) {
        return { panel, page };
      }
    }

    return undefined;
  }

  private buildScriptContext(match: ScriptPanelMatch): ScriptContext {
    const { panel, page } = match;

    return {
      pageNumber: page.pageNumber,
      panelNumber: panel.panelNumber,
      action: panel.action ?? undefined,
      sceneDescription: panel.sceneDescription ?? undefined,
      mood: panel.mood ?? page.mood ?? undefined,
      timeOfDay: panel.timeOfDay ?? page.timeOfDay ?? undefined,
      location: panel.locationSpecifics ?? page.location ?? undefined,
      characters: [...(panel.characters ?? [])],
      dialogue:
        panel.dialogue?.map(entry => ({
          character: entry.character,
          text: entry.text,
          tone: entry.tone ?? undefined,
          bubbleType: entry.bubbleType ?? undefined,
          emotionalState: entry.emotionalState ?? undefined,
        })) ?? [],
      environment: {
        props: this.collectStrings(...(panel.props ?? [])),
        setDressing: this.collectStrings(...(panel.setDressing ?? [])),
        background: this.collectStrings(...(panel.backgroundElements ?? [])),
        weather: panel.weatherCondition ?? page.weatherConditions ?? undefined,
        atmosphere: panel.atmosphere ?? undefined,
      },
      camera: {
        angle: panel.cameraAngle ?? undefined,
        shotType: panel.shotType ?? undefined,
        movement: panel.cameraMovement ?? undefined,
        composition: panel.frameComposition ?? undefined,
        focus: panel.focusPoint ?? undefined,
        depthOfField: panel.depthOfField ?? undefined,
      },
      notes: panel.consistencyNotes ?? undefined,
    };
  }

  private buildCharacterSnapshots(
    panelStates: PanelCharacterState[],
    charactersById: Map<string, Character>,
    panelAnalysis?: PanelVisualAnalysis
  ): CharacterSnapshot[] {
    const analysisMap = new Map<string, CharacterAppearanceAnalysis>();
    if (panelAnalysis?.characters) {
      for (const entry of panelAnalysis.characters) {
        if (entry.characterName) {
          analysisMap.set(entry.characterName.trim().toLowerCase(), entry);
        }
      }
    }

    return panelStates.map(state => {
      const character = charactersById.get(state.characterId);
      const canonicalName = character?.name ?? state.characterId;
      const analysis = analysisMap.get(canonicalName.trim().toLowerCase());

      return this.serializeCharacterState(state, canonicalName, analysis);
    });
  }

  private serializeCharacterState(
    state: PanelCharacterState,
    canonicalName: string,
    analysis?: CharacterAppearanceAnalysis
  ): CharacterSnapshot {
    const clothingColors = this.collectStrings(...(state.detectedClothingColors ?? []));
    const clothingAccessories = this.collectStrings(
      ...(state.detectedClothingAccessories ?? []),
      ...(analysis?.visualDetails?.clothing?.accessories ?? [])
    );
    const jewelry = this.collectStrings(...(state.detectedJewelry ?? []));
    const otherAccessories = this.collectStrings(
      ...(state.detectedOtherAccessories ?? []),
      ...(analysis?.visualDetails?.accessories?.other ?? [])
    );

    const analysisWarnings = (analysis?.inconsistencies ?? []).map(inconsistency => ({
      type: inconsistency.type,
      severity: inconsistency.severity,
      description: inconsistency.description,
    }));

    return {
      id: state.characterId,
      name: canonicalName,
      isPresent: (state.isPresent ?? undefined) ?? analysis?.isPresent ?? true,
      confidence: state.confidenceScore ?? analysis?.confidence,
      appearance: {
        clothing: {
          upper: state.detectedUpperBody ?? analysis?.visualDetails?.clothing?.upperBody,
          lower: state.detectedLowerBody ?? analysis?.visualDetails?.clothing?.lowerBody,
          outerwear: state.detectedOuterwear ?? analysis?.visualDetails?.clothing?.outerwear ?? undefined,
          style: state.detectedClothingStyle ?? analysis?.visualDetails?.clothing?.style ?? undefined,
          colors: clothingColors.length > 0 ? clothingColors : analysis?.visualDetails?.clothing?.colors ?? [],
          accessories: clothingAccessories,
        },
        hair: {
          color: state.detectedHairColor ?? analysis?.visualDetails?.hair?.color,
          style: state.detectedHairStyle ?? analysis?.visualDetails?.hair?.style,
          length: state.detectedHairLength ?? analysis?.visualDetails?.hair?.length,
          texture: state.detectedHairTexture ?? analysis?.visualDetails?.hair?.texture,
        },
        physical: {
          skinTone: state.detectedSkinTone ?? analysis?.visualDetails?.physicalAppearance?.skinTone,
          eyeColor: state.detectedEyeColor ?? analysis?.visualDetails?.physicalAppearance?.eyeColor,
          pose:
            state.detectedPose ??
            state.pose ??
            analysis?.visualDetails?.physicalAppearance?.pose ??
            analysis?.visualDetails?.location?.interaction,
          bodyLanguage:
            state.bodyLanguage ?? analysis?.visualDetails?.physicalAppearance?.bodyLanguage,
        },
        accessories: {
          jewelry,
          glasses:
            typeof state.detectedGlasses === "boolean"
              ? state.detectedGlasses
              : analysis?.visualDetails?.accessories?.glasses,
          hat: state.detectedHat ?? analysis?.visualDetails?.accessories?.hat ?? undefined,
          other: otherAccessories,
        },
      },
      emotion: state.emotion ?? undefined,
      facialExpression:
        state.facialExpression ?? analysis?.visualDetails?.physicalAppearance?.facialExpression,
      bodyLanguage: state.bodyLanguage ?? analysis?.visualDetails?.physicalAppearance?.bodyLanguage,
      positioning: {
        position: state.position ?? analysis?.visualDetails?.location?.position,
        pose: state.pose ?? state.detectedPose ?? analysis?.visualDetails?.physicalAppearance?.pose,
        screenPosition: state.screenPosition ?? state.detectedScreenPosition ?? undefined,
        facingDirection: state.facingDirection ?? undefined,
        visibility: state.visibility ?? undefined,
        interaction: state.detectedInteraction ?? analysis?.visualDetails?.location?.interaction,
        proximity: state.proximityToOthers ?? undefined,
      },
      notes: {
        temporaryChanges: this.collectStrings(...(state.temporaryChanges ?? [])),
        injuriesVisible: this.collectStrings(...(state.injuriesVisible ?? [])),
        generationPrompt: state.generationPrompt ?? undefined,
        consistencyNotes: state.consistencyNotes ?? undefined,
        analysisWarnings,
      },
      source: analysis ? "visual-analysis" : "panel-state",
    };
  }

  private buildEnvironmentSnapshot(
    match: ScriptPanelMatch | undefined,
    panelAnalysis?: PanelVisualAnalysis
  ): EnvironmentSnapshot {
    const scriptPanel = match?.panel;
    const scriptPage = match?.page;

    return {
      setting: this.firstDefined([
        panelAnalysis?.overallScene?.setting,
        scriptPanel?.sceneDescription ?? undefined,
        scriptPage?.setting ?? undefined,
        scriptPanel?.locationSpecifics ?? undefined,
      ]),
      mood: this.firstDefined([
        panelAnalysis?.overallScene?.mood,
        scriptPanel?.mood ?? undefined,
        scriptPanel?.atmosphere ?? undefined,
        scriptPage?.mood ?? undefined,
      ]),
      lighting: this.firstDefined([
        panelAnalysis?.overallScene?.lighting,
        scriptPanel?.lightingMood ?? undefined,
        scriptPanel?.primaryLightSource ?? undefined,
      ]),
      timeOfDay: this.firstDefined([
        panelAnalysis?.overallScene?.timeOfDay,
        scriptPanel?.timeOfDay ?? undefined,
        scriptPage?.timeOfDay ?? undefined,
      ]),
      weather: scriptPanel?.weatherCondition ?? scriptPage?.weatherConditions ?? undefined,
      props: this.collectStrings(
        ...(scriptPanel?.props ?? []),
        ...(scriptPanel?.setDressing ?? []),
        ...(scriptPanel?.backgroundElements ?? [])
      ),
      backgroundElements: this.collectStrings(...(scriptPanel?.backgroundElements ?? [])),
      notablePatterns: this.extractNotablePatterns(panelAnalysis),
    };
  }

  private buildCameraSnapshot(
    match: ScriptPanelMatch | undefined,
    panelAnalysis: PanelVisualAnalysis | undefined,
    panelStates: PanelCharacterState[]
  ): CameraSnapshot {
    const scriptPanel = match?.panel;
    const cameraFromRaw = this.extractCameraFromRawData(panelStates, panelAnalysis);
    const highlightPoseState = panelStates.find(
      candidate => candidate.detectedPose || candidate.pose
    );

    return {
      angle: this.firstDefined([
        cameraFromRaw?.angle,
        scriptPanel?.cameraAngle ?? undefined,
      ]),
      shotType: this.firstDefined([
        cameraFromRaw?.shotType,
        scriptPanel?.shotType ?? undefined,
      ]),
      movement: this.firstDefined([
        cameraFromRaw?.movement,
        scriptPanel?.cameraMovement ?? undefined,
      ]),
      composition: this.firstDefined([
        cameraFromRaw?.composition,
        scriptPanel?.frameComposition ?? undefined,
      ]),
      focus: this.firstDefined([
        cameraFromRaw?.focus,
        scriptPanel?.focusPoint ?? undefined,
      ]),
      depthOfField: this.firstDefined([
        cameraFromRaw?.depthOfField,
        scriptPanel?.depthOfField ?? undefined,
      ]),
      perspective: this.firstDefined([
        cameraFromRaw?.perspective,
        scriptPanel?.perspectiveType ?? undefined,
      ]),
      highlightPose: highlightPoseState?.detectedPose ?? highlightPoseState?.pose ?? undefined,
    };
  }

  private extractNotablePatterns(panelAnalysis?: PanelVisualAnalysis): string[] {
    if (!panelAnalysis) {
      return [];
    }

    const rawAnalysis = panelAnalysis as unknown as Record<string, unknown>;
    const overallScene = rawAnalysis.overallScene as Record<string, unknown> | undefined;

    const fromOverallScene = Array.isArray(overallScene?.notablePatterns)
      ? (overallScene!.notablePatterns as unknown[])
      : [];
    const directPatterns = Array.isArray(rawAnalysis.notablePatterns)
      ? (rawAnalysis.notablePatterns as unknown[])
      : [];

    return this.collectStrings(
      ...fromOverallScene.filter((value): value is string => typeof value === "string"),
      ...directPatterns.filter((value): value is string => typeof value === "string")
    );
  }

  private extractPanelAnalysis(panelStates: PanelCharacterState[]): PanelVisualAnalysis | undefined {
    for (const state of panelStates) {
      const raw = state.visualAnalysisRawData;
      if (!raw || typeof raw !== "object") {
        continue;
      }

      if (this.isPanelVisualAnalysis(raw)) {
        return raw;
      }

      const enriched = raw as Record<string, unknown>;

      if (enriched.panelAnalysis && this.isPanelVisualAnalysis(enriched.panelAnalysis)) {
        return enriched.panelAnalysis;
      }

      if (enriched.panelVisualAnalysis && this.isPanelVisualAnalysis(enriched.panelVisualAnalysis)) {
        return enriched.panelVisualAnalysis;
      }

      if (Array.isArray(enriched.panelAnalyses)) {
        const candidate = enriched.panelAnalyses.find(entry => this.isPanelVisualAnalysis(entry));
        if (candidate) {
          return candidate;
        }
      }

      if (enriched.analysis && this.isPanelVisualAnalysis(enriched.analysis)) {
        return enriched.analysis;
      }
    }

    return undefined;
  }

  private extractCameraFromRawData(
    panelStates: PanelCharacterState[],
    panelAnalysis?: PanelVisualAnalysis
  ): Partial<CameraSnapshot> | undefined {
    const rawAnalysis = panelAnalysis as unknown as Record<string, unknown> | undefined;
    const candidateFromAnalysis =
      rawAnalysis && typeof rawAnalysis.camera === "object"
        ? (rawAnalysis.camera as Record<string, unknown>)
        : undefined;

    if (candidateFromAnalysis) {
      const normalized = this.normalizeCamera(candidateFromAnalysis);
      if (normalized) {
        return normalized;
      }
    }

    for (const state of panelStates) {
      const raw = state.visualAnalysisRawData;
      if (!raw || typeof raw !== "object") {
        continue;
      }

      const container = raw as Record<string, unknown>;
      const cameraCandidate =
        container.camera ??
        container.cameraSnapshot ??
        container.cameraDetails ??
        (container.panelAnalysis && (container.panelAnalysis as any).camera) ??
        (container.sceneCamera as unknown);

      if (cameraCandidate && typeof cameraCandidate === "object") {
        const normalized = this.normalizeCamera(cameraCandidate);
        if (normalized) {
          return normalized;
        }
      }
    }

    return undefined;
  }

  private normalizeCamera(camera: unknown): Partial<CameraSnapshot> | undefined {
    if (!camera || typeof camera !== "object") {
      return undefined;
    }

    const source = camera as Record<string, unknown>;
    return {
      angle: this.pickString(source, ["angle", "cameraAngle", "viewAngle"]),
      shotType: this.pickString(source, ["shotType", "cameraShot", "type"]),
      movement: this.pickString(source, ["movement", "cameraMovement"]),
      composition: this.pickString(source, ["frameComposition", "composition"]),
      focus: this.pickString(source, ["focus", "focusPoint"]),
      depthOfField: this.pickString(source, ["depthOfField"]),
      perspective: this.pickString(source, ["perspective", "perspectiveType"]),
    };
  }

  private isPanelVisualAnalysis(candidate: unknown): candidate is PanelVisualAnalysis {
    if (!candidate || typeof candidate !== "object") {
      return false;
    }

    const analysis = candidate as PanelVisualAnalysis;
    return (
      Array.isArray((analysis as PanelVisualAnalysis).characters) &&
      Boolean((analysis as PanelVisualAnalysis).overallScene)
    );
  }

  private collectStrings(...inputs: Array<string | string[] | null | undefined>): string[] {
    const result: string[] = [];

    for (const input of inputs) {
      if (Array.isArray(input)) {
        for (const value of input) {
          if (typeof value === "string") {
            const trimmed = value.trim();
            if (trimmed.length > 0 && !result.includes(trimmed)) {
              result.push(trimmed);
            }
          }
        }
      } else if (typeof input === "string") {
        const trimmed = input.trim();
        if (trimmed.length > 0 && !result.includes(trimmed)) {
          result.push(trimmed);
        }
      }
    }

    return result;
  }

  private pickString(source: Record<string, unknown>, keys: string[]): string | undefined {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === "string" && value.trim().length > 0) {
        return value;
      }
    }
    return undefined;
  }

  private pickNumber(source: Record<string, unknown>, keys: string[]): number | undefined {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        return value;
      }
    }
    return undefined;
  }

  private firstDefined(values: Array<string | null | undefined>): string | undefined {
    for (const value of values) {
      if (typeof value === "string" && value.trim().length > 0) {
        return value;
      }
    }
    return undefined;
  }

  private normalizeDate(value: unknown): string | undefined {
    if (!value) {
      return undefined;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (typeof value === "string") {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString();
      }
      return undefined;
    }

    return undefined;
  }
}
