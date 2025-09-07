import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";
import * as path from "path";

// Initialize Gemini AI client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

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

export class GeminiService {
  /**
   * Generate an image for a comic panel using Gemini's image generation
   */
  async generatePanelImage(request: GenerateImageRequest): Promise<GenerateImageResponse> {
    try {
      // Build context-aware prompt
      const contextualPrompt = this.buildContextualPrompt(request);
      
      console.log(`Generating image for panel ${request.panelId} with prompt: ${contextualPrompt}`);

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image-preview",
        contents: contextualPrompt,
      });

      // Process the response to extract image data
      if (!response.candidates || !response.candidates[0]?.content?.parts) {
        throw new Error("No valid response received from Gemini");
      }
      
      for (const part of response.candidates[0].content.parts) {
        if (part.text) {
          console.log("Generated text:", part.text);
        } else if (part.inlineData) {
          // Save the image to a temporary location and return URL
          const imageData = part.inlineData.data;
          if (!imageData) {
            throw new Error("No image data received");
          }
          const buffer = Buffer.from(imageData, "base64");
          const filename = `panel_${request.panelId}_${Date.now()}.png`;
          const imagePath = path.join(process.cwd(), "public", "generated", filename);
          
          // Ensure directory exists
          const dir = path.dirname(imagePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          
          fs.writeFileSync(imagePath, buffer);
          
          return {
            imageUrl: `/generated/${filename}`,
            status: "completed",
            panelId: request.panelId,
            generationId: Date.now().toString(),
          };
        }
      }

      throw new Error("No image data received from Gemini");
    } catch (error) {
      console.error("Error generating panel image:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate image";
      return {
        imageUrl: "",
        status: "failed",
        panelId: request.panelId,
        error: errorMessage,
      };
    }
  }

  /**
   * Generate multiple panel images for a full page
   */
  async generateFullPage(
    projectContext: GenerateImageRequest["projectContext"],
    pageScript: string,
    panelLayout: Array<{ panelNumber: number; description: string }>
  ): Promise<Array<GenerateImageResponse>> {
    const results: Array<GenerateImageResponse> = [];
    
    try {
      // Generate each panel sequentially to maintain consistency
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

        // Small delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      return results;
    } catch (error) {
      console.error("Error generating full page:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      throw new Error("Failed to generate full page: " + errorMessage);
    }
  }

  /**
   * Generate a comic script using Gemini's text generation
   */
  async generateScript(request: GenerateScriptRequest): Promise<GenerateScriptResponse> {
    try {
      const prompt = this.buildScriptPrompt(request);
      
      console.log("Generating script with prompt:", prompt);

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const generatedText = response.text || "";
      
      // Parse the generated script into structured format
      const parsedScript = this.parseGeneratedScript(generatedText);
      
      return {
        script: generatedText,
        scenes: parsedScript,
      };
    } catch (error) {
      console.error("Error generating script:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      throw new Error("Failed to generate script: " + errorMessage);
    }
  }

  /**
   * Build a context-aware prompt for image generation
   */
  private buildContextualPrompt(request: GenerateImageRequest): string {
    let prompt = `Create a comic panel image: ${request.prompt}`;

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
      
      // Add aspect ratio hint for better fit
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
   * Build a prompt for script generation
   */
  private buildScriptPrompt(request: GenerateScriptRequest): string {
    let prompt = `Write a comic book script for "${request.title}".`;
    
    if (request.genre) {
      prompt += ` Genre: ${request.genre}.`;
    }
    
    prompt += ` Story Description: ${request.description}.`;
    
    if (request.characters.length > 0) {
      prompt += ` Characters: `;
      request.characters.forEach(char => {
        prompt += `${char.name} (${char.role}) - ${char.bio}. `;
      });
    }
    
    if (request.settings.length > 0) {
      prompt += ` Settings: `;
      request.settings.forEach(setting => {
        prompt += `${setting.name} - ${setting.description}. `;
      });
    }
    
    const pageCount = request.pageCount || 5;
    prompt += ` Create a script for ${pageCount} pages. Format it with clear scene descriptions, panel descriptions, and character dialogue. Include stage directions and visual descriptions for each panel.`;
    
    if (request.tone) {
      prompt += ` Tone: ${request.tone}.`;
    }
    
    return prompt;
  }

  /**
   * Parse generated script text into structured scenes
   */
  private parseGeneratedScript(scriptText: string): Array<{
    sceneNumber: number;
    setting: string;
    characters: string[];
    description: string;
    dialogue: Array<{ character: string; text: string }>;
  }> {
    // Simple parsing - in a real implementation, this would be more sophisticated
    const scenes = [];
    const lines = scriptText.split('\n').filter(line => line.trim());
    
    let currentScene = 1;
    let sceneDescription = "";
    let characters = new Set<string>();
    let dialogue = [];
    
    for (const line of lines) {
      if (line.toLowerCase().includes('scene') || line.toLowerCase().includes('page')) {
        if (sceneDescription) {
          scenes.push({
            sceneNumber: currentScene,
            setting: "Comic page",
            characters: Array.from(characters),
            description: sceneDescription,
            dialogue: dialogue,
          });
          currentScene++;
          sceneDescription = "";
          characters.clear();
          dialogue = [];
        }
      } else if (line.includes(':')) {
        // Likely dialogue
        const [character, text] = line.split(':', 2);
        if (character && text) {
          characters.add(character.trim());
          dialogue.push({
            character: character.trim(),
            text: text.trim(),
          });
        }
      } else {
        sceneDescription += line + " ";
      }
    }
    
    // Add the last scene if any content remains
    if (sceneDescription || dialogue.length > 0) {
      scenes.push({
        sceneNumber: currentScene,
        setting: "Comic page",
        characters: Array.from(characters),
        description: sceneDescription,
        dialogue: dialogue,
      });
    }
    
    return scenes;
  }
}

// Export singleton instance
export const geminiService = new GeminiService();