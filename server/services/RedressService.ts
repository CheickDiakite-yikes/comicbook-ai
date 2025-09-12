import { randomUUID } from "crypto";
import { ObjectStorageService } from "../objectStorage";
import { storage } from "../storage";
import type { RedressJob, InsertRedressJob, RedressRequest, RedressResponse, StoryContext } from "@shared/schema";
import { contextPromptBuilder, type OutfitSpecification, type CharacterData, type ContextualOutfitSuggestion } from "./ContextPromptBuilder";

export interface ProcessingStep {
  step: string;
  status: "pending" | "processing" | "completed" | "failed";
  message?: string;
  timestamp?: Date;
}

export interface RedressJobData {
  jobId: string;
  userId: string;
  panelId: string;
  originalImageUrl: string;
  characterIds: string[];
  outfitSpecs: any;
  isPreview: boolean;
  strength: number;
}

// Provider interfaces for extensibility
export interface FaceRecognitionProvider {
  comparefaces(referenceImageUrl: string, targetImageUrl: string): Promise<{
    confidence: number;
    boundingBox: { left: number; top: number; width: number; height: number };
  }>;
  detectPeople(imageUrl: string): Promise<Array<{
    confidence: number;
    boundingBox: { left: number; top: number; width: number; height: number };
  }>>;
}

export interface ClothingMaskProvider {
  generateClothingMask(imageUrl: string, targetRegion: string): Promise<{
    maskUrl: string;
    segmentedRegions: string[];
  }>;
}

export interface InpaintingProvider {
  inpaint(params: {
    imageUrl: string;
    maskUrl: string;
    prompt: string;
    negativePrompt?: string;
    strength: number;
    preserveIdentity?: boolean;
  }): Promise<{
    resultUrl: string;
    confidence: number;
  }>;
}

// Mock providers - will be replaced with real implementations
class MockFaceRecognitionProvider implements FaceRecognitionProvider {
  async comparefaces(referenceImageUrl: string, targetImageUrl: string) {
    // Mock implementation - would use AWS Rekognition or similar
    await new Promise(resolve => setTimeout(resolve, 1000));
    return {
      confidence: 0.95,
      boundingBox: { left: 0.2, top: 0.1, width: 0.3, height: 0.4 }
    };
  }

  async detectPeople(imageUrl: string) {
    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 500));
    return [{
      confidence: 0.9,
      boundingBox: { left: 0.1, top: 0.05, width: 0.8, height: 0.85 }
    }];
  }
}

class MockClothingMaskProvider implements ClothingMaskProvider {
  async generateClothingMask(imageUrl: string, targetRegion: string) {
    // Mock implementation - would use human parsing model
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Create a placeholder mask image that will trigger the fallback SVG system
    // This ensures the URL exists and serves proper placeholder content
    const timestamp = Date.now();
    const mockMaskUrl = `/generated/mask_${targetRegion}_${timestamp}.png`;
    
    return {
      maskUrl: mockMaskUrl,
      segmentedRegions: ["upper_clothes", "lower_clothes"]
    };
  }
}

class MockInpaintingProvider implements InpaintingProvider {
  async inpaint(params: {
    imageUrl: string;
    maskUrl: string;
    prompt: string;
    negativePrompt?: string;
    strength: number;
    preserveIdentity?: boolean;
  }) {
    // Mock implementation - would use SDXL inpainting
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Create a placeholder result image that will trigger the fallback SVG system
    // This ensures the URL exists and serves proper placeholder content
    const timestamp = Date.now();
    const mockResultUrl = `/generated/redress_result_${timestamp}.png`;
    
    return {
      resultUrl: mockResultUrl,
      confidence: 0.88
    };
  }
}

export class RedressService {
  private faceRecognition: FaceRecognitionProvider;
  private clothingMask: ClothingMaskProvider;
  private inpainting: InpaintingProvider;
  private objectStorage: ObjectStorageService;
  private activeJobs: Map<string, RedressJobData> = new Map();

