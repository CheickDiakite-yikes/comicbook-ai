import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";
import * as path from "path";
import { imageProcessor } from "./image-processor";
import { imageEnhancer } from "./image-enhancer";

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
  crossPageContext?: Array<{
    pageNumber: number;
    panels: Array<{
      panelNumber: number;
      prompt: string;
      imageUrl?: string;
    }>;
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
          
          // Process image to fit panel dimensions
          let finalImageUrl = `/generated/${filename}`;
          
          // Always try to enhance the image for better fitting
          try {
            // Determine panel dimensions
            let panelWidth = 400; // Default
            let panelHeight = 400; // Default
            
            if (request.panelContext?.dimensions) {
              panelWidth = request.panelContext.dimensions.width;
              panelHeight = request.panelContext.dimensions.height;
            } else {
              // Fallback: estimate from panel number and standard layouts
              console.log("No dimensions provided, using defaults for panel", request.panelId);
            }
            
            // Use the enhanced image processor for better results
            const enhancedImagePath = await imageEnhancer.fitImageToPanel(
              imagePath,
              panelWidth,
              panelHeight,
              Number(request.panelId)
            );
            
            // Extract just the filename from the processed path
            const enhancedFile = path.basename(enhancedImagePath);
            finalImageUrl = `/generated/${enhancedFile}`;
            console.log(`Image enhanced for panel ${request.panelId}: ${finalImageUrl}`);
            
          } catch (enhanceError) {
            console.error("Enhancement failed, trying basic processing:", enhanceError);
            
            // Fallback to basic processor
            if (request.panelContext?.dimensions) {
              try {
                const processedImagePath = await imageProcessor.processForComicPanel(
                  imagePath,
                  request.panelContext.dimensions.width,
                  request.panelContext.dimensions.height,
                  Number(request.panelId)
                );
                const processedFile = path.basename(processedImagePath);
                finalImageUrl = `/generated/${processedFile}`;
              } catch (processError) {
                console.error("All processing failed, using original:", processError);
              }
            }
          }
          
          return {
            imageUrl: finalImageUrl,
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
  async generatePanelBackground(request: {
    panelId: number;
    projectContext: GenerateImageRequest["projectContext"];
    panelContext?: GenerateImageRequest["panelContext"];
  }): Promise<GenerateImageResponse> {
    try {
      // Build background-specific prompt
      const backgroundPrompt = this.buildBackgroundPrompt(request);
      
      console.log(`Generating background for panel ${request.panelId} with prompt: ${backgroundPrompt}`);

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image-preview",
        contents: backgroundPrompt,
      });

      // Process response (same as generatePanelImage)
      if (!response.candidates || !response.candidates[0]?.content?.parts) {
        throw new Error("No valid response received from Gemini");
      }
      
      for (const part of response.candidates[0].content.parts) {
        if (part.text) {
          console.log("Generated background text:", part.text);
        } else if (part.inlineData) {
          const imageData = part.inlineData.data;
          if (!imageData) {
            throw new Error("No background image data received");
          }
          const buffer = Buffer.from(imageData, "base64");
          const filename = `background_${request.panelId}_${Date.now()}.png`;
          const imagePath = path.join(process.cwd(), "public", "generated", filename);
          
          // Ensure directory exists
          const dir = path.dirname(imagePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          
          fs.writeFileSync(imagePath, buffer);
          
          // Process image to fit panel dimensions
          let finalImageUrl = `/generated/${filename}`;
          
          // Always try to enhance the image for better fitting
          try {
            // Determine panel dimensions
            let panelWidth = 400; // Default
            let panelHeight = 400; // Default
            
            if (request.panelContext?.dimensions) {
              panelWidth = request.panelContext.dimensions.width;
              panelHeight = request.panelContext.dimensions.height;
            } else {
              // Fallback: estimate from panel number and standard layouts
              console.log("No dimensions provided, using defaults for panel", request.panelId);
            }
            
            // Use the enhanced image processor for better results
            const enhancedImagePath = await imageEnhancer.fitImageToPanel(
              imagePath,
              panelWidth,
              panelHeight,
              Number(request.panelId)
            );
            
            // Extract just the filename from the processed path
            const enhancedFile = path.basename(enhancedImagePath);
            finalImageUrl = `/generated/${enhancedFile}`;
            console.log(`Image enhanced for panel ${request.panelId}: ${finalImageUrl}`);
            
          } catch (enhanceError) {
            console.error("Enhancement failed, trying basic processing:", enhanceError);
            
            // Fallback to basic processor
            if (request.panelContext?.dimensions) {
              try {
                const processedImagePath = await imageProcessor.processForComicPanel(
                  imagePath,
                  request.panelContext.dimensions.width,
                  request.panelContext.dimensions.height,
                  Number(request.panelId)
                );
                const processedFile = path.basename(processedImagePath);
                finalImageUrl = `/generated/${processedFile}`;
              } catch (processError) {
                console.error("All processing failed, using original:", processError);
              }
            }
          }
          
          return {
            imageUrl: finalImageUrl,
            status: "completed",
            panelId: request.panelId,
            generationId: Date.now().toString(),
          };
        }
      }

      throw new Error("No background image data received from Gemini");
    } catch (error) {
      console.error("Error generating panel background:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate background";
      return {
        imageUrl: "",
        status: "failed",
        panelId: request.panelId,
        error: errorMessage,
      };
    }
  }

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
    storage?: any,
    layoutId?: string
  ): Promise<Array<GenerateImageResponse>> {
    const results: Array<GenerateImageResponse> = [];
    
    try {
      // Build cross-page context if currentPageId and storage are provided
      let crossPageContext: Array<{
        pageNumber: number;
        panels: Array<{
          panelNumber: number;
          prompt: string;
          imageUrl?: string;
        }>;
      }> = [];
      
      if (currentPageId && storage) {
        crossPageContext = await this.buildCrossPageContext(currentPageId, storage);
      }
      
      // Generate each panel sequentially to maintain consistency
      for (const panel of panelLayout) {
        const request: GenerateImageRequest = {
          prompt: panel.description,
          panelId: panel.panelNumber,
          projectContext,
          panelContext: panel.panelContext, // Pass the panel dimensions and aspect ratio!
          previousPanelsContext: results.map((r, index) => ({
            panelNumber: index + 1,
            prompt: panelLayout[index]?.description || "",
            imageUrl: r.imageUrl,
          })),
          crossPageContext,
        };

        const result = await this.generatePanelImage(request);
        results.push(result);
        
        // CRITICAL FIX: Save panel data to database after successful generation
        if (result.status === "completed" && currentPageId && storage) {
          try {
            // Check if panel already exists
            const existingPanels = await storage.getPagePanels(currentPageId);
            const existingPanel = existingPanels.find((p: any) => p.panelNumber === panel.panelNumber);
            
            if (existingPanel) {
              // Update existing panel
              await storage.updatePanel(existingPanel.id, {
                imageUrl: result.imageUrl,
                prompt: panel.description,
                isGenerated: true,
                generationStatus: "completed"
              });
              console.log(`Updated panel ${panel.panelNumber} in database`);
            } else {
              // Create new panel
              await storage.createPanel({
                pageId: currentPageId,
                panelNumber: panel.panelNumber,
                prompt: panel.description,
                imageUrl: result.imageUrl,
                isGenerated: true,
                generationStatus: "completed"
              });
              console.log(`Created new panel ${panel.panelNumber} in database`);
            }
          } catch (dbError) {
            console.error(`Failed to save panel ${panel.panelNumber} to database:`, dbError);
          }
        }

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
   * Build cross-page context by fetching previous pages and their panels
   */
  async buildCrossPageContext(
    currentPageId: string,
    storage: any
  ): Promise<Array<{
    pageNumber: number;
    panels: Array<{
      panelNumber: number;
      prompt: string;
      imageUrl?: string;
    }>;
  }>> {
    try {
      // Get the current page to find its project and page number
      const currentPage = await storage.getPage(currentPageId);
      if (!currentPage) {
        console.log("Current page not found, skipping cross-page context");
        return [];
      }

      // Get all pages in the project
      const allPages = await storage.getProjectPages(currentPage.projectId);
      if (!allPages || allPages.length <= 1) {
        console.log("No previous pages found, skipping cross-page context");
        return [];
      }

      // Sort pages by page number and filter out current and future pages
      const previousPages = allPages
        .filter((page: any) => page.pageNumber < currentPage.pageNumber)
        .sort((a: any, b: any) => a.pageNumber - b.pageNumber);

      if (previousPages.length === 0) {
        console.log("No previous pages found after filtering, skipping cross-page context");
        return [];
      }

      // Limit to last 3 pages to keep context manageable
      const recentPreviousPages = previousPages.slice(-3);

      console.log(`Building cross-page context from ${recentPreviousPages.length} previous pages`);

      // Build context for each previous page
      const crossPageContext = [];
      for (const page of recentPreviousPages) {
        try {
          const panels = await storage.getPagePanels(page.id);
          
          const pageContext = {
            pageNumber: page.pageNumber,
            panels: panels.map((panel: any) => ({
              panelNumber: panel.panelNumber,
              prompt: panel.prompt || `Panel ${panel.panelNumber}`, 
              imageUrl: panel.imageUrl,
            })),
          };
          
          crossPageContext.push(pageContext);
        } catch (error) {
          console.error(`Error fetching panels for page ${page.id}:`, error);
          // Continue with other pages even if one fails
        }
      }

      console.log(`Cross-page context built with ${crossPageContext.length} pages`);
      return crossPageContext;
    } catch (error) {
      console.error("Error building cross-page context:", error);
      return []; // Return empty context rather than failing
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
  private buildBackgroundPrompt(request: {
    panelId: number;
    projectContext: GenerateImageRequest["projectContext"];
    panelContext?: GenerateImageRequest["panelContext"];
  }): string {
    let prompt = "Generate a FULL-BLEED background artwork with NO borders, NO padding, NO white space. The background must extend completely edge-to-edge. Create a subtle comic panel background that sets the scene without being distracting. ";

    // Genre-based background suggestions
    if (request.projectContext.genre) {
      const genre = request.projectContext.genre.toLowerCase();
      if (genre.includes("romance")) {
        prompt += "Soft romantic setting with gentle flowers, gardens, or dreamy landscapes. ";
      } else if (genre.includes("adventure")) {
        prompt += "Epic landscape or terrain that suggests adventure and exploration. ";
      } else if (genre.includes("mystery")) {
        prompt += "Atmospheric background with shadows and intriguing environments. ";
      } else if (genre.includes("fantasy")) {
        prompt += "Magical or fantastical environment with ethereal elements. ";
      } else {
        prompt += "Appropriate environmental setting that matches the story mood. ";
      }
    }

    // Story context-based backgrounds
    if (request.projectContext.description) {
      const description = request.projectContext.description.toLowerCase();
      if (description.includes("bee")) {
        prompt += "Flower fields, meadows, or garden settings with soft natural elements. ";
      } else if (description.includes("city") || description.includes("urban")) {
        prompt += "Urban environments, city streets, or architectural backgrounds. ";
      } else if (description.includes("forest") || description.includes("nature")) {
        prompt += "Natural forest or woodland settings. ";
      }
    }

    // Art style context
    if (request.projectContext.artStyle) {
      prompt += `Rendered in ${request.projectContext.artStyle} art style. `;
    }

    // Panel composition context - with safe property access
    if (request.panelContext) {
      const aspectRatio = request.panelContext.aspectRatio;
      const panelType = request.panelContext.panelType;
      const dimensions = request.panelContext.dimensions;
      
      if (panelType === "page-background") {
        prompt += "Full comic page background composition, portrait orientation, suitable for comic book page layout. ";
      } else if (panelType === "wide-cinematic" || panelType === "wide") {
        prompt += "Wide cinematic background composition, panoramic view. ";
      } else if (panelType === "tall-vertical") {
        prompt += "Vertical background composition, suitable for portrait orientation. ";
      } else if (panelType === "square") {
        prompt += "Balanced square background composition. ";
      }
      
      // Add specific aspect ratio guidance for better image generation
      if (aspectRatio && typeof aspectRatio === 'number' && !isNaN(aspectRatio)) {
        if (panelType === "page-background") {
          prompt += `Portrait page format optimized for aspect ratio ${aspectRatio.toFixed(3)}:1 (comic book page proportions). `;
        } else {
          prompt += `Panel format optimized for aspect ratio ${aspectRatio.toFixed(2)}:1. `;
        }
      }
      
      // Add dimension context for better AI understanding
      if (dimensions && dimensions.width && dimensions.height) {
        prompt += `Target dimensions: ${dimensions.width}x${dimensions.height} pixels. `;
      }
    }

    // Quality and style instructions with edge-to-edge emphasis
    prompt += "Keep background subtle and atmospheric, not overpowering. No characters or foreground objects. Focus on environmental mood and atmosphere. ";
    prompt += "CRITICAL: Generate edge-to-edge artwork with NO white borders - fill the entire canvas completely. ";
    prompt += "High-quality comic book illustration style with full-bleed artwork.";

    return prompt;
  }

  private buildContextualPrompt(request: GenerateImageRequest): string {
    // Start with aspect ratio specifications - CRITICAL for proper panel fitting
    let prompt = "";
    
    if (request.panelContext?.aspectRatio) {
      const aspectRatio = request.panelContext.aspectRatio;
      
      // Convert decimal aspect ratio to readable format
      if (aspectRatio > 2.0) {
        prompt += `ULTRA-WIDE PANORAMIC IMAGE: Create an ultra-wide ${aspectRatio.toFixed(1)}:1 aspect ratio image. `;
      } else if (aspectRatio > 1.5) {
        prompt += `WIDE CINEMATIC IMAGE: Create a ${aspectRatio.toFixed(1)}:1 landscape aspect ratio image. `;
      } else if (aspectRatio > 1.2) {
        prompt += `LANDSCAPE IMAGE: Create a ${aspectRatio.toFixed(1)}:1 landscape format image. `;
      } else if (aspectRatio > 0.8) {
        prompt += `SQUARE FORMAT IMAGE: Create a 1:1 square aspect ratio image. `;
      } else if (aspectRatio > 0.6) {
        prompt += `PORTRAIT IMAGE: Create a ${(1/aspectRatio).toFixed(1)}:1 portrait format image. `;
      } else {
        prompt += `TALL VERTICAL IMAGE: Create a tall ${(1/aspectRatio).toFixed(1)}:1 vertical aspect ratio image. `;
      }
    }
    
    prompt += `FULL-BLEED comic panel artwork with NO white borders, NO padding, NO frames. `;
    prompt += `The artwork must completely fill the ${request.panelContext?.aspectRatio ? `${request.panelContext.aspectRatio.toFixed(1)}:1` : ''} format from edge to edge. `;
    
    prompt += `Create a high-quality comic panel illustration: ${request.prompt}`;

    // Add specific composition guidance based on panel shape
    if (request.panelContext) {
      const { aspectRatio, panelType } = request.panelContext;
      
      if (aspectRatio && aspectRatio > 1.5) {
        prompt += ". Use wide horizontal composition with elements spread across the frame. Position speech bubbles in the upper-center area to avoid cropping.";
      } else if (aspectRatio && aspectRatio < 0.8) {
        prompt += ". Use vertical composition with elements stacked vertically. Place speech bubbles in the upper third of the frame.";
      } else {
        prompt += ". Use balanced square composition with centered elements and speech bubbles in the upper-center area.";
      }
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

    // Add cross-page narrative context for continuity without panel numbering
    if (request.crossPageContext && request.crossPageContext.length > 0) {
      const narrativeContext = request.crossPageContext
        .map(page => {
          const panelSummaries = page.panels
            .map(panel => panel.prompt.replace(/^Panel \d+:\s*/i, ''))
            .join(", ");
          return `Previous page content: ${panelSummaries}`;
        })
        .join(". ");
      
      prompt += `. Previous story context: ${narrativeContext}`;
    }

    // Add professional composition instructions
    if (request.panelContext?.aspectRatio) {
      const aspectRatio = request.panelContext.aspectRatio;
      prompt += `. CRITICAL COMPOSITION: Design the entire artwork to perfectly fit ${aspectRatio.toFixed(2)}:1 aspect ratio with zero wasted space`;
      
      if (aspectRatio > 1.5) {
        prompt += ". Use WIDE ANGLE composition like a movie still - spread elements horizontally across the frame. Center speech bubbles to avoid edge cropping";
      } else if (aspectRatio < 0.8) {
        prompt += ". Use PORTRAIT composition with vertical stacking - arrange elements from top to bottom. Place dialogue in upper third";
      } else {
        prompt += ". Use BALANCED SQUARE composition - center main subjects with speech bubbles in safe zone";
      }
    }

    // Add consistency and quality instructions with speech bubble guidance
    prompt += ". Continue the narrative flow naturally from previous events. Maintain character visual consistency with previous panels";
    prompt += ". CRITICAL: Keep all speech bubbles, text, and important visual elements completely within the artwork";
    prompt += ". ABSOLUTELY NO WHITE BORDERS OR PADDING - the artwork must extend fully to all four edges (top, bottom, left, right)";
    prompt += ". Generate professional comic book artwork that bleeds to the edges like printed comics";
    prompt += ". Fill 100% of the canvas area with actual artwork, no empty space or borders";

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