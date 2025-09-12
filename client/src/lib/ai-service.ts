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
      
      // CRITICAL FIX: apiRequest already returns parsed JSON, don't parse again
      const jsonData = await apiRequest("POST", `${this.baseUrl}/generate-image`, {
        prompt: contextualPrompt,
        panelId: request.panelId,
        projectContext: request.projectContext,
        characterContext: request.characterContext,
        styleOptions: request.styleOptions,
        panelContext: request.panelContext,
      });
      
      return jsonData as GenerateImageResponse;
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
      // CRITICAL FIX: apiRequest already returns parsed JSON, don't parse again
      const jsonData = await apiRequest("POST", `${this.baseUrl}/generate-full-page`, {
        projectContext,
        pageScript,
        panelLayout,
        currentPageId,
        layoutId,
      });
      
      console.log("Full page response:", jsonData); // Debug logging
      
      if (!Array.isArray(jsonData)) {
        console.error("Expected array response, got:", typeof jsonData, jsonData);
        throw new Error("Invalid response format from server");
      }

      // ✅ PARTIAL SUCCESS HANDLING: Accept mixed results (some success, some failure)
      // Count successful vs failed panels
      const successCount = jsonData.filter(panel => panel && panel.status === "completed").length;
      const failCount = jsonData.filter(panel => panel && panel.status === "failed").length;
      
      console.log(`Full page generation result: ${successCount} succeeded, ${failCount} failed out of ${jsonData.length} total panels`);
      
      // Only throw error if ALL panels failed (complete failure)
      if (successCount === 0 && failCount > 0) {
        throw new Error(`All ${failCount} panels failed to generate. Please try again.`);
      }
      
      return jsonData as Array<GenerateImageResponse>;
    } catch (error) {
      console.error("Failed to generate full page:", error);
      // Re-throw the original error to preserve the specific error message
      throw error;
    }
  }

  /**
   * Generate a comic script based on story outline
   */
  async generateScript(request: GenerateScriptRequest): Promise<GenerateScriptResponse> {
    try {
      // CRITICAL FIX: apiRequest already returns parsed JSON, don't parse again  
      const jsonData = await apiRequest("POST", `${this.baseUrl}/generate-script`, request);
      return jsonData as GenerateScriptResponse;
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
      // CRITICAL FIX: apiRequest already returns parsed JSON
      const jsonData = await apiRequest("GET", `${this.baseUrl}/generation-status/${generationId}`);
      return jsonData as {
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

    // 🎯 ENHANCED CHARACTER CONSISTENCY - Use Gemini's character reference capabilities
    if (request.characterContext && request.characterContext.length > 0) {
      // Build detailed character descriptions using proven consistency techniques
      const characterDescriptions = request.characterContext.map(char => {
        return this.buildCharacterConsistencyPrompt(char.name, char.visualDescriptors, char.role);
      }).join(". ");
      
      prompt += `. CRITICAL CHARACTER CONSISTENCY: ${characterDescriptions}`;
    }

    // Add previous panel context for visual continuity
    if (request.previousPanelsContext && request.previousPanelsContext.length > 0) {
      const previousContext = request.previousPanelsContext
        .slice(-2) // Only use last 2 panels to avoid prompt bloat
        .map(panel => `Panel ${panel.panelNumber}: ${panel.prompt}`)
        .join(". ");
      prompt += `. Previous panel context for consistency: ${previousContext}`;
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

    // 🎯 ENHANCED CONSISTENCY INSTRUCTIONS using Gemini best practices
    prompt += ". CONSISTENCY RULES: Keep ALL character physical features identical (facial structure, hair color/style, body type, skin tone, distinctive marks). Only clothing may change if story requires it. Use the EXACT SAME character visual details from previous panels. Create a detailed, high-quality comic book illustration with perfect character consistency.";

    return prompt;
  }

  /**
   * 🎯 NEW: Build enhanced character consistency prompt using AI art best practices
   */
  private buildCharacterConsistencyPrompt(name: string, visualDescriptors: string, role: string): string {
    // Enhanced prompt structure for maximum consistency
    return `${name} (${role}) MUST appear with these EXACT features: ${visualDescriptors}. Maintain IDENTICAL facial structure, hair, body type, and all distinctive physical characteristics`;
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
