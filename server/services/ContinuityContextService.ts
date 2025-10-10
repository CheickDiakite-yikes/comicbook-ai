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
