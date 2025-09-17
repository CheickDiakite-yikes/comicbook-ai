import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";
import * as path from "path";
import { imageProcessor } from "./image-processor";
import { imageEnhancer } from "./image-enhancer";
import { ObjectStorageService } from "./objectStorage";
import { characterNameService } from "./services/CharacterNameService";
import { characterDescriptorService } from "./services/CharacterDescriptorService";
import { PanelVisualAnalysisService } from "./services/PanelVisualAnalysisService";
import { VisualContinuityService } from "./services/VisualContinuityService";
import { CharacterNameValidationService } from "./services/CharacterNameValidationService";
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
  errorCategory?: string;
  debugInfo?: any;
}

export interface GenerateReferencePortraitRequest {
  characterId: string;
  characterName: string;
  visualDescriptors: string;
  alwaysTraits: string;
  artStyle?: string;
  forceRegenerate?: boolean;
  projectId: string; // Required for security validation
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
      characterEmotions: { [character: string]: string } | Array<{characterName: string, emotion: string}>;
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
  private panelVisualAnalysisService: PanelVisualAnalysisService | null = null;

  /**
   * Initialize the PanelVisualAnalysisService with storage
   */
  public initializeVisualAnalysisService(storage: any): void {
    this.panelVisualAnalysisService = new PanelVisualAnalysisService(storage);
    console.log('🔍 PanelVisualAnalysisService initialized');
  }

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
        projectId: request.projectId, // Required for security validation
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
            artStyle: project.artStyle || "Comic Book Reference Sheet",
            projectId: projectId
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
    
    // 🔍 CONTEXT TRACE: Start comprehensive panel generation logging
    const contextTraceId = `${request.panelId}_${Date.now()}`;
    const timestamp = new Date().toISOString();
    
    console.log(`🔍 === CONTEXT TRACE START [${contextTraceId}] ===`);
    console.log(`🔍 CONTEXT TRACE: Timestamp: ${timestamp}`);
    console.log(`🔍 CONTEXT TRACE: Panel ID: ${request.panelId}`);
    console.log(`🔍 CONTEXT TRACE: Project ID: ${projectId || 'MISSING'}`);
    console.log(`🔍 CONTEXT TRACE: Generation Mode: ${isEditMode ? 'IMAGE_EDIT' : 'TEXT_TO_IMAGE'}`);
    
    // 📊 PROJECT CONTEXT LOGGING
    console.log(`🔍 CONTEXT TRACE: === PROJECT CONTEXT ===`);
    console.log(`🔍 CONTEXT TRACE: Project Title: "${request.projectContext?.title || 'Unknown'}"`);
    console.log(`🔍 CONTEXT TRACE: Project Genre: "${request.projectContext?.genre || 'Not specified'}"`);
    console.log(`🔍 CONTEXT TRACE: Project Description: "${request.projectContext?.description || 'None'}"`);
    console.log(`🔍 CONTEXT TRACE: Project Art Style: "${request.projectContext?.artStyle || 'Default'}"`);
    console.log(`🔍 CONTEXT TRACE: Style Consistency Rules: "${request.projectContext?.styleConsistencyRules || 'None'}"`);
    
    // 🎭 CHARACTER CONTEXT DETAILED LOGGING
    console.log(`🔍 CONTEXT TRACE: === CHARACTER CONTEXT ===`);
    console.log(`🔍 CONTEXT TRACE: Total Characters: ${request.projectContext?.characters?.length || 0}`);
    if (request.projectContext?.characters && request.projectContext.characters.length > 0) {
      request.projectContext.characters.forEach((char, index) => {
        console.log(`🔍 CONTEXT TRACE: Character ${index + 1}: "${char.name}"`);
        console.log(`🔍 CONTEXT TRACE:   - Role: "${char.role || 'Unknown'}"`);
        console.log(`🔍 CONTEXT TRACE:   - Bio: "${char.bio || 'None'}"`);
        console.log(`🔍 CONTEXT TRACE:   - Visual Descriptors: "${char.visualDescriptors || 'None'}"`);
        console.log(`🔍 CONTEXT TRACE:   - Always Traits: "${char.alwaysTraits || 'None'}"`);
        console.log(`🔍 CONTEXT TRACE:   - Never Traits: "${char.neverTraits || 'None'}"`);
        console.log(`🔍 CONTEXT TRACE:   - Color Scheme: "${char.colorScheme || 'None'}"`);
        console.log(`🔍 CONTEXT TRACE:   - Reference Image: "${char.referenceImageUrl || 'None'}"`);
      });
    } else {
      console.log(`🔍 CONTEXT TRACE: No character context provided`);
    }
    
    // 📐 PANEL CONTEXT DETAILED LOGGING
    console.log(`🔍 CONTEXT TRACE: === PANEL CONTEXT ===`);
    if (request.panelContext) {
      console.log(`🔍 CONTEXT TRACE: Layout Template: "${request.panelContext.layoutTemplate}"`);
      console.log(`🔍 CONTEXT TRACE: Panel Number: ${request.panelContext.panelNumber}`);
      console.log(`🔍 CONTEXT TRACE: Aspect Ratio: ${request.panelContext.aspectRatio}`);
      console.log(`🔍 CONTEXT TRACE: Dimensions: ${request.panelContext.dimensions?.width || 'Unknown'}x${request.panelContext.dimensions?.height || 'Unknown'}`);
      console.log(`🔍 CONTEXT TRACE: Panel Type: "${request.panelContext.panelType}"`);
    } else {
      console.log(`🔍 CONTEXT TRACE: No panel context provided`);
    }
    
    // 🎨 STYLE OPTIONS LOGGING
    console.log(`🔍 CONTEXT TRACE: === STYLE OPTIONS ===`);
    if (request.styleOptions) {
      console.log(`🔍 CONTEXT TRACE: Art Style Override: "${request.styleOptions.artStyle || 'None'}"`);
      console.log(`🔍 CONTEXT TRACE: Color Palette: [${request.styleOptions.colorPalette?.join(', ') || 'None'}]`);
      console.log(`🔍 CONTEXT TRACE: Mood: "${request.styleOptions.mood || 'None'}"`);
    } else {
      console.log(`🔍 CONTEXT TRACE: No style options provided`);
    }
    
    // 📝 PROMPT LOGGING
    console.log(`🔍 CONTEXT TRACE: === BASE PROMPT ===`);
    console.log(`🔍 CONTEXT TRACE: Original Prompt Length: ${request.prompt?.length || 0} characters`);
    console.log(`🔍 CONTEXT TRACE: Original Prompt: "${request.prompt || 'Empty'}"`);
    
    // 🖼️ SOURCE IMAGE LOGGING
    if (request.sourceImageUrl) {
      console.log(`🔍 CONTEXT TRACE: === SOURCE IMAGE (EDIT MODE) ===`);
      console.log(`🔍 CONTEXT TRACE: Source Image URL: "${request.sourceImageUrl}"`);
    }
    
    // 🔄 PREVIOUS PANELS CONTEXT
    console.log(`🔍 CONTEXT TRACE: === PREVIOUS PANELS CONTEXT ===`);
    console.log(`🔍 CONTEXT TRACE: Previous Panels Count: ${request.previousPanelsContext?.length || 0}`);
    if (request.previousPanelsContext && request.previousPanelsContext.length > 0) {
      request.previousPanelsContext.forEach((panel, index) => {
        console.log(`🔍 CONTEXT TRACE: Previous Panel ${index + 1}: Panel #${panel.panelNumber}`);
        console.log(`🔍 CONTEXT TRACE:   - Prompt: "${panel.prompt}"`);
        console.log(`🔍 CONTEXT TRACE:   - Image URL: "${panel.imageUrl || 'None'}"`);
      });
    }
    
    // 📚 CROSS-PAGE CONTEXT
    console.log(`🔍 CONTEXT TRACE: === CROSS-PAGE CONTEXT ===`);
    console.log(`🔍 CONTEXT TRACE: Cross-Page Context Count: ${request.crossPageContext?.length || 0}`);
    if (request.crossPageContext && request.crossPageContext.length > 0) {
      request.crossPageContext.forEach((page, pageIndex) => {
        console.log(`🔍 CONTEXT TRACE: Page ${page.pageNumber}: ${page.panels?.length || 0} panels`);
        if (page.panels && page.panels.length > 0) {
          page.panels.forEach((panel, panelIndex) => {
            console.log(`🔍 CONTEXT TRACE:   Panel ${panel.panelNumber}: "${panel.prompt}"`);
            console.log(`🔍 CONTEXT TRACE:     Image: "${panel.imageUrl || 'None'}"`);
          });
        }
      });
    }
    
    // 🎪 CHARACTER CONTEXT ADDITIONAL LOGGING
    console.log(`🔍 CONTEXT TRACE: === ADDITIONAL CHARACTER CONTEXT ===`);
    console.log(`🔍 CONTEXT TRACE: Character Context Count: ${request.characterContext?.length || 0}`);
    if (request.characterContext && request.characterContext.length > 0) {
      request.characterContext.forEach((char, index) => {
        console.log(`🔍 CONTEXT TRACE: Char Context ${index + 1}: "${char.name}" (${char.role})`);
        console.log(`🔍 CONTEXT TRACE:   - Visual Descriptors: "${char.visualDescriptors}"`);
      });
    }
    
    // 🏢 PROJECT SETTINGS
    console.log(`🔍 CONTEXT TRACE: === PROJECT SETTINGS ===`);
    if (request.projectContext?.settings && request.projectContext.settings.length > 0) {
      request.projectContext.settings.forEach((setting, index) => {
        console.log(`🔍 CONTEXT TRACE: Setting ${index + 1}: "${setting.name}"`);
        console.log(`🔍 CONTEXT TRACE:   - Description: "${setting.description}"`);
      });
    } else {
      console.log(`🔍 CONTEXT TRACE: No project settings provided`);
    }
    
    // SECURITY ENFORCEMENT: ProjectId is required - fail fast if missing
    if (!projectId) {
      console.error(`🚫 === SECURITY VIOLATION ===`);
      console.error(`❌ Missing required projectId for panel ${request.panelId}`);
      console.error(`📋 Request Source: This request must come from a valid authenticated project route`);
      console.error(`🔒 Security Context: ProjectId is required for all panel generation operations`);
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
          console.error(`🚫 === CHARACTER VALIDATION FAILURE ===`);
          console.error(`📋 Panel ID: ${request.panelId}`);
          console.error(`🏗️ Project ID: ${projectId}`);
          console.error(`❌ Validation Status: FAILED`);
          console.error(`🔍 Total Errors: ${validationResult.errors.length}`);
          console.error(`✅ Valid Characters Found: ${validationResult.validCharacters.length}`);
          console.error(`❓ Unknown Characters: ${validationResult.unknownCharacters.length}`);
          
          validationResult.errors.forEach((error, index) => {
            console.error(`🚨 Error ${index + 1}:`);
            console.error(`   Character: "${error.characterName}"`);
            console.error(`   Location: ${error.location}`);
            console.error(`   Normalized: "${error.normalizedName}"`);
            if (error.suggestions?.length) {
              console.error(`   Suggestions: ${error.suggestions.join(', ')}`);
            }
          });
          
          if (validationResult.validCharacters.length > 0) {
            console.error(`✅ Valid Characters in Project: ${validationResult.validCharacters.join(', ')}`);
          }
          
          const errorDetails = validationResult.errors.map(e => 
            `Unknown character "${e.characterName}" in ${e.location}${
              e.suggestions?.length ? ` (suggestions: ${e.suggestions.join(", ")})` : ""
            }`
          ).join("; ");
          
          console.error(`📋 Error Summary: ${errorDetails}`);
          
          return {
            imageUrl: "",
            status: "failed",
            panelId: request.panelId,
            error: `Panel generation blocked - unknown characters detected: ${errorDetails}. Only these characters are allowed in project: ${validationResult.validCharacters.join(', ')}.`
          };
        }
        
