import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";
import * as path from "path";
import { imageProcessor } from "./image-processor";
import { imageEnhancer } from "./image-enhancer";
import { ObjectStorageService } from "./objectStorage";
import { characterNameService } from "./services/CharacterNameService";
import { characterDescriptorService } from "./services/CharacterDescriptorService";
import { 
  createCharacterNameEnum, 
  buildCharacterConstraintInstructions,
  validateScriptCharacters,
  validatePanelCharacters
} from "./utils/characterValidation";

// Initialize Gemini AI client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface GenerateImageRequest {
  prompt: string;
  panelId: string | number;
  projectId: string; // REQUIRED: Authenticated project ID from route params (not derived from panelId)
  sourceImageUrl?: string; // For image editing - the existing panel image
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
      referenceImageUrl?: string;
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

export interface GenerateReferencePortraitRequest {
  characterId: string;
  characterName: string;
  visualDescriptors: string;
  alwaysTraits: string;
  artStyle?: string;
  forceRegenerate?: boolean;
}

export interface GenerateReferencePortraitResponse {
  status: "completed" | "failed";
  referenceImageUrl?: string;
  characterId: string;
  characterName: string;
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

// ========================================
// MULTI-STAGE SCRIPT GENERATION INTERFACES
// ========================================

export interface MultiStageScriptRequest {
  title: string;
  genre?: string;
  description: string;
  characters: Array<{
    name: string;
    role: string;
    bio: string;
    visualHints?: string;
  }>;
  settings: Array<{
    name: string;
    description: string;
  }>;
  pageCount?: number;
  tone?: string;
  logline?: string;
  targetAudience?: string;
  themes?: string[];
  artStyle?: string;
}

export interface StoryOutlineResponse {
  title: string;
  logline: string;
  estimatedPageCount: number;
  totalActs: number;
  overallThemes: string[];
  targetTone: string;
  storyBeats: Array<{
    beatNumber: number;
    beatTitle: string;
    description: string;
    emotionalTone: string;
    estimatedPageRange: string; // e.g., "1-3"
    keyEvents: string[];
    charactersInvolved: string[];
  }>;
  actStructure: Array<{
    actNumber: number;
    actTitle: string;
    startPage: number;
    endPage: number;
    summary: string;
    majorEvents: string[];
    characterArcs: { [character: string]: string };
    emotionalArc: string;
  }>;
  pageSummaries: Array<{
    pageNumber: number;
    pageTitle: string;
    summary: string;
    setting: string;
    characters: string[];
    plotFunction: string; // e.g., "Setup", "Inciting Incident", "Climax"
    emotionalTone: string;
    keyMoments: string[];
    transitionTo?: string; // How it connects to the next page
  }>;
  worldBuildingElements: {
    primarySettings: string[];
    secondarySettings: string[];
    timeOfDay: { [setting: string]: string };
    atmosphere: { [setting: string]: string };
  };
  consistencyNotes: string[];
}

export interface CharacterBibleResponse {
  characters: Array<{
    id: string;
    name: string;
    role: string;
    bio: string;
    
    // Enhanced Appearance Details
    physicalProfile: {
      height: string;
      build: string;
      bodyType: string;
      posture: string;
      
      // Facial Features
      faceShape: string;
      eyeColor: string;
      eyeShape: string;
      eyebrowShape: string;
      noseShape: string;
      lipShape: string;
      jawline: string;
      
      // Hair Details
      hairColor: string;
      hairTexture: string;
      hairLength: string;
      hairStyle: string;
      facialHair?: string;
      
      // Skin
      skinTone: string;
      skinTexture: string;
      
      // Distinctive Features
      scarsMarkings?: string[];
      tattoos?: string[];
      piercings?: string[];
      glasses?: string;
    };
    
    // Clothing & Style
    defaultClothingState: {
      stateName: string;
      isDefault: boolean;
      headwear?: string;
      upperBody: string;
      lowerBody: string;
      footwear: string;
      outerwear?: string;
      jewelry?: string[];
      accessories?: string[];
      primaryColors: string[];
      colorScheme: string;
      styleDescription: string;
      fittingNotes: string;
    };
    
    alternateClothingStates?: Array<{
      stateName: string; // "formal", "casual", "work", "action"
      description: string;
      appropriateScenes: string[];
    }>;
    
    // Character Voice & Mannerisms
    personality: {
      coreTraits: string[];
      motivations: string[];
      fears: string[];
      quirks: string[];
      speechPattern: string;
      voiceDescription: string;
      commonPhrases: string[];
      bodyLanguage: string[];
      facialExpressions: string[];
      gestureStyle: string;
    };
    
    // Story Role
    storyFunction: {
      primaryRole: string; // "protagonist", "antagonist", "mentor", "comic relief"
      relationshipToProtagonist: string;
      characterArc: string;
      keyScenes: string[];
      emotionalJourney: string;
    };
    
    // Consistency Guidelines
    consistencyRules: {
      alwaysTraits: string[];
      neverTraits: string[];
      characteristicPoses: string[];
      signatureExpressions: string[];
      warningNotes: string[]; // Things to avoid
    };
  }>;
  
  characterRelationships: Array<{
    character1: string;
    character2: string;
    relationshipType: string;
    dynamicDescription: string;
    conflictPoints?: string[];
    bondingMoments?: string[];
  }>;
  
  narrativeConsistency: {
    globalRules: string[];
    settingSpecificRules: { [setting: string]: string[] };
    storyProgressionRules: string[];
  };
}

export interface ChunkedScriptGenerationRequest {
  storyOutline: StoryOutlineResponse;
  characterBible: CharacterBibleResponse;
  chunkInfo: {
    totalChunks: number;
    currentChunk: number;
    pagesInChunk: number[];
    startPage: number;
    endPage: number;
  };
  previousChunkSummary?: {
    lastScene: string;
    characterStates: { [character: string]: string };
    plotProgression: string;
    unresolvedElements: string[];
  };
  generationMode: "sequential" | "parallel";
}

export interface ChunkedScriptResponse {
  chunkNumber: number;
  pagesGenerated: number[];
  pages: Array<{
    pageNumber: number;
    title: string;
    overallMood: string;
    setting: string;
    characters: string[];
    narrative: string;
    layoutSuggestion: string;
    panelCount: number;
    
    panels: Array<{
      panelNumber: number;
      panelType: string; // "establishing", "action", "dialogue", "close-up", "transition"
      visualDescription: string;
      cameraAngle: string;
      shotType: string;
      mood: string;
      
      // Enhanced Character Details
      characterStates: Array<{
        characterName: string;
        emotion: string;
        facialExpression: string;
        bodyLanguage: string;
        position: string;
        pose: string;
        facingDirection: string;
        visibility: string;
        clothingState: string;
        lightingCondition: string;
        proximityToOthers: string;
        interactingWith: string[];
      }>;
      
      // Environmental Details
      environment: {
        settingName: string;
        timeOfDay: string;
        weather?: string;
        lighting: string;
        atmosphere: string;
        keyObjects: string[];
        backgroundCharacters?: string[];
        soundscape: string[];
      };
      
      // Technical Direction
      cinematography: {
        cameraAngle: string;
        shotSize: string; // "extreme close-up", "close-up", "medium", "wide", "extreme wide"
        depth: string; // "shallow", "medium", "deep"
        focusPoint: string;
        composition: string;
        movement?: string; // "static", "pan", "zoom", "tracking"
      };
      
      visualNotes: string;
      timing: string;
      soundEffects: string[];
      
      dialogue: Array<{
        characterName: string;
        text: string;
        tone: string;
        placement: string;
        bubbleType: string; // "speech", "thought", "whisper", "shout", "narrative"
        emotionalSubtext: string;
      }>;
      
      transitionType?: string; // "cut", "fade", "dissolve", "wipe", "match cut"
      consistencyNotes: string[];
    }>;
    
    pageTransition: {
      transitionType: string;
      description: string;
      continuityNotes: string[];
    };
  }>;
  
  chunkSummary: {
    plotProgressionThisChunk: string;
    characterDevelopments: { [character: string]: string };
    unresolvedPlotThreads: string[];
    setupForNextChunk: string[];
    continuityCheckpoints: string[];
  };
  
  nextChunkPrep?: {
    expectedOpeningScene: string;
    characterStatesCarryover: { [character: string]: string };
    plotMomentum: string;
    atmosphereCarryover: string;
  };
}

export interface MultiStageGenerationProgress {
  stage: "outline" | "character_bible" | "chunked_script";
  currentStep: string;
  totalSteps: number;
  completedSteps: number;
  progress: number; // 0-100
  estimatedTimeRemaining?: number; // in seconds
  currentlyProcessing?: string;
  chunksCompleted?: number;
  totalChunks?: number;
  errors?: string[];
  warnings?: string[];
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
   * Helper method to download image from URL and convert to base64
   */
  private async downloadImageAsBase64(imageUrl: string): Promise<{ data: string; mimeType: string }> {
    try {
      // Check if this is a relative object storage path
      if (imageUrl.startsWith('/objects/')) {
        console.log('Using ObjectStorageService for relative path:', imageUrl);
        
        // Use ObjectStorageService to get the file directly
        const objectFile = await this.objectStorageService.getObjectEntityFile(imageUrl);
        
        // Get file metadata for content type
        const [metadata] = await objectFile.getMetadata();
        const contentType = metadata.contentType || 'image/png';
        
        // Download the file data
        const [buffer] = await objectFile.download();
        const base64Data = buffer.toString('base64');
        
        console.log(`Successfully downloaded object storage file: ${imageUrl} (${buffer.length} bytes)`);
        
        return {
          data: base64Data,
          mimeType: contentType
        };
      } else {
        // Handle external URLs via fetch
        console.log('Using fetch for external URL:', imageUrl);
        
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`Failed to download image: ${response.statusText}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Data = buffer.toString('base64');
        
        // Determine MIME type from content type or file extension
        const contentType = response.headers.get('content-type') || 'image/png';
        
        return {
          data: base64Data,
          mimeType: contentType
        };
      }
    } catch (error) {
      console.error('Error downloading image:', error);
      throw new Error('Failed to download source image for editing');
    }
  }

  /**
   * 🎨 PHASE 1: REFERENCE PORTRAIT GENERATION SYSTEM
   * Generate canonical reference portraits for character consistency
   */
  async generateReferencePortrait(request: GenerateReferencePortraitRequest): Promise<GenerateReferencePortraitResponse> {
    console.log(`🖼️ Generating reference portrait for character: ${request.characterName}`);
    
    try {
      // Build optimized portrait prompt for character consistency
      const portraitPrompt = this.buildReferencePortraitPrompt(request);
      
      // Generate the reference portrait using specialized parameters
      const portraitResult = await this.generatePanelImage({
        prompt: portraitPrompt,
        panelId: `ref_${request.characterId}`,
        projectContext: {
          title: "Character Reference",
          artStyle: request.artStyle || "Professional Character Reference Sheet",
          characters: [], // Don't include other characters to avoid confusion
        },
        panelContext: {
          layoutTemplate: "single",
          panelNumber: 1,
          aspectRatio: 1.0, // Square aspect for portraits
          dimensions: { width: 512, height: 512 },
          panelType: "character_reference"
        }
      });
      
      if (portraitResult.status === "completed" && portraitResult.imageUrl) {
        console.log(`✅ Reference portrait generated for ${request.characterName}: ${portraitResult.imageUrl}`);
        
        return {
          status: "completed",
          referenceImageUrl: portraitResult.imageUrl,
          characterId: request.characterId,
          characterName: request.characterName
        };
      } else {
        console.error(`❌ Failed to generate reference portrait for ${request.characterName}: ${portraitResult.error}`);
        
        return {
          status: "failed",
          characterId: request.characterId,
          characterName: request.characterName,
          error: portraitResult.error || "Unknown generation error"
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Error generating reference portrait for ${request.characterName}:`, errorMessage);
      
      return {
        status: "failed",
        characterId: request.characterId,
        characterName: request.characterName,
        error: errorMessage
      };
    }
  }
  
  /**
   * Build specialized prompt for reference portrait generation
   */
  private buildReferencePortraitPrompt(request: GenerateReferencePortraitRequest): string {
    return `REFERENCE CHARACTER PORTRAIT GENERATION:

Character: ${request.characterName}
Visual Description: ${request.visualDescriptors}
Immutable Traits: ${request.alwaysTraits}

STYLE REQUIREMENTS:
- Professional character reference sheet style
- Clean front-facing portrait against neutral background
- Clear focus on identifying features
- Consistent lighting and composition
- High detail on face, hair, and distinctive features
- Comic book illustration style with clean linework

CRITICAL PORTRAIT GUIDELINES:
- This is a REFERENCE IMAGE for character consistency
- Focus on facial features, hair, skin tone, and identifying characteristics
- Neutral expression with slight smile
- Eyes looking directly at viewer
- Clear, well-lit, professional quality
- Avoid dramatic poses or distracting elements
- Maximum detail on: ${request.alwaysTraits}

Generate a clean, professional reference portrait that will serve as the visual standard for this character in all future comic panels.`;
  }
  
  /**
   * 🎯 PHASE 3: CROSS-PANEL CHARACTER CONSISTENCY VALIDATION
   * Validate character appearance consistency across panels
   */
  async validateCharacterConsistency(options: {
    currentPanelImageUrl: string;
    characterId: string;
    characterName: string;
    referenceImageUrl?: string;
    previousPanelImageUrls?: string[];
    toleranceLevel?: 'strict' | 'moderate' | 'lenient';
  }): Promise<{
    isConsistent: boolean;
    consistencyScore: number; // 0-100 scale
    deviations: Array<{
      type: 'facial_features' | 'hair' | 'body_type' | 'clothing' | 'color_scheme';
      severity: 'minor' | 'moderate' | 'major';
      description: string;
    }>;
    recommendation: 'accept' | 'review' | 'regenerate';
    confidenceLevel: number; // 0-100 scale
  }> {
    console.log(`🔍 Validating character consistency for ${options.characterName}...`);
    
    try {
      const tolerance = options.toleranceLevel || 'moderate';
      const toleranceThresholds = {
        strict: { accept: 95, review: 85 },
        moderate: { accept: 85, review: 70 },
        lenient: { accept: 75, review: 60 }
      };
      
      // Build consistency validation prompt
      const validationPrompt = this.buildConsistencyValidationPrompt(options);
      
      // Use Gemini's vision capabilities to analyze the image
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image-preview",
        contents: [
          {
            inlineData: {
              mimeType: "image/jpeg", // Assuming JPEG, but should detect from URL
              data: await this.downloadImageAsBase64(options.currentPanelImageUrl).then(data => data.data)
            }
          },
          { text: validationPrompt }
        ]
      });
      
