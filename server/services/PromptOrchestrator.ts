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