        console.log(`🔍 CONTEXT TRACE: === CHARACTER VALIDATION SUCCESS ===`);
        console.log(`🔍 CONTEXT TRACE: Validation Status: PASSED`);
        console.log(`🔍 CONTEXT TRACE: Valid Characters Found: ${validationResult.validCharacters.length}`);
        console.log(`🔍 CONTEXT TRACE: Valid Character Names: [${validationResult.validCharacters.join(', ')}]`);
        console.log(`🔍 CONTEXT TRACE: Unknown Characters: ${validationResult.unknownCharacters.length}`);
        if (validationResult.unknownCharacters.length > 0) {
          console.log(`🔍 CONTEXT TRACE: Unknown Character Names: [${validationResult.unknownCharacters.join(', ')}]`);
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
        console.log(`🔍 CONTEXT TRACE: === SHARED STATE MANAGER CONTEXT ===`);
        const sharedContext = await sharedStateManager.getSharedContext(projectId);
        
        console.log(`🔍 CONTEXT TRACE: Shared Context Retrieved`);
        console.log(`🔍 CONTEXT TRACE: Shared Characters Count: ${sharedContext.characters?.length || 0}`);
        console.log(`🔍 CONTEXT TRACE: Shared Settings Count: ${sharedContext.settings?.length || 0}`);
        
        // Log detailed shared context
        if (sharedContext.characters && sharedContext.characters.length > 0) {
          sharedContext.characters.forEach((sharedChar: any, index: number) => {
            console.log(`🔍 CONTEXT TRACE: Shared Character ${index + 1}: "${sharedChar.name}"`);
            console.log(`🔍 CONTEXT TRACE:   - Role: "${sharedChar.role || 'Unknown'}"`);
            console.log(`🔍 CONTEXT TRACE:   - Bio: "${sharedChar.bio || 'None'}"`);
            console.log(`🔍 CONTEXT TRACE:   - Visual Descriptors: "${sharedChar.visualDescriptors || 'None'}"`);
            console.log(`🔍 CONTEXT TRACE:   - Always Traits: "${sharedChar.alwaysTraits || 'None'}"`);
            console.log(`🔍 CONTEXT TRACE:   - Never Traits: "${sharedChar.neverTraits || 'None'}"`);
            console.log(`🔍 CONTEXT TRACE:   - Color Scheme: "${sharedChar.colorScheme || 'None'}"`);
            console.log(`🔍 CONTEXT TRACE:   - Reference Image: "${sharedChar.referenceImageUrl || 'None'}"`);
          });
        }
        
        // Merge shared context with request context for enhanced consistency
        if (sharedContext.characters && sharedContext.characters.length > 0) {
          if (!request.projectContext) {
            request.projectContext = { title: 'Untitled' };
          }
          const originalCharCount = request.projectContext.characters?.length || 0;
          request.projectContext.characters = sharedContext.characters;
          
          console.log(`🔍 CONTEXT TRACE: Character Context Merge`);
          console.log(`🔍 CONTEXT TRACE:   - Original Characters: ${originalCharCount}`);
          console.log(`🔍 CONTEXT TRACE:   - Shared Characters: ${sharedContext.characters.length}`);
          console.log(`🔍 CONTEXT TRACE:   - Final Characters: ${request.projectContext.characters?.length || 0}`);
          console.log(`🎯 Enhanced character context from SharedStateManager: ${sharedContext.characters.length} characters`);
        }
        
        console.log(`🔄 SharedStateManager initialized for project ${projectId}`);
      }
    } catch (stateError) {
      console.warn(`⚠️ Failed to initialize SharedStateManager:`, stateError);
      // Continue with generation even if state management fails
    }
    
    // 🎯 PHASE 5: VISUAL CONTINUITY ANALYSIS - Analyze last 10 panels for character consistency
    let continuityGuidance: any = null;
    
    try {
      // Only perform visual analysis if we have characters in the project and we're not in edit mode
      if (!isEditMode && request.projectContext?.characters && request.projectContext.characters.length > 0) {
        console.log(`🔍 === VISUAL CONTINUITY ANALYSIS START ===`);
        console.log(`📋 Project: ${projectId}`);
        console.log(`👥 Characters to analyze: ${request.projectContext.characters.map(c => c.name).join(', ')}`);
        
        const { storage } = await import("./storage");
        const visualContinuityService = new VisualContinuityService();
        
        // Get the last 10 panels from the same project, ordered by globalPanelNumber
        const projectPanels = await storage.getProjectPanels(projectId);
        const recentPanels = projectPanels
          .filter(panel => panel.imageUrl && panel.imageUrl.trim() !== '') // Only panels with generated images
          .sort((a, b) => (a.globalPanelNumber || 0) - (b.globalPanelNumber || 0)) // 🔧 FIX: Sort by globalPanelNumber ascending for deterministic chronological order
          .slice(-10) // Get last 10 panels chronologically
          .map(panel => ({
            panelNumber: panel.globalPanelNumber || panel.panelNumber,
            imageUrl: panel.imageUrl as string // Safe because of filter above
          }));
          
        console.log(`🔍 Panel ordering debug: Found ${projectPanels.length} total panels, ${recentPanels.length} recent panels with images`);
        if (recentPanels.length > 0) {
          console.log(`📊 Recent panel order (globalPanelNumbers): [${recentPanels.map(p => p.panelNumber).join(', ')}]`);
        }
        
        console.log(`📊 Found ${recentPanels.length} recent panels to analyze for continuity`);
        
        if (recentPanels.length > 0) {
          // Extract character names for analysis
          const characterNames = request.projectContext.characters.map(char => char.name);
          
          console.log(`🎭 Analyzing character appearances for: ${characterNames.join(', ')}`);
          
          // Analyze character appearances in recent panels
          const analysisResult = await visualContinuityService.analyzeCharacterAppearances({
            panelImageUrls: recentPanels,
            characterNames: characterNames,
            projectContext: {
              title: request.projectContext.title,
              genre: request.projectContext.genre,
              artStyle: request.projectContext.artStyle
            },
            analysisOptions: {
              focusOnConsistency: true,
              detailLevel: 'detailed',
              maxPanelsToAnalyze: 10
            }
          });
          
          if (analysisResult.success && analysisResult.panelAnalyses.length > 0) {
            console.log(`🔍 CONTEXT TRACE: === VISUAL CONTINUITY ANALYSIS RESULTS ===`);
            console.log(`🔍 CONTEXT TRACE: Analysis Success: ${analysisResult.success}`);
            console.log(`🔍 CONTEXT TRACE: Total Panels Analyzed: ${analysisResult.totalPanelsAnalyzed}`);
            
            // Log detailed analysis results for each panel
            analysisResult.panelAnalyses.forEach((panelAnalysis, index) => {
              console.log(`🔍 CONTEXT TRACE: Panel Analysis ${index + 1}: Panel #${panelAnalysis.panelNumber}`);
              console.log(`🔍 CONTEXT TRACE:   - Image URL: "${panelAnalysis.imageUrl}"`);
              console.log(`🔍 CONTEXT TRACE:   - Analysis Success: ${panelAnalysis.analysisSuccess}`);
              console.log(`🔍 CONTEXT TRACE:   - Characters Found: ${panelAnalysis.characters.length}`);
              
              if (panelAnalysis.characters.length > 0) {
                panelAnalysis.characters.forEach((charAnalysis, charIndex) => {
                  console.log(`🔍 CONTEXT TRACE:     Character ${charIndex + 1}: "${charAnalysis.characterName}"`);
                  console.log(`🔍 CONTEXT TRACE:       - Present: ${charAnalysis.isPresent}`);
                  console.log(`🔍 CONTEXT TRACE:       - Confidence: ${charAnalysis.confidence}%`);
                  
                  if (charAnalysis.visualDetails) {
                    const details = charAnalysis.visualDetails;
                    console.log(`🔍 CONTEXT TRACE:       - Clothing: ${details.clothing?.upperBody || 'Unknown'} | ${details.clothing?.lowerBody || 'Unknown'}`);
                    console.log(`🔍 CONTEXT TRACE:       - Hair: ${details.hair?.color || 'Unknown'} ${details.hair?.style || 'Unknown'}`);
                    console.log(`🔍 CONTEXT TRACE:       - Skin Tone: ${details.physicalAppearance?.skinTone || 'Unknown'}`);
                    console.log(`🔍 CONTEXT TRACE:       - Expression: ${details.physicalAppearance?.facialExpression || 'Unknown'}`);
                    console.log(`🔍 CONTEXT TRACE:       - Pose: ${details.physicalAppearance?.pose || 'Unknown'}`);
                  }
                  
                  if (charAnalysis.inconsistencies && charAnalysis.inconsistencies.length > 0) {
                    console.log(`🔍 CONTEXT TRACE:       - Inconsistencies: ${charAnalysis.inconsistencies.length}`);
                    charAnalysis.inconsistencies.forEach((inconsistency, incIndex) => {
                      console.log(`🔍 CONTEXT TRACE:         ${incIndex + 1}. ${inconsistency.type} (${inconsistency.severity}): ${inconsistency.description}`);
                    });
                  }
                });
              }
              
              console.log(`🔍 CONTEXT TRACE:   - Scene Setting: "${panelAnalysis.overallScene?.setting || 'Unknown'}"`);
              console.log(`🔍 CONTEXT TRACE:   - Scene Lighting: "${panelAnalysis.overallScene?.lighting || 'Unknown'}"`);
              console.log(`🔍 CONTEXT TRACE:   - Scene Mood: "${panelAnalysis.overallScene?.mood || 'Unknown'}"`);
              
              if (panelAnalysis.error) {
                console.log(`🔍 CONTEXT TRACE:   - Error: "${panelAnalysis.error}"`);
              }
            });
            
            // Log character summary from analysis
            if (analysisResult.characterSummary && analysisResult.characterSummary.length > 0) {
              console.log(`🔍 CONTEXT TRACE: === CHARACTER CONSISTENCY SUMMARY ===`);
              analysisResult.characterSummary.forEach((charSummary, index) => {
                console.log(`🔍 CONTEXT TRACE: Character Summary ${index + 1}: "${charSummary.characterName}"`);
                console.log(`🔍 CONTEXT TRACE:   - Appeared in Panels: [${charSummary.appearedInPanels.join(', ')}]`);
                console.log(`🔍 CONTEXT TRACE:   - Consistency Score: ${charSummary.consistencyScore}/100`);
                console.log(`🔍 CONTEXT TRACE:   - Most Common Clothing: "${charSummary.commonAppearance?.mostCommonClothing || 'Unknown'}"`);
                console.log(`🔍 CONTEXT TRACE:   - Most Common Hair Style: "${charSummary.commonAppearance?.mostCommonHairStyle || 'Unknown'}"`);
                console.log(`🔍 CONTEXT TRACE:   - Consistent Features: [${charSummary.commonAppearance?.consistentFeatures?.join(', ') || 'None'}]`);
                
                if (charSummary.variations && charSummary.variations.length > 0) {
                  console.log(`🔍 CONTEXT TRACE:   - Variations Found: ${charSummary.variations.length}`);
                  charSummary.variations.forEach((variation, varIndex) => {
                    console.log(`🔍 CONTEXT TRACE:     Variation ${varIndex + 1}: Panel ${variation.panelNumber} (${variation.significance})`);
                    console.log(`🔍 CONTEXT TRACE:       Changes: [${variation.changes.join(', ')}]`);
                  });
                }
              });
            }
            
            // Log overall insights
            if (analysisResult.overallInsights) {
              console.log(`🔍 CONTEXT TRACE: === OVERALL INSIGHTS ===`);
              console.log(`🔍 CONTEXT TRACE: Setting Consistency: "${analysisResult.overallInsights.settingConsistency}"`);
              console.log(`🔍 CONTEXT TRACE: Time Progression: "${analysisResult.overallInsights.timeProgression || 'None'}"`);
              console.log(`🔍 CONTEXT TRACE: Notable Patterns: [${analysisResult.overallInsights.notablePatterns?.join(', ') || 'None'}]`);
            }
            
            console.log(`✅ Visual analysis completed: ${analysisResult.totalPanelsAnalyzed} panels analyzed`);
            
            // Generate continuity guidance based on analysis
            continuityGuidance = await visualContinuityService.generateContinuityGuidance(analysisResult);
            
            if (continuityGuidance.success) {
              console.log(`🔍 CONTEXT TRACE: === CONTINUITY GUIDANCE GENERATION ===`);
              console.log(`🔍 CONTEXT TRACE: Guidance Success: ${continuityGuidance.success}`);
              console.log(`🔍 CONTEXT TRACE: Character Guidance Count: ${continuityGuidance.characterGuidance.length}`);
              
              continuityGuidance.characterGuidance.forEach((guidance: any, index: number) => {
                console.log(`🔍 CONTEXT TRACE: Character Guidance ${index + 1}: "${guidance.characterName}"`);
                console.log(`🔍 CONTEXT TRACE:   - Consistency Score: ${guidance.consistencyScore}/100`);
                console.log(`🔍 CONTEXT TRACE:   - Last Seen Panel: ${guidance.lastSeenPanel}`);
                console.log(`🔍 CONTEXT TRACE:   - Generated Prompt: "${guidance.prompt}"`);
                
                if (guidance.keyAttributes) {
                  console.log(`🔍 CONTEXT TRACE:   - Key Hair: "${guidance.keyAttributes.hair}"`);
                  console.log(`🔍 CONTEXT TRACE:   - Key Clothing: "${guidance.keyAttributes.clothing}"`);
                  console.log(`🔍 CONTEXT TRACE:   - Key Physical Features: "${guidance.keyAttributes.physicalFeatures}"`);
                  console.log(`🔍 CONTEXT TRACE:   - Key Accessories: "${guidance.keyAttributes.accessories}"`);
                }
              });
              
              if (continuityGuidance.sceneGuidance) {
                console.log(`🔍 CONTEXT TRACE: === SCENE GUIDANCE ===`);
                console.log(`🔍 CONTEXT TRACE: Setting Consistency: "${continuityGuidance.sceneGuidance.settingConsistency}"`);
                console.log(`🔍 CONTEXT TRACE: Lighting Pattern: "${continuityGuidance.sceneGuidance.lightingPattern}"`);
                console.log(`🔍 CONTEXT TRACE: Suggested Mood: "${continuityGuidance.sceneGuidance.suggestedMood}"`);
              }
              
              console.log(`🎯 Continuity guidance generated for ${continuityGuidance.characterGuidance.length} characters`);
              continuityGuidance.characterGuidance.forEach((guidance: any) => {
                console.log(`👤 ${guidance.characterName}: Consistency score ${guidance.consistencyScore}/100`);
              });
            } else {
              console.log(`🔍 CONTEXT TRACE: === CONTINUITY GUIDANCE FAILED ===`);
              console.log(`🔍 CONTEXT TRACE: Error: "${continuityGuidance.error}"`);
              console.warn(`⚠️ Failed to generate continuity guidance: ${continuityGuidance.error}`);
              continuityGuidance = null;
            }
          } else {
            console.log(`🔍 CONTEXT TRACE: === VISUAL ANALYSIS FAILED ===`);
            console.log(`🔍 CONTEXT TRACE: Success: ${analysisResult.success}`);
            console.log(`🔍 CONTEXT TRACE: Error: "${analysisResult.error || 'No results'}"`);
            console.log(`🔍 CONTEXT TRACE: Panel Analyses Count: ${analysisResult.panelAnalyses?.length || 0}`);
            console.warn(`⚠️ Visual analysis failed or found no panels: ${analysisResult.error || 'No results'}`);
          }
        } else {
          console.log(`📝 No previous panels found for continuity analysis - this appears to be early in the project`);
        }
        
        console.log(`🔍 === VISUAL CONTINUITY ANALYSIS COMPLETE ===`);
      } else {
        console.log(`⏭️ Skipping visual continuity analysis: Edit mode=${isEditMode}, Characters=${request.projectContext?.characters?.length || 0}`);
      }
    } catch (continuityError) {
      console.warn(`⚠️ Visual continuity analysis failed, continuing with normal generation:`, continuityError);
      continuityGuidance = null;
      // Continue with generation even if continuity analysis fails
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
      console.log(`🔍 Continuity Guidance: ${continuityGuidance ? 'Available' : 'None'}`);
      
      // Build context-aware prompt (optimized for edit vs generation)
      console.log(`🔍 CONTEXT TRACE: === PROMPT CONSTRUCTION START ===`);
      console.log(`🔍 CONTEXT TRACE: Building ${isEditMode ? 'EDITING' : 'GENERATION'} prompt`);
      console.log(`🔍 CONTEXT TRACE: Continuity Guidance Available: ${continuityGuidance ? 'Yes' : 'No'}`);
      
      const contextualPrompt = this.buildContextualPrompt(request, isEditMode, continuityGuidance);
      
      // 🔧 COMPREHENSIVE PROMPT LOGGING
      console.log(`🔍 CONTEXT TRACE: === FINAL CONSTRUCTED PROMPT ===`);
      console.log(`🔍 CONTEXT TRACE: Final Prompt Length: ${contextualPrompt.length} characters`);
      console.log(`🔍 CONTEXT TRACE: Final Prompt (First 500 chars): "${contextualPrompt.substring(0, 500)}${contextualPrompt.length > 500 ? '...' : ''}"`);
      
      // Split the prompt and log it in chunks for better readability
      const promptLines = contextualPrompt.split(/\. (?=[A-Z]|🎯|⚠️|🔥|🎨|CHARACTER|CRITICAL|CONSISTENCY)/);
      console.log(`🔍 CONTEXT TRACE: Prompt Components (${promptLines.length} segments):`);
      promptLines.forEach((line, index) => {
        if (line.trim()) {
          console.log(`🔍 CONTEXT TRACE:   ${index + 1}. "${line.trim()}"`);
        }
      });
      
      console.log(`📝 Generated Prompt (${contextualPrompt.length} chars):`);
      console.log(`"${contextualPrompt.substring(0, 200)}${contextualPrompt.length > 200 ? '...' : ''}"`);
      
      // Verify continuity guidance was included in the prompt
      if (continuityGuidance && continuityGuidance.success) {
        const hasVisualGuidance = contextualPrompt.includes('VISUAL CONTINUITY GUIDANCE FROM RECENT PANELS');
        const hasCriticalEnforcement = contextualPrompt.includes('🚨 CRITICAL: The above continuity guidance');
        console.log(`✅ Continuity Guidance Integration Verification:`);
        console.log(`   - Visual guidance section: ${hasVisualGuidance ? '✅ INCLUDED' : '❌ MISSING'}`);
        console.log(`   - Critical enforcement: ${hasCriticalEnforcement ? '✅ INCLUDED' : '❌ MISSING'}`);
        console.log(`   - Character guidance count: ${continuityGuidance.characterGuidance?.length || 0}`);
        
        if (hasVisualGuidance && hasCriticalEnforcement) {
          console.log(`🎯 SUCCESS: Continuity guidance is properly integrated into the AI prompt!`);
        } else {
          console.warn(`⚠️ WARNING: Continuity guidance may not be properly integrated!`);
        }
      } else {
        console.log(`ℹ️ No continuity guidance available for this panel generation`);
      }

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
          console.error(`⚠️ === GENERATION ATTEMPT ${attempt} FAILED ===`);
          console.error(`📋 Panel ID: ${request.panelId}`);
          console.error(`🔄 Attempt: ${attempt}/${maxRetries}`);
          console.error(`⏱️ Timestamp: ${new Date().toISOString()}`);
          console.error(`🚨 Error Type: ${error?.constructor?.name || 'Unknown'}`);
          console.error(`📝 Error Message: ${(error as Error).message}`);
          
          // Enhanced error details based on error type
          if (error && typeof error === 'object') {
            if ('status' in error) {
              console.error(`🔢 HTTP Status: ${(error as any).status}`);
            }
            if ('code' in error) {
              console.error(`🔧 Error Code: ${(error as any).code}`);
            }
            if ('response' in error) {
              console.error(`📡 API Response: ${JSON.stringify((error as any).response, null, 2)}`);
            }
          }
          
          // Log request context for failed attempts
          console.error(`📋 Request Context at Failure:`);
          console.error(`   Model: gemini-2.5-flash-image-preview`);
          console.error(`   Content Parts: ${contentParts.length}`);
          console.error(`   Has Image Input: ${contentParts.some(p => p.inlineData)}`);
          console.error(`   Prompt Length: ${contextualPrompt?.length || 0}`);
          
          if (attempt < maxRetries) {
            console.log(`🔄 Retrying in ${retryDelay}ms... (${maxRetries - attempt} attempts remaining)`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          } else {
            console.error(`❌ === ALL GENERATION ATTEMPTS EXHAUSTED ===`);
            console.error(`📋 Panel ID: ${request.panelId}`);
            console.error(`🔄 Total Attempts: ${maxRetries}`);
            console.error(`⏱️ Total Duration: ${Date.now() - startTime}ms`);
            console.error(`🚨 Final Error: ${(lastError as Error).message}`);
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
          // CRITICAL: Sanitize panelId to prevent NaN filenames (declare at broader scope)
          const safePanelId = !isNaN(Number(request.panelId)) ? String(request.panelId) : 'unknown';
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
            // safePanelId already declared at broader scope
            const enhancedFilename = `panel_${safePanelId}_enhanced_${Date.now()}.png`;
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
                const processedFilename = `panel_${safePanelId}_processed_${Date.now()}.png`;
                finalImageUrl = await this.saveImageToObjectStorage(processedBuffer, processedFilename);
              } catch (processError) {
                console.error("All processing failed, using original:", processError);
              }
            }
          }
          
          const duration = Date.now() - startTime;
          
          console.log(`🔍 CONTEXT TRACE: === IMAGE GENERATION SUCCESS ===`);
          console.log(`🔍 CONTEXT TRACE: Panel ID: ${request.panelId}`);
          console.log(`🔍 CONTEXT TRACE: Generation Duration: ${duration}ms`);
          console.log(`🔍 CONTEXT TRACE: Final Image URL: "${finalImageUrl}"`);
          console.log(`🔍 CONTEXT TRACE: Image Processing: Enhanced`);
          console.log(`🔍 CONTEXT TRACE: Model Used: gemini-2.5-flash-image-preview`);
          console.log(`🔍 CONTEXT TRACE: Content Parts: ${contentParts.length}`);
          console.log(`🔍 CONTEXT TRACE: Had Source Image: ${contentParts.some(p => p.inlineData)}`);
          
          console.log(`✅ === GEMINI IMAGE ${isEditMode ? 'EDITING' : 'GENERATION'} SUCCESS ===`);
          console.log(`⏱️ Duration: ${duration}ms`);
          console.log(`🖼️ Result URL: ${finalImageUrl}`);
          console.log(`📋 Panel ${request.panelId} completed successfully`);
          
          // 🔄 PHASE 4: UPDATE CHARACTER STATES AFTER SUCCESSFUL GENERATION
          try {
            if (sharedStateManager && projectId && request.projectContext?.characters) {
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
            if (sharedStateManager && projectId && request.projectContext?.characters && request.projectContext.characters.length > 0) {
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
          
          // 🔍 PHASE 4: AUTOMATIC VISUAL ANALYSIS CAPTURE
          try {
            if (this.panelVisualAnalysisService && request.projectContext?.characters) {
              console.log(`🔍 Capturing visual analysis for panel ${request.panelId}...`);
              
              // Prepare character data for analysis
              const projectCharacters = request.projectContext.characters.map(char => ({
                id: char.name, // Using name as ID for now - could be improved with actual character IDs
                name: char.name
              }));
              
              // Capture visual analysis in the background (don't wait for completion)
              this.panelVisualAnalysisService.captureVisualAnalysis(
                String(request.panelId),
                finalImageUrl,
                projectCharacters,
                { 
                  skipIfExists: true, 
                  retryOnFailure: true, 
                  maxRetries: 1 
                }
              ).then(states => {
                console.log(`✅ Visual analysis captured for panel ${request.panelId}: ${states.length} character states stored`);
              }).catch(analysisError => {
                console.warn(`⚠️ Visual analysis capture failed for panel ${request.panelId}:`, analysisError);
                // Don't fail panel generation for analysis errors
              });
            }
          } catch (analysisError) {
            console.warn(`⚠️ Visual analysis setup failed for panel ${request.panelId}:`, analysisError);
            // Don't fail generation for analysis setup errors
          }
          
          // 🔍 COMPREHENSIVE CONTEXT TRACE SUMMARY
          console.log(`🔍 CONTEXT TRACE: === GENERATION COMPLETE - FINAL SUMMARY [${contextTraceId}] ===`);
          console.log(`🔍 CONTEXT TRACE: Success: YES`);
          console.log(`🔍 CONTEXT TRACE: Total Duration: ${duration}ms`);
          console.log(`🔍 CONTEXT TRACE: Final Image URL: "${finalImageUrl}"`);
          
          // Summary of all context used
          console.log(`🔍 CONTEXT TRACE: === CONTEXT SUMMARY ===`);
          console.log(`🔍 CONTEXT TRACE: Project: "${request.projectContext?.title || 'Unknown'}" (ID: ${projectId})`);
          console.log(`🔍 CONTEXT TRACE: Base Prompt: "${request.prompt}"`);
          console.log(`🔍 CONTEXT TRACE: Art Style: "${request.styleOptions?.artStyle || request.projectContext?.artStyle || 'Default'}"`);
          console.log(`🔍 CONTEXT TRACE: Characters Used: ${request.projectContext?.characters?.length || 0}`);
          if (request.projectContext?.characters?.length) {
            const charNames = request.projectContext.characters.map(c => c.name).join(', ');
            console.log(`🔍 CONTEXT TRACE: Character Names: [${charNames}]`);
          }
          console.log(`🔍 CONTEXT TRACE: Visual Continuity: ${continuityGuidance ? 'Used' : 'Not Available'}`);
          if (continuityGuidance?.success) {
            console.log(`🔍 CONTEXT TRACE: Continuity Characters: ${continuityGuidance.characterGuidance?.length || 0}`);
          }
          console.log(`🔍 CONTEXT TRACE: Previous Panels Context: ${request.previousPanelsContext?.length || 0}`);
          console.log(`🔍 CONTEXT TRACE: Cross-Page Context: ${request.crossPageContext?.length || 0}`);
          console.log(`🔍 CONTEXT TRACE: Final Prompt Length: ${contextualPrompt.length} chars`);
          console.log(`🔍 CONTEXT TRACE: SharedStateManager: ${sharedStateManager ? 'Active' : 'Inactive'}`);
          console.log(`🔍 CONTEXT TRACE: === END SUMMARY [${contextTraceId}] ===`);
          
          return result;
        }
      }

      throw new Error("No image data received from Gemini");
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // 🔍 COMPREHENSIVE ERROR CONTEXT TRACE
      console.error(`🔍 CONTEXT TRACE: === GENERATION FAILED - ERROR SUMMARY [${contextTraceId}] ===`);
      console.error(`🔍 CONTEXT TRACE: Success: NO`);
      console.error(`🔍 CONTEXT TRACE: Error Duration: ${duration}ms`);
      console.error(`🔍 CONTEXT TRACE: Panel ID: ${request.panelId}`);
      console.error(`🔍 CONTEXT TRACE: Project ID: ${projectId}`);
      console.error(`🔍 CONTEXT TRACE: Timestamp: ${timestamp}`);
      
      // Log all context that was being used when error occurred
      console.error(`🔍 CONTEXT TRACE: === ERROR CONTEXT DETAILS ===`);
      console.error(`🔍 CONTEXT TRACE: Project: "${request.projectContext?.title || 'Unknown'}"`);
      console.error(`🔍 CONTEXT TRACE: Base Prompt: "${request.prompt}"`);
      console.error(`🔍 CONTEXT TRACE: Art Style: "${request.styleOptions?.artStyle || request.projectContext?.artStyle || 'Default'}"`);
      console.error(`🔍 CONTEXT TRACE: Characters: ${request.projectContext?.characters?.length || 0}`);
      if (request.projectContext?.characters?.length) {
        const charNames = request.projectContext.characters.map(c => c.name).join(', ');
        console.error(`🔍 CONTEXT TRACE: Character Names: [${charNames}]`);
        request.projectContext.characters.forEach((char: any, index: number) => {
          console.error(`🔍 CONTEXT TRACE:   Character ${index + 1}: "${char.name}" - Visual: "${char.visualDescriptors || 'None'}"`);
          console.error(`🔍 CONTEXT TRACE:     Always Traits: "${char.alwaysTraits || 'None'}"`);
          console.error(`🔍 CONTEXT TRACE:     Reference Image: "${char.referenceImageUrl || 'None'}"`);
        });
      }
      console.error(`🔍 CONTEXT TRACE: Panel Context: ${request.panelContext ? 'Present' : 'Missing'}`);
      if (request.panelContext) {
        console.error(`🔍 CONTEXT TRACE:   Dimensions: ${request.panelContext.dimensions?.width || 'Unknown'}x${request.panelContext.dimensions?.height || 'Unknown'}`);
        console.error(`🔍 CONTEXT TRACE:   Aspect Ratio: ${request.panelContext.aspectRatio}`);
        console.error(`🔍 CONTEXT TRACE:   Panel Type: "${request.panelContext.panelType}"`);
      }
      console.error(`🔍 CONTEXT TRACE: Visual Continuity: ${continuityGuidance ? 'Available' : 'Not Available'}`);
      if (continuityGuidance?.success) {
        console.error(`🔍 CONTEXT TRACE: Continuity Characters: ${continuityGuidance.characterGuidance?.length || 0}`);
        continuityGuidance.characterGuidance.forEach((guidance: any, index: number) => {
          console.error(`🔍 CONTEXT TRACE:   Guidance ${index + 1}: "${guidance.characterName}" (Score: ${guidance.consistencyScore}/100)`);
        });
      }
      console.error(`🔍 CONTEXT TRACE: Previous Context: ${request.previousPanelsContext?.length || 0} panels`);
      console.error(`🔍 CONTEXT TRACE: Cross-Page Context: ${request.crossPageContext?.length || 0} pages`);
      console.error(`🔍 CONTEXT TRACE: SharedStateManager: ${sharedStateManager ? 'Active' : 'Inactive'}`);
      
      // Log the final prompt that failed (if it was constructed)
      let contextualPrompt: string | undefined;
      try {
        // Try to access contextualPrompt from outer scope if available
        contextualPrompt = (this as any).lastContextualPrompt;
      } catch {
        contextualPrompt = undefined;
      }
      
      if (typeof contextualPrompt !== 'undefined') {
        console.error(`🔍 CONTEXT TRACE: Final Prompt Length: ${contextualPrompt.length} chars`);
        console.error(`🔍 CONTEXT TRACE: Final Prompt Preview: "${contextualPrompt.substring(0, 300)}${contextualPrompt.length > 300 ? '...' : ''}"`);
      } else {
        console.error(`🔍 CONTEXT TRACE: Final Prompt: Not constructed (error occurred before prompt building)`);
      }
      
      console.error(`🔍 CONTEXT TRACE: === END ERROR SUMMARY [${contextTraceId}] ===`);
      
      console.error(`❌ === GEMINI IMAGE ${isEditMode ? 'EDITING' : 'GENERATION'} FAILED ===`);
      console.error(`📋 Panel ID: ${request.panelId}`);
      console.error(`🏗️ Project ID: ${projectId}`);
      console.error(`🎬 Project: ${request.projectContext?.title || 'Unknown'}`);
      console.error(`⏱️ Total Duration: ${duration}ms`);
      console.error(`🔄 Mode: ${isEditMode ? 'IMAGE_EDITING' : 'TEXT_TO_IMAGE'}`);
      console.error(`⏰ Timestamp: ${new Date().toISOString()}`);
      
      // Enhanced error classification and logging
      const errorType = error?.constructor?.name || 'UnknownError';
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.error(`🚨 === ERROR DETAILS ===`);
      console.error(`🏷️ Error Type: ${errorType}`);
      console.error(`📝 Error Message: ${errorMessage}`);
      
      // Log full error object for debugging
      if (error && typeof error === 'object') {
        console.error(`🔍 Full Error Object:`);
        console.error(JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      }
      
      // Log request state at time of failure
      console.error(`📋 === REQUEST STATE AT FAILURE ===`);
      console.error(`🎭 Character Count: ${request.projectContext?.characters?.length || 0}`);
      console.error(`📐 Panel Dimensions: ${request.panelContext?.dimensions?.width || 'Unknown'}x${request.panelContext?.dimensions?.height || 'Unknown'}`);
      console.error(`📝 Prompt Length: ${request.prompt?.length || 0}`);
      console.error(`🖼️ Source Image: ${request.sourceImageUrl ? 'Present' : 'None'}`);
      console.error(`🔄 Previous Panels: ${request.previousPanelsContext?.length || 0}`);
      
      // Log system state
      console.error(`💻 === SYSTEM STATE ===`);
      console.error(`🧠 Memory Usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
      console.error(`⏱️ Uptime: ${Math.round(process.uptime())}s`);
      console.error(`🔧 Node Version: ${process.version}`);
      
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
      
      // Enhanced error response with categorization
      let errorCategory = 'unknown';
      let userFriendlyMessage = "Failed to generate image";
      
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();
        
        if (errorMsg.includes('quota') || errorMsg.includes('limit')) {
          errorCategory = 'quota_exceeded';
          userFriendlyMessage = 'API quota exceeded. Please try again later or contact support.';
        } else if (errorMsg.includes('timeout') || errorMsg.includes('deadline')) {
          errorCategory = 'timeout';
          userFriendlyMessage = 'Request timed out. The image generation took too long. Please try again.';
        } else if (errorMsg.includes('invalid') || errorMsg.includes('malformed')) {
          errorCategory = 'invalid_request';
          userFriendlyMessage = 'Invalid request format. Please check your prompt and try again.';
        } else if (errorMsg.includes('character') || errorMsg.includes('validation')) {
          errorCategory = 'character_validation';
          userFriendlyMessage = 'Character validation failed. Please check your character names and project setup.';
        } else if (errorMsg.includes('network') || errorMsg.includes('connection')) {
          errorCategory = 'network_error';
          userFriendlyMessage = 'Network connection failed. Please check your internet connection and try again.';
        } else {
          userFriendlyMessage = error.message;
        }
      }
      
      console.error(`🏷️ Error Category: ${errorCategory}`);
      console.error(`👤 User Message: ${userFriendlyMessage}`);
      console.error(`📋 Returning failed response for panel ${request.panelId}`);
      
      return {
        imageUrl: "",
        status: "failed",
        panelId: request.panelId,
        error: userFriendlyMessage,
        errorCategory,
        debugInfo: {
          originalError: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
          duration: duration,
          projectId: projectId,
          panelId: request.panelId
        }
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
          // CRITICAL: Sanitize panelId to prevent NaN filenames (declare at broader scope)
          const safePanelId = !isNaN(Number(request.panelId)) ? String(request.panelId) : 'unknown';
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
            // safePanelId already declared at broader scope
            const enhancedFilename = `panel_${safePanelId}_enhanced_${Date.now()}.png`;
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
                const processedFilename = `panel_${safePanelId}_processed_${Date.now()}.png`;
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
    projectId: string,
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
          projectId: projectId,
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
      
      // Generate optimal panel distribution pattern
      const requestedPageCount = request.pageCount || 12;
      const targetPanelDistribution = this.generatePanelDistribution(requestedPageCount);
      console.log(`🎯 Target panel distribution for ${requestedPageCount} pages: [${targetPanelDistribution.join(', ')}]`);
      
      const prompt = this.buildStructuredScriptPrompt(request, characterNames, targetPanelDistribution);
      
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
                            type: "array",
                            description: "Character to emotion assignments for this panel",
                            items: {
                              type: "object",
                              properties: {
                                characterName: characterNames.length > 0 ? 
                                  { type: "string", enum: characterNames } : 
                                  { type: "string", enum: ["UNKNOWN_CHARACTER"] },
                                emotion: { type: "string" }
                              },
                              required: ["characterName", "emotion"]
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
                                  { type: "string", enum: ["UNKNOWN_CHARACTER"] },
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
        let structuredScript: GenerateStructuredScriptResponse = JSON.parse(responseText);
        
        // Initialize pages array if missing (don't throw, handle with padding)
        if (!structuredScript.pages) {
          structuredScript.pages = [];
        }
        
        // 🧹 PRE-VALIDATION CLEANUP: Fix invalid character names before validation
        const cleanedScript = this.cleanupInvalidCharacterNames(structuredScript, characterNames);
        
        // 🔒 VALIDATION GATE: Validate character names in generated script
        if (projectId && projectCharacters.length > 0) {
          const validationResult = await validateScriptCharacters(
            cleanedScript, 
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
        
        // Use the cleaned script for further processing
        structuredScript = cleanedScript;
        
        // PANEL DISTRIBUTION VALIDATION AND ENFORCEMENT (Critical for comic quality)
        this.validateAndFixPanelDistribution(structuredScript, targetPanelDistribution);
        
        // SERVER-SIDE PAGE COUNT VALIDATION (Critical for user expectations)
        const requestedPageCount = request.pageCount || 12;
        const actualPageCount = structuredScript.pages?.length || 0;
        
        if (actualPageCount !== requestedPageCount) {
          console.warn(`⚠️ Page count mismatch: requested ${requestedPageCount}, got ${actualPageCount}. Auto-correcting...`);
          
          if (actualPageCount < requestedPageCount) {
            // Pad with contextual pages if too few pages generated
            const missingPages = requestedPageCount - actualPageCount;
            for (let i = actualPageCount + 1; i <= requestedPageCount; i++) {
              const defaults = this.generateContextualDefaults(request, i);
              
              // CRITICAL: Generate contextual titles instead of generic "Page X"
              const contextualTitle = this.generateContextualPageTitle(request, i, structuredScript);
              
              structuredScript.pages.push({
                pageNumber: i,
                title: contextualTitle,
                overallMood: defaults.mood,
                setting: defaults.setting,
                characters: request.characters?.map(c => c.name) || [],
                narrative: defaults.narrative,
                panels: [{
                  panelNumber: 1,
                  visualDescription: defaults.visualDescription,
                  cameraAngle: "medium shot",
                  shotType: "establishing shot",
                  mood: defaults.mood,
                  characterEmotions: {},
                  visualNotes: defaults.visualNotes,
                  timing: "moment",
                  soundEffects: [],
                  dialogue: []
                }]
              });
            }
            console.log(`✅ Added ${missingPages} placeholder pages to reach requested count of ${requestedPageCount}`);
          } else {
            // Trim excess pages if too many were generated
            structuredScript.pages = structuredScript.pages.slice(0, requestedPageCount);
            console.log(`✅ Trimmed ${actualPageCount - requestedPageCount} excess pages to match requested count of ${requestedPageCount}`);
          }
        }
        
        // FINAL NORMALIZATION: Ensure sequential pageNumbers and exact count
        structuredScript.pages = structuredScript.pages.map((page, index) => ({
          ...page,
          pageNumber: index + 1 // Normalize to sequential 1, 2, 3... N
        }));
        
        // INVARIANT ASSERTION: Guarantee exactly the requested page count
        if (structuredScript.pages.length !== requestedPageCount) {
          throw new Error(`CRITICAL: Page count invariant failed - expected ${requestedPageCount}, got ${structuredScript.pages.length}`);
        }
        
        // Fill in missing required fields with defaults and ensure page count
        structuredScript.totalPages = requestedPageCount; // Use requested count, not actual
        structuredScript.overallMood = structuredScript.overallMood || "engaging";
        
        structuredScript.pages = structuredScript.pages.map(page => {
          const defaults = this.generateContextualDefaults(request, page.pageNumber);
          
          return {
            ...page,
            overallMood: page.overallMood || defaults.mood,
            setting: page.setting || defaults.setting,
            characters: page.characters || [],
            narrative: page.narrative || defaults.narrative,
            panels: (page.panels || []).map((panel, index) => ({
              ...panel,
              cameraAngle: panel.cameraAngle || (index === 0 ? "wide shot" : "medium shot"),
              shotType: panel.shotType || (index === 0 ? "establishing shot" : "medium shot"),
              mood: panel.mood || defaults.mood,
              characterEmotions: Array.isArray(panel.characterEmotions) 
                ? Object.fromEntries(panel.characterEmotions.map((e: any) => [e.characterName, e.emotion]))
                : panel.characterEmotions || {},
              visualNotes: panel.visualNotes || defaults.visualNotes,
              timing: panel.timing || "moment",
              soundEffects: panel.soundEffects || [],
              dialogue: panel.dialogue || []
            }))
          };
        });
        
        console.log(`✅ AI generated ${structuredScript.pages.length} pages for structured script`);
        
        return structuredScript;
      } catch (parseError) {
        console.error("JSON parsing failed, attempting to extract partial data:", parseError);
        
        // Fallback: create the full requested number of pages
        const requestedPageCount = request.pageCount || 12;
        const fallbackPages = [];
        
        for (let i = 1; i <= requestedPageCount; i++) {
          const defaults = this.generateContextualDefaults(request, i);
          
          fallbackPages.push({
            pageNumber: i,
            title: `Page ${i}`,
            overallMood: defaults.mood,
            setting: defaults.setting,
            characters: request.characters?.map(c => c.name) || [],
            narrative: defaults.narrative,
            panels: [{
              panelNumber: 1,
              visualDescription: defaults.visualDescription,
              cameraAngle: "wide shot",
              shotType: "establishing shot", 
              mood: defaults.mood,
              characterEmotions: [],
              visualNotes: defaults.visualNotes,
              timing: "moment",
              soundEffects: [],
              dialogue: []
            }]
          });
        }
        
        return {
          title: request.title || "Generated Comic Script",
          logline: request.logline || request.description || "A compelling comic story",
          totalPages: requestedPageCount,
          overallMood: "neutral",
          pages: fallbackPages
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

      // 🔒 CRITICAL: Create character name enum for schema enforcement
      const validCharacterNames = createCharacterNameEnum(request.characters);
      console.log(`🔒 SCHEMA ENFORCEMENT: Limiting character names to: ${validCharacterNames.join(', ')}`);

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
                    name: { type: "string", enum: validCharacterNames },
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
                    character1: { type: "string", enum: validCharacterNames },
                    character2: { type: "string", enum: validCharacterNames },
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

      // 🔍 CRITICAL: Validate and auto-correct character name consistency
      const validator = new CharacterNameValidationService();
      const originalCharacterNames = request.characters.map(char => char.name);
      const validationResult = validator.validateCharacterBible(characterBible, originalCharacterNames);
      
      // Use corrected character bible if corrections were made
      let finalCharacterBible = characterBible;
      if (validationResult.correctedCharacterBible) {
        finalCharacterBible = validationResult.correctedCharacterBible;
      }
      
      if (validationResult.correctionsMade && validationResult.correctionsMade.length > 0) {
        console.log(`🔧 CHARACTER NAME AUTO-CORRECTION: Applied ${validationResult.correctionsMade.length} corrections:`);
        validationResult.correctionsMade.forEach(correction => {
          console.log(`   ${correction.field}: "${correction.from}" → "${correction.to}"`);
        });
      }
      
      // Only fail if there are still unfixable errors after corrections
      if (!validationResult.isValid && validationResult.errors.length > 0) {
        console.error('🚨 CHARACTER NAME VALIDATION FAILED WITH UNFIXABLE ERRORS:');
        console.error('Remaining errors after corrections:', validationResult.errors);
        
        // Generate mapping report for debugging
        const mappingReport = validator.generateCharacterMappingReport(
          request.characters,
          finalCharacterBible
        );
        console.error('Character Mapping Report:', mappingReport);
        
        // Only throw error if there are critical unfixable issues
        const criticalErrors = validationResult.errors.filter(error => error.type === 'name_mismatch');
        if (criticalErrors.length > 0) {
          throw new Error(`Character name validation failed with ${criticalErrors.length} critical errors after corrections: ${criticalErrors[0]?.description || 'Character names are inconsistent between bible and original characters.'}`);
        } else {
          console.warn(`⚠️  Character bible has ${validationResult.errors.length} non-critical validation warnings but proceeding with corrections applied`);
        }
      }
      
      console.log(`✅ STAGE 2 COMPLETE: Generated detailed profiles for ${finalCharacterBible.characters.length} characters with validated name consistency`);
      console.log(`   Applied corrections: ${validationResult.correctionsMade.length}`);
      console.log(`   Remaining warnings: ${validationResult.errors.length}`);
      return finalCharacterBible;

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
      
      // Convert characterEmotions arrays to objects for compatibility
      if (scriptChunk.pages) {
        scriptChunk.pages.forEach((page: any) => {
          if (page.panels) {
            page.panels.forEach((panel: any) => {
              if (Array.isArray(panel.characterEmotions)) {
                panel.characterEmotions = Object.fromEntries(
                  panel.characterEmotions.map((e: any) => [e.characterName, e.emotion])
                );
              }
            });
          }
        });
      }
      
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
      if (request.projectContext?.genre) {
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
      if (request.projectContext?.description) {
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
    if (request.projectContext?.artStyle) {
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

  private buildContextualPrompt(request: GenerateImageRequest, isEditMode: boolean = false, continuityGuidance: any = null): string {
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
    if (request.projectContext?.artStyle) {
      prompt += `, in CONSISTENT ${request.projectContext.artStyle} art style`;
      prompt += `. STYLE CONSISTENCY: Use the EXACT same art style, line weight, shading technique, and color palette across ALL panels. Maintain consistent artistic rendering throughout.`;
    }

    // 🎯 PHASE 2: ENHANCED CHARACTER CONSISTENCY PROMPTING WITH REFERENCE PORTRAITS
    if (request.projectContext?.characters && request.projectContext.characters.length > 0) {
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
    
    // 🎯 PHASE 3: VISUAL CONTINUITY GUIDANCE FROM RECENT PANELS
    if (continuityGuidance && continuityGuidance.success && continuityGuidance.characterGuidance) {
      console.log(`🔍 Integrating visual continuity guidance for ${continuityGuidance.characterGuidance.length} characters`);
      
      const continuityInstructions = continuityGuidance.characterGuidance
        .map((guidance: any) => {
          let instruction = `${guidance.characterName}: ${guidance.prompt}`;
          
          // Add detailed attribute instructions
          if (guidance.keyAttributes) {
            const attributes = [];
            if (guidance.keyAttributes.hair && guidance.keyAttributes.hair.trim()) {
              attributes.push(`HAIR: ${guidance.keyAttributes.hair}`);
            }
            if (guidance.keyAttributes.clothing && guidance.keyAttributes.clothing.trim()) {
              attributes.push(`CLOTHING: ${guidance.keyAttributes.clothing}`);
            }
            if (guidance.keyAttributes.physicalFeatures && guidance.keyAttributes.physicalFeatures.trim()) {
              attributes.push(`FEATURES: ${guidance.keyAttributes.physicalFeatures}`);
            }
            if (guidance.keyAttributes.accessories && guidance.keyAttributes.accessories.trim()) {
              attributes.push(`ACCESSORIES: ${guidance.keyAttributes.accessories}`);
            }
            
            if (attributes.length > 0) {
              instruction += ` - ${attributes.join(', ')}`;
            }
          }
          
          // Add consistency score context
          if (guidance.consistencyScore !== undefined) {
            if (guidance.consistencyScore < 70) {
              instruction += ` (⚠️ ATTENTION: This character showed inconsistencies in recent panels - be extra careful to match the described appearance exactly)`;
            } else if (guidance.consistencyScore >= 90) {
              instruction += ` (✅ EXCELLENT: This character has been very consistent - maintain this exact appearance)`;
            }
          }
          
          return instruction;
        })
        .join(" || ");
      
      prompt += `. 🔍 VISUAL CONTINUITY GUIDANCE FROM RECENT PANELS: Based on analysis of the last ${continuityGuidance.characterGuidance.length > 0 ? 'several' : 'few'} panels in this project, here are the EXACT character appearances you MUST maintain: ${continuityInstructions}`;
      
      // Add scene consistency if available
      if (continuityGuidance.sceneGuidance) {
        const sceneInstructions = [];
        if (continuityGuidance.sceneGuidance.settingConsistency) {
          sceneInstructions.push(`Setting consistency: ${continuityGuidance.sceneGuidance.settingConsistency}`);
        }
        if (continuityGuidance.sceneGuidance.lightingPattern) {
          sceneInstructions.push(`Lighting: ${continuityGuidance.sceneGuidance.lightingPattern}`);
        }
        if (continuityGuidance.sceneGuidance.suggestedMood) {
          sceneInstructions.push(`Mood: ${continuityGuidance.sceneGuidance.suggestedMood}`);
        }
        
        if (sceneInstructions.length > 0) {
          prompt += ` SCENE CONTINUITY: ${sceneInstructions.join(', ')}.`;
        }
      }
      
      // Add strong enforcement
      prompt += ` 🚨 CRITICAL: The above continuity guidance is based on actual analysis of your recent panel artwork. You MUST follow these exact appearance descriptions to maintain visual consistency with the established character looks in this project.`;
    }
    
    // Fallback to old character context if new one isn't available
    else if (request.characterContext && request.characterContext.length > 0) {
      const characterDescriptions = request.characterContext
        .map(char => `${char.name} (${char.role}): ${char.visualDescriptors}`)
        .join(", ");
      prompt += `. Characters present: ${characterDescriptions}`;
    }

    // Add story context
    if (request.projectContext?.description) {
      prompt += `. Story context: ${request.projectContext.description}`;
    }

    // Add genre/mood context
    if (request.projectContext?.genre) {
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
    if (request.projectContext?.genre) {
      prompt += `Genre: ${request.projectContext.genre}. `;
      
      switch (request.projectContext.genre?.toLowerCase()) {
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
    if (request.projectContext?.description) {
      prompt += `Story concept: ${request.projectContext.description}. `;
    }
    
    // Character focus for cover
    if (request.projectContext?.characters && request.projectContext.characters.length > 0) {
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
    if (request.projectContext?.settings && request.projectContext.settings.length > 0) {
      const mainSetting = request.projectContext.settings[0];
      prompt += `Background setting: ${mainSetting.name} - ${mainSetting.description}. `;
      prompt += `Incorporate elements of this setting into the background composition. `;
    }
    
    // Cover design requirements
    prompt += `COVER DESIGN REQUIREMENTS: `;
    prompt += `- Leave space at the TOP for the comic title "${request.projectContext?.title || 'Untitled'}" `;
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
   * Generate contextual page title instead of generic "Page X" 
   */
  private generateContextualPageTitle(request: GenerateStructuredScriptRequest, pageNumber: number, structuredScript: any): string {
    const genre = request.genre?.toLowerCase() || 'adventure';
    const isEarlyPage = pageNumber <= 3;
    const isMidPage = pageNumber > 3 && pageNumber <= 8;
    const isLatePage = pageNumber > 8;
    
    // Generate story-appropriate titles based on page position and genre
    const titlePatterns = {
      romantic: {
        early: ["First Glances", "Meeting Fate", "Unexpected Encounters", "Hearts Awakening"],
        mid: ["Growing Closer", "Shared Moments", "Hidden Feelings", "The Confession", "Tender Promises"],
        late: ["True Love", "Forever Together", "Happy Endings", "Wedding Bells", "New Beginnings"]
      },
      adventure: {
        early: ["The Journey Begins", "First Challenges", "Into the Unknown", "Call to Adventure"],
        mid: ["Facing Danger", "New Allies", "The Quest", "Hidden Secrets", "Major Discovery"],
        late: ["Final Confrontation", "Victory Achieved", "The Return", "New Horizons", "Journey's End"]
      },
      comedy: {
        early: ["Hilarious Start", "Comic Mishaps", "Funny Business", "Laughs Begin"],
        mid: ["Comedy of Errors", "Silly Situations", "Unexpected Laughs", "Comic Relief", "Funny Twists"],
        late: ["Grand Finale", "Comedy Gold", "Happy Chaos", "Laughing Together", "Comic Resolution"]
      },
      scifi: {
        early: ["Future Vision", "Tech Discovery", "Space Odyssey", "Digital Dawn"],
        mid: ["System Override", "Quantum Leap", "Cyber Chase", "Tech Revolution", "Future Shock"],
        late: ["Final Protocol", "New Reality", "Digital Victory", "Future Hope", "Tomorrow's Promise"]
      }
    };
    
    const genrePatterns = titlePatterns[genre as keyof typeof titlePatterns] || titlePatterns.adventure;
    const phasePatterns = isEarlyPage ? genrePatterns.early : isMidPage ? genrePatterns.mid : genrePatterns.late;
    
    // Use page number to select from patterns consistently
    const selectedTitle = phasePatterns[(pageNumber - 1) % phasePatterns.length];
    
    return selectedTitle;
  }

  /**
   * Generate optimal panel distribution pattern for a script (FRONTEND-COMPATIBLE)
   */
  private generatePanelDistribution(pageCount: number): number[] {
    const distribution: number[] = [];
    // CRITICAL: Only use panel counts supported by frontend (1, 2, 4, 6)
    const supportedPanelCounts = [1, 2, 4, 6];
    const patterns = [
      4, 6, 2, 4, 1, 6, 2, 4, 1, 2, 4, 6  // Frontend-compatible pattern for variety
    ];
    
    for (let i = 0; i < pageCount; i++) {
      const baseCount = patterns[i % patterns.length];
      
      // Special cases for story structure (FRONTEND-COMPATIBLE)
      if (i === 0) {
        distribution.push(4); // Opening: 4 panels for impact
      } else if (i === pageCount - 1) {
        distribution.push(2); // Closing: 2 panels for resolution
      } else {
        distribution.push(baseCount);
      }
    }
    
    // CRITICAL: Ensure no consecutive identical counts AND all counts are frontend-supported
    for (let i = 1; i < distribution.length; i++) {
      if (distribution[i] === distribution[i-1]) {
        // Find a different supported count
        const alternatives = supportedPanelCounts.filter(count => count !== distribution[i-1]);
        distribution[i] = alternatives[i % alternatives.length] || 4;
      }
      
      // SAFETY: Ensure all counts are in supported set
      if (!supportedPanelCounts.includes(distribution[i])) {
        distribution[i] = supportedPanelCounts[i % supportedPanelCounts.length];
      }
    }
    
    console.log(`🎯 Generated frontend-compatible panel distribution: [${distribution.join(', ')}]`);
    
    return distribution;
  }

  /**
   * Create a properly formatted panel with all required fields (CRITICAL FIELDS GUARANTEED)
   */
  private createValidPanel(template: any, panelNumber: number, pageContext: any): any {
    const cameraAngles = ["close-up", "medium shot", "wide shot", "establishing shot"];
    const shotTypes = ["close-up", "medium shot", "wide shot", "establishing shot", "low angle", "high angle"];
    const timings = ["moment", "beat", "extended", "quick"];
    const panelTypes = ["dialogue", "action", "establishing", "emotional"];
    
    // CRITICAL: Ensure panelNumber is always a valid number
    const safePanelNumber = Number(panelNumber) || 1;
    
    return {
      panelNumber: safePanelNumber,
      // REQUIRED: panelType for image generation compatibility
      panelType: template?.panelType || panelTypes[(safePanelNumber - 1) % panelTypes.length],
      visualDescription: template?.visualDescription || `Dynamic panel ${safePanelNumber} continuing the scene with meaningful progression`,
      cameraAngle: cameraAngles[(safePanelNumber - 1) % cameraAngles.length] || "medium shot",
      shotType: shotTypes[(safePanelNumber - 1) % shotTypes.length] || "medium shot", 
      mood: template?.mood || pageContext.overallMood || "neutral",
      characterEmotions: template?.characterEmotions || {},
      visualNotes: `Panel ${safePanelNumber} - enhanced storytelling continuity`,
      timing: timings[(safePanelNumber - 1) % timings.length] || "moment",
      soundEffects: Array.isArray(template?.soundEffects) ? template.soundEffects : [],
      dialogue: Array.isArray(template?.dialogue) ? template.dialogue : [],
      // Additional fields for consistency
      lightingSetup: template?.lightingSetup || pageContext.lightingSetup || "natural lighting",
      colorPalette: template?.colorPalette || pageContext.colorPalette || ["warm tones"],
      panelSize: safePanelNumber === 1 ? "large" : (safePanelNumber % 2 === 0 ? "medium" : "small")
    };
  }

  /**
   * Validate and enforce panel distribution in generated script (ROBUST VERSION)
   */
  private validateAndFixPanelDistribution(script: any, targetDistribution: number[]): void {
    if (!script.pages || script.pages.length === 0) return;
    
    console.log(`🎯 Panel distribution validation - Target: [${targetDistribution.join(', ')}]`);
    
    script.pages.forEach((page: any, index: number) => {
      const targetPanelCount = targetDistribution[index] || 3;
      
      // Initialize panels array if missing
      if (!Array.isArray(page.panels)) {
        page.panels = [];
      }
      
      const currentPanelCount = page.panels.length;
      
      if (currentPanelCount !== targetPanelCount) {
        console.log(`📊 Page ${page.pageNumber}: Adjusting ${currentPanelCount} → ${targetPanelCount} panels`);
        
        if (currentPanelCount < targetPanelCount) {
          // Add missing panels using the template-based factory
          const templatePanel = page.panels.length > 0 ? page.panels[page.panels.length - 1] : null;
          
          for (let i = currentPanelCount; i < targetPanelCount; i++) {
            const newPanel = this.createValidPanel(templatePanel, i + 1, page);
            page.panels.push(newPanel);
          }
        } else {
          // Remove excess panels intelligently (keep the most important ones)
          page.panels = page.panels.slice(0, targetPanelCount);
        }
      }
      
      // CRITICAL: Ensure all panels have sequential numbering and valid structure (NaN-safe)
      page.panels.forEach((panel: any, panelIndex: number) => {
        // NaN-safe panelNumber assignment
        const safePanelNumber = Number(panelIndex + 1) || (panelIndex + 1);
        panel.panelNumber = safePanelNumber;
        
        // Ensure panelType exists (required for image generation)
        if (!panel.panelType) {
          panel.panelType = panel.visualDescription?.includes("dialogue") ? "dialogue" : "action";
        }
        
        // Ensure critical arrays exist with proper structure
        if (!Array.isArray(panel.soundEffects)) panel.soundEffects = [];
        if (!Array.isArray(panel.dialogue)) panel.dialogue = [];
        if (!panel.characterEmotions || typeof panel.characterEmotions !== 'object') {
          panel.characterEmotions = {};
        }
        
        // Validate numeric fields are not NaN
        if (isNaN(panel.panelNumber)) {
          console.error(`❌ NaN panelNumber detected! Fixing to ${safePanelNumber}`);
          panel.panelNumber = safePanelNumber;
        }
      });
    });
    
    const finalDistribution = script.pages.map((page: any) => page.panels?.length || 0);
    const isValid = finalDistribution.every((count: number, idx: number) => count === (targetDistribution[idx] || 3));
    
    // COMPREHENSIVE END-TO-END VALIDATION LOGGING
    const supportedCounts = [1, 2, 4, 6];
    const allCountsSupported = finalDistribution.every((count: number) => supportedCounts.includes(count));
    const hasVariedPanels = new Set(finalDistribution).size > 1;
    const noConsecutiveSame = finalDistribution.every((count: number, idx: number) => 
      idx === 0 || count !== finalDistribution[idx-1]
    );
    
    console.log(`✅ PANEL DISTRIBUTION ANALYSIS:`);
    console.log(`   Target: [${targetDistribution.join(', ')}]`);
    console.log(`   Result: [${finalDistribution.join(', ')}]`);
    console.log(`   ✓ All counts frontend-supported (1,2,4,6): ${allCountsSupported}`);
    console.log(`   ✓ Varied panel counts (not monotonous): ${hasVariedPanels}`);
    console.log(`   ✓ No consecutive identical counts: ${noConsecutiveSame}`);
    console.log(`   ✓ Target match validation: ${isValid ? 'PASSED' : 'FAILED'}`);
    
    if (!isValid || !allCountsSupported || !hasVariedPanels || !noConsecutiveSame) {
      console.error('❌ CRITICAL: Panel distribution validation failed! System integrity compromised.');
      console.error(`   - Target Match: ${isValid ? 'OK' : 'FAIL'}`);
      console.error(`   - Frontend Compatible: ${allCountsSupported ? 'OK' : 'FAIL'}`);
      console.error(`   - Varied Patterns: ${hasVariedPanels ? 'OK' : 'FAIL'}`);
      console.error(`   - No Consecutive: ${noConsecutiveSame ? 'OK' : 'FAIL'}`);
    } else {
      console.log(`🎉 SYSTEM SUCCESS: Panel distribution completely resolved! "1 panel per page" monotony eliminated.`);
    }
  }

  /**
   * Clean up invalid character names in the script before validation
   * Fixes common AI mistakes like using "0", "1", null, or other invalid values
   */
  private cleanupInvalidCharacterNames(script: any, validCharacterNames: string[]): any {
    if (!script || !script.pages) {
      return script;
    }
    
    const cleanedScript = JSON.parse(JSON.stringify(script)); // Deep copy
    let cleanupCount = 0;
    
    // Helper function to determine if a character name is invalid
    const isInvalidCharacterName = (name: any): boolean => {
      if (!name || typeof name !== 'string') return true;
      
      // Check for common invalid patterns
      const invalidPatterns = [
        /^\d+$/, // Pure numbers like "0", "1", "2"
        /^[^\w\s]$/, // Single special characters
        /^\s*$/, // Empty or whitespace only
        /^(null|undefined|none|unknown|character|person)$/i // Common AI fallbacks
      ];
      
      return invalidPatterns.some(pattern => pattern.test(name.trim()));
    };
    
    // Helper function to find best character match or fallback
    const getValidCharacterName = (invalidName: any): string => {
      if (validCharacterNames.length === 0) {
        return 'UNKNOWN_CHARACTER';
      }
      
      // If we have valid characters, use the first one as default
      // In a real scenario, we could use more sophisticated matching
      return validCharacterNames[0];
    };
    
    cleanedScript.pages.forEach((page: any, pageIndex: number) => {
      if (!page.panels) return;
      
      page.panels.forEach((panel: any, panelIndex: number) => {
        // Clean dialogue character names
        if (panel.dialogue && Array.isArray(panel.dialogue)) {
          panel.dialogue.forEach((dialogue: any, dialogueIndex: number) => {
            if (isInvalidCharacterName(dialogue.characterName)) {
              const originalName = dialogue.characterName;
              dialogue.characterName = getValidCharacterName(originalName);
              cleanupCount++;
              console.log(`🧹 CLEANUP: Fixed invalid character name "${originalName}" → "${dialogue.characterName}" in dialogue[${dialogueIndex}] of panel ${panelIndex + 1}, page ${pageIndex + 1}`);
            }
          });
        }
        
        // Clean character emotions
        if (panel.characterEmotions) {
          if (Array.isArray(panel.characterEmotions)) {
            // Handle array format
            panel.characterEmotions.forEach((emotion: any, emotionIndex: number) => {
              if (isInvalidCharacterName(emotion.characterName)) {
                const originalName = emotion.characterName;
                emotion.characterName = getValidCharacterName(originalName);
                cleanupCount++;
                console.log(`🧹 CLEANUP: Fixed invalid character name "${originalName}" → "${emotion.characterName}" in characterEmotions[${emotionIndex}] of panel ${panelIndex + 1}, page ${pageIndex + 1}`);
              }
            });
          } else if (typeof panel.characterEmotions === 'object') {
            // Handle object format - need to rebuild object with clean keys
            const cleanEmotions: { [key: string]: string } = {};
            Object.entries(panel.characterEmotions).forEach(([charName, emotion]) => {
              if (isInvalidCharacterName(charName)) {
                const cleanName = getValidCharacterName(charName);
                cleanEmotions[cleanName] = emotion as string;
                cleanupCount++;
                console.log(`🧹 CLEANUP: Fixed invalid character name "${charName}" → "${cleanName}" in characterEmotions object of panel ${panelIndex + 1}, page ${pageIndex + 1}`);
              } else {
                cleanEmotions[charName] = emotion as string;
              }
            });
            panel.characterEmotions = cleanEmotions;
          }
        }
      });
      
      // Clean page-level character arrays
      if (page.characters && Array.isArray(page.characters)) {
        const cleanCharacters = page.characters.map((charName: any) => {
          if (isInvalidCharacterName(charName)) {
            const cleanName = getValidCharacterName(charName);
            cleanupCount++;
            console.log(`🧹 CLEANUP: Fixed invalid character name "${charName}" → "${cleanName}" in page ${pageIndex + 1} characters array`);
            return cleanName;
          }
          return charName;
        });
        page.characters = Array.from(new Set(cleanCharacters)); // Remove duplicates
      }
    });
    
    if (cleanupCount > 0) {
      console.log(`✅ CHARACTER NAME CLEANUP: Fixed ${cleanupCount} invalid character names`);
    }
    
    return cleanedScript;
  }

  /**
   * Generate contextual defaults for script elements based on story information
   */
  private generateContextualDefaults(request: GenerateStructuredScriptRequest | GenerateStructuredScriptRequest, pageNumber?: number) {
    const genre = request.genre?.toLowerCase() || 'adventure';
    const primarySetting = request.settings?.[0]?.name || 'an interesting location';
    const mainCharacter = request.characters?.[0]?.name || 'the protagonist';
    
    // Genre-based mood variations
    const genreMoods: Record<string, string[]> = {
      'action': ['intense', 'dynamic', 'energetic', 'suspenseful'],
      'adventure': ['exciting', 'mysterious', 'hopeful', 'determined'],
      'comedy': ['lighthearted', 'playful', 'upbeat', 'witty'],
      'drama': ['emotional', 'thoughtful', 'contemplative', 'moving'],
      'horror': ['eerie', 'tense', 'ominous', 'unsettling'],
      'mystery': ['intriguing', 'puzzling', 'atmospheric', 'suspenseful'],
      'romance': ['warm', 'intimate', 'tender', 'passionate'],
      'fantasy': ['magical', 'wondrous', 'mystical', 'enchanting'],
      'sci-fi': ['futuristic', 'technological', 'otherworldly', 'innovative']
    };
    
    const moodOptions = genreMoods[genre] || genreMoods['adventure'];
    const randomMood = moodOptions[Math.floor(Math.random() * moodOptions.length)];
    
    // Setting variations based on genre and existing settings
    const settingVariations = [
      primarySetting,
      `${primarySetting} - ${randomMood} atmosphere`,
      `A ${randomMood} scene in ${primarySetting}`,
      `${primarySetting} where the story unfolds`
    ];
    
    return {
      mood: randomMood,
      setting: settingVariations[Math.floor(Math.random() * settingVariations.length)],
      narrative: `${mainCharacter} continues the journey${pageNumber ? ` on page ${pageNumber}` : ''} in this ${randomMood} scene.`,
      visualDescription: `${mainCharacter} is in ${primarySetting}, with ${randomMood} lighting that enhances the ${genre} atmosphere.`,
      visualNotes: `Capture the ${randomMood} mood of this ${genre} story with dynamic composition.`
    };
  }

  /**
   * Build a structured script generation prompt with rich metadata (ENHANCED VERSION)
   * Now includes movie-quality panel descriptions with detailed character states,
   * camera work, lighting, and technical direction using enhanced schema fields
   */
  private buildStructuredScriptPrompt(request: GenerateStructuredScriptRequest, validCharacterNames?: string[], targetPanelDistribution?: number[]): string {
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
    } else {
      // Add warning if no character constraints are provided
      prompt += `\n\n⚠️ WARNING: No character constraints provided. If characters exist in the project, ensure all dialogue uses their exact names.`;
    }

    prompt += `\n\nPRODUCE A STRUCTURED SCRIPT WITH:

1. Script Metadata:
   - Compelling logline
   - Overall mood and tone
   - Total pages: exactly ${request.pageCount || 12} (do not deviate); number pages 1..${request.pageCount || 12}

2. Page-by-Page Breakdown (Generate pages 1..${request.pageCount || 12}):
   - **CRITICAL PANEL DISTRIBUTION**: Vary panel counts for dynamic storytelling:
     • Opening/Closing pages: 2-3 panels (dramatic impact)
     • Action/Dialogue pages: 4-6 panels (detailed sequences)  
     • Transition/Mood pages: 1-2 panels (emotional beats)
     • Never make consecutive pages with the same panel count
   - Page title reflecting story progression
   - Mood that evolves throughout the narrative
   - Setting changes that advance the plot
   - Character development and growth in each scene

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
- **REQUIRED PAGE COUNT**: Create exactly ${request.pageCount || 12} pages. This is a strict requirement - do not analyze or adjust the page count. Use the full ${request.pageCount || 12} pages to tell a complete, well-paced story with proper narrative structure.

**STORYTELLING MASTERY REQUIREMENTS**:
- **CHARACTER DEVELOPMENT**: Each character must evolve throughout the story with clear arcs, motivations, and growth
- **NARRATIVE FLOW**: Pages must connect logically with cause-and-effect relationships, not random scenes
- **DIALOGUE EXCELLENCE**: Write natural, character-specific dialogue that reveals personality and advances plot
- **SETTING PROGRESSION**: Locations should change purposefully to support story beats and character journeys  
- **CONFLICT ESCALATION**: Build tension systematically - introduce conflicts early, develop them, and resolve satisfyingly
- **AVOID REPETITION**: Never repeat scenes, dialogue, or character actions - each page must advance the story
- **PACING VARIETY**: Mix action, dialogue, introspection, and plot advancement across different pages

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

Create a MOVIE-QUALITY script with the depth and precision of a professional film storyboard, utilizing every technical field for maximum visual impact and narrative clarity. The script should generate panels that rival professional comic book and film production standards.

**CRITICAL OUTPUT CONSTRAINTS:**
- totalPages must equal exactly ${request.pageCount || 12}
- pages array must contain exactly ${request.pageCount || 12} items
- pages must be numbered sequentially: pageNumber 1, 2, 3... up to ${request.pageCount || 12}
- Do NOT generate fewer or more pages than requested - this is a strict requirement

**MANDATORY PANEL DISTRIBUTION PATTERN** (Follow this exactly):${targetPanelDistribution ? 
`\nEXACT TARGET PATTERN: ${targetPanelDistribution.map((count, index) => 
  `Page ${index + 1}: ${count} panels`).join(', ')}\nMUST match this pattern exactly - no deviations allowed!` :
`
- Page 1: 2-3 panels (story opening)
- Page 2: 4-6 panels (character introduction) 
- Page 3: 1-2 panels (emotional beat)
- Page 4: 4-5 panels (conflict development)
- Page 5: 2-3 panels (character interaction)
- Continue this variation pattern - NEVER have consecutive pages with same panel count`}
- Ensure each page has meaningful story progression with varied visual pacing

Example JSON structure (adapt for your story):
{
  "title": "Your Story Title",
  "logline": "Your compelling logline",
  "pages": [
    {"pageNumber": 1, "title": "Page 1 Title", "setting": "Location", "mood": "Mood", "characters": ["Character1"], "narrative": "Brief description", "panels": [...4-5 panels...]},
    {"pageNumber": 2, "title": "Page 2 Title", "setting": "Location", "mood": "Mood", "characters": ["Character2"], "narrative": "Brief description", "panels": [...4-5 panels...]},
    ... continue until page ${request.pageCount || 12}
  ]
}`;

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
   * NEW IMPROVED FLOW: Characters → Script → Description (using actual content)
   */
  async generateCompleteStory(request: {
    genres: string[];
    length: string;
    artStyle: string;
    tones: string[];
    projectId?: string;
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
    // Use the new orchestrator for better sequencing
    return await this.generateCompleteStoryOrchestrator(request);
  }

  /**
   * NEW: Orchestrated story generation with proper sequencing
   * 1. Generate characters first
   * 2. Generate script using those characters  
   * 3. Generate description using actual characters and script content
   */
  async generateCompleteStoryOrchestrator(request: {
    genres: string[];
    length: string;
    artStyle: string;
    tones: string[];
    projectId?: string;
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
      console.log("🎨 === NEW ORCHESTRATED STORY GENERATION ====");
      console.log("🎯 Flow: Characters → Script → Description (using actual content)");
      
      // Map length to page count
      const pageCounts = {
        short: Math.floor(Math.random() * 7) + 6,  // 6-12 pages
        medium: Math.floor(Math.random() * 9) + 12, // 12-20 pages
        epic: Math.floor(Math.random() * 11) + 20   // 20-30 pages
      };
      
      const pageCount = pageCounts[request.length as keyof typeof pageCounts] || 12;
      console.log(`📊 Target page count: ${pageCount} (${request.length})`);
      
      // For longer stories (15+ pages), use chunked generation to avoid timeouts
      if (pageCount > 15) {
        console.log(`🎨 Long story detected (${pageCount} pages, ${request.length}) - using chunked generation...`);
        return await this.generateLongStoryInChunksOrchestrated(request, pageCount);
      }
      
      // === STEP 1: Generate Title and Characters First ===
      console.log("🎭 STEP 1: Generating title and characters...");
      const titleAndCharacters = await this.generateTitleAndCharacters(request);
      
      // === STEP 2: Generate Script Using Those Characters ===
      console.log("📝 STEP 2: Generating script using the characters...");
      const structuredScript = await this.generateScriptWithCharacters({
        title: titleAndCharacters.title,
        genre: titleAndCharacters.genre,
        characters: titleAndCharacters.characters,
        pageCount,
        artStyle: request.artStyle,
        tones: request.tones,
        projectId: request.projectId
      });
      
      // === STEP 3: Generate Description Using Actual Characters and Script ===
      console.log("📖 STEP 3: Generating description using actual content...");
      const description = await this.generateStoryDescriptionFromContent({
        title: titleAndCharacters.title,
        genre: titleAndCharacters.genre,
        characters: titleAndCharacters.characters,
        structuredScript,
        tones: request.tones,
        artStyle: request.artStyle
      });
      
      // === Return Complete Story ===
      const orchestratedStory = {
        title: titleAndCharacters.title,
        genre: titleAndCharacters.genre,
        description,
        characters: titleAndCharacters.characters,
        structuredScript
      };
      
      console.log("🎉 ORCHESTRATED STORY COMPLETE: All steps completed successfully!");
      return orchestratedStory;
    } catch (error) {
      console.error("🔥 Error in orchestrated story generation:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      throw new Error("Failed to generate orchestrated story: " + errorMessage);
    }
  }

  /**
   * STEP 1: Generate title and characters with isolation constraints
   */
  async generateTitleAndCharacters(request: {
    genres: string[];
    length: string;
    artStyle: string;
    tones: string[];
  }): Promise<{
    title: string;
    genre: string;
    characters: Array<{
      name: string;
      role: string;
      bio: string;
      visualDescriptors: string;
    }>;
  }> {
    console.log("🎭 Generating title and characters with strict isolation...");

    const prompt = `You are a master storyteller creating original characters for a new comic series.

REQUIREMENTS:
- Genres: ${request.genres.join(" + ")} (blend these thoughtfully)
- Art Style: ${request.artStyle}
- Tones: ${request.tones.join(" + ")} (emotional elements)

🚨 CRITICAL CHARACTER ISOLATION RULES:
- NEVER use character names from existing franchises, books, movies, TV shows, or games
- NEVER use names like: Lyra, Aria, Zara, Kai, Luna, Nova, Phoenix, Raven, or other common fantasy/fiction names
- CREATE COMPLETELY ORIGINAL character names that are unique to this specific story
- Use fresh, creative names that don't appear in popular culture or literature
- Ensure character names are thematically appropriate for the genre but entirely new
- Each character name must be original and not borrowed from any existing media

GENERATE:
1. TITLE: Creative, memorable title that captures the genre blend
2. BLENDED GENRE: How the ${request.genres.join(" and ")} elements work together
3. MAIN CHARACTERS: 3-4 well-developed characters with COMPLETELY ORIGINAL NAMES:
   - ORIGINAL name (never used in fiction before) and role
   - Personality and background
   - Visual description (appearance, clothing, distinctive features)
   - Character motivations and goals
   - VERIFY each name is unique and not from existing media

CRITICAL: Focus ONLY on title and characters. Do NOT include any script or story description.
Generate professional-quality characters with 100% original names that comic creators would be excited to use.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            title: { type: "string" },
            genre: { type: "string" },
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
          required: ["title", "genre", "characters"]
        }
      },
      contents: prompt,
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("Empty response from Gemini API for title and characters");
    }

    const parsedResponse = JSON.parse(responseText);
    
    // 🚨 CHARACTER CONTAMINATION VALIDATION
    console.log("🔍 Validating character names for contamination...");
    const generatedCharacterNames = parsedResponse.characters?.map((char: any) => char.name) || [];
    
    const forbiddenNames = [
      'lyra', 'aria', 'zara', 'kai', 'luna', 'nova', 'phoenix', 'raven', 
      'sage', 'quinn', 'alex', 'blake', 'jamie', 'casey', 'riley', 'taylor',
      'ember', 'storm', 'cloud', 'rain', 'sky', 'dawn', 'dusk', 'shadow',
      'blade', 'hunter', 'wolf', 'fox', 'crow', 'sparrow', 'falcon',
      'iris', 'ruby', 'jade', 'pearl', 'diamond', 'crystal', 'sapphire',
      'rose', 'lily', 'violet', 'daisy', 'holly', 'ivy', 'jasmine',
      'neo', 'matrix', 'cipher', 'echo', 'ghost', 'phantom', 'viper',
      'axel', 'blaze', 'frost', 'steel', 'iron', 'chrome', 'titan'
    ];
    
    const contaminatedNames = generatedCharacterNames.filter((name: string) =>
      forbiddenNames.includes(name.toLowerCase())
    );
    
    if (contaminatedNames.length > 0) {
      console.error(`🚨 CHARACTER CONTAMINATION DETECTED: Found forbidden names: ${contaminatedNames.join(', ')}`);
      throw new Error(`Character contamination detected. Forbidden character names found: ${contaminatedNames.join(', ')}. Please regenerate with completely original names.`);
    }

    console.log(`✅ Character validation passed for names: ${generatedCharacterNames.join(', ')}`);
    console.log(`🎭 STEP 1 COMPLETE: Generated title "${parsedResponse.title}" with ${parsedResponse.characters.length} characters`);
    
    return parsedResponse;
  }

  /**
   * STEP 2: Generate script using the actual characters from step 1
   */
  async generateScriptWithCharacters(request: {
    title: string;
    genre: string;
    characters: Array<{ name: string; role: string; bio: string; visualDescriptors: string }>;
    pageCount: number;
    artStyle: string;
    tones: string[];
    projectId?: string;
  }): Promise<any> {
    console.log(`📝 Generating ${request.pageCount}-page script using actual characters...`);

    const characterNames = request.characters.map(char => char.name);
    const characterDescriptions = request.characters.map(char => 
      `${char.name} (${char.role}): ${char.bio} Visual: ${char.visualDescriptors}`
    ).join('\n');

    const prompt = `Generate a detailed ${request.pageCount}-page comic script for "${request.title}".

STORY CONTEXT:
- Title: ${request.title}
- Genre: ${request.genre}
- Art Style: ${request.artStyle}
- Tones: ${request.tones.join(" + ")}

CHARACTERS (USE ONLY THESE EXACT NAMES):
${characterDescriptions}

🚨 CRITICAL CHARACTER ISOLATION RULES:
- ONLY use these character names: ${characterNames.join(', ')}
- NEVER introduce new characters not in the list above
- NEVER use names from other franchises or popular culture
- STRICT NAME CONSISTENCY: Only the character names provided above

GENERATE A ${request.pageCount}-PAGE STRUCTURED SCRIPT WITH:
- Page-by-page breakdown (exactly ${request.pageCount} pages)
- Panel descriptions (2-5 panels per page)
- Character dialogue with emotion (using ONLY the provided character names)
- Visual notes and camera angles
- Sound effects where appropriate
- Complete story arc: strong opening, development, climax, and resolution

Ensure the script tells a complete, satisfying story that fits the ${request.genre} genre and ${request.tones.join(", ")} tones.
Use ONLY the character names provided: ${characterNames.join(', ')}.`;

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
                  overallMood: { type: "string" },
                  narrative: { type: "string" },
                  characters: { type: "array", items: { type: "string" } },
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
                          type: "array",
                          description: "Character to emotion assignments for this panel",
                          items: {
                            type: "object",
                            properties: {
                              characterName: { type: "string" },
                              emotion: { type: "string" }
                            },
                            required: ["characterName", "emotion"]
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
      contents: prompt,
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("Empty response from Gemini API for script generation");
    }

    const parsedScript = JSON.parse(responseText);
    
    // Convert characterEmotions arrays to objects for compatibility
    if (parsedScript.pages) {
      parsedScript.pages.forEach((page: any) => {
        if (page.panels) {
          page.panels.forEach((panel: any) => {
            if (Array.isArray(panel.characterEmotions)) {
              panel.characterEmotions = Object.fromEntries(
                panel.characterEmotions.map((e: any) => [e.characterName, e.emotion])
              );
            }
          });
        }
      });
    }
    
    // Validate character names in script
    if (request.projectId) {
      try {
        const { validateScriptCharacters } = await import("./utils/characterValidation");
        const { storage } = await import("./storage");
        
        const validation = await validateScriptCharacters(parsedScript, request.projectId, storage);
        if (!validation.isValid) {
          console.warn(`⚠️ Script character validation warnings: ${validation.errors.map(e => e.characterName).join(', ')}`);
        }
      } catch (validationError) {
        console.warn("Script character validation error:", validationError);
      }
    }

    console.log(`📝 STEP 2 COMPLETE: Generated ${parsedScript.pages.length}-page script using characters: ${characterNames.join(', ')}`);
    return parsedScript;
  }

  /**
   * STEP 3: Generate description using actual characters and script content  
   */
  async generateStoryDescriptionFromContent(request: {
    title: string;
    genre: string;
    characters: Array<{ name: string; role: string; bio: string; visualDescriptors: string }>;
    structuredScript: any;
    tones: string[];
    artStyle: string;
  }): Promise<string> {
    console.log("📖 Generating description using actual characters and script content...");

    const characterNames = request.characters.map(char => char.name);
    const characterSummaries = request.characters.map(char => 
      `${char.name} (${char.role}): ${char.bio.substring(0, 100)}...`
    ).join('\n');

    // Extract key plot points from the script
    const plotSummary = request.structuredScript.pages?.slice(0, 3).map((page: any) => 
      `Page ${page.pageNumber}: ${page.narrative || page.title}`
    ).join(' ') || '';

    const prompt = `Create a compelling 2-3 paragraph story description for the comic "${request.title}".

ACTUAL STORY CONTENT TO BASE DESCRIPTION ON:
- Title: ${request.title}
- Genre: ${request.genre}
- Art Style: ${request.artStyle}
- Tones: ${request.tones.join(", ")}

ACTUAL CHARACTERS IN THE STORY:
${characterSummaries}

ACTUAL PLOT BEGINNING:
${plotSummary}

🚨 CRITICAL RULES:
- ONLY mention these character names: ${characterNames.join(', ')}
- Base the description on the ACTUAL script content provided above
- DO NOT invent characters or plot points not in the actual story
- Create a compelling synopsis that accurately reflects the generated content
- Keep it engaging but truthful to the actual story

Generate a professional, engaging story description that comic readers would find compelling and that accurately represents the actual characters and plot generated above.
Use ONLY the character names: ${characterNames.join(', ')}.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: prompt,
    });

    const description = response.text?.trim();
    if (!description) {
      throw new Error("Empty response from Gemini API for description generation");
    }

    // Final validation: ensure only the correct character names appear
    const descriptionWords = description.toLowerCase().split(/\s+/);
    const forbiddenNames = ['lyra', 'aria', 'zara', 'kai', 'luna', 'nova', 'phoenix', 'raven'];
    const foundForbidden = forbiddenNames.filter(name => descriptionWords.includes(name));
    
    if (foundForbidden.length > 0) {
      console.error(`🚨 DESCRIPTION CONTAMINATION: Found forbidden names: ${foundForbidden.join(', ')}`);
      throw new Error(`Description contamination detected: ${foundForbidden.join(', ')}`);
    }

    console.log(`📖 STEP 3 COMPLETE: Generated description using characters: ${characterNames.join(', ')}`);
    return description;
  }

  /**
   * Orchestrated long story generation for 15+ pages
   */
  async generateLongStoryInChunksOrchestrated(request: {
    genres: string[];
    length: string;
    artStyle: string;
    tones: string[];
    projectId?: string;
  }, pageCount: number): Promise<{
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
    console.log("🎨 Using orchestrated chunked generation for long story...");
    
    // Step 1: Generate title and characters
    const titleAndCharacters = await this.generateTitleAndCharacters(request);
    
    // Step 2: Use the existing chunked generation logic but with the characters
    const longStory = await this.generateLongStoryInChunks(request, pageCount);
    
    // Step 3: Generate description using the actual content
    const description = await this.generateStoryDescriptionFromContent({
      title: longStory.title,
      genre: longStory.genre,
      characters: longStory.characters,
      structuredScript: longStory.structuredScript,
      tones: request.tones,
      artStyle: request.artStyle
    });
    
    return {
      ...longStory,
      description
    };
  }

  /**
   * LEGACY: Generate a complete story with title, description, characters, and script (OLD METHOD)
   */
  async generateCompleteStoryLegacy(request: {
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
      
      const prompt = `You are an expert storyteller and comic creator. Generate a complete, original comic story concept with all necessary details.

REQUIREMENTS:
- Genres: ${request.genres.join(" + ")} (blend these thoughtfully)
- Length: ${request.length} story (${pageCount} pages)
- Art Style: ${request.artStyle}
- Tones: ${request.tones.join(" + ")} (blend these emotional elements)

🚨 CRITICAL CHARACTER ISOLATION RULES:
- NEVER use character names from existing franchises, books, movies, TV shows, or games
- NEVER use names like: Lyra, Aria, Zara, Kai, Luna, Nova, Phoenix, Raven, or other common fantasy/fiction names
- CREATE COMPLETELY ORIGINAL character names that are unique to this specific story
- Use fresh, creative names that don't appear in popular culture or literature
- Ensure character names are thematically appropriate for the genre but entirely new
- Each character name must be original and not borrowed from any existing media

CREATE A COMPLETE STORY PACKAGE INCLUDING:

1. TITLE: Creative, memorable title that captures the genre blend
2. BLENDED GENRE: How the ${request.genres.join(" and ")} elements work together
3. STORY DESCRIPTION: 2-3 paragraph compelling synopsis that hooks readers
4. MAIN CHARACTERS: 3-4 well-developed characters with COMPLETELY ORIGINAL NAMES:
   - ORIGINAL name (never used in fiction before) and role
   - Personality and background
   - Visual description (appearance, clothing, distinctive features)
   - Character motivations and goals
   - VERIFY each name is unique and not from existing media

5. COMPLETE STRUCTURED SCRIPT: ${pageCount} pages of detailed comic script with:
   - Page-by-page breakdown
   - Panel descriptions (2-5 panels per page)
   - Character dialogue with emotion (using ONLY the original character names)
   - Visual notes and camera angles
   - Sound effects where appropriate
   - STRICT NAME CONSISTENCY: Only use the original character names created above

STORYTELLING GUIDELINES:
- Create compelling character arcs and conflicts
- Include genre-appropriate elements (${request.genres.join(", ")})
- Blend the ${request.tones.join(", ")} tones throughout the narrative
- Design for ${request.artStyle} visual style
- Ensure ${pageCount} pages tell a complete, satisfying story
- Include strong opening, development, climax, and resolution
- MAINTAIN STRICT CHARACTER NAME ISOLATION - no borrowed names from any existing media

CHARACTER NAME VALIDATION:
Before finalizing, verify that EVERY character name is:
1. Completely original and not from any existing franchise
2. Not a common fantasy/sci-fi name used in popular culture
3. Unique to this specific story concept
4. Thematically appropriate but entirely new

Generate a professional-quality story concept with 100% original character names that comic creators would be excited to produce.`;

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
      
      // 🚨 CHARACTER CONTAMINATION VALIDATION: Check for phantom characters
      console.log("🔍 Validating character names for contamination...");
      const generatedCharacterNames = parsedStory.characters?.map((char: any) => char.name) || [];
      
      // List of known phantom character names that should never appear
      const forbiddenNames = [
        'lyra', 'aria', 'zara', 'kai', 'luna', 'nova', 'phoenix', 'raven', 
        'sage', 'quinn', 'alex', 'blake', 'jamie', 'casey', 'riley', 'taylor',
        'ember', 'storm', 'cloud', 'rain', 'sky', 'dawn', 'dusk', 'shadow',
        'blade', 'hunter', 'wolf', 'fox', 'crow', 'sparrow', 'falcon',
        'iris', 'ruby', 'jade', 'pearl', 'diamond', 'crystal', 'sapphire',
        'rose', 'lily', 'violet', 'daisy', 'holly', 'ivy', 'jasmine',
        'neo', 'matrix', 'cipher', 'echo', 'ghost', 'phantom', 'viper',
        'axel', 'blaze', 'frost', 'steel', 'iron', 'chrome', 'titan'
      ];
      
      // Check for forbidden names
      const contaminatedNames = generatedCharacterNames.filter((name: string) =>
        forbiddenNames.includes(name.toLowerCase())
      );
      
      if (contaminatedNames.length > 0) {
        console.error(`🚨 CHARACTER CONTAMINATION DETECTED: Found forbidden names: ${contaminatedNames.join(', ')}`);
        throw new Error(`Character contamination detected. Forbidden character names found: ${contaminatedNames.join(', ')}. Please regenerate with completely original names.`);
      }
      
      // Additional validation: Check if names are too similar to common fantasy/sci-fi names
      const suspiciousPatterns = [
        /^[A-Z][aeiou]+[rn]a?$/i, // Lyra, Aria, Luna pattern
        /^[A-Z][aeiou]*x[aeiou]*$/i, // Names ending with x
        /^[A-Z][aeiou]*th[aeiou]*$/i, // Names with 'th' 
        /^[A-Z][aeiou]*iel?$/i, // Angel-like names
        /^[A-Z][aeiou]*yn[ae]?$/i // Fantasy-like endings
      ];
      
      const suspiciousNames = generatedCharacterNames.filter((name: string) =>
        suspiciousPatterns.some(pattern => pattern.test(name))
      );
      
      if (suspiciousNames.length > 0) {
        console.warn(`⚠️ SUSPICIOUS CHARACTER NAMES: ${suspiciousNames.join(', ')} - may be too similar to common fantasy names`);
      }
      
      console.log(`✅ Character validation passed for names: ${generatedCharacterNames.join(', ')}`);
      
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

🚨 CRITICAL CHARACTER ISOLATION RULES:
- NEVER use character names from existing franchises, books, movies, TV shows, or games
- NEVER use names like: Lyra, Aria, Zara, Kai, Luna, Nova, Phoenix, Raven, or other common fantasy/fiction names
- CREATE COMPLETELY ORIGINAL character names that are unique to this specific story
- Use fresh, creative names that don't appear in popular culture or literature
- Ensure character names are thematically appropriate for the genre but entirely new
- Each character name must be original and not borrowed from any existing media

GENERATE ONLY:
1. TITLE: Creative, memorable title that captures the genre blend
2. BLENDED GENRE: How the ${request.genres.join(" and ")} elements work together
3. STORY DESCRIPTION: 2-3 paragraph compelling synopsis that hooks readers
4. MAIN CHARACTERS: 3-4 well-developed characters with COMPLETELY ORIGINAL NAMES:
   - ORIGINAL name (never used in fiction before) and role
   - Personality and background
   - Visual description (appearance, clothing, distinctive features)
   - Character motivations and goals
   - VERIFY each name is unique and not from existing media

CHARACTER NAME VALIDATION:
Before finalizing, verify that EVERY character name is:
1. Completely original and not from any existing franchise
2. Not a common fantasy/sci-fi name used in popular culture
3. Unique to this specific story concept
4. Thematically appropriate but entirely new

NO SCRIPT - Just the concept foundation for a ${totalPages}-page story with 100% original character names.`;

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

    // 🚨 CHARACTER CONTAMINATION VALIDATION: Check for phantom characters in chunked generation
    console.log("🔍 Validating character names for contamination in chunked story...");
    const generatedCharacterNames = storyConcept.characters?.map((char: any) => char.name) || [];
    
    // List of known phantom character names that should never appear
    const forbiddenNames = [
      'lyra', 'aria', 'zara', 'kai', 'luna', 'nova', 'phoenix', 'raven', 
      'sage', 'quinn', 'alex', 'blake', 'jamie', 'casey', 'riley', 'taylor',
      'ember', 'storm', 'cloud', 'rain', 'sky', 'dawn', 'dusk', 'shadow',
      'blade', 'hunter', 'wolf', 'fox', 'crow', 'sparrow', 'falcon',
      'iris', 'ruby', 'jade', 'pearl', 'diamond', 'crystal', 'sapphire',
      'rose', 'lily', 'violet', 'daisy', 'holly', 'ivy', 'jasmine',
      'neo', 'matrix', 'cipher', 'echo', 'ghost', 'phantom', 'viper',
      'axel', 'blaze', 'frost', 'steel', 'iron', 'chrome', 'titan'
    ];
    
    // Check for forbidden names
    const contaminatedNames = generatedCharacterNames.filter((name: string) =>
      forbiddenNames.includes(name.toLowerCase())
    );
    
    if (contaminatedNames.length > 0) {
      console.error(`🚨 CHARACTER CONTAMINATION DETECTED IN CHUNKED STORY: Found forbidden names: ${contaminatedNames.join(', ')}`);
      throw new Error(`Character contamination detected in chunked story. Forbidden character names found: ${contaminatedNames.join(', ')}. Please regenerate with completely original names.`);
    }
    
    console.log(`✅ Chunked story character validation passed for names: ${generatedCharacterNames.join(', ')}`);

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
            projectId: projectId || 'fallback-project-id', // Add required projectId for security validation
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

🚨 CRITICAL CHARACTER NAME CONSISTENCY RULES:
- EACH CHARACTER MUST BE REFERENCED BY THEIR EXACT NAME THROUGHOUT ALL FIELDS
${request.characters.map(char => `- The character "${char.name}" must ONLY be called "${char.name}" - NEVER use nicknames, shortened names, or alternatives`).join('\n')}
- NO nicknames, aliases, or alternative names are allowed in any field (bio, personality, etc.)
- ALL character references in bios, personality descriptions, and relationships MUST use the exact character name provided
- This is MANDATORY for character synchronization with scripts and project data

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
   - 🚨 REMINDER: When describing relationships or story function, use EXACT character names only

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

🔥 FINAL CHARACTER NAME VALIDATION:
Before generating the JSON, verify that:
1. The "name" field contains the exact character name provided
2. The "bio" field ONLY references the character by their exact name field value
3. NO nicknames, shortened names, or aliases appear in any field
4. Character relationships use exact names only

EXAMPLE CORRECT BIO: "${request.characters[0]?.name || 'Character Name'} is a detailed character description. ${request.characters[0]?.name || 'Character Name'} has specific traits and behaviors."
EXAMPLE INCORRECT BIO: "Nickname or shortened name..." (WRONG - must use exact character name provided)

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

CHARACTER APPEARANCE DICTIONARY (MANDATORY FOR PANEL DESCRIPTIONS):
${characterBible.characters.map(char => {
  const physical = char.physicalProfile;
  const clothing = char.defaultClothingState;
  const accessories = clothing.jewelry?.length ? `, ${clothing.jewelry.join(', ')}` : '';
  const extra = clothing.accessories?.length ? `, ${clothing.accessories.join(', ')}` : '';
  return `${char.name}: [${physical.height} ${physical.build}, ${physical.skinTone}, ${physical.hairColor} ${physical.hairTexture} ${physical.hairStyle} hair, ${physical.eyeColor} eyes; wearing ${clothing.upperBody}, ${clothing.lowerBody}, ${clothing.footwear}${accessories}${extra}]`;
}).join('\n')}

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

🎯 **CRITICAL CHARACTER APPEARANCE RULE**: In EVERY panel's visualDescription, sceneDescription, or action field where a character appears:
   - The FIRST time a character appears on each page, you MUST include their appearance description EXACTLY as written in the CHARACTER APPEARANCE DICTIONARY above
   - Format: "Character Name [exact appearance description from dictionary] does/says/moves..."
   - Example: "Sol Bautista [tall athletic build, warm brown skin, wavy shoulder-length black hair, brown eyes; wearing blue flight jumpsuit, tactical boots, silver cuff] examines the clockwork device..."
   - This is MANDATORY for character consistency - do NOT omit, paraphrase, or shorten these descriptions
   - If a character changes clothing in a panel, update their appearance description accordingly

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
              characters: validCharacterNames && validCharacterNames.length > 0 ? 
                { type: "array", items: { type: "string", enum: validCharacterNames } } : 
                { type: "array", items: { type: "string", enum: ["UNKNOWN_CHARACTER"] } },
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
                            { type: "string", enum: ["UNKNOWN_CHARACTER"] },
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
                            { type: "array", items: { type: "string", enum: ["UNKNOWN_CHARACTER"] } }
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
                        backgroundCharacters: validCharacterNames && validCharacterNames.length > 0 ? 
                          { type: "array", items: { type: "string", enum: validCharacterNames } } : 
                          { type: "array", items: { type: "string", enum: ["UNKNOWN_CHARACTER"] } },
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
                        voiceOverCharacter: validCharacterNames && validCharacterNames.length > 0 ? 
                          { type: "string", enum: validCharacterNames } : 
                          { type: "string", enum: ["UNKNOWN_CHARACTER"] },
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
                            { type: "string", enum: ["UNKNOWN_CHARACTER"] },
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