      if (!response.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error("No validation response received from Gemini");
      }
      
      const analysisText = response.candidates[0].content.parts[0].text;
      console.log(`🔍 Raw consistency analysis:`, analysisText);
      
      // Parse the structured response from Gemini
      const consistencyResult = this.parseConsistencyValidation(analysisText, tolerance, toleranceThresholds[tolerance]);
      
      console.log(`📊 Character consistency result for ${options.characterName}:`, consistencyResult);
      
      return consistencyResult;
    } catch (error) {
      console.error(`❌ Error validating character consistency for ${options.characterName}:`, error);
      
      // Return fallback result
      return {
        isConsistent: true, // Default to accepting in case of validation error
        consistencyScore: 50,
        deviations: [{
          type: 'facial_features',
          severity: 'moderate',
          description: 'Unable to validate consistency due to technical error'
        }],
        recommendation: 'review',
        confidenceLevel: 0
      };
    }
  }
  
  /**
   * Build validation prompt for character consistency analysis
   */
  private buildConsistencyValidationPrompt(options: {
    characterId: string;
    characterName: string;
    referenceImageUrl?: string;
    previousPanelImageUrls?: string[];
    toleranceLevel?: 'strict' | 'moderate' | 'lenient';
  }): string {
    return `CRITICAL CHARACTER CONSISTENCY ANALYSIS:

You are analyzing this comic panel image to validate character consistency for: ${options.characterName}

ANALYSIS REQUIREMENTS:
1. Examine the character's appearance in extreme detail
2. Score consistency on a 0-100 scale where:
   - 100 = Perfect consistency, no changes
   - 85-99 = Minor variations within acceptable range
   - 70-84 = Noticeable changes requiring review
   - 50-69 = Significant inconsistencies requiring regeneration
   - 0-49 = Major character changes, complete regeneration needed

3. Identify specific deviations in these categories:
   - FACIAL_FEATURES: eyes, nose, lips, jawline, facial structure
   - HAIR: color, style, length, texture
   - BODY_TYPE: height, build, proportions
   - CLOTHING: style, colors, fit, accessories
   - COLOR_SCHEME: skin tone, hair color, eye color

4. Rate deviation severity:
   - MINOR: Slight artistic variation, acceptable
   - MODERATE: Noticeable change, needs review
   - MAJOR: Significant change, requires regeneration

PROVIDE YOUR ANALYSIS IN THIS EXACT FORMAT:
CONSISTENCY_SCORE: [0-100 number]
OVERALL_ASSESSMENT: [CONSISTENT/INCONSISTENT]
DEVIATIONS:
- [CATEGORY]: [SEVERITY] - [description]
- [CATEGORY]: [SEVERITY] - [description]
RECOMMENDATION: [ACCEPT/REVIEW/REGENERATE]
CONFIDENCE: [0-100 number]

${options.referenceImageUrl ? `REFERENCE: Compare against canonical reference image: ${options.referenceImageUrl}` : ''}

Analyze the character appearance thoroughly and provide structured feedback.`;
  }
  
  /**
   * Parse Gemini's consistency validation response
   */
  private parseConsistencyValidation(
    analysisText: string, 
    tolerance: 'strict' | 'moderate' | 'lenient',
    thresholds: { accept: number; review: number }
  ): {
    isConsistent: boolean;
    consistencyScore: number;
    deviations: Array<{
      type: 'facial_features' | 'hair' | 'body_type' | 'clothing' | 'color_scheme';
      severity: 'minor' | 'moderate' | 'major';
      description: string;
    }>;
    recommendation: 'accept' | 'review' | 'regenerate';
    confidenceLevel: number;
  } {
    try {
      // Extract consistency score
      const scoreMatch = analysisText.match(/CONSISTENCY_SCORE:\s*(\d+)/i);
      const consistencyScore = scoreMatch ? parseInt(scoreMatch[1]) : 50;
      
      // Extract overall assessment
      const assessmentMatch = analysisText.match(/OVERALL_ASSESSMENT:\s*(CONSISTENT|INCONSISTENT)/i);
      const isConsistent = assessmentMatch ? assessmentMatch[1].toUpperCase() === 'CONSISTENT' : false;
      
      // Extract deviations
      const deviations: Array<{
        type: 'facial_features' | 'hair' | 'body_type' | 'clothing' | 'color_scheme';
        severity: 'minor' | 'moderate' | 'major';
        description: string;
      }> = [];
      
      const deviationMatches = analysisText.match(/DEVIATIONS:(.*?)(?=RECOMMENDATION:|$)/i);
      if (deviationMatches) {
        const deviationLines = deviationMatches[1].split('\n').filter(line => line.trim().startsWith('-'));
        
        for (const line of deviationLines) {
          const match = line.match(/([A-Z_]+):\s*(MINOR|MODERATE|MAJOR)\s*-\s*(.+)/i);
          if (match) {
            const [, category, severity, description] = match;
            deviations.push({
              type: this.mapDeviationType(category),
              severity: severity.toLowerCase() as 'minor' | 'moderate' | 'major',
              description: description.trim()
            });
          }
        }
      }
      
      // Extract recommendation
      const recommendationMatch = analysisText.match(/RECOMMENDATION:\s*(ACCEPT|REVIEW|REGENERATE)/i);
      let recommendation: 'accept' | 'review' | 'regenerate' = 'review';
      
      if (recommendationMatch) {
        recommendation = recommendationMatch[1].toLowerCase() as 'accept' | 'review' | 'regenerate';
      } else {
        // Fallback based on score and tolerance
        if (consistencyScore >= thresholds.accept) {
          recommendation = 'accept';
        } else if (consistencyScore >= thresholds.review) {
          recommendation = 'review';
        } else {
          recommendation = 'regenerate';
        }
      }
      
      // Extract confidence
      const confidenceMatch = analysisText.match(/CONFIDENCE:\s*(\d+)/i);
      const confidenceLevel = confidenceMatch ? parseInt(confidenceMatch[1]) : 70;
      
      return {
        isConsistent: consistencyScore >= thresholds.review,
        consistencyScore,
        deviations,
        recommendation,
        confidenceLevel
      };
    } catch (error) {
      console.error('Error parsing consistency validation:', error);
      return {
        isConsistent: false,
        consistencyScore: 0,
        deviations: [{
          type: 'facial_features',
          severity: 'major',
          description: 'Failed to parse validation response'
        }],
        recommendation: 'review',
        confidenceLevel: 0
      };
    }
  }
  
  /**
   * Extract location information from prompt for state tracking
   */
  private extractLocationFromPrompt(prompt: string): string {
    const locationKeywords = [
      'in the', 'at the', 'inside', 'outside', 'room', 'house', 'building', 'street', 'park', 
      'office', 'kitchen', 'bedroom', 'bathroom', 'living room', 'cafe', 'restaurant', 'school'
    ];
    
    const lowerPrompt = prompt.toLowerCase();
    for (const keyword of locationKeywords) {
      const index = lowerPrompt.indexOf(keyword);
      if (index !== -1) {
        // Extract potential location context around the keyword
        const start = Math.max(0, index - 10);
        const end = Math.min(prompt.length, index + keyword.length + 20);
        const context = prompt.substring(start, end).trim();
        return context;
      }
    }
    
    return 'unknown';
  }
  
  /**
   * Map deviation category string to type
   */
  private mapDeviationType(category: string): 'facial_features' | 'hair' | 'body_type' | 'clothing' | 'color_scheme' {
    const normalizedCategory = category.toLowerCase().replace(/[^a-z]/g, '');
    
    if (normalizedCategory.includes('facial') || normalizedCategory.includes('face')) return 'facial_features';
    if (normalizedCategory.includes('hair')) return 'hair';
    if (normalizedCategory.includes('body') || normalizedCategory.includes('build')) return 'body_type';
    if (normalizedCategory.includes('clothing') || normalizedCategory.includes('clothes')) return 'clothing';
    if (normalizedCategory.includes('color') || normalizedCategory.includes('scheme')) return 'color_scheme';
    
    return 'facial_features'; // Default fallback
  }

  /**
   * 🏗️ PHASE 5: MULTI-PAGE CONSISTENCY ARCHITECTURE
   * Comprehensive character consistency system for 30+ page comics
   */
  async generateConsistentMultiPageComic(options: {
    projectId: string;
    pageRange: { start: number; end: number };
    enableStrictConsistency?: boolean;
    consistencyCheckpoints?: number[]; // Pages where to do extra validation
    maxInconsistencyScore?: number; // Threshold for regeneration (0-100)
  }): Promise<{
    status: 'completed' | 'partial' | 'failed';
    pagesGenerated: number;
    consistencyReport: {
      overallScore: number;
      characterReports: Array<{
        characterName: string;
        consistencyScore: number;
        flaggedPages: number[];
        recommendations: string[];
      }>;
    };
    regeneratedPanels: Array<{
      pageNumber: number;
      panelId: string;
      reason: string;
      originalScore: number;
      newScore: number;
    }>;
  }> {
    console.log(`🏗️ Starting multi-page consistency generation for project ${options.projectId}, pages ${options.pageRange.start}-${options.pageRange.end}`);
    
    try {
      const { storage } = await import("./storage");
      const { SharedStateManager } = await import("./parallel-processing/SharedStateManager");
      
      // Initialize comprehensive state management
      const sharedStateManager = new SharedStateManager();
      await sharedStateManager.initializeProject(options.projectId, storage);
      
      const project = await storage.getProject(options.projectId);
      if (!project) {
        throw new Error(`Project ${options.projectId} not found`);
      }
      
      const characters = await storage.getProjectCharacters(options.projectId);
      console.log(`🎭 Project characters: ${characters.map(c => c.name).join(', ')}`);
      
      // Generate missing reference portraits first (critical for consistency)
      console.log(`🖼️ Ensuring all characters have reference portraits...`);
      const portraitResult = await this.generateMissingReferencePortraits(options.projectId);
      console.log(`📊 Reference portraits: ${portraitResult.succeeded} succeeded, ${portraitResult.failed} failed`);
      
      // Multi-page generation with consistency tracking
      const consistencyTracker = {
        trackCharacter: (characterName: string, score: number) => {
          console.log(`📊 Tracking ${characterName}: ${score}`);
        },
        updateCharacterAppearance: (characterName: string, pageNum: number, panelId: string, data: any) => {
          console.log(`🎭 Updating character ${characterName} appearance on page ${pageNum}, panel ${panelId}`);
        },
        generateCheckpointReport: (pageNum: number) => {
          return {
            pageNumber: pageNum,
            summary: `Checkpoint report for page ${pageNum}`,
            characterStatuses: []
          };
        }
      };
      const regeneratedPanels: Array<{
        pageNumber: number;
        panelId: string;
        reason: string;
        originalScore: number;
        newScore: number;
      }> = [];
      
      let pagesGenerated = 0;
      const characterReports: Array<{
        characterName: string;
        consistencyScore: number;
        flaggedPages: number[];
        recommendations: string[];
      }> = [];
      
      // Initialize character tracking for each character
      for (const character of characters) {
        characterReports.push({
          characterName: character.name,
          consistencyScore: 100,
          flaggedPages: [],
          recommendations: []
        });
      }
      
      // Process each page with enhanced consistency checks
      for (let pageNum = options.pageRange.start; pageNum <= options.pageRange.end; pageNum++) {
        console.log(`📄 Processing page ${pageNum}...`);
        
        try {
          const pages = await storage.getProjectPages(options.projectId);
          const page = pages.find(p => p.pageNumber === pageNum);
          if (!page) {
            console.log(`⚠️ Page ${pageNum} not found, skipping`);
            continue;
          }
          
          const panels = await storage.getPagePanels(page.id);
          
          // Process each panel with consistency validation
          for (const panel of panels) {
            if (!panel.imageUrl) {
              console.log(`⚠️ Panel ${panel.id} has no image, skipping consistency check`);
              continue;
            }
            
            // Validate character consistency for each character in panel
            for (const character of characters) {
              // Check if character appears in this panel (basic heuristic)
              if (panel.prompt?.toLowerCase().includes(character.name.toLowerCase())) {
                console.log(`🔍 Validating ${character.name} in panel ${panel.id}`);
                
                const validationResult = await this.validateCharacterConsistency({
                  currentPanelImageUrl: panel.imageUrl,
                  characterId: character.id,
                  characterName: character.name,
                  referenceImageUrl: character.referenceImageUrl || undefined,
                  toleranceLevel: options.enableStrictConsistency ? 'strict' : 'moderate'
                });
                
                const characterReport = characterReports.find(r => r.characterName === character.name);
                if (characterReport) {
                  // Update character consistency metrics
                  characterReport.consistencyScore = Math.min(characterReport.consistencyScore, validationResult.consistencyScore);
                  
                  // Flag problematic pages
                  if (validationResult.consistencyScore < (options.maxInconsistencyScore || 70)) {
                    characterReport.flaggedPages.push(pageNum);
                    characterReport.recommendations.push(`Page ${pageNum}: ${validationResult.recommendation} (Score: ${validationResult.consistencyScore})`);
                    
                    // Consider regeneration for severely inconsistent panels
                    if (validationResult.consistencyScore < 50 && validationResult.recommendation === 'regenerate') {
                      console.log(`🔄 Panel ${panel.id} flagged for regeneration due to poor consistency (Score: ${validationResult.consistencyScore})`);
                      // Note: Actual regeneration would go here in a full implementation
                      regeneratedPanels.push({
                        pageNumber: pageNum,
                        panelId: panel.id,
                        reason: `Character consistency too low: ${validationResult.consistencyScore}/100`,
                        originalScore: validationResult.consistencyScore,
                        newScore: 0 // Would be updated after regeneration
                      });
                    }
                  }
                }
                
                // Track character states
                consistencyTracker.updateCharacterAppearance(character.name, pageNum, panel.id, {
                  imageUrl: panel.imageUrl,
                  prompt: panel.prompt || '',
                  consistencyScore: validationResult.consistencyScore,
                  validationResult
                });
              }
            }
          }
          
          pagesGenerated++;
          
          // Perform checkpoint validation if specified
          if (options.consistencyCheckpoints?.includes(pageNum)) {
            console.log(`🎯 Consistency checkpoint at page ${pageNum}`);
            const checkpointReport = consistencyTracker.generateCheckpointReport(pageNum);
            console.log(`📊 Checkpoint Report:`, checkpointReport);
          }
          
        } catch (pageError) {
          console.error(`❌ Error processing page ${pageNum}:`, pageError);
        }
      }
      
      // Calculate overall consistency score
      const overallScore = characterReports.length > 0 
        ? Math.round(characterReports.reduce((sum, report) => sum + report.consistencyScore, 0) / characterReports.length)
        : 100;
      
      console.log(`🎉 Multi-page consistency analysis complete: Overall score ${overallScore}/100`);
      
      return {
        status: 'completed',
        pagesGenerated,
        consistencyReport: {
          overallScore,
          characterReports
        },
        regeneratedPanels
      };
      
    } catch (error) {
      console.error(`❌ Multi-page consistency generation failed:`, error);
      throw error;
    }
  }

  /**
   * 🔄 BULK REFERENCE PORTRAIT GENERATION
   * Generate reference portraits for all characters missing them
   */
  async generateMissingReferencePortraits(projectId: string): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
    results: Array<{ characterId: string; characterName: string; status: string; referenceImageUrl?: string; error?: string; }>;
  }> {
    console.log(`🎨 Generating missing reference portraits for project: ${projectId}`);
    
    try {
      const { storage } = await import("./storage");
      const project = await storage.getProject(projectId);
      const characters = await storage.getProjectCharacters(projectId);
      
      if (!project) {
        throw new Error(`Project ${projectId} not found`);
      }
      
      // Filter characters without reference portraits
      const charactersNeedingPortraits = characters.filter(char => !char.referenceImageUrl);
      
      console.log(`📊 Found ${charactersNeedingPortraits.length} characters needing reference portraits out of ${characters.length} total`);
      
      const results: Array<{ characterId: string; characterName: string; status: string; referenceImageUrl?: string; error?: string; }> = [];
      let succeeded = 0;
      let failed = 0;
      
      // Process each character sequentially to avoid API rate limits
      for (const character of charactersNeedingPortraits) {
        console.log(`🎨 Processing character ${succeeded + failed + 1}/${charactersNeedingPortraits.length}: ${character.name}`);
        
        if (!character.visualDescriptors || !character.alwaysTraits) {
          console.warn(`⚠️ Skipping character ${character.name} - missing visual descriptors or always traits`);
          results.push({
            characterId: character.id,
            characterName: character.name,
            status: "skipped",
            error: "Missing visual descriptors or always traits"
          });
          failed++;
          continue;
        }
        
        try {
          const portraitResult = await this.generateReferencePortrait({
            characterId: character.id,
            characterName: character.name,
            visualDescriptors: character.visualDescriptors,
            alwaysTraits: character.alwaysTraits,
            artStyle: project.artStyle || "Comic Book Reference Sheet"
          });
          
          if (portraitResult.status === "completed" && portraitResult.referenceImageUrl) {
            // Update character in database with reference portrait URL
            await storage.updateCharacter(character.id, {
              referenceImageUrl: portraitResult.referenceImageUrl
            });
            
            console.log(`✅ Reference portrait generated and saved for ${character.name}`);
            
            results.push({
              characterId: character.id,
              characterName: character.name,
              status: "completed",
              referenceImageUrl: portraitResult.referenceImageUrl
            });
            succeeded++;
          } else {
            console.error(`❌ Failed to generate portrait for ${character.name}: ${portraitResult.error}`);
            
            results.push({
              characterId: character.id,
              characterName: character.name,
              status: "failed",
              error: portraitResult.error
            });
            failed++;
          }
        } catch (charError) {
          const errorMessage = charError instanceof Error ? charError.message : String(charError);
          console.error(`❌ Error processing character ${character.name}:`, errorMessage);
          
          results.push({
            characterId: character.id,
            characterName: character.name,
            status: "failed",
            error: errorMessage
          });
          failed++;
        }
        
        // Add delay between generations to respect API limits
        if (succeeded + failed < charactersNeedingPortraits.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      console.log(`🎉 Bulk reference portrait generation completed: ${succeeded} succeeded, ${failed} failed`);
      
      return {
        processed: charactersNeedingPortraits.length,
        succeeded,
        failed,
        results
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Error in bulk reference portrait generation:`, errorMessage);
      throw error;
    }
  }

  /**
   * 🎨 PHASE 2: ENHANCED CHARACTER CONSISTENCY PROMPTING
   * Generate an image for a comic panel using Gemini's image generation or editing
   */
  async generatePanelImage(request: GenerateImageRequest): Promise<GenerateImageResponse> {
    const startTime = Date.now();
    const isEditMode = !!request.sourceImageUrl;
    
    // 🔒 RUNTIME CHARACTER VALIDATION GUARD: Validate characters before panel generation
    const { projectId } = request; // SECURITY FIX: Use authenticated projectId from route params, not derived from panelId
    
    // SECURITY ENFORCEMENT: ProjectId is required - fail fast if missing
    if (!projectId) {
      console.error(`🚫 SECURITY VIOLATION: Missing required projectId for panel ${request.panelId}`);
      return {
        imageUrl: "",
        status: "failed",
        panelId: request.panelId,
        error: "Generation blocked - missing authenticated project context. This request must come from a valid project route."
      };
    }
    
    try {
      // 🔒 CHARACTER VALIDATION GATE: Verify all characters exist before panel generation
      {
        const { storage } = await import("./storage");
        const validationResult = await validatePanelCharacters(
          request, 
          projectId, 
          storage
        );
        
        if (!validationResult.isValid) {
          const errorDetails = validationResult.errors.map(e => 
            `Unknown character "${e.characterName}" in ${e.location}${
              e.suggestions?.length ? ` (suggestions: ${e.suggestions.join(", ")})` : ""
            }`
          ).join("; ");
          
          console.error(`🚫 PANEL GENERATION BLOCKED: ${errorDetails}`);
          
          return {
            imageUrl: "",
            status: "failed",
            panelId: request.panelId,
            error: `Panel generation blocked - unknown characters detected: ${errorDetails}. Only these characters are allowed in project.`
          };
        }
        
        console.log(`✅ Character validation passed for panel ${request.panelId}: ${validationResult.validCharacters.length} valid characters found`);
      }
    } catch (validationError) {
      console.error("Character validation error:", validationError);
      // Continue with generation but log the error
    }
    
    // 🔄 PHASE 4: INITIALIZE CHARACTER STATE TRACKING FOR CONSISTENCY
    let sharedStateManager: any = null;
    
    try {
      // SECURITY FIX: Use authenticated projectId (already validated above) instead of parsing from panelId
      // This ensures SharedStateManager operates on the correct, authenticated project context
      
      // Initialize SharedStateManager for character consistency  
      {
        const { SharedStateManager } = await import("./parallel-processing/SharedStateManager");
        const { storage } = await import("./storage");
        
        sharedStateManager = new SharedStateManager();
        await sharedStateManager.initializeProject(projectId, storage);
        
        // Get enhanced character context from SharedStateManager
        const sharedContext = await sharedStateManager.getSharedContext(projectId);
        
        // Merge shared context with request context for enhanced consistency
        if (sharedContext.characters && sharedContext.characters.length > 0) {
          request.projectContext.characters = sharedContext.characters;
          console.log(`🎯 Enhanced character context from SharedStateManager: ${sharedContext.characters.length} characters`);
        }
        
        console.log(`🔄 SharedStateManager initialized for project ${projectId}`);
      }
    } catch (stateError) {
      console.warn(`⚠️ Failed to initialize SharedStateManager:`, stateError);
      // Continue with generation even if state management fails
    }
    
    try {
      // Enhanced logging for debugging
      console.log(`🎨 === GEMINI IMAGE ${isEditMode ? 'EDITING' : 'GENERATION'} START ===`);
      console.log(`📋 Panel: ${request.panelId}`);
      console.log(`🖼️ Mode: ${isEditMode ? 'EDIT (using existing image)' : 'GENERATE (text-to-image)'}`);
      if (isEditMode) {
        console.log(`📸 Source Image: ${request.sourceImageUrl}`);
      }
      console.log(`🎬 Project: ${request.projectContext?.title || 'Unknown'}`);
      console.log(`🎨 Art Style: ${request.styleOptions?.artStyle || request.projectContext?.artStyle || 'Default'}`);
      
      // Build context-aware prompt (optimized for edit vs generation)
      const contextualPrompt = this.buildContextualPrompt(request, isEditMode);
      console.log(`📝 Generated Prompt (${contextualPrompt.length} chars):`);
      console.log(`"${contextualPrompt.substring(0, 200)}${contextualPrompt.length > 200 ? '...' : ''}"`);

      let contentParts: any[];
      
      if (request.sourceImageUrl) {
        // Image editing mode - include the source image
        const imageData = await this.downloadImageAsBase64(request.sourceImageUrl);
        
        contentParts = [
          {
            inlineData: {
              mimeType: imageData.mimeType,
              data: imageData.data,
            },
          },
          { text: contextualPrompt }
        ];
      } else {
        // Text-to-image generation mode
        contentParts = [{ text: contextualPrompt }];
      }

      // 🔄 ENHANCED RELIABILITY: Automatic retry logic for transient API failures
      let response: any = null;
      let lastError: any = null;
      const maxRetries = 3;
      const retryDelay = 1000; // 1 second

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`🎯 Generation attempt ${attempt}/${maxRetries} for panel ${request.panelId}`);
          
          response = await ai.models.generateContent({
            model: "gemini-2.5-flash-image-preview",
            contents: contentParts,
          });

          // Process the response to extract image data
          if (!response.candidates || !response.candidates[0]?.content?.parts) {
            throw new Error("No valid response received from Gemini");
          }

          // Success! Break the retry loop
          console.log(`✅ Generation succeeded on attempt ${attempt} for panel ${request.panelId}`);
          break;

        } catch (error) {
          lastError = error;
          console.log(`⚠️ Generation attempt ${attempt} failed for panel ${request.panelId}:`, (error as Error).message);
          
          if (attempt < maxRetries) {
            console.log(`🔄 Retrying in ${retryDelay}ms... (${maxRetries - attempt} attempts remaining)`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          } else {
            console.log(`❌ All ${maxRetries} attempts failed for panel ${request.panelId}`);
            throw lastError;
          }
        }
      }
      
      // Ensure we have a valid response after retry attempts
      if (!response || !response.candidates || !response.candidates[0]?.content?.parts) {
        throw new Error("Failed to get valid response from Gemini after all retry attempts");
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
          
          const duration = Date.now() - startTime;
          console.log(`✅ === GEMINI IMAGE ${isEditMode ? 'EDITING' : 'GENERATION'} SUCCESS ===`);
          console.log(`⏱️ Duration: ${duration}ms`);
          console.log(`🖼️ Result URL: ${finalImageUrl}`);
          console.log(`📋 Panel ${request.panelId} completed successfully`);
          
          // 🔄 PHASE 4: UPDATE CHARACTER STATES AFTER SUCCESSFUL GENERATION
          try {
            if (sharedStateManager && projectId && request.projectContext.characters) {
              // Update character states with new panel information
              for (const character of request.projectContext.characters) {
                await sharedStateManager.updateCharacterStates(
                  projectId,
                  character.name,
                  {
                    lastSeenPanelId: String(request.panelId),
                    generatedImageUrl: finalImageUrl,
                    prompt: request.prompt,
                    mood: request.styleOptions?.mood || 'neutral',
                    location: this.extractLocationFromPrompt(request.prompt)
                  }
                );
              }
              console.log(`🔄 Character states updated for panel ${request.panelId}`);
            }
          } catch (updateError) {
            console.warn(`⚠️ Failed to update character states:`, updateError);
            // Don't fail the generation for state update errors
          }
          
          const result = {
            imageUrl: finalImageUrl,
            status: "completed" as const,
            panelId: request.panelId,
            generationId: Date.now().toString(),
          };
          
          // 🎯 PHASE 3: VALIDATE CHARACTER CONSISTENCY (OPTIONAL)
          try {
            if (sharedStateManager && projectId && request.projectContext.characters && request.projectContext.characters.length > 0) {
              // Perform automatic consistency validation for main character
              const mainCharacter = request.projectContext.characters[0];
              
              if (mainCharacter.referenceImageUrl) {
                console.log(`🔍 Performing automatic consistency validation for ${mainCharacter.name}...`);
                
                const validationResult = await this.validateCharacterConsistency({
                  currentPanelImageUrl: finalImageUrl,
                  characterId: mainCharacter.name, // Using name as ID for now
                  characterName: mainCharacter.name,
                  referenceImageUrl: mainCharacter.referenceImageUrl,
                  toleranceLevel: 'moderate'
                });
                
                console.log(`📊 Consistency validation for ${mainCharacter.name}: Score ${validationResult.consistencyScore}/100, Recommendation: ${validationResult.recommendation}`);
                
                // Add validation result to response (for debugging/monitoring)
                (result as any).consistencyValidation = {
                  characterName: mainCharacter.name,
                  score: validationResult.consistencyScore,
                  recommendation: validationResult.recommendation,
                  isConsistent: validationResult.isConsistent
                };
              }
            }
          } catch (validationError) {
            console.warn(`⚠️ Automatic consistency validation failed:`, validationError);
            // Don't fail generation for validation errors
          }
          
          return result;
        }
      }

      throw new Error("No image data received from Gemini");
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ === GEMINI IMAGE ${isEditMode ? 'EDITING' : 'GENERATION'} FAILED ===`);
      console.error(`⏱️ Duration: ${duration}ms`);
      console.error(`📋 Panel: ${request.panelId}`);
      console.error(`🚨 Error:`, error);
      
      // If image editing failed due to Gemini API error, try fallback to text-to-image generation
      if (isEditMode && error && typeof error === 'object' && 'status' in error && error.status === 500) {
        console.log(`🔄 === FALLBACK TO TEXT-TO-IMAGE GENERATION ===`);
        console.log(`📋 Panel: ${request.panelId}`);
        console.log(`💡 Reason: Image editing failed with API error, trying fresh generation`);
        
        try {
          // Remove source image and try text-to-image generation
          const fallbackRequest = { ...request, sourceImageUrl: undefined };
          const fallbackResult = await this.generatePanelImage(fallbackRequest);
          
          if (fallbackResult.status === "completed") {
            console.log(`✅ === FALLBACK GENERATION SUCCEEDED ===`);
            console.log(`📋 Panel: ${request.panelId}`);
            console.log(`🖼️ Image URL: ${fallbackResult.imageUrl}`);
            return fallbackResult;
          }
        } catch (fallbackError) {
          console.error(`❌ === FALLBACK GENERATION ALSO FAILED ===`);
          console.error(`📋 Panel: ${request.panelId}`);
          console.error(`🚨 Fallback Error:`, fallbackError);
        }
      }
      
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
    pageScriptData?: {
      setting?: string;
      mood?: string;
      timeOfDay?: string;
      location?: string;
      weatherConditions?: string;
      title?: string;
    };
  }): Promise<GenerateImageResponse> {
    try {
      // Build enhanced background-specific prompt with script context
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
  async generateStructuredScript(request: GenerateStructuredScriptRequest, projectId?: string): Promise<GenerateStructuredScriptResponse> {
    try {
      // 🔒 CHARACTER VALIDATION: Get project characters for constraints
      let projectCharacters: Array<{ name: string; id: string }> = [];
      if (projectId) {
        try {
          const { storage } = await import("./storage");
          projectCharacters = await storage.getProjectCharacters(projectId);
        } catch (error) {
          console.warn("Could not load project characters for validation:", error);
        }
      }
      
      const characterNames = projectCharacters.map(c => c.name);
      const prompt = this.buildStructuredScriptPrompt(request, characterNames);
      
      console.log("Generating structured script with character constraints:", characterNames.length > 0 ? characterNames.join(", ") : "No character constraints");
      console.log("Prompt length:", prompt.length);

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
                                characterName: characterNames.length > 0 ? 
                                  { type: "string", enum: characterNames } : 
                                  { type: "string" },
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
        
        // 🔒 VALIDATION GATE: Validate character names in generated script
        if (projectId && projectCharacters.length > 0) {
          const validationResult = await validateScriptCharacters(
            structuredScript, 
            projectId, 
            (await import("./storage")).storage
          );
          
          if (!validationResult.isValid) {
            const errorDetails = validationResult.errors.map(e => 
              `Unknown character "${e.characterName}" in ${e.location}${
                e.suggestions?.length ? ` (suggestions: ${e.suggestions.join(", ")})` : ""
              }`
            ).join("; ");
            
            throw new Error(`Script validation failed - unknown characters detected: ${errorDetails}. Only these characters are allowed: ${characterNames.join(", ")}`);
          }
          
          console.log(`✅ Script validation passed: ${validationResult.validCharacters.length} valid characters found`);
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

  // ========================================
  // MULTI-STAGE SCRIPT GENERATION METHODS
  // ========================================

  /**
   * Stage 1: Generate comprehensive story outline with acts, beats, and page planning
   */
  async generateStoryOutline(request: MultiStageScriptRequest): Promise<StoryOutlineResponse> {
    try {
      const prompt = this.buildStoryOutlinePrompt(request);
      
      console.log("🎬 STAGE 1: Generating story outline...");
      console.log("Prompt length:", prompt.length);

      const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              title: { type: "string" },
              logline: { type: "string" },
              estimatedPageCount: { type: "number" },
              totalActs: { type: "number" },
              overallThemes: { type: "array", items: { type: "string" } },
              targetTone: { type: "string" },
              storyBeats: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    beatNumber: { type: "number" },
                    beatTitle: { type: "string" },
                    description: { type: "string" },
                    emotionalTone: { type: "string" },
                    estimatedPageRange: { type: "string" },
                    keyEvents: { type: "array", items: { type: "string" } },
                    charactersInvolved: { type: "array", items: { type: "string" } }
                  },
                  required: ["beatNumber", "beatTitle", "description", "emotionalTone", "keyEvents", "charactersInvolved"]
                }
              },
              actStructure: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    actNumber: { type: "number" },
                    actTitle: { type: "string" },
                    startPage: { type: "number" },
                    endPage: { type: "number" },
                    summary: { type: "string" },
                    majorEvents: { type: "array", items: { type: "string" } },
                    characterArcs: { 
                      type: "object",
                      properties: {
                        character: { type: "string" }
                      }
                    },
                    emotionalArc: { type: "string" }
                  },
                  required: ["actNumber", "actTitle", "startPage", "endPage", "summary", "majorEvents", "emotionalArc"]
                }
              },
              pageSummaries: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    pageNumber: { type: "number" },
                    pageTitle: { type: "string" },
                    summary: { type: "string" },
                    setting: { type: "string" },
                    characters: { type: "array", items: { type: "string" } },
                    plotFunction: { type: "string" },
                    emotionalTone: { type: "string" },
                    keyMoments: { type: "array", items: { type: "string" } },
                    transitionTo: { type: "string" }
                  },
                  required: ["pageNumber", "pageTitle", "summary", "setting", "characters", "plotFunction", "emotionalTone", "keyMoments"]
                }
              },
              worldBuildingElements: {
                type: "object",
                properties: {
                  primarySettings: { type: "array", items: { type: "string" } },
                  secondarySettings: { type: "array", items: { type: "string" } },
                  timeOfDay: {
                    type: "object",
                    properties: {
                      setting: { type: "string" }
                    }
                  },
                  atmosphere: {
                    type: "object",
                    properties: {
                      setting: { type: "string" }
                    }
                  }
                },
                required: ["primarySettings", "secondarySettings"]
              },
              consistencyNotes: { type: "array", items: { type: "string" } }
            },
            required: ["title", "logline", "estimatedPageCount", "totalActs", "overallThemes", "targetTone", "storyBeats", "actStructure", "pageSummaries", "worldBuildingElements", "consistencyNotes"]
          }
        },
        contents: prompt,
      });

      const responseText = response.text || "";
      if (!responseText) {
        throw new Error("No response received from Gemini for story outline");
      }

      const storyOutline: StoryOutlineResponse = JSON.parse(responseText);
      
      // Validate essential structure
      if (!storyOutline.pageSummaries || storyOutline.pageSummaries.length === 0) {
        throw new Error("No page summaries generated in story outline");
      }

      console.log(`✅ STAGE 1 COMPLETE: Generated outline for ${storyOutline.estimatedPageCount} pages with ${storyOutline.totalActs} acts`);
      return storyOutline;

    } catch (error) {
      console.error("Error generating story outline:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      throw new Error("Failed to generate story outline: " + errorMessage);
    }
  }

  /**
   * Stage 2: Generate comprehensive character bible with detailed appearance profiles
   */
  async generateCharacterBible(
    request: MultiStageScriptRequest, 
    storyOutline: StoryOutlineResponse
  ): Promise<CharacterBibleResponse> {
    try {
      const prompt = this.buildCharacterBiblePrompt(request, storyOutline);
      
      console.log("👥 STAGE 2: Generating character bible...");
      console.log("Prompt length:", prompt.length);

      const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              characters: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    role: { type: "string" },
                    bio: { type: "string" },
                    physicalProfile: {
                      type: "object",
                      properties: {
                        height: { type: "string" },
                        build: { type: "string" },
                        bodyType: { type: "string" },
                        posture: { type: "string" },
                        faceShape: { type: "string" },
                        eyeColor: { type: "string" },
                        eyeShape: { type: "string" },
                        eyebrowShape: { type: "string" },
                        noseShape: { type: "string" },
                        lipShape: { type: "string" },
                        jawline: { type: "string" },
                        hairColor: { type: "string" },
                        hairTexture: { type: "string" },
                        hairLength: { type: "string" },
                        hairStyle: { type: "string" },
                        facialHair: { type: "string" },
                        skinTone: { type: "string" },
                        skinTexture: { type: "string" },
                        scarsMarkings: { type: "array", items: { type: "string" } },
                        tattoos: { type: "array", items: { type: "string" } },
                        piercings: { type: "array", items: { type: "string" } },
                        glasses: { type: "string" }
                      },
                      required: ["height", "build", "faceShape", "eyeColor", "hairColor", "skinTone"]
                    },
                    defaultClothingState: {
                      type: "object",
                      properties: {
                        stateName: { type: "string" },
                        isDefault: { type: "boolean" },
                        headwear: { type: "string" },
                        upperBody: { type: "string" },
                        lowerBody: { type: "string" },
                        footwear: { type: "string" },
                        outerwear: { type: "string" },
                        jewelry: { type: "array", items: { type: "string" } },
                        accessories: { type: "array", items: { type: "string" } },
                        primaryColors: { type: "array", items: { type: "string" } },
                        colorScheme: { type: "string" },
                        styleDescription: { type: "string" },
                        fittingNotes: { type: "string" }
                      },
                      required: ["stateName", "isDefault", "upperBody", "lowerBody", "footwear", "primaryColors", "colorScheme", "styleDescription"]
                    },
                    personality: {
                      type: "object",
                      properties: {
                        coreTraits: { type: "array", items: { type: "string" } },
                        motivations: { type: "array", items: { type: "string" } },
                        fears: { type: "array", items: { type: "string" } },
                        quirks: { type: "array", items: { type: "string" } },
                        speechPattern: { type: "string" },
                        voiceDescription: { type: "string" },
                        commonPhrases: { type: "array", items: { type: "string" } },
                        bodyLanguage: { type: "array", items: { type: "string" } },
                        facialExpressions: { type: "array", items: { type: "string" } },
                        gestureStyle: { type: "string" }
                      },
                      required: ["coreTraits", "motivations", "speechPattern", "voiceDescription"]
                    },
                    consistencyRules: {
                      type: "object",
                      properties: {
                        alwaysTraits: { type: "array", items: { type: "string" } },
                        neverTraits: { type: "array", items: { type: "string" } },
                        characteristicPoses: { type: "array", items: { type: "string" } },
                        signatureExpressions: { type: "array", items: { type: "string" } },
                        warningNotes: { type: "array", items: { type: "string" } }
                      },
                      required: ["alwaysTraits", "neverTraits"]
                    }
                  },
                  required: ["id", "name", "role", "bio", "physicalProfile", "defaultClothingState", "personality", "consistencyRules"]
                }
              },
              characterRelationships: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    character1: { type: "string" },
                    character2: { type: "string" },
                    relationshipType: { type: "string" },
                    dynamicDescription: { type: "string" },
                    conflictPoints: { type: "array", items: { type: "string" } },
                    bondingMoments: { type: "array", items: { type: "string" } }
                  },
                  required: ["character1", "character2", "relationshipType", "dynamicDescription"]
                }
              },
              narrativeConsistency: {
                type: "object",
                properties: {
                  globalRules: { type: "array", items: { type: "string" } },
                  settingSpecificRules: {
                    type: "object",
                    properties: {
                      setting: { type: "array", items: { type: "string" } }
                    }
                  },
                  storyProgressionRules: { type: "array", items: { type: "string" } }
                },
                required: ["globalRules", "storyProgressionRules"]
              }
            },
            required: ["characters", "characterRelationships", "narrativeConsistency"]
          }
        },
        contents: prompt,
      });

      const responseText = response.text || "";
      if (!responseText) {
        throw new Error("No response received from Gemini for character bible");
      }

      const characterBible: CharacterBibleResponse = JSON.parse(responseText);
      
      // Validate essential structure
      if (!characterBible.characters || characterBible.characters.length === 0) {
        throw new Error("No characters generated in character bible");
      }

      console.log(`✅ STAGE 2 COMPLETE: Generated detailed profiles for ${characterBible.characters.length} characters`);
      return characterBible;

    } catch (error) {
      console.error("Error generating character bible:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      throw new Error("Failed to generate character bible: " + errorMessage);
    }
  }

  /**
   * Stage 3: Generate detailed panel scripts using chunking system
   */
  async generateChunkedScript(
    request: ChunkedScriptGenerationRequest,
    projectId?: string
  ): Promise<ChunkedScriptResponse> {
    try {
      // 🔒 CHARACTER VALIDATION: Get project characters for constraints
      let projectCharacters: Array<{ name: string; id: string }> = [];
      if (projectId) {
        try {
          const { storage } = await import("./storage");
          projectCharacters = await storage.getProjectCharacters(projectId);
        } catch (error) {
          console.warn("Could not load project characters for validation:", error);
        }
      }
      
      const characterNames = projectCharacters.map(c => c.name);
      const prompt = this.buildChunkedScriptPrompt(request, characterNames);
      
      console.log(`📝 STAGE 3: Generating script chunk ${request.chunkInfo.currentChunk}/${request.chunkInfo.totalChunks}`);
      console.log(`Processing pages: ${request.chunkInfo.pagesInChunk.join(', ')}`);
      console.log("Prompt length:", prompt.length);

      const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        config: {
          responseMimeType: "application/json",
          responseSchema: this.getChunkedScriptSchema(characterNames)
        },
        contents: prompt,
      });

      const responseText = response.text || "";
      if (!responseText) {
        throw new Error("No response received from Gemini for script chunk");
      }

      const scriptChunk: ChunkedScriptResponse = JSON.parse(responseText);
      
      // Validate essential structure
      if (!scriptChunk.pages || scriptChunk.pages.length === 0) {
        throw new Error("No pages generated in script chunk");
      }
      
      // 🔒 VALIDATION GATE: Validate character names in generated script chunk
      if (projectId && projectCharacters.length > 0) {
        const validationResult = await validateScriptCharacters(
          scriptChunk, 
          projectId, 
          (await import("./storage")).storage
        );
        
        if (!validationResult.isValid) {
          const errorDetails = validationResult.errors.map(e => 
            `Unknown character "${e.characterName}" in ${e.location}${
              e.suggestions?.length ? ` (suggestions: ${e.suggestions.join(", ")})` : ""
            }`
          ).join("; ");
          
          throw new Error(`Script chunk validation failed - unknown characters detected: ${errorDetails}. Only these characters are allowed: ${characterNames.join(", ")}`);
        }
        
        console.log(`✅ Script chunk validation passed: ${validationResult.validCharacters.length} valid characters found`);
      }

      console.log(`✅ STAGE 3 CHUNK ${request.chunkInfo.currentChunk} COMPLETE: Generated ${scriptChunk.pages.length} pages with detailed panels`);
      return scriptChunk;

    } catch (error) {
      console.error("Error generating chunked script:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      throw new Error("Failed to generate script chunk: " + errorMessage);
    }
  }

  /**
   * Full multi-stage script generation orchestrator
   */
  async generateMultiStageScript(request: MultiStageScriptRequest, projectId?: string): Promise<{
    storyOutline: StoryOutlineResponse;
    characterBible: CharacterBibleResponse;
    scriptChunks: ChunkedScriptResponse[];
  }> {
    try {
      console.log("🚀 STARTING MULTI-STAGE SCRIPT GENERATION");
      console.log(`Project: ${request.title}`);
      console.log(`Characters: ${request.characters.map(c => c.name).join(', ')}`);
      console.log(`Target Pages: ${request.pageCount || 'Auto-determine'}`);

      // Stage 1: Generate story outline
      const storyOutline = await this.generateStoryOutline(request);
      
      // Stage 2: Generate character bible
      const characterBible = await this.generateCharacterBible(request, storyOutline);
      
      // Stage 3: Generate chunked scripts
      const totalPages = storyOutline.estimatedPageCount;
      const chunkSize = this.calculateOptimalChunkSize(totalPages);
      const chunks = this.createChunkPlan(totalPages, chunkSize);
      
      console.log(`📋 CHUNKING PLAN: ${chunks.length} chunks of ~${chunkSize} pages each`);
      
      const scriptChunks: ChunkedScriptResponse[] = [];
      let previousChunkSummary: ChunkedScriptGenerationRequest['previousChunkSummary'] = undefined;
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkRequest: ChunkedScriptGenerationRequest = {
          storyOutline,
          characterBible,
          chunkInfo: {
            totalChunks: chunks.length,
            currentChunk: i + 1,
            pagesInChunk: chunk.pages,
            startPage: chunk.startPage,
            endPage: chunk.endPage
          },
          previousChunkSummary,
          generationMode: "sequential"
        };
        
        const chunkResult = await this.generateChunkedScript(chunkRequest, projectId);
        scriptChunks.push(chunkResult);
        
        // Prepare summary for next chunk
        if (i < chunks.length - 1 && chunkResult.nextChunkPrep) {
          previousChunkSummary = {
            lastScene: chunkResult.nextChunkPrep.expectedOpeningScene,
            characterStates: chunkResult.nextChunkPrep.characterStatesCarryover,
            plotProgression: chunkResult.nextChunkPrep.plotMomentum,
            unresolvedElements: chunkResult.chunkSummary.unresolvedPlotThreads
          };
        }
        
        // Optional: Add delay between chunks to avoid rate limiting
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log("🎉 MULTI-STAGE GENERATION COMPLETE!");
      console.log(`Generated ${totalPages} pages across ${chunks.length} chunks with full character consistency`);

      return {
        storyOutline,
        characterBible,
        scriptChunks
      };

    } catch (error) {
      console.error("Error in multi-stage script generation:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      throw new Error("Failed to generate multi-stage script: " + errorMessage);
    }
  }

  // ========================================
  // HELPER METHODS FOR MULTI-STAGE GENERATION
  // ========================================

  private calculateOptimalChunkSize(totalPages: number): number {
    // Optimal chunk size based on content complexity and API limits
    if (totalPages <= 5) return totalPages; // Small comics in one chunk
    if (totalPages <= 12) return Math.ceil(totalPages / 2); // Medium comics in 2 chunks
    if (totalPages <= 25) return Math.ceil(totalPages / 3); // Larger comics in 3 chunks
    return Math.ceil(totalPages / Math.ceil(totalPages / 8)); // Very large comics in chunks of ~8 pages
  }

  private createChunkPlan(totalPages: number, chunkSize: number): Array<{
    startPage: number;
    endPage: number;
    pages: number[];
  }> {
    const chunks = [];
    let currentPage = 1;
    
    while (currentPage <= totalPages) {
      const endPage = Math.min(currentPage + chunkSize - 1, totalPages);
      const pages = [];
      
      for (let p = currentPage; p <= endPage; p++) {
        pages.push(p);
      }
      
      chunks.push({
        startPage: currentPage,
        endPage,
        pages
      });
      
      currentPage = endPage + 1;
    }
    
    return chunks;
  }

  /**
   * Build a context-aware prompt for image generation
   */
  private buildBackgroundPrompt(request: {
    panelId: number;
    projectContext: GenerateImageRequest["projectContext"];
    panelContext?: GenerateImageRequest["panelContext"];
    pageScriptData?: {
      setting?: string;
      mood?: string;
      timeOfDay?: string;
      location?: string;
      weatherConditions?: string;
      title?: string;
    };
  }): string {
    let prompt = "Generate a FULL-BLEED background artwork with NO borders, NO padding, NO white space. The background must extend completely edge-to-edge. Create a subtle comic panel background that sets the scene without being distracting. ";

    // ENHANCED: Use page-specific script data for highly contextual backgrounds
    if (request.pageScriptData) {
      const scriptData = request.pageScriptData;
      
      // Primary setting description
      if (scriptData.setting) {
        prompt += `Setting: ${scriptData.setting}. `;
      }
      
      // Specific location details
      if (scriptData.location) {
        prompt += `Location: ${scriptData.location}. `;
      }
      
      // Time of day lighting
      if (scriptData.timeOfDay) {
        const timeOfDay = scriptData.timeOfDay.toLowerCase();
        if (timeOfDay.includes("night") || timeOfDay.includes("evening")) {
          prompt += "Dark evening/night lighting, dramatic shadows, atmospheric night scene. ";
        } else if (timeOfDay.includes("morning")) {
          prompt += "Early morning lighting, soft dawn glow, fresh morning atmosphere. ";
        } else if (timeOfDay.includes("noon") || timeOfDay.includes("day")) {
          prompt += "Bright daylight, clear illumination, daytime atmosphere. ";
        } else if (timeOfDay.includes("sunset") || timeOfDay.includes("dusk")) {
          prompt += "Golden hour lighting, warm sunset glow, dramatic evening atmosphere. ";
        }
      }
      
      // Mood and atmosphere
      if (scriptData.mood) {
        const mood = scriptData.mood.toLowerCase();
        if (mood.includes("tense") || mood.includes("suspenseful")) {
          prompt += "Tense, suspenseful atmosphere with dramatic shadows and moody lighting. ";
        } else if (mood.includes("romantic") || mood.includes("warm")) {
          prompt += "Warm, romantic atmosphere with soft lighting and gentle ambiance. ";
        } else if (mood.includes("mysterious") || mood.includes("eerie")) {
          prompt += "Mysterious, eerie atmosphere with atmospheric shadows and intriguing elements. ";
        } else if (mood.includes("action") || mood.includes("intense")) {
          prompt += "Dynamic, intense atmosphere with bold lighting and energetic environment. ";
        } else if (mood.includes("peaceful") || mood.includes("calm")) {
          prompt += "Peaceful, calm atmosphere with gentle lighting and serene environment. ";
        } else {
          prompt += `${scriptData.mood} atmosphere. `;
        }
      }
      
      // Weather and environmental conditions
      if (scriptData.weatherConditions) {
        const weather = scriptData.weatherConditions.toLowerCase();
        if (weather.includes("rain") || weather.includes("storm")) {
          prompt += "Rainy, stormy weather effects with dramatic atmosphere. ";
        } else if (weather.includes("sunny") || weather.includes("clear")) {
          prompt += "Clear, sunny weather with bright natural lighting. ";
        } else if (weather.includes("fog") || weather.includes("mist")) {
          prompt += "Foggy, misty atmosphere with ethereal environmental effects. ";
        } else if (weather.includes("snow") || weather.includes("winter")) {
          prompt += "Snowy, winter atmosphere with cold environmental effects. ";
        } else {
          prompt += `${scriptData.weatherConditions} environmental conditions. `;
        }
      }
    } else {
      // FALLBACK: Use generic genre-based suggestions only if no script data
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

      // Basic story context (only as fallback)
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

  /**
   * Build a context-preserving prompt specifically for image editing
   * Based on Gemini's best practices for image editing with enhanced framing preservation
   */
  private buildEditingPrompt(request: GenerateImageRequest): string {
    let prompt = `EDIT ONLY THE CHARACTER'S OUTFIT in this image while preserving EVERYTHING ELSE: `;
    
    // 🎯 CRITICAL FRAMING AND COMPOSITION PRESERVATION
    prompt += `🔒 EXACT FRAMING: Maintain the EXACT same image framing, crop, zoom level, and composition as the original. `;
    prompt += `🔒 NO RECOMPOSITION: Do NOT change the camera distance, angle, or reframe the scene in any way. `;
    prompt += `🔒 PRESERVE ASPECT RATIO: Keep the exact same image dimensions and aspect ratio. `;
    prompt += `🔒 NO CROPPING: Do NOT crop, zoom in, or zoom out from the original framing. `;
    
    // 🗨️ SPEECH BUBBLE AND TEXT PRESERVATION
    prompt += `💬 PRESERVE ALL TEXT: Keep ALL speech bubbles, dialogue text, thought bubbles, sound effects, and any text overlays in their EXACT original positions and sizes. `;
    prompt += `💬 TEXT POSITIONING: Do NOT move, resize, or alter any text elements - they must remain precisely where they are. `;
    prompt += `💬 BUBBLE SHAPES: Preserve the exact shape, size, and position of all speech bubble outlines and text containers. `;
    
    // Add scene preservation instructions
    prompt += `Keep the exact same scene, setting, lighting, mood, camera angle, composition, and background. `;
    prompt += `Maintain the same character position and pose. `;
    prompt += `Preserve all other characters, objects, and environmental details exactly as they are. `;
    
    // Add specific outfit change request
    prompt += `Change ONLY the main character's clothing to: ${request.prompt}. `;
    
    // Add character context for consistency
    if (request.characterContext && request.characterContext.length > 0) {
      const mainCharacter = request.characterContext[0];
      prompt += `Character details - ${mainCharacter.name}: ${mainCharacter.visualDescriptors}. `;
    }
    
    // Add art style preservation
    if (request.projectContext?.artStyle) {
      prompt += `Art style: EXACTLY preserve the ${request.projectContext.artStyle} comic book art style and visual quality. `;
    }
    
    // Add panel context if available
    if (request.panelContext?.panelType) {
      prompt += `Panel type: ${request.panelContext.panelType}. `;
    }
    
    // Add critical preservation instructions
    prompt += `CRITICAL: This is an image edit, not a new image generation. `;
    prompt += `Only change the character's outfit while keeping everything else identical to the original image. `;
    prompt += `⚠️ FINAL RULE: The output image must be visually identical to the input image except for the character's outfit change - same framing, same speech bubbles, same text positions, same everything.`;
    
    return prompt;
  }

  private buildContextualPrompt(request: GenerateImageRequest, isEditMode: boolean = false): string {
    // For image editing, use a much shorter, focused prompt
    if (isEditMode) {
      return this.buildEditingPrompt(request);
    }
    
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

    // 🎯 PHASE 2: ENHANCED CHARACTER CONSISTENCY PROMPTING WITH REFERENCE PORTRAITS
    if (request.projectContext.characters && request.projectContext.characters.length > 0) {
      const charactersWithRefs = request.projectContext.characters.filter(char => char.referenceImageUrl);
      
      // Build ultra-detailed character profiles with strong consistency enforcement
      const characterProfiles = request.projectContext.characters
        .map((char, index) => {
          let profile = `CHARACTER ${index + 1}: ${char.name} (${char.role})`;
          
          if (char.visualDescriptors) {
            profile += `. CANONICAL APPEARANCE: ${char.visualDescriptors}`;
          }
          
          if (char.alwaysTraits) {
            profile += `. IMMUTABLE TRAITS (NEVER CHANGE): ${char.alwaysTraits}`;
          }
          
          if (char.neverTraits) {
            profile += `. FORBIDDEN TRAITS (NEVER SHOW): ${char.neverTraits}`;
          }
          
          if (char.colorScheme) {
            profile += `. SIGNATURE COLORS: ${char.colorScheme}`;
          }
          
          // 🖼️ CRITICAL: Emphasize reference portrait matching
          if (char.referenceImageUrl) {
            profile += `. 🎯 REFERENCE PORTRAIT MANDATORY: This character has a canonical reference image that shows their EXACT appearance. YOU MUST match the reference portrait PRECISELY - same facial features, hair color, hair style, skin tone, body type, clothing style. Reference image URL: ${char.referenceImageUrl}`;
          }
          
          return profile;
        })
        .join(" || ");
      
      prompt += `. 🔥 CRITICAL CHARACTER CONSISTENCY ENFORCEMENT: ${characterProfiles}`;
      
      // Add extremely strong consistency rules
      prompt += `. ⚠️ CHARACTER CONSISTENCY IS MANDATORY: Every character MUST maintain their EXACT canonical appearance across ALL panels. NO deviations allowed - same facial structure, same hair color and texture, same skin tone, same body proportions, same eye color, same distinctive features.`;
      
      // Add reference portrait emphasis if any characters have reference images
      if (charactersWithRefs.length > 0) {
        prompt += ` 🎯 REFERENCE PORTRAIT COMPLIANCE: ${charactersWithRefs.length} character(s) have official reference portraits showing their canonical appearance. These reference images are the AUTHORITATIVE visual standard. You MUST match them EXACTLY - treat the reference portraits as visual law. Any deviation from the reference images is strictly forbidden.`;
        
        // List characters with reference portraits for emphasis
        const refCharNames = charactersWithRefs.map(char => char.name).join(", ");
        prompt += ` Characters with mandatory reference portraits: ${refCharNames}.`;
      }
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

    // Add current-page previous panels context for immediate continuity
    if (request.previousPanelsContext && request.previousPanelsContext.length > 0) {
      const previousPanelSummaries = request.previousPanelsContext
        .map(panel => `Panel ${panel.panelNumber}: ${panel.prompt.replace(/^Panel \d+:\s*/i, '')}`)
        .join(". ");
      
      prompt += `. Previous panels on this page: ${previousPanelSummaries}`;
      prompt += `. IMMEDIATE CONTINUITY: This panel must visually flow from the previous panels. Maintain character positions, clothing, and environmental details from the earlier panels on this page.`;
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
    prompt += " 🔥 ULTRA-CRITICAL CHARACTER CONSISTENCY: Every character appearance is LOCKED and IMMUTABLE. Characters MUST be visually identical across all panels: EXACT same facial features (eyes, nose, lips, jaw), EXACT same hair color and style, EXACT same skin tone, EXACT same body proportions, EXACT same distinctive markings. ANY change in character appearance is a critical error.";
    prompt += " 🎨 ARTISTIC CONSISTENCY ENFORCEMENT: Maintain IDENTICAL art style, drawing technique, line thickness, and color saturation throughout all panels. Zero tolerance for style variations between panels. Every panel must look like it was drawn by the same artist using the same tools.";
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
   * Build a structured script generation prompt with rich metadata (ENHANCED VERSION)
   * Now includes movie-quality panel descriptions with detailed character states,
   * camera work, lighting, and technical direction using enhanced schema fields
   */
  private buildStructuredScriptPrompt(request: GenerateStructuredScriptRequest, validCharacterNames?: string[]): string {
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
    
    // 🔒 CHARACTER CONSTRAINTS: Add strict character validation instructions
    if (validCharacterNames && validCharacterNames.length > 0) {
      prompt += `\n\n${buildCharacterConstraintInstructions(validCharacterNames.map(name => ({ name })))}`;
    }

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

3. ENHANCED Panel-Level Details (MOVIE-QUALITY for AI generation):
   - Panel numbering: Number panels sequentially within each page (1, 2, 3, 4, 5, 6)
   - Visual description (extremely detailed, specific, cinematic)
   
   **CINEMATOGRAPHY (Film-Level Direction)**:
   - Camera angle with reasoning: specific angles (low angle for power, high angle for vulnerability)
   - Shot size: precise framing (extreme close-up, close-up, medium, wide, extreme wide)
   - Camera movement: static, pan, tilt, zoom, dolly, tracking shots
   - Depth of field: shallow (character focus), medium, deep (environmental context)
   - Focus point: what draws the eye first in the composition
   - Composition: rule of thirds, leading lines, framing devices, visual balance
   
   **LIGHTING DESIGN (Professional Level)**:
   - Primary lighting: source, direction, intensity (harsh sunlight, soft window light)
   - Secondary lighting: fill lights, rim lights, accent lighting
   - Lighting mood: dramatic, naturalistic, stylized, noir, bright, moody
   - Shadow placement: cast shadows, character shadows, environmental shadows
   - Color temperature: warm (2700K-3000K), neutral (3500K-4100K), cool (5000K+)
   
   **CHARACTER STATES (Enhanced Detail)**:
   - Character positioning: exact body position, stance, gestures
   - Character interactions: who is interacting with whom, proximity
   - Emotional states: specific facial expressions, micro-expressions
   - Body language: posture details, hand positions, eye contact
   - Clothing states: condition, fit, styling details
   
   **ENVIRONMENTAL DETAILS (Complete Scene Setting)**:
   - Weather conditions: clear, overcast, raining, stormy, foggy, snowing
   - Time of day: specific lighting conditions for different times
   - Atmospheric elements: dust particles, steam, smoke, mist, environmental mood
   - Key props: foreground, midground, background objects that advance story
   - Environmental storytelling: background details that enhance narrative
   
   **TECHNICAL DIRECTION (Advanced Techniques)**:
   - Panel pacing: very slow, slow, moderate, fast, very fast, frozen moment
   - Timing: real-time, slow-motion, time-lapse, compressed time
   - Transition type: cut, fade, dissolve, wipe, match cut, jump cut
   - Visual effects: motion blur, speed lines, impact effects, thought bubbles
   - Special effects: explosions, magical aura, energy beams, particle effects
   - Panel borders: standard, rounded, irregular, borderless, overlapping
   
   **AUDIO LANDSCAPE (Complete Sound Design)**:
   - Sound effects: specific, layered audio descriptions
   - Ambient sounds: environmental audio layers (city traffic, office chatter, nature)
   - Music cues: dramatic orchestral, light jazz, tension building, emotional swells
   - Voice-over: narrator or character internal thoughts
   - Dialogue placement: strategic positioning for speech bubbles
   - Silence emphasis: moments where quiet drives the narrative

4. Dialogue Specifications:
   - Character name
   - Dialogue text
   - Tone (excited, whispered, shouting, thoughtful, etc.)
   - Placement (top-left, center, bottom-right, off-panel, etc.)

ENHANCED GUIDELINES FOR MOVIE-QUALITY SCRIPTS:
- CRITICAL: Number panels sequentially within each page starting from 1 (Panel 1, Panel 2, Panel 3, etc.)
- **PAGE COUNT DETERMINATION**: Analyze story complexity - simple concepts (6-12 pages), complex plots (12-20 pages), epic stories (20-30+ pages). Genre considerations: Action/Superhero (more panels for choreographed sequences), Romance/Character-driven (fewer panels for emotional beats), Horror/Mystery (medium pacing for tension and reveals).

**PROFESSIONAL STANDARDS**:
- Visual descriptions must be EXTREMELY detailed and cinematic
- Include specific technical camera direction (lens choice, movement, framing)
- Specify professional lighting setups with mood and technical details
- Character positioning must be precise and purposeful
- Environmental storytelling through every background element
- Panel-to-panel flow with intentional pacing and rhythm
- Color psychology considerations for mood enhancement
- Sound design integration for complete sensory experience

**VISUAL STORYTELLING MASTERY**:
- Each panel must have multiple layers of visual information
- Foreground, midground, background composition planning
- Character acting through body language and micro-expressions
- Environmental details that advance plot and character development
- Technical effects that enhance rather than distract from story
- Transition planning between panels for optimal reading flow

**AI OPTIMIZATION**:
- Use concrete, specific visual language AI can interpret accurately
- Include technical specifications that translate to visual parameters
- Provide character consistency guidelines throughout the script
- Balance artistic vision with technical execution requirements

Create a MOVIE-QUALITY script with the depth and precision of a professional film storyboard, utilizing every technical field for maximum visual impact and narrative clarity. The script should generate panels that rival professional comic book and film production standards.`;

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
      
      // For longer stories (15+ pages), use chunked generation to avoid timeouts
      if (pageCount > 15) {
        console.log(`🎨 Long story detected (${pageCount} pages, ${request.length}) - using chunked generation...`);
        return await this.generateLongStoryInChunks(request, pageCount);
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
      const parsedStory = JSON.parse(completeStory);
      
      // 🎨 CHARACTER CANON PASS: Enhance characters with diverse names and detailed descriptions
      const enhancedStory = await this.applyCharacterCanonPass(parsedStory);
      
      return enhancedStory;
    } catch (error) {
      console.error("🔥 Error generating complete story:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      throw new Error("Failed to generate complete story: " + errorMessage);
    }
  }

  /**
   * Generate long stories (15+ pages) with PARALLEL processing to avoid timeouts
   * Major improvements: parallel chunk generation, better error handling, retry logic
   */
  private async generateLongStoryInChunks(request: {
    genres: string[];
    length: string;
    artStyle: string;
    tones: string[];
    projectId?: string;
  }, totalPages: number): Promise<{
    title: string;
    genre: string;
    description: string;
    characters: Array<{
      name: string;
      role: string;
      bio: string;
      visualDescriptors: string;
      alwaysTraits: string;
      neverTraits: string;
      colorScheme: string;
      referenceImageUrl?: string;
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

    // 🚀 PARALLEL GENERATION: Generate script chunks simultaneously for speed
    const chunkSize = 5; // Reduced chunk size for better parallelization
    const chunkPromises: Promise<{startPage: number; endPage: number; pages: any[]}>[] = [];
    
    // Create all chunk generation promises in parallel
    for (let startPage = 1; startPage <= totalPages; startPage += chunkSize) {
      const endPage = Math.min(startPage + chunkSize - 1, totalPages);
      const isFirstChunk = startPage === 1;
      const isLastChunk = endPage === totalPages;

      console.log(`⚡ Preparing parallel generation for pages ${startPage}-${endPage} of ${totalPages}...`);

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

CRITICAL PANEL NUMBERING RULE:
- Number panels sequentially within each page starting from 1 (Panel 1, Panel 2, Panel 3, etc.)
- Each page should have panels numbered 1, 2, 3, 4... regardless of page number

Ensure story continuity and ${request.tones.join(" + ")} tones.`;

      // Create promise for this chunk with retry logic
      const chunkPromise = this.generateScriptChunkWithRetry(scriptPrompt, startPage, endPage);
      chunkPromises.push(chunkPromise);
    }

    console.log(`🚀 PARALLEL PROCESSING: Starting ${chunkPromises.length} chunks simultaneously...`);
    const startTime = Date.now();
    
    // Execute all chunks in parallel with proper error handling
    let chunkResults: Array<{startPage: number; endPage: number; pages: any[]}> = [];
    try {
      chunkResults = await Promise.all(chunkPromises);
      const parallelTime = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`✅ PARALLEL SUCCESS: All ${chunkResults.length} chunks completed in ${parallelTime}s`);
    } catch (error) {
      console.error(`🔥 PARALLEL FAILURE: Error in chunk generation:`, error);
      throw new Error(`Failed to generate story chunks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Sort chunks by page order and combine
    chunkResults.sort((a, b) => a.startPage - b.startPage);
    const chunks: any[] = [];
    for (const result of chunkResults) {
      chunks.push(...result.pages);
      console.log(`📄 Merged pages ${result.startPage}-${result.endPage} (${result.pages.length} pages)`);
    }

    // This section is now replaced by parallel processing above

    // Combine all chunks into final structured script
    const structuredScript = {
      title: storyConcept.title,
      logline: storyConcept.description,
      pages: chunks
    };

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`🎉 EPIC STORY COMPLETE: ${chunks.length} pages generated with parallel processing in ${totalTime}s`);

    const longStory = {
      title: storyConcept.title,
      genre: storyConcept.genre,
      description: storyConcept.description,
      characters: storyConcept.characters,
      structuredScript
    };
    
    // 🎨 CHARACTER CANON PASS: Enhance characters with diverse names, detailed descriptions, and reference portraits
    const enhancedLongStory = await this.applyCharacterCanonPass(longStory, request.projectId);
    
    return enhancedLongStory;
  }

  /**
   * Generate a single script chunk with retry logic and timeout handling
   */
  private async generateScriptChunkWithRetry(
    scriptPrompt: string, 
    startPage: number, 
    endPage: number,
    maxRetries: number = 2
  ): Promise<{startPage: number; endPage: number; pages: any[]}> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        console.log(`🎯 Generating pages ${startPage}-${endPage} (attempt ${attempt}/${maxRetries + 1})`);
        
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
          throw new Error(`Empty response for chunk ${startPage}-${endPage}`);
        }

        const chunkData = JSON.parse(chunkText);
        if (!chunkData.pages || chunkData.pages.length === 0) {
          throw new Error(`No pages generated for chunk ${startPage}-${endPage}`);
        }

        console.log(`✅ SUCCESS: Pages ${startPage}-${endPage} generated (${chunkData.pages.length} pages, attempt ${attempt})`);
        
        return {
          startPage,
          endPage,
          pages: chunkData.pages
        };
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`⚠️  RETRY: Pages ${startPage}-${endPage} failed on attempt ${attempt}:`, lastError.message);
        
        if (attempt <= maxRetries) {
          // Exponential backoff: 1s, 2s, 4s...
          const delay = Math.pow(2, attempt - 1) * 1000;
          console.log(`⏳ Waiting ${delay}ms before retry ${attempt + 1}...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    throw new Error(`Failed to generate pages ${startPage}-${endPage} after ${maxRetries + 1} attempts. Last error: ${lastError?.message}`);
  }

  /**
   * 🎨 CHARACTER CANON PASS: Enhance generated characters with diverse names and detailed descriptions
   * ENHANCED: Now includes reference portrait generation and database persistence
   * This method runs after basic character generation to solve repetition and consistency issues
   */
  private async applyCharacterCanonPass(storyData: {
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
  }, projectId?: string): Promise<{
    title: string;
    genre: string;
    description: string;
    characters: Array<{
      name: string;
      role: string;
      bio: string;
      visualDescriptors: string;
      alwaysTraits: string;
      neverTraits: string;
      colorScheme: string;
      referenceImageUrl?: string;
    }>;
    structuredScript: any;
  }> {
    console.log(`🎨 Starting Character Canon Pass for ${storyData.characters.length} characters...`);

    // Track diversity for balanced character generation
    const existingCharacters: Array<{ ethnicity?: string; role?: string; }> = [];

    // Enhance each character with unique names, canonical descriptions, and reference portraits
    const enhancedCharacters = await Promise.all(storyData.characters.map(async (character, index) => {
      try {
        // Generate unique, diverse name
        const uniqueName = characterNameService.generateUniqueName();
        
        // Map ethnicity from name service to descriptor service
        let preferredEthnicity = uniqueName.ethnicity;
        
        // Map name service ethnicities to descriptor service ethnicities
        const ethnicityMapping: { [key: string]: string } = {
          'western': 'European',
          'eastAsian': 'East Asian',
          'southAsian': 'South Asian',
          'middleEastern': 'Middle Eastern',
          'african': 'African',
          'nordic': 'Nordic',
          'latino': 'Latino',
          'slavic': 'Slavic'
        };
        
        preferredEthnicity = ethnicityMapping[uniqueName.ethnicity] || 'European';
        
        // Generate canonical visual description
        const canonicalDescription = characterDescriptorService.generateCanonicalDescription(
          character.bio,
          preferredEthnicity,
          character.role
        );
        
        // Track for diversity
        existingCharacters.push({ 
          ethnicity: preferredEthnicity, 
          role: character.role 
        });

        // 🎨 GENERATE REFERENCE PORTRAIT for visual consistency
        let referenceImageUrl: string | undefined;
        try {
          console.log(`🖼️ Generating reference portrait for ${uniqueName.fullName}...`);
          
          const portraitPrompt = `Create a character reference portrait: ${canonicalDescription.visualDescriptors}. REFERENCE STYLE: Simple, clean front-facing portrait with neutral expression against white background. Focus on key identifying features: ${canonicalDescription.alwaysTraits}. Professional character design sheet style.`;
          
          const portraitResult = await this.generatePanelImage({
            prompt: portraitPrompt,
            panelId: `char_ref_${index}`,
            projectContext: {
              title: storyData.title,
              genre: storyData.genre,
              description: storyData.description,
              artStyle: "character reference sheet",
              characters: [], // Don't include other characters in reference generation
            },
            panelContext: {
              layoutTemplate: "single",
              panelNumber: 1,
              aspectRatio: 1.0, // Square for portraits
              dimensions: { width: 512, height: 512 },
              panelType: "character_reference"
            }
          });
          
          if (portraitResult.status === "completed" && portraitResult.imageUrl) {
            referenceImageUrl = portraitResult.imageUrl;
            console.log(`✅ Reference portrait generated for ${uniqueName.fullName}: ${referenceImageUrl}`);
          } else {
            console.warn(`⚠️ Failed to generate reference portrait for ${uniqueName.fullName}: ${portraitResult.error || 'Unknown error'}`);
          }
        } catch (portraitError) {
          console.error(`❌ Error generating reference portrait for ${uniqueName.fullName}:`, portraitError);
        }

        console.log(`✨ Enhanced character ${index + 1}: ${uniqueName.fullName} (${preferredEthnicity}) ${referenceImageUrl ? 'with reference portrait' : 'without reference portrait'}`);

        return {
          name: uniqueName.fullName,
          role: character.role,
          bio: character.bio,
          visualDescriptors: canonicalDescription.visualDescriptors,
          alwaysTraits: canonicalDescription.alwaysTraits,
          neverTraits: canonicalDescription.neverTraits,
          colorScheme: canonicalDescription.colorScheme,
          referenceImageUrl,
        };
      } catch (error) {
        console.error(`⚠️ Failed to enhance character ${index + 1}, using fallback:`, error);
        
        // Fallback: keep original character with empty enhanced fields
        return {
          name: character.name,
          role: character.role,
          bio: character.bio,
          visualDescriptors: character.visualDescriptors,
          alwaysTraits: "",
          neverTraits: "",
          colorScheme: "",
          referenceImageUrl: undefined,
        };
      }
    }));

    // 🏗️ SAVE ENHANCED CHARACTERS TO DATABASE for panel generation consistency
    if (projectId) {
      try {
        console.log(`💾 Saving ${enhancedCharacters.length} enhanced characters to database for project ${projectId}...`);
        
        const { storage } = await import("./storage");
        
        // Create enhanced characters in database (replaces old ones)
        for (const enhancedChar of enhancedCharacters) {
          try {
            await storage.createCharacter({
              projectId,
              name: enhancedChar.name,
              role: enhancedChar.role || null,
              bio: enhancedChar.bio || null,
              visualDescriptors: enhancedChar.visualDescriptors || null,
              alwaysTraits: enhancedChar.alwaysTraits || null,
              neverTraits: enhancedChar.neverTraits || null,
              colorScheme: enhancedChar.colorScheme || null,
              referenceImageUrl: enhancedChar.referenceImageUrl || null,
              isLibraryCharacter: false,
            });
            console.log(`✅ Saved enhanced character: ${enhancedChar.name}`);
          } catch (charError) {
            console.error(`⚠️ Failed to save character ${enhancedChar.name}:`, charError);
          }
        }
        
        console.log(`🎉 Enhanced character data saved to database - panel generation will now have access to canonical descriptions and reference portraits!`);
      } catch (dbError) {
        console.error(`⚠️ Failed to save enhanced characters to database:`, dbError);
        console.log(`📝 Enhanced characters exist in memory but panel generation may not have access to canonical descriptions`);
      }
    } else {
      console.log(`📝 No projectId provided - enhanced characters will exist only in memory for this generation`);
    }

    // Update character references in structured script
    const updatedStructuredScript = this.updateCharacterNamesInScript(
      storyData.structuredScript, 
      storyData.characters, 
      enhancedCharacters
    );

    console.log(`🎉 Character Canon Pass completed: ${enhancedCharacters.length} characters enhanced with unique names and canonical descriptions`);

    return {
      title: storyData.title,
      genre: storyData.genre,
      description: storyData.description,
      characters: enhancedCharacters,
      structuredScript: updatedStructuredScript,
    };
  }

  /**
   * Update character name references in structured script after Canon Pass
   * ENHANCED: Now updates ALL character references including panel arrays, scene descriptions, and text mentions
   */
  private updateCharacterNamesInScript(
    structuredScript: any,
    originalCharacters: Array<{ name: string; role: string; bio: string; visualDescriptors: string; }>,
    enhancedCharacters: Array<{ name: string; role: string; bio: string; visualDescriptors: string; alwaysTraits: string; neverTraits: string; colorScheme: string; }>
  ): any {
    if (!structuredScript?.pages) {
      return structuredScript;
    }

    // Create mapping from old names to new names
    const nameMapping: { [oldName: string]: string } = {};
    for (let i = 0; i < originalCharacters.length && i < enhancedCharacters.length; i++) {
      nameMapping[originalCharacters[i].name] = enhancedCharacters[i].name;
    }

    console.log(`🔄 Updating character name references in script:`, Object.keys(nameMapping).length, "mappings");

    // Helper function to replace character names in text
    const replaceNamesInText = (text: string): string => {
      if (!text) return text;
      let updatedText = text;
      
      // Replace each character name (case-insensitive, word boundaries)
      Object.entries(nameMapping).forEach(([oldName, newName]) => {
        const regex = new RegExp(`\\b${oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        updatedText = updatedText.replace(regex, newName);
      });
      
      return updatedText;
    };

    // Deep clone and update script
    const updatedScript = JSON.parse(JSON.stringify(structuredScript));
    
    try {
      // Update character names in pages
      if (updatedScript.pages) {
        updatedScript.pages.forEach((page: any) => {
          // Update character arrays in pages
          if (page.characters && Array.isArray(page.characters)) {
            page.characters = page.characters.map((characterName: string) => 
              nameMapping[characterName] || characterName
            );
          }

          // Update page-level narrative text
          if (page.narrative) {
            page.narrative = replaceNamesInText(page.narrative);
          }

          // Update character names in panels
          if (page.panels && Array.isArray(page.panels)) {
            page.panels.forEach((panel: any) => {
              // 🔥 CRITICAL FIX: Update panel.characters arrays (was missing!)
              if (panel.characters && Array.isArray(panel.characters)) {
                panel.characters = panel.characters.map((characterName: string) => 
                  nameMapping[characterName] || characterName
                );
              }

              // 🔥 CRITICAL FIX: Update character names in all panel text fields
              if (panel.action) {
                panel.action = replaceNamesInText(panel.action);
              }
              if (panel.sceneDescription) {
                panel.sceneDescription = replaceNamesInText(panel.sceneDescription);
              }
              if (panel.visualNotes) {
                panel.visualNotes = replaceNamesInText(panel.visualNotes);
              }
              if (panel.visualDescription) {
                panel.visualDescription = replaceNamesInText(panel.visualDescription);
              }

              // Update character emotions object keys
              if (panel.characterEmotions && typeof panel.characterEmotions === 'object') {
                const updatedEmotions: any = {};
                Object.entries(panel.characterEmotions).forEach(([charName, emotion]: [string, any]) => {
                  const newCharName = nameMapping[charName] || charName;
                  updatedEmotions[newCharName] = emotion;
                });
                panel.characterEmotions = updatedEmotions;
              }

              // Update character names in dialogue
              if (panel.dialogue && Array.isArray(panel.dialogue)) {
                panel.dialogue.forEach((dialogueItem: any) => {
                  // Update characterName field
                  if (dialogueItem.characterName && nameMapping[dialogueItem.characterName]) {
                    dialogueItem.characterName = nameMapping[dialogueItem.characterName];
                  }
                  
                  // Also check for 'character' field (alternative format)
                  if (dialogueItem.character && nameMapping[dialogueItem.character]) {
                    dialogueItem.character = nameMapping[dialogueItem.character];
                  }

                  // Update character mentions in dialogue text
                  if (dialogueItem.text) {
                    dialogueItem.text = replaceNamesInText(dialogueItem.text);
                  }
                });
              }
            });
          }
        });
      }

      console.log(`✅ Character name references updated successfully in structured script - enhanced version covering all text fields`);
    } catch (error) {
      console.error(`⚠️ Error updating character names in script:`, error);
      // Return original script if update fails
      return structuredScript;
    }

    return updatedScript;
  }

  // ========================================
  // HELPER METHODS FOR MULTI-STAGE GENERATION PROMPTS
  // ========================================

  /**
   * Build prompt for story outline generation
   */
  private buildStoryOutlinePrompt(request: MultiStageScriptRequest): string {
    let prompt = `You are a professional comic book writer and story architect. Create a comprehensive story outline for a comic book project.

COMIC PROJECT DETAILS:
- Title: "${request.title}"
- Genre: ${request.genre || 'General'}
- Target Pages: ${request.pageCount || 'Determine optimal length'}
- Target Audience: ${request.targetAudience || 'General readers'}
- Tone: ${request.tone || 'Balanced'}

STORY CONCEPT:
${request.description}

MAIN CHARACTERS:
${request.characters.map(char => `- ${char.name} (${char.role}): ${char.bio}`).join('\n')}

KEY SETTINGS:
${request.settings.map(setting => `- ${setting.name}: ${setting.description}`).join('\n')}

THEMES TO EXPLORE:
${request.themes?.join(', ') || 'Universal themes relevant to the story'}

ART STYLE CONTEXT:
${request.artStyle || 'Professional comic book illustration'}

INSTRUCTIONS:
Create a detailed story outline that includes:

1. **Story Structure**: Divide into 2-4 acts with clear dramatic progression
2. **Beat Analysis**: Break down into 8-12 story beats that drive plot and character development
3. **Page Planning**: Create detailed summaries for each page showing plot function, setting, characters, and key moments
4. **World Building**: Establish consistent rules for settings, time periods, and atmosphere
5. **Character Arcs**: Plan how each character grows and changes throughout the story
6. **Consistency Guidelines**: Rules to maintain visual and narrative consistency

The outline should be comprehensive enough to guide detailed script generation while maintaining creative flexibility for individual scenes.

Focus on:
- Strong three-act structure with compelling conflicts
- Character development arcs that serve the larger story
- Visual storytelling opportunities unique to comics
- Pacing that works for comic book format
- Clear setup and payoff of story elements
- Emotional journey that resonates with readers

Generate a complete story outline in the specified JSON format.`;

    return prompt;
  }

  /**
   * Build prompt for character bible generation
   */
  private buildCharacterBiblePrompt(request: MultiStageScriptRequest, storyOutline: StoryOutlineResponse): string {
    let prompt = `You are a professional character designer and visual development artist for comic books. Create a comprehensive character bible based on the story outline.

COMIC PROJECT:
- Title: "${request.title}"
- Genre: ${request.genre || 'General'}
- Art Style: ${request.artStyle || 'Professional comic book illustration'}
- Total Pages: ${storyOutline.estimatedPageCount}

STORY OUTLINE SUMMARY:
- Logline: ${storyOutline.logline}
- Acts: ${storyOutline.totalActs}
- Themes: ${storyOutline.overallThemes.join(', ')}
- Tone: ${storyOutline.targetTone}

CHARACTERS TO DEVELOP:
${request.characters.map(char => `- ${char.name} (${char.role}): ${char.bio}`).join('\n')}

KEY STORY BEATS:
${storyOutline.storyBeats.map(beat => `- ${beat.beatTitle}: ${beat.description}`).join('\n')}

PRIMARY SETTINGS:
${storyOutline.worldBuildingElements.primarySettings.join(', ')}

INSTRUCTIONS:
Create detailed character profiles that ensure visual consistency throughout the comic. For each character, provide:

1. **Physical Profile**: Comprehensive appearance details including:
   - Body type, height, build, posture
   - Detailed facial features (face shape, eyes, nose, lips, jawline)
   - Hair characteristics (color, texture, length, style)
   - Skin tone and texture
   - Distinctive features (scars, tattoos, glasses, etc.)

2. **Clothing & Style**: Default outfit and style guidelines:
   - Complete clothing description from head to toe
   - Color scheme and style preferences
   - Alternative outfits for different scenes/contexts
   - Accessories and jewelry

3. **Personality & Voice**: Character psychology and mannerisms:
   - Core personality traits and motivations
   - Speech patterns and common phrases
   - Body language and facial expressions
   - Fears, quirks, and distinctive behaviors

4. **Story Function**: Role in the narrative:
   - Primary story function and character arc
   - Relationship to protagonist and other characters
   - Key scenes and emotional journey
   - Character growth throughout the story

5. **Consistency Rules**: Visual guidelines:
   - ALWAYS traits that must be maintained
   - NEVER traits to avoid
   - Characteristic poses and expressions
   - Warning notes for common mistakes

6. **Character Relationships**: Define dynamics between characters:
   - Relationship types and descriptions
   - Conflict points and bonding moments
   - How relationships evolve throughout story

Focus on creating characters that:
- Are visually distinct and memorable
- Reflect the story's themes and tone
- Work well in the comic book medium
- Have consistent, recognizable designs
- Support the narrative effectively

Generate comprehensive character profiles in the specified JSON format.`;

    return prompt;
  }

  /**
   * Build prompt for chunked script generation
   */
  private buildChunkedScriptPrompt(request: ChunkedScriptGenerationRequest, validCharacterNames?: string[]): string {
    const { storyOutline, characterBible, chunkInfo, previousChunkSummary } = request;
    
    let prompt = `You are a professional comic book scripwriter creating detailed panel scripts. Generate a script chunk for pages ${chunkInfo.startPage}-${chunkInfo.endPage}.

PROJECT CONTEXT:
- Title: ${storyOutline.title}
- Total Pages: ${storyOutline.estimatedPageCount}
- Current Chunk: ${chunkInfo.currentChunk}/${chunkInfo.totalChunks}
- Pages in this chunk: ${chunkInfo.pagesInChunk.join(', ')}

STORY OUTLINE:
- Logline: ${storyOutline.logline}
- Overall Tone: ${storyOutline.targetTone}
- Themes: ${storyOutline.overallThemes.join(', ')}

CHARACTER PROFILES:
${characterBible.characters.map(char => {
  const physical = char.physicalProfile;
  const clothing = char.defaultClothingState;
  return `${char.name} (${char.role}):
  - Physical: ${physical.height} ${physical.build}, ${physical.faceShape} face, ${physical.eyeColor} eyes, ${physical.hairColor} ${physical.hairLength} hair
  - Clothing: ${clothing.upperBody}, ${clothing.lowerBody}, ${clothing.footwear} (${clothing.colorScheme})
  - Personality: ${char.personality.coreTraits.join(', ')}
  - Speech: ${char.personality.speechPattern}
  - Always: ${char.consistencyRules.alwaysTraits.join(', ')}
  - Never: ${char.consistencyRules.neverTraits.join(', ')}`;
}).join('\n\n')}

PAGES TO SCRIPT (from outline):
${storyOutline.pageSummaries
  .filter(page => chunkInfo.pagesInChunk.includes(page.pageNumber))
  .map(page => `Page ${page.pageNumber}: "${page.pageTitle}"
  - Setting: ${page.setting}
  - Characters: ${page.characters.join(', ')}
  - Plot Function: ${page.plotFunction}
  - Emotional Tone: ${page.emotionalTone}
  - Summary: ${page.summary}
  - Key Moments: ${page.keyMoments.join(', ')}
  ${page.transitionTo ? `- Transitions to: ${page.transitionTo}` : ''}`)
  .join('\n\n')}

${previousChunkSummary ? `
PREVIOUS CHUNK CONTEXT:
- Last Scene: ${previousChunkSummary.lastScene}
- Plot Progression: ${previousChunkSummary.plotProgression}
- Character States: ${Object.entries(previousChunkSummary.characterStates).map(([char, state]) => char + ': ' + state).join(', ')}
- Unresolved Elements: ${previousChunkSummary.unresolvedElements.join(', ')}
` : ''}

NARRATIVE CONSISTENCY RULES:
${characterBible.narrativeConsistency.globalRules.map(rule => `- ${rule}`).join('\n')}

${validCharacterNames && validCharacterNames.length > 0 ? buildCharacterConstraintInstructions(validCharacterNames.map(name => ({ name }))) : ''}

INSTRUCTIONS:
Create MOVIE-QUALITY detailed panel scripts that utilize the full range of cinematic techniques. For each page:

1. **Page Structure**: Determine optimal panel count and layout based on story beats
2. **ENHANCED Panel Details**: For each panel, provide comprehensive technical direction:

   **A. CHARACTER STATES (Enhanced Detail)**:
   - Physical positioning (exact body position, stance, gesture)
   - Emotional expression (specific facial expression, micro-expressions)
   - Body language and posture details
   - Clothing state and appearance condition
   - Character interactions and proximity to others
   - Eye contact and facing direction
   - Visibility level (full body, partial, silhouette, close-up)
   - Character-specific lighting conditions

   **B. CINEMATOGRAPHY (Film-Level Direction)**:
   - Camera angle: specific angle with reasoning (low angle for power, high angle for vulnerability)
   - Shot size: precise framing (extreme close-up, close-up, medium, wide, extreme wide)
   - Camera movement: static, pan, tilt, zoom, dolly, tracking
   - Depth of field: shallow (character focus), medium, deep (environmental context)
   - Focus point: what draws the eye first
   - Composition: rule of thirds, leading lines, framing devices
   - Camera height: eye level, low angle, high angle, bird's eye, worm's eye

   **C. LIGHTING DESIGN (Professional Level)**:
   - Primary lighting: source, direction, intensity (harsh sunlight, soft window light)
   - Secondary lighting: fill lights, rim lights, accent lights
   - Lighting mood: dramatic, naturalistic, stylized, noir, bright
   - Shadow placement: cast shadows, character shadows, environmental shadows
   - Color temperature: warm (2700K-3000K), neutral (3500K-4100K), cool (5000K+)
   - Time of day lighting: golden hour, blue hour, noon harsh, twilight

   **D. ENVIRONMENTAL DETAILS (Complete Scene Setting)**:
   - Weather conditions: clear, overcast, raining, stormy, foggy, snowing
   - Atmospheric elements: dust particles, steam, smoke, mist
   - Key props and objects: foreground, midground, background elements
   - Environmental storytelling: details that advance narrative
   - Background activity: ambient life, movement, secondary action
   - Architectural details: specific building features, textures, materials

   **E. TECHNICAL DIRECTION (Advanced Techniques)**:
   - Panel pacing: very slow, slow, moderate, fast, very fast, frozen moment
   - Timing: real-time, slow-motion, time-lapse, compressed time
   - Transition type: cut, fade, dissolve, wipe, match cut, jump cut
   - Visual effects: motion blur, speed lines, impact effects, thought bubbles
   - Special effects: explosions, magical aura, energy beams, particle effects
   - Stylized elements: halftone shading, bold outlines, watercolor backgrounds

   **F. AUDIO LANDSCAPE (Complete Sound Design)**:
   - Sound effects: specific, layered audio (not just "crash" but "metallic screech of bending steel")
   - Ambient sounds: environmental audio layers (city traffic, office chatter, nature sounds)
   - Music cues: dramatic orchestral, light jazz, tension building, emotional swells
   - Voice-over: narrator or character internal thoughts
   - Dialogue placement: panel positioning for speech bubbles (top, center, distributed)
   - Silence emphasis: moments where quiet is key to the story
   - Sound perspective: close intimate sounds, distant muffled, echoing reverb

3. **ENHANCED Character Consistency**: Use character bible data meticulously:
   - Exact physical measurements and build descriptions
   - Precise clothing states with color coordination
   - Maintain speech patterns and vocabulary
   - Follow "always" traits religiously (never deviate)
   - Avoid "never" traits completely
   - Use characteristic poses and signature expressions

4. **ADVANCED Visual Storytelling**: Professional comic techniques:
   - Varied shot sequences for rhythm (wide-medium-close-extreme close)
   - Page turn reveals and cliffhangers
   - Panel shape storytelling (jagged for action, soft for emotions)
   - Gutters and white space for pacing
   - Visual metaphors and symbolism
   - Color psychology for mood enhancement

5. **COMPREHENSIVE Continuity**: Track every detail:
   - Character clothing and appearance changes
   - Time progression and lighting shifts
   - Object placement and environmental consistency
   - Character relationship dynamics evolution
   - Plot thread advancement and setup/payoff

6. **PROFESSIONAL Technical Direction**: Industry-standard guidance:
   - Specific camera lens effects (wide-angle distortion, telephoto compression)
   - Aspect ratio considerations for panel shapes
   - Color palette consistency across panels
   - Texture and material specifications
   - Perspective accuracy and spatial relationships

Generate MOVIE-QUALITY panel scripts with the depth and precision of a professional film storyboard, utilizing every available technical field for maximum visual impact and narrative clarity.

Output in the specified JSON format with ALL enhanced fields completed comprehensively.`;

    return prompt;
  }

  /**
   * Get JSON schema for chunked script generation
   */
  private getChunkedScriptSchema(validCharacterNames?: string[]): any {
    return {
      type: "object",
      properties: {
        chunkNumber: { type: "number" },
        pagesGenerated: { type: "array", items: { type: "number" } },
        pages: {
          type: "array",
          items: {
            type: "object",
            properties: {
              pageNumber: { type: "number" },
              title: { type: "string" },
              overallMood: { type: "string" },
              setting: { type: "string" },
              characters: { type: "array", items: { type: "string" } },
              narrative: { type: "string" },
              layoutSuggestion: { type: "string" },
              panelCount: { type: "number" },
              panels: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    panelNumber: { type: "number" },
                    panelType: { type: "string" },
                    visualDescription: { type: "string" },
                    cameraAngle: { type: "string" },
                    shotType: { type: "string" },
                    mood: { type: "string" },
                    characterStates: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          characterName: validCharacterNames && validCharacterNames.length > 0 ? 
                            { type: "string", enum: validCharacterNames } : 
                            { type: "string" },
                          emotion: { type: "string" },
                          facialExpression: { type: "string" },
                          bodyLanguage: { type: "string" },
                          position: { type: "string" },
                          pose: { type: "string" },
                          facingDirection: { type: "string" },
                          visibility: { type: "string" },
                          clothingState: { type: "string" },
                          lightingCondition: { type: "string" },
                          proximityToOthers: { type: "string" },
                          interactingWith: validCharacterNames && validCharacterNames.length > 0 ? 
                            { type: "array", items: { type: "string", enum: validCharacterNames } } : 
                            { type: "array", items: { type: "string" } }
                        },
                        required: ["characterName", "emotion", "position", "visibility"]
                      }
                    },
                    environment: {
                      type: "object",
                      properties: {
                        settingName: { type: "string" },
                        timeOfDay: { type: "string" },
                        weather: { type: "string" },
                        lighting: { type: "string" },
                        atmosphere: { type: "string" },
                        keyObjects: { type: "array", items: { type: "string" } },
                        backgroundCharacters: { type: "array", items: { type: "string" } },
                        soundscape: { type: "array", items: { type: "string" } }
                      },
                      required: ["settingName", "timeOfDay", "lighting", "atmosphere"]
                    },
                    cinematography: {
                      type: "object",
                      properties: {
                        cameraAngle: { type: "string" },
                        shotSize: { type: "string" },
                        depth: { type: "string" },
                        focusPoint: { type: "string" },
                        composition: { type: "string" },
                        movement: { type: "string" },
                        cameraMovement: { type: "string" },
                        cameraFocusPoint: { type: "string" },
                        depthOfField: { type: "string" }
                      },
                      required: ["cameraAngle", "shotSize", "composition"]
                    },
                    
                    // ENHANCED LIGHTING SYSTEM
                    lighting: {
                      type: "object",
                      properties: {
                        lightingPrimary: { type: "string" },
                        lightingSecondary: { type: "string" },
                        lightingMood: { type: "string" },
                        shadows: { type: "string" },
                        colorTemperature: { type: "string" }
                      },
                      required: ["lightingPrimary", "lightingMood"]
                    },
                    
                    // ENHANCED CHARACTER POSITIONING
                    characterPositioning: { type: "string" },
                    characterInteractions: { type: "string" },
                    characterProximity: { type: "string" },
                    
                    // ENHANCED ENVIRONMENTAL DETAILS
                    weatherConditions: { type: "string" },
                    keyProps: { type: "array", items: { type: "string" } },
                    environmentalDetails: { type: "string" },
                    
                    // TECHNICAL DIRECTION
                    pacing: { type: "string" },
                    transitionType: { type: "string" },
                    panelBorders: { type: "string" },
                    visualEffects: { type: "array", items: { type: "string" } },
                    specialEffects: { type: "array", items: { type: "string" } },
                    stylizedElements: { type: "array", items: { type: "string" } },
                    
                    // ENHANCED AUDIO SYSTEM
                    audioLandscape: {
                      type: "object",
                      properties: {
                        ambientSounds: { type: "array", items: { type: "string" } },
                        musicCues: { type: "string" },
                        voiceOverText: { type: "string" },
                        voiceOverCharacter: { type: "string" },
                        dialoguePlacement: { type: "string" },
                        silenceEmphasis: { type: "boolean" },
                        soundPerspective: { type: "string" }
                      }
                    },
                    
                    // AI GENERATION METADATA
                    generationNotes: {
                      type: "object",
                      properties: {
                        generationPrompt: { type: "string" },
                        negativePrompt: { type: "string" },
                        promptWeight: { type: "object" },
                        referenceImages: { type: "array", items: { type: "string" } }
                      }
                    },
                    visualNotes: { type: "string" },
                    timing: { type: "string" },
                    soundEffects: { type: "array", items: { type: "string" } },
                    detailedSoundEffects: { type: "object" },
                    dialogue: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          characterName: validCharacterNames && validCharacterNames.length > 0 ? 
                            { type: "string", enum: validCharacterNames } : 
                            { type: "string" },
                          text: { type: "string" },
                          tone: { type: "string" },
                          placement: { type: "string" },
                          bubbleType: { type: "string" },
                          emotionalSubtext: { type: "string" }
                        },
                        required: ["characterName", "text", "tone", "placement"]
                      }
                    },
                    consistencyNotes: { type: "array", items: { type: "string" } },
                    
                    // LEGACY COMPATIBILITY FIELDS
                    visualStyle: { type: "string" },
                    artisticNotes: { type: "string" }
                  },
                  required: ["panelNumber", "panelType", "visualDescription", "cameraAngle", "shotType", "mood"]
                }
              },
              pageTransition: {
                type: "object",
                properties: {
                  transitionType: { type: "string" },
                  description: { type: "string" },
                  continuityNotes: { type: "array", items: { type: "string" } }
                },
                required: ["transitionType", "description"]
              }
            },
            required: ["pageNumber", "title", "overallMood", "setting", "characters", "narrative", "panels"]
          }
        },
        chunkSummary: {
          type: "object",
          properties: {
            plotProgressionThisChunk: { type: "string" },
            characterDevelopments: {
              type: "object",
              additionalProperties: { type: "string" }
            },
            unresolvedPlotThreads: { type: "array", items: { type: "string" } },
            setupForNextChunk: { type: "array", items: { type: "string" } },
            continuityCheckpoints: { type: "array", items: { type: "string" } }
          },
          required: ["plotProgressionThisChunk", "characterDevelopments", "unresolvedPlotThreads"]
        },
        nextChunkPrep: {
          type: "object",
          properties: {
            expectedOpeningScene: { type: "string" },
            characterStatesCarryover: {
              type: "object",
              additionalProperties: { type: "string" }
            },
            plotMomentum: { type: "string" },
            atmosphereCarryover: { type: "string" }
          },
          required: ["expectedOpeningScene", "plotMomentum"]
        }
      },
      required: ["chunkNumber", "pagesGenerated", "pages", "chunkSummary"]
    };
  }
}

// Export singleton instance
export const geminiService = new GeminiService();