  constructor() {
    // Initialize providers - would use real providers in production
    this.faceRecognition = new MockFaceRecognitionProvider();
    this.clothingMask = new MockClothingMaskProvider();
    this.inpainting = new MockInpaintingProvider();
    this.objectStorage = new ObjectStorageService();
  }

  async createRedressJob(
    userId: string,
    panelId: string,
    request: RedressRequest
  ): Promise<RedressResponse> {
    
    try {
      // Get panel data
      const panel = await storage.getPanel(panelId);
      if (!panel) {
        throw new Error("Panel not found");
      }

      // Verify panel has an image
      if (!panel.imageUrl) {
        throw new Error("Panel has no image to redress");
      }

      // Get character data for context
      const characters = await Promise.all(
        request.characters.map(async (char) => {
          const character = await storage.getCharacter(char.characterId);
          if (!character) {
            throw new Error(`Character ${char.characterId} not found`);
          }
          return character;
        })
      );

      // Gather story context data if not provided in request
      const storyContext = request.context || await this.gatherStoryContext(panelId, request.characters.map(c => c.characterId));

      // Create initial job record
      const jobData: InsertRedressJob = {
        userId,
        panelId,
        status: "queued",
        originalImageUrl: panel.imageUrl,
        characterIds: request.characters.map(c => c.characterId),
        outfitSpecs: request.outfit,
        isPreview: request.preview,
        strength: request.strength,
        progress: 0,
        processingSteps: [
          { step: "face_recognition", status: "pending" },
          { step: "clothing_mask", status: "pending" },
          { step: "inpainting", status: "pending" },
          { step: "finalization", status: "pending" }
        ]
      };

      // Store job in database
      const savedJob = await storage.createRedressJob(jobData);
      const actualJobId = savedJob.id; // Use the actual database-generated job ID
      console.log("🎭 Created redress job in database:", actualJobId);

      // Store active job data for processing (for current session only)
      this.activeJobs.set(actualJobId, {
        jobId: actualJobId,
        userId,
        panelId,
        originalImageUrl: panel.imageUrl,
        characterIds: request.characters.map(c => c.characterId),
        outfitSpecs: request.outfit,
        isPreview: request.preview,
        strength: request.strength
      });

      // Start processing asynchronously
      this.processRedressJob(actualJobId, jobData, characters, request, storyContext)
        .catch(error => {
          console.error("🎭 Redress job failed:", actualJobId, error);
          this.updateJobStatus(actualJobId, "failed", 0, error.message);
        });

      return {
        jobId: actualJobId,
        status: "queued",
        progress: 0,
        processingSteps: jobData.processingSteps as ProcessingStep[]
      };

    } catch (error) {
      console.error("🎭 Failed to create redress job:", error);
      throw error;
    }
  }

  async getJobStatus(jobId: string): Promise<RedressResponse | null> {
    // Fetch job from database
    const dbJob = await storage.getRedressJob(jobId);
    if (!dbJob) {
      return null;
    }

    // Convert database job to response format
    return {
      jobId: dbJob.id,
      status: dbJob.status as "queued" | "processing" | "completed" | "failed",
      progress: dbJob.progress || 0,
      previewUrl: dbJob.previewImageUrl || undefined,
      finalUrl: dbJob.finalImageUrl || undefined,
      errorMessage: dbJob.errorMessage || undefined,
      processingSteps: (dbJob.processingSteps as any[]) || [],
      metadata: (dbJob.metadata as any) || undefined
    };
  }

