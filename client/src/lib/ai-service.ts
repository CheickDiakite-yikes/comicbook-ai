import { apiRequest } from "./queryClient";

export interface GenerateImageRequest {
  prompt: string;
  panelId: string | number;
  projectContext: {
    title: string;
    genre?: string;
    description?: string;
    artStyle?: string;
    characters?: Array<{
      name: string;
      role: string;
      bio: string;
      visualDescriptors?: string;
    }>;
    settings?: Array<{
      name: string;
      description: string;
    }>;
  };
  characterContext?: Array<{
    name: string;
    visualDescriptors: string;
    role: string;
  }>;
  styleOptions?: {
    artStyle?: string;
    colorPalette?: string[];
    mood?: string;
  };
  previousPanelsContext?: Array<{
    panelNumber: number;
    prompt: string;
    imageUrl?: string;
  }>;
}

export interface GenerateImageResponse {
  imageUrl: string;
  status: "completed" | "generating" | "failed";
  panelId: string | number;
  generationId?: string;
  error?: string;
}

export interface GenerateScriptRequest {
  title: string;
  genre?: string;
  description: string;
  characters: Array<{
    name: string;
    role: string;
    bio: string;
  }>;
  settings: Array<{
    name: string;
    description: string;
  }>;
  pageCount?: number;
  tone?: string;
}

export interface GenerateScriptResponse {
  script: string;
  scenes: Array<{
    sceneNumber: number;
    setting: string;
    characters: string[];
    description: string;
    dialogue: Array<{
      character: string;
      text: string;
    }>;
  }>;
}

class AIService {
  private baseUrl = "/api";

  /**
   * Generate an image for a specific comic panel using AI
   */
  async generatePanelImage(request: GenerateImageRequest): Promise<GenerateImageResponse> {
    try {
      // Construct context-aware prompt
      const contextualPrompt = this.buildContextualPrompt(request);
      
      const response = await apiRequest("POST", `${this.baseUrl}/generate-image`, {
        prompt: contextualPrompt,
        panelId: request.panelId,
        projectContext: request.projectContext,
        characterContext: request.characterContext,
        styleOptions: request.styleOptions,
      });

      return await response.json();
    } catch (error) {
      console.error("Failed to generate panel image:", error);
      throw new Error("Failed to generate panel image. Please try again.");
    }
  }

  /**
   * Generate a full page of comic panels at once
   */
  async generateFullPage(
    projectContext: GenerateImageRequest["projectContext"],
    pageScript: string,
    panelLayout: Array<{ panelNumber: number; description: string }>
  ): Promise<Array<GenerateImageResponse>> {
    try {
      const results: Array<GenerateImageResponse> = [];
      
      // Generate each panel in sequence to maintain consistency
      for (const panel of panelLayout) {
        const request: GenerateImageRequest = {
          prompt: panel.description,
          panelId: panel.panelNumber,
          projectContext,
          previousPanelsContext: results.map((r, index) => ({
            panelNumber: index + 1,
            prompt: panelLayout[index]?.description || "",
            imageUrl: r.imageUrl,
          })),
        };

        const result = await this.generatePanelImage(request);
        results.push(result);
      }

      return results;
    } catch (error) {
      console.error("Failed to generate full page:", error);
      throw new Error("Failed to generate full page. Please try again.");
    }
  }

  /**
   * Generate a comic script based on story outline
   */
  async generateScript(request: GenerateScriptRequest): Promise<GenerateScriptResponse> {
    try {
      // In a real implementation, this would call the Nano Banana API
      // For now, we'll create a structured response based on the input
      const response = await apiRequest("POST", `${this.baseUrl}/generate-script`, request);
      return await response.json();
    } catch (error) {
      console.error("Failed to generate script:", error);
      throw new Error("Failed to generate script. Please try again.");
    }
  }

  /**
   * Get generation status for long-running operations
   */
  async getGenerationStatus(generationId: string): Promise<{
    status: "pending" | "generating" | "completed" | "failed";
    progress?: number;
    result?: GenerateImageResponse;
    error?: string;
  }> {
    try {
      const response = await apiRequest("GET", `${this.baseUrl}/generation-status/${generationId}`);
      return await response.json();
    } catch (error) {
      console.error("Failed to get generation status:", error);
      throw new Error("Failed to get generation status.");
    }
  }

  /**
   * Build a context-aware prompt that includes character consistency and story context
   */
  private buildContextualPrompt(request: GenerateImageRequest): string {
    let prompt = request.prompt;

    // Add art style context
    if (request.projectContext.artStyle) {
      prompt += `, in ${request.projectContext.artStyle} art style`;
    }

    // Add character context for consistency
    if (request.characterContext && request.characterContext.length > 0) {
      const characterDescriptions = request.characterContext
        .map(char => `${char.name} (${char.role}): ${char.visualDescriptors}`)
        .join(", ");
      prompt += `. Characters present: ${characterDescriptions}`;
    }

    // Add story context
    if (request.projectContext.description) {
      prompt += `. Story context: ${request.projectContext.description}`;
    }

    // Add genre/mood context
    if (request.projectContext.genre) {
      prompt += `. Genre: ${request.projectContext.genre}`;
    }

    // Add style options
    if (request.styleOptions?.mood) {
      prompt += `. Mood: ${request.styleOptions.mood}`;
    }

    if (request.styleOptions?.colorPalette && request.styleOptions.colorPalette.length > 0) {
      prompt += `. Color palette: ${request.styleOptions.colorPalette.join(", ")}`;
    }

    // Add consistency instructions
    prompt += ". Maintain character visual consistency with previous panels.";

    return prompt;
  }

  /**
   * Extract character references from a prompt
   */
  extractCharacterReferences(prompt: string, characters: Array<{ name: string }>): string[] {
    const references: string[] = [];
    const lowercasePrompt = prompt.toLowerCase();

    characters.forEach(character => {
      if (lowercasePrompt.includes(character.name.toLowerCase())) {
        references.push(character.name);
      }
    });

    return references;
  }

  /**
   * Suggest panel prompts based on script content
   */
  suggestPanelPrompts(scriptText: string, panelCount: number): string[] {
    // This is a simplified implementation
    // In a real app, this would use NLP to extract visual scenes
    const sentences = scriptText.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const suggestions: string[] = [];

    for (let i = 0; i < panelCount && i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      if (sentence.length > 0) {
        suggestions.push(sentence);
      }
    }

    // Fill remaining panels with generic prompts if needed
    while (suggestions.length < panelCount) {
      suggestions.push("Continue the scene with appropriate visual storytelling");
    }

    return suggestions;
  }

  /**
   * Validate panel prompt for AI generation
   */
  validatePrompt(prompt: string): { isValid: boolean; suggestions?: string[] } {
    if (!prompt || prompt.trim().length < 10) {
      return {
        isValid: false,
        suggestions: [
          "Add more descriptive details about the scene",
          "Include character actions and emotions",
          "Specify the setting and environment",
        ],
      };
    }

    if (prompt.length > 500) {
      return {
        isValid: false,
        suggestions: [
          "Shorten the prompt to focus on key visual elements",
          "Break complex scenes into multiple panels",
        ],
      };
    }

    return { isValid: true };
  }
}

// Export singleton instance
export const aiService = new AIService();

// Export types for use in components
export type {
  GenerateImageRequest,
  GenerateImageResponse,
  GenerateScriptRequest,
  GenerateScriptResponse,
};
