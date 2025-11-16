import type { Project } from "@shared/schema";

export interface PanelAsset {
  id: string;
  pageId: string;
  pageNumber: number;
  panelNumber: number;
  imageUrl: string | null;
  prompt: string | null;
  scriptSnippet: string | null;
}

export interface SceneClip {
  id: string;
  panel: PanelAsset;
}

export interface PromptTokenSelection {
  shot: string | null;
  cameraMove: string | null;
  mood: string | null;
  lighting: string | null;
  style: string | null;
  consistencyLocks: string[];
}

export type SceneQuality = "quality" | "standard";
export type SceneAspectRatio = "16:9" | "1:1" | "4:5" | "9:16";
export type SceneSoundtrackMood = "none" | "uplifting" | "dramatic" | "mysterious" | "tense" | "whimsical";
export type PromptVariant = "A" | "B";

export interface Scene {
  id: string;
  title: string;
  clips: SceneClip[];
  prompt: string;
  promptWasEdited: boolean;
  promptTokens: PromptTokenSelection;
  promptFreeform: string;
  promptVersionHistory: string[];
  promptVariants: Record<PromptVariant, string | null>;
  activePromptVariant: PromptVariant;
  durationSeconds: number;
  aspectRatio: SceneAspectRatio;
  quality: SceneQuality;
  soundtrackMood: SceneSoundtrackMood;
  includeAudioBed: boolean;
  model: string;
  isSubmitting?: boolean;
  lastSubmittedAt?: string;
}

export interface SelectedProjectContext {
  project?: Project | null;
  panelLibrary: PanelAsset[];
}