  private async processRedressJob(
    jobId: string,
    jobData: InsertRedressJob,
    characters: any[],
    request: RedressRequest,
    storyContext?: StoryContext
  ) {
    try {
      console.log("🎭 Starting redress job processing:", jobId);
      
      // Step 1: Face Recognition
      await this.updateJobStatus(jobId, "processing", 10);
      await this.updateProcessingStep(jobId, "face_recognition", "processing");
      
      const faceMatches = await this.performFaceRecognition(
        jobData.originalImageUrl, 
        request.characters
      );
      
      await this.updateProcessingStep(jobId, "face_recognition", "completed");
      console.log("🎭 Face recognition completed:", faceMatches);

      // Step 2: Clothing Mask Generation
      await this.updateJobStatus(jobId, "processing", 40);
      await this.updateProcessingStep(jobId, "clothing_mask", "processing");
      
      const clothingMask = await this.generateClothingMask(
        jobData.originalImageUrl,
        request.outfit.type
      );
      
      await this.updateProcessingStep(jobId, "clothing_mask", "completed");
      console.log("🎭 Clothing mask generated:", clothingMask);

      // Step 3: AI Inpainting
      await this.updateJobStatus(jobId, "processing", 70);
      await this.updateProcessingStep(jobId, "inpainting", "processing");
      
      const inpaintResult = await this.performInpainting(
        jobData.originalImageUrl,
        clothingMask.maskUrl,
        characters,
        request.outfit,
        request.strength,
        storyContext
      );
      
      await this.updateProcessingStep(jobId, "inpainting", "completed");
      console.log("🎭 Inpainting completed:", inpaintResult);

      // Step 4: Finalization
      await this.updateJobStatus(jobId, "processing", 90);
      await this.updateProcessingStep(jobId, "finalization", "processing");
      
      // Save result and update panel
      const finalImageUrl = await this.saveResultImage(inpaintResult.resultUrl, jobId);
      
      // Add to panel revisions only for non-preview jobs
      if (!jobData.isPreview) {
        await this.addPanelRevision(jobData.panelId, {
          previousImageUrl: jobData.originalImageUrl,
          newImageUrl: finalImageUrl,
          revisionType: "redress",
          metadata: {
            jobId,
            outfit: request.outfit,
            characters: request.characters,
            strength: request.strength
          }
        });
      }

      await this.updateProcessingStep(jobId, "finalization", "completed");
      await this.updateJobStatus(jobId, "completed", 100, undefined, finalImageUrl);
      
      console.log("🎭 Redress job completed successfully:", jobId);

    } catch (error) {
      console.error("🎭 Redress job processing failed:", jobId, error);
      await this.updateJobStatus(jobId, "failed", 0, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private async performFaceRecognition(imageUrl: string, characters: any[]) {
    const results = [];
    
    for (const character of characters) {
      if (character.referenceImageUrl) {
        const match = await this.faceRecognition.comparefaces(
          character.referenceImageUrl,
          imageUrl
        );
        results.push({
          characterId: character.characterId,
          confidence: match.confidence,
          boundingBox: match.boundingBox
        });
      }
    }

    // Fallback to person detection if no face matches
    if (results.length === 0) {
      const people = await this.faceRecognition.detectPeople(imageUrl);
      results.push(...people.map(person => ({
        characterId: "unknown",
        confidence: person.confidence,
        boundingBox: person.boundingBox
      })));
    }

    return results;
  }

  private async generateClothingMask(imageUrl: string, clothingType: string) {
    const targetRegion = this.mapClothingTypeToRegion(clothingType);
    return await this.clothingMask.generateClothingMask(imageUrl, targetRegion);
  }

  private async performInpainting(
    imageUrl: string,
    maskUrl: string,
    characters: any[],
    outfit: any,
    strength: number,
    storyContext?: StoryContext
  ) {
    // Convert characters to CharacterData format
    const characterData: CharacterData[] = characters.map(char => ({
      id: char.id,
      name: char.name,
      visualDescriptors: char.visualDescriptors,
      alwaysTraits: char.alwaysTraits,
      neverTraits: char.neverTraits,
      currentOutfit: char.currentOutfit,
      wardrobePresets: char.wardrobePresets
    }));

    // Convert outfit to OutfitSpecification format
    const outfitSpec: OutfitSpecification = {
      type: outfit.type,
      style: outfit.style,
      colors: outfit.colors,
      description: outfit.description,
      pattern: outfit.pattern,
      fabric: outfit.fabric,
      formality: outfit.formality,
      modesty: outfit.modesty
    };

    // Build intelligent prompts using context
    const prompt = contextPromptBuilder.buildContextualPrompt(outfitSpec, characterData, storyContext);
    const negativePrompt = contextPromptBuilder.buildContextualNegativePrompt(characterData, storyContext);

    console.log("🎭 Context-enhanced prompt:", prompt);
    console.log("🎭 Context-enhanced negative prompt:", negativePrompt);

    return await this.inpainting.inpaint({
      imageUrl,
      maskUrl,
      prompt,
      negativePrompt,
      strength: strength / 100,
      preserveIdentity: true
    });
  }

  /**
   * Gather comprehensive story context from database for intelligent outfit generation
   */
  private async gatherStoryContext(panelId: string, characterIds: string[]): Promise<StoryContext> {
    try {
      // Get panel data
      const panel = await storage.getPanel(panelId);
      if (!panel) throw new Error("Panel not found");

      // Get page data
      const page = await storage.getPage(panel.pageId);
      if (!page) throw new Error("Page not found");

      // Get project data
      const project = await storage.getProject(page.projectId);
      if (!project) throw new Error("Project not found");

      // Get characters
      const characters = await Promise.all(
        characterIds.map(id => storage.getCharacter(id))
      );

      // Get structured script data if available
      let scriptData = null;
      try {
        const structuredScript = await storage.getProjectStructuredScript(page.projectId);
        if (structuredScript) {
          // Find the script page that matches the current page number
          const scriptPage = structuredScript.pages.find(sp => sp.pageNumber === page.pageNumber);
          if (scriptPage) {
            // Find the script panel that matches the current panel number
            const scriptPanel = scriptPage.panels.find(sp => sp.panelNumber === panel.panelNumber);
            scriptData = { scriptPage, scriptPanel };
          }
        }
      } catch (error) {
        console.log("🎭 No structured script data available:", error);
      }

      // Build context object
      const context: StoryContext = {
        // Project context
        projectGenre: project.genre,
        projectCanonRules: project.canonRules,
        projectArtStyle: project.artStyle,

        // Page context
        pageScriptSnippet: page.scriptSnippet,
        pageMood: scriptData?.scriptPage?.mood,
        pageTimeOfDay: scriptData?.scriptPage?.timeOfDay,
        pageLocation: scriptData?.scriptPage?.location,
        pageWeatherConditions: scriptData?.scriptPage?.weatherConditions,

        // Panel context
        panelPrompt: panel.prompt,
        panelLayout: page.layoutTemplate, // Using page layout as panel layout
        panelAction: scriptData?.scriptPanel?.action,
        panelMood: scriptData?.scriptPanel?.mood,
        panelCameraAngle: scriptData?.scriptPanel?.cameraAngle,
        panelShotType: scriptData?.scriptPanel?.shotType,

        // Character context
        characterCurrentOutfits: {},
        characterAlwaysTraits: {},
        characterNeverTraits: {},
        characterWardrobePresets: {}
      };

      // Populate character-specific context
      characters.forEach(char => {
        if (char) {
          if (context.characterCurrentOutfits) {
            context.characterCurrentOutfits[char.id] = char.currentOutfit;
          }
          if (context.characterAlwaysTraits && char.alwaysTraits) {
            context.characterAlwaysTraits[char.id] = char.alwaysTraits;
          }
          if (context.characterNeverTraits && char.neverTraits) {
            context.characterNeverTraits[char.id] = char.neverTraits;
          }
          if (context.characterWardrobePresets) {
            context.characterWardrobePresets[char.id] = char.wardrobePresets;
          }
        }
      });

      console.log("🎭 Gathered story context:", context);
      return context;

    } catch (error) {
      console.error("🎭 Error gathering story context:", error);
      // Return minimal context on error
      return {};
    }
  }

  /**
   * Get contextual outfit suggestions for characters based on story context
   */
  async getContextualOutfitSuggestions(
    panelId: string,
    characterIds: string[]
  ): Promise<ContextualOutfitSuggestion[]> {
    try {
      const storyContext = await this.gatherStoryContext(panelId, characterIds);
      const characters = await Promise.all(
        characterIds.map(id => storage.getCharacter(id))
      );

      const characterData: CharacterData[] = characters
        .filter(char => char !== null)
        .map(char => ({
          id: char.id,
          name: char.name,
          visualDescriptors: char.visualDescriptors,
          alwaysTraits: char.alwaysTraits,
          neverTraits: char.neverTraits,
          currentOutfit: char.currentOutfit,
          wardrobePresets: char.wardrobePresets
        }));

      return contextPromptBuilder.suggestContextualOutfits(characterData, storyContext);
    } catch (error) {
      console.error("🎭 Error getting contextual suggestions:", error);
      return [];
    }
  }

  private mapClothingTypeToRegion(clothingType: string): string {
    const regionMap: Record<string, string> = {
      "shirt": "upper_clothes",
      "dress": "dress",
      "pants": "lower_clothes",
      "skirt": "lower_clothes",
      "jacket": "upper_clothes",
      "coat": "upper_clothes",
      "shoes": "shoes",
      "hat": "hat",
      "accessories": "accessories"
    };
    
    return regionMap[clothingType] || "upper_clothes";
  }

  private async saveResultImage(resultUrl: string, jobId: string): Promise<string> {
    // In real implementation, would save the processed image to object storage
    // For now, return the mock result URL which will trigger the fallback placeholder system
    const timestamp = Date.now();
    const savedUrl = `/generated/redress_final_${jobId}_${timestamp}.png`;
    console.log("🎭 Saving result image:", savedUrl);
    return savedUrl;
  }

  private async addPanelRevision(panelId: string, revisionData: any) {
    // Get current panel
    const panel = await storage.getPanel(panelId);
    if (!panel) return;

    const revisions = panel.revisions ? [...panel.revisions as any[]] : [];
    revisions.push({
      id: randomUUID(),
      timestamp: new Date(),
      ...revisionData
    });

    // Update panel with new revision
    await storage.updatePanel(panelId, { 
      revisions: revisions,
      imageUrl: revisionData.newImageUrl
    });
  }

  private async updateJobStatus(
    jobId: string, 
    status: string, 
    progress: number, 
    errorMessage?: string,
    finalUrl?: string
  ) {
    // Update job in database
    const updates: Partial<any> = {
      status,
      progress,
      errorMessage,
    };
    
    if (finalUrl) {
      updates.finalImageUrl = finalUrl;
    }
    
    await storage.updateRedressJob(jobId, updates);
    
    console.log(`🎭 Job ${jobId} status: ${status} (${progress}%)`);
    if (errorMessage) {
      console.error(`🎭 Job ${jobId} error:`, errorMessage);
    }
    if (finalUrl) {
      console.log(`🎭 Job ${jobId} final result:`, finalUrl);
    }
  }

  private async updateProcessingStep(
    jobId: string, 
    step: string, 
    status: string, 
    message?: string
  ) {
    // Get current job from database
    const dbJob = await storage.getRedressJob(jobId);
    if (!dbJob) return;
    
    // Update processing steps
    const steps = (dbJob.processingSteps as any[]) || [];
    const stepIndex = steps.findIndex(s => s.step === step);
    
    if (stepIndex >= 0) {
      steps[stepIndex] = {
        ...steps[stepIndex],
        status,
        message,
        timestamp: new Date()
      };
    }
    
    // Update database
    await storage.updateRedressJob(jobId, {
      processingSteps: steps
    });
    
    console.log(`🎭 Job ${jobId} step ${step}: ${status}${message ? ' - ' + message : ''}`);
  }
}

export const redressService = new RedressService();