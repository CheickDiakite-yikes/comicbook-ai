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
  panelContext?: {
    layoutTemplate: string;
    panelNumber: number;
    aspectRatio: number;
    dimensions: {
      width: number;
      height: number;
    };
    panelType: string;
  };
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
        panelContext: request.panelContext,
      });

      return response as unknown as GenerateImageResponse; // apiRequest already returns JSON
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
    panelLayout: Array<{ 
      panelNumber: number; 
      description: string;
      panelContext?: any;
      layoutInfo?: any;
    }>,
    currentPageId?: string,
    layoutId?: string
  ): Promise<Array<GenerateImageResponse>> {
    try {
      const response = await apiRequest("POST", `${this.baseUrl}/generate-full-page`, {
        projectContext,
        pageScript,
        panelLayout,
        currentPageId,
        layoutId,
      });

      return response as unknown as Array<GenerateImageResponse>;
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
      const response = await apiRequest("POST", `${this.baseUrl}/generate-script`, request);
      return response as unknown as GenerateScriptResponse;
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
      return response as unknown as {
        status: "pending" | "generating" | "completed" | "failed";
        progress?: number;
        result?: GenerateImageResponse;
        error?: string;
      };
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

    // Add panel dimension context for better composition
    if (request.panelContext) {
      const { aspectRatio, panelType } = request.panelContext;
      
      if (panelType === "wide-cinematic" || panelType === "wide") {
        prompt += " (wide cinematic composition, landscape orientation)";
      } else if (panelType === "tall-vertical") {
        prompt += " (vertical composition, portrait orientation)";
      } else if (panelType === "square") {
        prompt += " (square composition, balanced framing)";
      }
      
      // Add aspect ratio hint
      prompt += ` (aspect ratio ${aspectRatio.toFixed(2)}:1)`;
    }

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

    // Add consistency and quality instructions
    prompt += ". Maintain character visual consistency with previous panels. Create a detailed, high-quality comic book illustration.";

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
// Helper functions for panel context
export function calculatePanelAspectRatio(width: number, height: number): number {
  return width / height;
}

export function determinePanelType(aspectRatio: number): string {
  if (aspectRatio > 2) return "wide-cinematic";
  if (aspectRatio > 1.5) return "wide";
  if (aspectRatio > 0.8 && aspectRatio < 1.2) return "square";
  if (aspectRatio < 0.5) return "tall-vertical";
  return "standard";
}

export const aiService = new AIService();
