import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";
import * as path from "path";
import { imageProcessor } from "./image-processor";
import { imageEnhancer } from "./image-enhancer";
import { ObjectStorageService } from "./objectStorage";

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
      alwaysTraits?: string;
      neverTraits?: string;
      colorScheme?: string;
    }>;
    settings?: Array<{
      name: string;
      description: string;
    }>;
    styleConsistencyRules?: string;
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

export interface GenerateStructuredScriptRequest {
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
  logline?: string;
}

export interface GenerateStructuredScriptResponse {
  title: string;
  logline: string;
  totalPages: number;
  overallMood: string;
  pages: Array<{
    pageNumber: number;
    title: string;
    overallMood: string;
    setting: string;
    characters: string[];
    narrative: string;
    panels: Array<{
      panelNumber: number;
      visualDescription: string;
      cameraAngle: string;
      shotType: string;
      mood: string;
      characterEmotions: { [character: string]: string };
      visualNotes: string;
      timing: string;
      soundEffects: string[];
      dialogue: Array<{
        characterName: string;
        text: string;
        tone: string;
        placement: string;
      }>;
    }>;
  }>;
}

// Legacy interfaces for backward compatibility
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
  private objectStorageService = new ObjectStorageService();

  /**
   * Helper function to save image buffer to object storage
   */
  private async saveImageToObjectStorage(buffer: Buffer, filename: string): Promise<string> {
    try {
      // Get upload URL from object storage
      const uploadUrl = await this.objectStorageService.getObjectEntityUploadURL();
      
      // Upload the image buffer to object storage
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        body: buffer,
        headers: {
          'Content-Type': 'image/png',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to upload to object storage: ${response.status}`);
      }
      
      // Extract the object path from the upload URL
      const normalizedPath = this.objectStorageService.normalizeObjectEntityPath(uploadUrl);
      console.log(`Image saved to object storage: ${normalizedPath}`);
      return normalizedPath;
    } catch (error) {
      console.error('Failed to save image to object storage:', error);
      throw error;
    }
  }

  /**
   * Helper function to clean up temporary files
   */
  private cleanupTempFile(tempPath: string): void {
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
        console.log(`Cleaned up temporary file: ${tempPath}`);
      }
    } catch (error) {
      console.error(`Failed to cleanup temp file ${tempPath}:`, error);
    }
  }
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
          
          // Save image to persistent object storage instead of local filesystem
          let finalImageUrl = await this.saveImageToObjectStorage(buffer, filename);
          
          // For image processing, we need a temporary local file
          const tempPath = path.join(process.cwd(), "temp", filename);
          const tempDir = path.dirname(tempPath);
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }
          fs.writeFileSync(tempPath, buffer);
          
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
              tempPath,
              panelWidth,
              panelHeight,
              Number(request.panelId)
            );
            
            // Extract just the filename from the processed path
            const enhancedFile = path.basename(enhancedImagePath);
            const enhancedBuffer = fs.readFileSync(enhancedImagePath);
            const enhancedFilename = `panel_${request.panelId}_enhanced_${Date.now()}.png`;
            finalImageUrl = await this.saveImageToObjectStorage(enhancedBuffer, enhancedFilename);
            console.log(`Image enhanced for panel ${request.panelId}: ${finalImageUrl}`);
            
          } catch (enhanceError) {
            console.error("Enhancement failed, trying basic processing:", enhanceError);
            
            // Fallback to basic processor
            if (request.panelContext?.dimensions) {
              try {
                const processedImagePath = await imageProcessor.processForComicPanel(
                  tempPath,
                  request.panelContext.dimensions.width,
                  request.panelContext.dimensions.height,
                  Number(request.panelId)
                );
                const processedBuffer = fs.readFileSync(processedImagePath);
                const processedFilename = `panel_${request.panelId}_processed_${Date.now()}.png`;
                finalImageUrl = await this.saveImageToObjectStorage(processedBuffer, processedFilename);
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
          
          // Save image to persistent object storage instead of local filesystem
          let finalImageUrl = await this.saveImageToObjectStorage(buffer, filename);
          
          // For image processing, we need a temporary local file
          const tempPath = path.join(process.cwd(), "temp", filename);
          const tempDir = path.dirname(tempPath);
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }
          fs.writeFileSync(tempPath, buffer);
          
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
              tempPath,
              panelWidth,
              panelHeight,
              Number(request.panelId)
            );
            
            // Extract just the filename from the processed path
            const enhancedFile = path.basename(enhancedImagePath);
            const enhancedBuffer = fs.readFileSync(enhancedImagePath);
            const enhancedFilename = `panel_${request.panelId}_enhanced_${Date.now()}.png`;
            finalImageUrl = await this.saveImageToObjectStorage(enhancedBuffer, enhancedFilename);
            console.log(`Image enhanced for panel ${request.panelId}: ${finalImageUrl}`);
            
          } catch (enhanceError) {
            console.error("Enhancement failed, trying basic processing:", enhanceError);
            
            // Fallback to basic processor
            if (request.panelContext?.dimensions) {
              try {
                const processedImagePath = await imageProcessor.processForComicPanel(
                  tempPath,
                  request.panelContext.dimensions.width,
                  request.panelContext.dimensions.height,
                  Number(request.panelId)
                );
                const processedBuffer = fs.readFileSync(processedImagePath);
                const processedFilename = `panel_${request.panelId}_processed_${Date.now()}.png`;
                finalImageUrl = await this.saveImageToObjectStorage(processedBuffer, processedFilename);
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
   * Generate cover art for a comic project
   */
  async generateCoverArt(request: {
    projectId: string;
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
  }): Promise<{
    imageUrl: string;
    status: "completed" | "failed";
    error?: string;
  }> {
    try {
      // Build cover art specific prompt
      const coverPrompt = this.buildCoverArtPrompt(request);
      
      console.log(`Generating cover art for project ${request.projectId} with prompt: ${coverPrompt}`);

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image-preview",
        contents: [coverPrompt],
      });

      // Process the response to extract image data
      if (!response.candidates || !response.candidates[0]?.content?.parts) {
        throw new Error("No valid response received from Gemini");
      }
      
      for (const part of response.candidates[0].content.parts) {
        if (part.text) {
          console.log("Generated cover art text:", part.text);
        } else if (part.inlineData) {
          // Save the image to a temporary location and return URL
          const imageData = part.inlineData.data;
          if (!imageData) {
            throw new Error("No cover art image data received");
          }
          const buffer = Buffer.from(imageData, "base64");
          const filename = `cover_${request.projectId}_${Date.now()}.png`;
          
          // Save image to persistent object storage instead of local filesystem
          let finalImageUrl = await this.saveImageToObjectStorage(buffer, filename);
          
          // For image processing, we need a temporary local file
          const tempPath = path.join(process.cwd(), "temp", filename);
          const tempDir = path.dirname(tempPath);
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }
          fs.writeFileSync(tempPath, buffer);
          
          try {
            // Use image enhancer to create proper cover art dimensions
            const enhancedImagePath = await imageEnhancer.fitImageToPanel(
              tempPath,
              800, // Cover width
              1200, // Cover height (2:3 aspect ratio)
              0 // Use 0 for cover art
            );
            
            // Extract just the filename from the processed path
            const enhancedFile = path.basename(enhancedImagePath);
            const enhancedBuffer = fs.readFileSync(enhancedImagePath);
            const enhancedFilename = `cover_${request.projectId}_enhanced_${Date.now()}.png`;
            finalImageUrl = await this.saveImageToObjectStorage(enhancedBuffer, enhancedFilename);
            console.log(`Cover art enhanced for project ${request.projectId}: ${finalImageUrl}`);
            
          } catch (enhanceError) {
            console.error("Cover art enhancement failed, using original:", enhanceError);
            // Keep the original URL if enhancement fails
          }
          
          return {
            imageUrl: finalImageUrl,
            status: "completed",
          };
        }
      }

      throw new Error("No cover art image data received from Gemini");
    } catch (error) {
      console.error("Error generating cover art:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate cover art";
      return {
        imageUrl: "",
        status: "failed",
        error: errorMessage,
      };
    }
  }

  /**
   * Generate a structured comic script with rich metadata
   */
  async generateStructuredScript(request: GenerateStructuredScriptRequest): Promise<GenerateStructuredScriptResponse> {
    try {
      const prompt = this.buildStructuredScriptPrompt(request);
      
      console.log("Generating structured script with prompt:", prompt);

      const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              title: { type: "string" },
              logline: { type: "string" },
              pages: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    pageNumber: { type: "number" },
                    title: { type: "string" },
                    setting: { type: "string" },
                    mood: { type: "string" },
                    characters: { type: "array", items: { type: "string" } },
                    narrative: { type: "string" },
                    panels: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          panelNumber: { type: "number" },
                          visualDescription: { type: "string" },
                          cameraAngle: { type: "string" },
                          shotType: { type: "string" },
                          mood: { type: "string" },
                          characterEmotions: { 
                            type: "object",
                            properties: {
                              character: { type: "string" },
                              emotion: { type: "string" }
                            }
                          },
                          visualNotes: { type: "string" },
                          timing: { type: "string" },
                          soundEffects: { type: "array", items: { type: "string" } },
                          dialogue: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                characterName: { type: "string" },
                                text: { type: "string" },
                                tone: { type: "string" },
                                placement: { type: "string" }
                              },
                              required: ["characterName", "text", "tone", "placement"]
                            }
                          }
                        },
                        required: ["panelNumber", "visualDescription"]
                      }
                    }
                  },
                  required: ["pageNumber", "title", "panels"]
                }
              }
            },
            required: ["title", "logline", "pages"]
          }
        },
        contents: prompt,
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("No response received from Gemini");
      }

      try {
        const structuredScript: GenerateStructuredScriptResponse = JSON.parse(responseText);
        
        // Validate and ensure we have at least some pages
        if (!structuredScript.pages || structuredScript.pages.length === 0) {
          throw new Error("No pages generated in structured script");
        }
        
        // Fill in missing required fields with defaults and ensure page count
        structuredScript.totalPages = structuredScript.pages?.length || 0;
        structuredScript.overallMood = structuredScript.overallMood || "engaging";
        
        structuredScript.pages = structuredScript.pages.map(page => ({
          ...page,
          overallMood: page.overallMood || "neutral",
          setting: page.setting || "Unknown location",
          characters: page.characters || [],
          narrative: page.narrative || "",
          panels: (page.panels || []).map(panel => ({
            ...panel,
            cameraAngle: panel.cameraAngle || "medium shot",
            shotType: panel.shotType || "establishing shot",
            mood: panel.mood || "neutral",
            characterEmotions: panel.characterEmotions || {},
            visualNotes: panel.visualNotes || "",
            timing: panel.timing || "moment",
            soundEffects: panel.soundEffects || [],
            dialogue: panel.dialogue || []
          }))
        }));
        
        console.log(`✅ AI generated ${structuredScript.pages.length} pages for structured script`);
        
        return structuredScript;
      } catch (parseError) {
        console.error("JSON parsing failed, attempting to extract partial data:", parseError);
        
        // Fallback: create a minimal valid response
        return {
          title: request.title || "Generated Comic Script",
          logline: request.logline || request.description || "A compelling comic story",
          totalPages: 1,
          overallMood: "neutral",
          pages: [{
            pageNumber: 1,
            title: "Opening Scene",
            overallMood: "neutral",
            setting: "Unknown location",
            characters: request.characters?.map(c => c.name) || [],
            narrative: "The story begins...",
            panels: [{
              panelNumber: 1,
              visualDescription: "Opening scene establishing the setting and introducing the main characters",
              cameraAngle: "wide shot",
              shotType: "establishing shot",
              mood: "neutral",
              characterEmotions: {},
              visualNotes: "Clear establishing shot",
              timing: "moment",
              soundEffects: [],
              dialogue: []
            }]
          }]
        };
      }
    } catch (error) {
      console.error("Error generating structured script:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      throw new Error("Failed to generate structured script: " + errorMessage);
    }
  }

  /**
   * Generate a comic script using Gemini's text generation (legacy)
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
    // Start with Google's native aspect ratio specifications for optimal generation
    let prompt = "";
    
    if (request.panelContext?.aspectRatio) {
      const aspectRatio = request.panelContext.aspectRatio;
      
      // Use Google's natively supported aspect ratios for best results
      if (Math.abs(aspectRatio - (16/9)) < 0.05) {
        prompt += `16:9 WIDESCREEN: Create a 16:9 widescreen aspect ratio image. `;
      } else if (Math.abs(aspectRatio - (4/3)) < 0.05) {
        prompt += `4:3 FULLSCREEN: Create a 4:3 fullscreen aspect ratio image. `;
      } else if (Math.abs(aspectRatio - 1.0) < 0.05) {
        prompt += `1:1 SQUARE: Create a 1:1 square aspect ratio image. `;
      } else if (Math.abs(aspectRatio - (3/4)) < 0.05) {
        prompt += `3:4 PORTRAIT: Create a 3:4 portrait aspect ratio image. `;
      } else if (Math.abs(aspectRatio - (9/16)) < 0.05) {
        prompt += `9:16 VERTICAL: Create a 9:16 tall portrait aspect ratio image. `;
      } else {
        // Fallback - map to closest Google ratio
        if (aspectRatio > 1.5) {
          prompt += `16:9 WIDESCREEN: Create a 16:9 widescreen aspect ratio image. `;
        } else if (aspectRatio > 1.1) {
          prompt += `4:3 FULLSCREEN: Create a 4:3 fullscreen aspect ratio image. `;
        } else if (aspectRatio > 0.9) {
          prompt += `1:1 SQUARE: Create a 1:1 square aspect ratio image. `;
        } else if (aspectRatio > 0.6) {
          prompt += `3:4 PORTRAIT: Create a 3:4 portrait aspect ratio image. `;
        } else {
          prompt += `9:16 VERTICAL: Create a 9:16 tall portrait aspect ratio image. `;
        }
      }
    }
    
    // CRITICAL TEXT SAFETY INSTRUCTIONS - MUST COME FIRST!
    prompt += `🎯 TEXT SAFE ZONE RULE: ALL speech bubbles and text MUST be positioned at least 15% away from ALL edges (top, bottom, left, right). Keep text in the CENTER 70% of the panel. Never place speech bubbles near panel boundaries! `;
    
    prompt += `FULL-BLEED comic panel artwork with NO white borders, NO padding, NO frames. `;
    prompt += `The artwork must completely fill the ${request.panelContext?.aspectRatio ? `${request.panelContext.aspectRatio.toFixed(1)}:1` : ''} format from edge to edge. `;
    
    prompt += `Create a high-quality comic panel illustration: ${request.prompt}`;

    // Add specific composition guidance based on panel shape with enhanced text placement
    if (request.panelContext) {
      const { aspectRatio, panelType } = request.panelContext;
      
      if (aspectRatio && aspectRatio > 1.5) {
        prompt += ". WIDE PANEL: Use horizontal composition. 🔴 CRITICAL: Position ALL speech bubbles in the CENTER horizontal strip (avoid left/right edges). Place text in the MIDDLE 60% of the panel width.";
      } else if (aspectRatio && aspectRatio < 0.8) {
        prompt += ". TALL PANEL: Use vertical composition. 🔴 CRITICAL: Position ALL speech bubbles in the CENTER vertical area (avoid top/bottom edges). Keep text in the MIDDLE 60% of the panel height.";
      } else {
        prompt += ". SQUARE PANEL: Use balanced composition. 🔴 CRITICAL: Position ALL speech bubbles in the CENTER SAFE ZONE - at least 20% away from all four edges.";
      }
    }

    // Add detailed art style context with consistency rules
    if (request.projectContext.artStyle) {
      prompt += `, in CONSISTENT ${request.projectContext.artStyle} art style`;
      prompt += `. STYLE CONSISTENCY: Use the EXACT same art style, line weight, shading technique, and color palette across ALL panels. Maintain consistent artistic rendering throughout.`;
    }

    // Add detailed character context for consistency - ENHANCED VERSION
    if (request.projectContext.characters && request.projectContext.characters.length > 0) {
      const characterProfiles = request.projectContext.characters
        .map(char => {
          let profile = `${char.name} (${char.role})`;
          if (char.visualDescriptors) {
            profile += `: EXACT APPEARANCE - ${char.visualDescriptors}`;
          }
          if (char.alwaysTraits) {
            profile += `. ALWAYS: ${char.alwaysTraits}`;
          }
          if (char.neverTraits) {
            profile += `. NEVER: ${char.neverTraits}`;
          }
          if (char.colorScheme) {
            profile += `. COLOR SCHEME: ${char.colorScheme}`;
          }
          return profile;
        })
        .join(" | ");
      
      prompt += `. CHARACTER CONSISTENCY RULES - ${characterProfiles}`;
      prompt += `. CRITICAL: These characters MUST maintain EXACT same appearance in every panel - same face, hair color, hair style, body type, and clothing style.`;
    }
    
    // Fallback to old character context if new one isn't available
    else if (request.characterContext && request.characterContext.length > 0) {
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

    // Add cross-page narrative and visual context for continuity
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
      prompt += `. VISUAL CONTINUITY: Characters and settings established in previous pages MUST maintain their exact appearance. Reference the visual style and character looks from earlier panels.`;
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

    // Add consistency and quality instructions with ENHANCED speech bubble guidance
    prompt += ". Continue the narrative flow naturally from previous events.";
    prompt += " CHARACTER CONSISTENCY IS CRITICAL: Every character MUST look EXACTLY the same across all panels - same facial features, same hair color and style, same body proportions, same clothing style (unless story requires a change).";
    prompt += " ARTISTIC CONSISTENCY: Maintain the EXACT same art style, drawing technique, line thickness, and color saturation throughout all panels. No style changes between panels.";
    prompt += ". 🚨 SPEECH BUBBLE PLACEMENT RULES: 1) Keep ALL text 15% away from edges 2) Center speech bubbles in SAFE ZONES 3) Use the middle 70% of panel area for text 4) Never cut off words or speech bubbles";
    prompt += ". ABSOLUTELY NO WHITE BORDERS OR PADDING - the artwork must extend fully to all four edges (top, bottom, left, right)";
    prompt += ". Generate professional comic book artwork that bleeds to the edges like printed comics";
    prompt += ". Fill 100% of the canvas area with actual artwork, no empty space or borders";

    return prompt;
  }

  /**
   * Build a cover art generation prompt
   */
  private buildCoverArtPrompt(request: {
    projectId: string;
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
  }): string {
    let prompt = `2:3 PORTRAIT: Create a 2:3 portrait aspect ratio comic book cover. `;
    
    // Core comic book cover requirements
    prompt += `Design a professional comic book cover for "${request.projectContext.title}". `;
    prompt += `This is a high-quality comic book cover in ${request.projectContext.artStyle || 'comic book'} art style. `;
    
    // Genre-specific styling
    if (request.projectContext.genre) {
      prompt += `Genre: ${request.projectContext.genre}. `;
      
      switch (request.projectContext.genre.toLowerCase()) {
        case 'superhero':
          prompt += `Dynamic superhero comic cover with bold action pose, dramatic lighting, and powerful composition. `;
          break;
        case 'horror':
          prompt += `Dark, atmospheric horror comic cover with moody shadows, dramatic lighting, and suspenseful composition. `;
          break;
        case 'romance':
          prompt += `Romantic comic cover with warm lighting, intimate composition, and emotional visual storytelling. `;
          break;
        case 'sci-fi':
          prompt += `Science fiction comic cover with futuristic elements, technological details, and cosmic atmosphere. `;
          break;
        case 'fantasy':
          prompt += `Fantasy comic cover with magical elements, mystical atmosphere, and enchanting composition. `;
          break;
        case 'mystery':
          prompt += `Mystery comic cover with intriguing shadows, suspenseful lighting, and dramatic noir atmosphere. `;
          break;
        default:
          prompt += `Genre-appropriate comic cover with engaging visual storytelling and dynamic composition. `;
      }
    }
    
    // Story context
    if (request.projectContext.description) {
      prompt += `Story concept: ${request.projectContext.description}. `;
    }
    
    // Character focus for cover
    if (request.projectContext.characters && request.projectContext.characters.length > 0) {
      const mainCharacters = request.projectContext.characters.slice(0, 3); // Focus on up to 3 main characters
      prompt += `Main characters for the cover: `;
      
      mainCharacters.forEach((char, index) => {
        prompt += `${char.name} (${char.role})${char.visualDescriptors ? `: ${char.visualDescriptors}` : ': ' + char.bio}`;
        if (index < mainCharacters.length - 1) prompt += `, `;
      });
      prompt += `. `;
      
      // Focus on the main character
      const mainChar = mainCharacters[0];
      prompt += `Feature ${mainChar.name} prominently as the central figure of the cover. `;
    }
    
    // Setting/environment context
    if (request.projectContext.settings && request.projectContext.settings.length > 0) {
      const mainSetting = request.projectContext.settings[0];
      prompt += `Background setting: ${mainSetting.name} - ${mainSetting.description}. `;
      prompt += `Incorporate elements of this setting into the background composition. `;
    }
    
    // Cover design requirements
    prompt += `COVER DESIGN REQUIREMENTS: `;
    prompt += `- Leave space at the TOP for the comic title "${request.projectContext.title}" `;
    prompt += `- Leave space at the BOTTOM for creator names and issue information `;
    prompt += `- Focus the main character(s) in the CENTER-LEFT or CENTER-RIGHT area `;
    prompt += `- Use dynamic poses and compelling composition that tells a story `;
    prompt += `- Include dramatic lighting and visual impact `;
    prompt += `- Create depth with foreground, midground, and background elements `;
    prompt += `- Use colors that support the genre and mood `;
    prompt += `- Ensure the cover is eye-catching and would stand out on a comic shelf `;
    
    // Technical requirements
    prompt += `TECHNICAL REQUIREMENTS: `;
    prompt += `- FULL-BLEED artwork with NO white borders - fill the entire 2:3 canvas completely `;
    prompt += `- High-quality professional comic book cover art `;
    prompt += `- Rich colors, detailed linework, and professional comic book illustration style `;
    prompt += `- Ensure artwork extends to all edges like a printed comic book cover `;
    prompt += `- 2:3 aspect ratio (portrait orientation) optimized composition `;
    
    return prompt;
  }

  /**
   * Build a structured script generation prompt with rich metadata
   */
  private buildStructuredScriptPrompt(request: GenerateStructuredScriptRequest): string {
    let prompt = `You are an expert comic book script writer. Create a highly detailed, structured comic book script with rich metadata for optimal AI comic generation.

STORY BRIEF:
- Title: "${request.title}"
- Genre: ${request.genre || "General"}
- Description: ${request.description}
- ${request.logline ? `Logline: ${request.logline}` : ''}
- Tone: ${request.tone || "Engaging and visual"}

CHARACTERS:`;

    request.characters.forEach(char => {
      prompt += `\n- ${char.name} (${char.role}): ${char.bio}`;
    });

    prompt += `\n\nSETTINGS:`;
    request.settings.forEach(setting => {
      prompt += `\n- ${setting.name}: ${setting.description}`;
    });

    prompt += `\n\nPRODUCE A STRUCTURED SCRIPT WITH:

1. Script Metadata:
   - Compelling logline
   - Overall mood and tone
   - Optimal page count (analyze story complexity and determine appropriate length: minimum 6 pages, typically 6-30+ pages depending on story scope, genre conventions, and narrative pacing needs)

2. Page-by-Page Breakdown:
   - Each page should have 1-5 panels for optimal comic pacing
   - Page title and overall mood
   - Setting and characters present
   - Brief narrative description

3. Panel-Level Details (CRITICAL for AI generation):
   - Panel numbering: Number panels sequentially within each page (1, 2, 3, 4, 5, 6)
   - Visual description (detailed, specific, visual)
   - Camera angle (close-up, medium shot, wide shot, bird's eye, worm's eye, over-shoulder, etc.)
   - Shot type (establishing shot, action shot, reaction shot, dramatic shot, etc.)
   - Mood and atmosphere
   - Character emotions for each character in the panel
   - Visual notes (lighting, composition, special effects)
   - Timing (beat, pause, moment, action)
   - Sound effects (if any)

4. Dialogue Specifications:
   - Character name
   - Dialogue text
   - Tone (excited, whispered, shouting, thoughtful, etc.)
   - Placement (top-left, center, bottom-right, off-panel, etc.)

GUIDELINES:
- CRITICAL: Number panels sequentially within each page starting from 1 (Panel 1, Panel 2, Panel 3, etc.)
- **PAGE COUNT DETERMINATION**: Analyze story needs - simple concepts (6-12 pages), complex plots (12-20 pages), epic stories (20-30+ pages). Consider genre: Action/Superhero (more pages for fights), Romance/Slice-of-life (fewer pages for character moments), Horror/Mystery (medium length for tension building).
- Make visual descriptions extremely detailed and specific
- Include concrete visual elements AI can understand
- Specify camera work like a film director
- Consider panel-to-panel flow and transitions
- Balance action, dialogue, and emotional beats
- Ensure each panel has clear visual focus
- Include environmental details and character positioning

Create a script that tells a complete, satisfying story with strong visual storytelling, memorable characters, and emotional impact. Focus on creating vivid, specific imagery that AI can translate into compelling comic panels.`;

    return prompt;
  }

  /**
   * Build a prompt for script generation (legacy)
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
    
    const pageCount = request.pageCount || 12;
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

  /**
   * Generate a complete story with title, description, characters, and script
   */
  async generateCompleteStory(request: {
    genres: string[];
    length: string;
    artStyle: string;
    tones: string[];
  }): Promise<{
    title: string;
    genre: string;
    description: string;
    characters: Array<{
      name: string;
      role: string;
      bio: string;
      visualDescriptors: string;
    }>;
    structuredScript: any;
  }> {
    try {
      // Map length to page count
      const pageCounts = {
        short: Math.floor(Math.random() * 7) + 6,  // 6-12 pages
        medium: Math.floor(Math.random() * 9) + 12, // 12-20 pages
        epic: Math.floor(Math.random() * 11) + 20   // 20-30 pages
      };
      
      const pageCount = pageCounts[request.length as keyof typeof pageCounts] || 12;
      
      // For epic stories, use chunked generation to avoid timeouts
      if (request.length === 'epic' && pageCount > 15) {
        console.log(`🎨 Epic story detected (${pageCount} pages) - using chunked generation...`);
        return await this.generateEpicStoryInChunks(request, pageCount);
      }
      
      const prompt = `You are an expert storyteller and comic creator. Generate a complete, original comic story concept with all necessary details.

REQUIREMENTS:
- Genres: ${request.genres.join(" + ")} (blend these thoughtfully)
- Length: ${request.length} story (${pageCount} pages)
- Art Style: ${request.artStyle}
- Tones: ${request.tones.join(" + ")} (blend these emotional elements)

CREATE A COMPLETE STORY PACKAGE INCLUDING:

1. TITLE: Creative, memorable title that captures the genre blend
2. BLENDED GENRE: How the ${request.genres.join(" and ")} elements work together
3. STORY DESCRIPTION: 2-3 paragraph compelling synopsis that hooks readers
4. MAIN CHARACTERS: 3-4 well-developed characters with:
   - Name and role
   - Personality and background
   - Visual description (appearance, clothing, distinctive features)
   - Character motivations and goals

5. COMPLETE STRUCTURED SCRIPT: ${pageCount} pages of detailed comic script with:
   - Page-by-page breakdown
   - Panel descriptions (2-5 panels per page)
   - Character dialogue with emotion
   - Visual notes and camera angles
   - Sound effects where appropriate

STORYTELLING GUIDELINES:
- Create compelling character arcs and conflicts
- Include genre-appropriate elements (${request.genres.join(", ")})
- Blend the ${request.tones.join(", ")} tones throughout the narrative
- Design for ${request.artStyle} visual style
- Ensure ${pageCount} pages tell a complete, satisfying story
- Include strong opening, development, climax, and resolution

Generate a professional-quality story concept that comic creators would be excited to produce.`;

      console.log("🎨 Generating complete story with Gemini Pro...");

      const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              title: { type: "string" },
              genre: { type: "string" },
              description: { type: "string" },
              characters: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    role: { type: "string" },
                    bio: { type: "string" },
                    visualDescriptors: { type: "string" }
                  },
                  required: ["name", "role", "bio", "visualDescriptors"]
                }
              },
              structuredScript: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  logline: { type: "string" },
                  pages: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        pageNumber: { type: "number" },
                        title: { type: "string" },
                        setting: { type: "string" },
                        overallMood: { type: "string" },
                        characters: { type: "array", items: { type: "string" } },
                        narrative: { type: "string" },
                        panels: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              panelNumber: { type: "number" },
                              visualDescription: { type: "string" },
                              cameraAngle: { type: "string" },
                              shotType: { type: "string" },
                              mood: { type: "string" },
                              visualNotes: { type: "string" },
                              timing: { type: "string" },
                              soundEffects: { type: "array", items: { type: "string" } },
                              dialogue: {
                                type: "array",
                                items: {
                                  type: "object",
                                  properties: {
                                    characterName: { type: "string" },
                                    text: { type: "string" },
                                    tone: { type: "string" },
                                    placement: { type: "string" }
                                  },
                                  required: ["characterName", "text", "tone", "placement"]
                                }
                              }
                            },
                            required: ["panelNumber", "visualDescription", "cameraAngle", "shotType", "mood"]
                          }
                        }
                      },
                      required: ["pageNumber", "title", "setting", "overallMood", "panels"]
                    }
                  }
                },
                required: ["title", "logline", "pages"]
              }
            },
            required: ["title", "genre", "description", "characters", "structuredScript"]
          }
        },
        contents: prompt,
      });

      const completeStory = response.text;
      if (!completeStory) {
        throw new Error("Empty response from Gemini API");
      }

      console.log("✅ Complete story generated successfully");
      return JSON.parse(completeStory);
    } catch (error) {
      console.error("🔥 Error generating complete story:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      throw new Error("Failed to generate complete story: " + errorMessage);
    }
  }

  /**
   * Generate epic stories in chunks to avoid API timeouts
   */
  private async generateEpicStoryInChunks(request: {
    genres: string[];
    length: string;
    artStyle: string;
    tones: string[];
  }, totalPages: number): Promise<{
    title: string;
    genre: string;
    description: string;
    characters: Array<{
      name: string;
      role: string;
      bio: string;
      visualDescriptors: string;
    }>;
    structuredScript: any;
  }> {
    // First, generate the story concept and characters (lightweight)
    const conceptPrompt = `You are an expert storyteller. Generate a complete comic story concept (NO SCRIPT YET):

REQUIREMENTS:
- Genres: ${request.genres.join(" + ")} (blend these thoughtfully)
- Length: ${request.length} story (${totalPages} pages total)
- Art Style: ${request.artStyle}
- Tones: ${request.tones.join(" + ")} (blend these emotional elements)

GENERATE ONLY:
1. TITLE: Creative, memorable title that captures the genre blend
2. BLENDED GENRE: How the ${request.genres.join(" and ")} elements work together
3. STORY DESCRIPTION: 2-3 paragraph compelling synopsis that hooks readers
4. MAIN CHARACTERS: 3-4 well-developed characters with:
   - Name and role
   - Personality and background
   - Visual description (appearance, clothing, distinctive features)
   - Character motivations and goals

NO SCRIPT - Just the concept foundation for a ${totalPages}-page story.`;

    console.log("🎨 Step 1: Generating story concept and characters...");

    const conceptResponse = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            title: { type: "string" },
            genre: { type: "string" },
            description: { type: "string" },
            characters: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  role: { type: "string" },
                  bio: { type: "string" },
                  visualDescriptors: { type: "string" }
                },
                required: ["name", "role", "bio", "visualDescriptors"]
              }
            }
          },
          required: ["title", "genre", "description", "characters"]
        }
      },
      contents: conceptPrompt,
    });

    const storyConceptText = conceptResponse.text;
    if (!storyConceptText) {
      throw new Error("Failed to generate story concept");
    }

    const storyConcept = JSON.parse(storyConceptText);
    console.log(`✅ Story concept generated: "${storyConcept.title}"`);

    // Now generate the script in chunks (6-8 pages per chunk to avoid timeouts)
    const chunkSize = 6;
    const chunks: any[] = [];
    
    for (let startPage = 1; startPage <= totalPages; startPage += chunkSize) {
      const endPage = Math.min(startPage + chunkSize - 1, totalPages);
      const isFirstChunk = startPage === 1;
      const isLastChunk = endPage === totalPages;

      console.log(`🎨 Step 2: Generating pages ${startPage}-${endPage} of ${totalPages}...`);

      const scriptPrompt = `You are an expert comic script writer. Generate pages ${startPage}-${endPage} of a ${totalPages}-page comic script.

STORY CONCEPT:
- Title: ${storyConcept.title}
- Genre: ${storyConcept.genre}
- Description: ${storyConcept.description}
- Characters: ${storyConcept.characters.map((c: any) => `${c.name} (${c.role}): ${c.bio}`).join(", ")}

SCRIPT REQUIREMENTS for pages ${startPage}-${endPage}:
${isFirstChunk ? "- OPENING: Strong hook and character introductions" : ""}
${isLastChunk ? "- CLIMAX & RESOLUTION: Satisfying conclusion" : ""}
${!isFirstChunk && !isLastChunk ? `- DEVELOPMENT: Continue story arc from page ${startPage}` : ""}

Generate ONLY pages ${startPage}-${endPage} with:
- Page-by-page breakdown
- Panel descriptions (2-5 panels per page)
- Character dialogue with emotion
- Visual notes and camera angles
- Sound effects where appropriate

Ensure story continuity and ${request.tones.join(" + ")} tones.`;

      const scriptResponse = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              pages: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    pageNumber: { type: "number" },
                    title: { type: "string" },
                    setting: { type: "string" },
                    overallMood: { type: "string" },
                    characters: { type: "array", items: { type: "string" } },
                    narrative: { type: "string" },
                    panels: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          panelNumber: { type: "number" },
                          visualDescription: { type: "string" },
                          cameraAngle: { type: "string" },
                          shotType: { type: "string" },
                          mood: { type: "string" },
                          visualNotes: { type: "string" },
                          timing: { type: "string" },
                          soundEffects: { type: "array", items: { type: "string" } },
                          dialogue: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                characterName: { type: "string" },
                                text: { type: "string" },
                                tone: { type: "string" },
                                placement: { type: "string" }
                              },
                              required: ["characterName", "text", "tone", "placement"]
                            }
                          }
                        },
                        required: ["panelNumber", "visualDescription", "cameraAngle", "shotType", "mood"]
                      }
                    }
                  },
                  required: ["pageNumber", "title", "setting", "overallMood", "panels"]
                }
              }
            },
            required: ["pages"]
          }
        },
        contents: scriptPrompt,
      });

      const chunkText = scriptResponse.text;
      if (!chunkText) {
        throw new Error(`Failed to generate script chunk ${startPage}-${endPage}`);
      }

      const chunkData = JSON.parse(chunkText);
      chunks.push(...chunkData.pages);
      
      console.log(`✅ Generated pages ${startPage}-${endPage} (${chunkData.pages.length} pages)`);

      // Small delay between chunks to be nice to the API
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Combine all chunks into final structured script
    const structuredScript = {
      title: storyConcept.title,
      logline: storyConcept.description,
      pages: chunks
    };

    console.log(`✅ Epic story complete: ${chunks.length} pages generated in chunks`);

    return {
      title: storyConcept.title,
      genre: storyConcept.genre,
      description: storyConcept.description,
      characters: storyConcept.characters,
      structuredScript
    };
  }
}

// Export singleton instance
export const geminiService = new GeminiService();