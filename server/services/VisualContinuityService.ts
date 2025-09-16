import { GoogleGenAI } from "@google/genai";
import { ObjectStorageService } from "../objectStorage";
import { URL } from 'url';
import { z } from 'zod';

// Initialize Gemini AI client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// Security constants
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB max
const FETCH_TIMEOUT_MS = 30000; // 30 second timeout
const MAX_CONCURRENT_PANELS = 3; // Limit concurrent analysis

// Allowed URL patterns for security
const ALLOWED_URL_PATTERNS = [
  /^\/objects\//,  // Object storage paths
  /^https:\/\/storage\.googleapis\.com\//,  // Google Cloud Storage
  /^https:\/\/[a-zA-Z0-9-]+\.googleapis\.com\//,  // Other Google APIs
  /^https:\/\/(?:[a-zA-Z0-9-]+\.)*replit\.com\//,  // Replit domains - properly anchored
  /^https:\/\/[a-zA-Z0-9-]+\.repl\.co\//  // Repl.co domains
];

// Zod validation schemas for Gemini API JSON responses
const ClothingSchema = z.object({
  upperBody: z.string(),
  lowerBody: z.string(),
  outerwear: z.string().nullable().optional(),
  accessories: z.array(z.string()).optional().default([]),
  colors: z.array(z.string()).optional().default([]),
  style: z.string()
});

const HairSchema = z.object({
  color: z.string(),
  style: z.string(),
  length: z.string(),
  texture: z.string()
});

const PhysicalAppearanceSchema = z.object({
  skinTone: z.string(),
  eyeColor: z.string().nullable().optional(),
  facialExpression: z.string(),
  bodyLanguage: z.string(),
  pose: z.string()
});

const AccessoriesSchema = z.object({
  jewelry: z.array(z.string()).optional().default([]),
  glasses: z.boolean().optional().default(false),
  hat: z.string().nullable().optional(),
  other: z.array(z.string()).optional().default([])
});

const LocationSchema = z.object({
  position: z.string(),
  interaction: z.string()
});

const VisualDetailsSchema = z.object({
  clothing: ClothingSchema,
  hair: HairSchema,
  physicalAppearance: PhysicalAppearanceSchema,
  accessories: AccessoriesSchema,
  location: LocationSchema
});

const CharacterSchema = z.object({
  characterName: z.string(),
  isPresent: z.boolean(),
  confidence: z.number().min(0).max(100),
  visualDetails: VisualDetailsSchema.optional()
});

const OverallSceneSchema = z.object({
  setting: z.string(),
  lighting: z.string(),
  mood: z.string(),
  timeOfDay: z.string().nullable().optional()
});

const GeminiAnalysisResponseSchema = z.object({
  characters: z.array(CharacterSchema),
  overallScene: OverallSceneSchema
});

/**
 * Interface for character appearance analysis in a single panel
 */
export interface CharacterAppearanceAnalysis {
  characterName: string;
  isPresent: boolean;
  confidence: number; // 0-100, confidence that this character is correctly identified
  visualDetails?: {
    clothing: {
      upperBody: string;
      lowerBody: string;
      outerwear?: string;
      accessories?: string[];
      colors: string[];
      style: string; // e.g., "casual", "formal", "athletic"
    };
    hair: {
      color: string;
      style: string;
      length: string;
      texture: string; // e.g., "straight", "wavy", "curly"
    };
    physicalAppearance: {
      skinTone: string;
      eyeColor?: string;
      facialExpression: string;
      bodyLanguage: string;
      pose: string;
    };
    accessories: {
      jewelry?: string[];
      glasses?: boolean;
      hat?: string;
      other?: string[];
    };
    location: {
      position: string; // e.g., "foreground", "background", "center"
      interaction: string; // what they're doing
    };
  };
  inconsistencies?: Array<{
    type: 'clothing' | 'hair' | 'physical' | 'accessories';
    description: string;
    severity: 'minor' | 'moderate' | 'major';
  }>;
}

/**
 * Interface for complete panel analysis
 */
export interface PanelVisualAnalysis {
  panelNumber: number;
  imageUrl: string;
  analysisSuccess: boolean;
  error?: string;
  characters: CharacterAppearanceAnalysis[];
  overallScene: {
    setting: string;
    lighting: string;
    mood: string;
    timeOfDay?: string;
  };
  analysisTimestamp: Date;
}

/**
 * Interface for the main analysis request
 */
export interface AnalyzeCharacterAppearancesRequest {
  panelImageUrls: Array<{
    panelNumber: number;
    imageUrl: string;
  }>;
  characterNames: string[];
  projectContext?: {
    title: string;
    genre?: string;
    artStyle?: string;
  };
  analysisOptions?: {
    focusOnConsistency?: boolean;
    detailLevel?: 'basic' | 'detailed' | 'comprehensive';
    maxPanelsToAnalyze?: number;
  };
}

/**
 * Interface for the complete analysis response
 */
export interface VisualContinuityAnalysisResponse {
  success: boolean;
  totalPanelsAnalyzed: number;
  panelAnalyses: PanelVisualAnalysis[];
  characterSummary: Array<{
    characterName: string;
    appearedInPanels: number[];
    consistencyScore: number; // 0-100, overall consistency across panels
    commonAppearance: {
      mostCommonClothing: string;
      mostCommonHairStyle: string;
      consistentFeatures: string[];
    };
    variations: Array<{
      panelNumber: number;
      changes: string[];
      significance: 'minor' | 'moderate' | 'major';
    }>;
  }>;
  overallInsights: {
    settingConsistency: string;
    timeProgression?: string;
    notablePatterns: string[];
  };
  error?: string;
}

/**
 * Interface for continuity guidance output
 */
export interface ContinuityGuidance {
  success: boolean;
  characterGuidance: Array<{
    characterName: string;
    prompt: string; // Ready-to-use prompt segment
    keyAttributes: {
      hair: string;
      clothing: string;
      physicalFeatures: string;
      accessories: string;
    };
    consistencyScore: number;
    lastSeenPanel: number;
  }>;
  sceneGuidance?: {
    settingConsistency: string;
    lightingPattern: string;
    suggestedMood: string;
  };
  error?: string;
}

/**
 * VisualContinuityService - Analyzes character appearances across comic panels
 * using Gemini Vision API to maintain visual consistency
 */
export class VisualContinuityService {
  private objectStorageService = new ObjectStorageService();
  
  /**
   * Validate URL for security - prevent SSRF attacks
   */
  private validateImageUrl(imageUrl: string): boolean {
    try {
      // Allow relative object storage paths
      if (imageUrl.startsWith('/objects/')) {
        return true;
      }
      
      // Parse and validate external URLs
      const url = new URL(imageUrl);
      
      // Only allow HTTPS (except for local object storage)
      if (url.protocol !== 'https:') {
        console.warn(`❌ URL validation failed: Non-HTTPS protocol: ${url.protocol}`);
        return false;
      }
      
      // Check against allowlist patterns
      const isAllowed = ALLOWED_URL_PATTERNS.some(pattern => pattern.test(imageUrl));
      if (!isAllowed) {
        console.warn(`❌ URL validation failed: Not in allowlist: ${imageUrl}`);
        return false;
      }
      
      // Reject private IP ranges and localhost
      const hostname = url.hostname;
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)
      ) {
        console.warn(`❌ URL validation failed: Private/local IP: ${hostname}`);
        return false;
      }
      
      return true;
      
    } catch (error) {
      console.warn(`❌ URL validation failed: Invalid URL format: ${imageUrl}`);
      return false;
    }
  }
  
  /**
   * Create fetch with timeout
   */
  private async fetchWithTimeout(url: string, timeoutMs: number = FETCH_TIMEOUT_MS): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'VisualContinuityService/1.0'
        }
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
  
  /**
   * Generate content with Gemini API with timeout protection
   */
  private async generateContentWithTimeout(
    request: any,
    timeoutMs: number = 60000
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Gemini API request timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      
      ai.models.generateContent(request)
        .then(response => {
          clearTimeout(timeoutId);
          resolve(response);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }
  
  /**
   * Analyze panels with limited concurrency to prevent overwhelming the API
   */
  private async analyzeWithLimitedConcurrency(
    panelsToAnalyze: Array<{ panelNumber: number; imageUrl: string }>,
    characterNames: string[],
    projectContext?: { title: string; genre?: string; artStyle?: string },
    analysisOptions?: { focusOnConsistency?: boolean; detailLevel?: 'basic' | 'detailed' | 'comprehensive' }
  ): Promise<PanelVisualAnalysis[]> {
    const results: PanelVisualAnalysis[] = [];
    const executing: Promise<void>[] = [];
    
    for (const panelInfo of panelsToAnalyze) {
      // If we've reached max concurrency, wait for one to complete
      if (executing.length >= MAX_CONCURRENT_PANELS) {
        await Promise.race(executing);
      }
      
      // Start analysis for this panel
      const promise = this.analyzePanelWithRetry(
        panelInfo,
        characterNames,
        projectContext,
        analysisOptions
      ).then(analysis => {
        results.push(analysis);
        // Remove this promise from executing array
        const index = executing.indexOf(promise);
        if (index > -1) {
          executing.splice(index, 1);
        }
      }).catch(error => {
        console.error(`❌ Failed to analyze panel ${panelInfo.panelNumber} after retries:`, error);
        results.push({
          panelNumber: panelInfo.panelNumber,
          imageUrl: panelInfo.imageUrl,
          analysisSuccess: false,
          error: error instanceof Error ? error.message : String(error),
          characters: [],
          overallScene: {
            setting: "unknown",
            lighting: "unknown",
            mood: "unknown"
          },
          analysisTimestamp: new Date()
        });
        // Remove this promise from executing array
        const index = executing.indexOf(promise);
        if (index > -1) {
          executing.splice(index, 1);
        }
      });
      
      executing.push(promise);
    }
    
    // Wait for all remaining panels to complete
    await Promise.all(executing);
    
    // Sort results by panel number to maintain order
    return results.sort((a, b) => a.panelNumber - b.panelNumber);
  }
  
  /**
   * Analyze panel with exponential backoff retry logic
   */
  private async analyzePanelWithRetry(
    panelInfo: { panelNumber: number; imageUrl: string },
    characterNames: string[],
    projectContext?: { title: string; genre?: string; artStyle?: string },
    analysisOptions?: { focusOnConsistency?: boolean; detailLevel?: 'basic' | 'detailed' | 'comprehensive' },
    maxRetries: number = 3
  ): Promise<PanelVisualAnalysis> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🖼️ Analyzing panel ${panelInfo.panelNumber} (attempt ${attempt}/${maxRetries})...`);
        
        const analysis = await this.analyzeSinglePanel(
          panelInfo,
          characterNames,
          projectContext,
          analysisOptions
        );
        
        console.log(`✅ Successfully analyzed panel ${panelInfo.panelNumber} on attempt ${attempt}`);
        return analysis;
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`⚠️ Panel ${panelInfo.panelNumber} analysis failed on attempt ${attempt}: ${lastError.message}`);
        
        // Don't retry on validation errors or non-retriable errors
        if (lastError.message.includes('URL validation failed') || 
            lastError.message.includes('Image too large') ||
            lastError.message.includes('Invalid JSON response') ||
            lastError.message.includes('Gemini API request timed out')) {
          throw lastError;
        }
        
        // Exponential backoff: wait longer between retries
        if (attempt < maxRetries) {
          const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 8000); // Cap at 8 seconds
          console.log(`⏱️ Waiting ${delayMs}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }
    
    throw lastError || new Error(`Failed to analyze panel ${panelInfo.panelNumber} after ${maxRetries} attempts`);
  }
  
  /**
   * Main method to analyze character appearances across multiple panels
   */
  async analyzeCharacterAppearances(
    request: AnalyzeCharacterAppearancesRequest
  ): Promise<VisualContinuityAnalysisResponse> {
    console.log(`🔍 Starting visual continuity analysis for ${request.characterNames.length} characters across ${request.panelImageUrls.length} panels`);
    
    try {
      const maxPanels = request.analysisOptions?.maxPanelsToAnalyze || 10;
      const panelsToAnalyze = request.panelImageUrls.slice(-maxPanels); // Take the most recent panels
      
      // Process panels with limited concurrency for better performance
      const panelAnalyses = await this.analyzeWithLimitedConcurrency(
        panelsToAnalyze,
        request.characterNames,
        request.projectContext,
        request.analysisOptions
      );
      
      // Generate character summary and insights
      const characterSummary = this.generateCharacterSummary(panelAnalyses, request.characterNames);
      const overallInsights = this.generateOverallInsights(panelAnalyses);
      
      const response: VisualContinuityAnalysisResponse = {
        success: true,
        totalPanelsAnalyzed: panelAnalyses.length,
        panelAnalyses,
        characterSummary,
        overallInsights
      };
      
      console.log(`✅ Visual continuity analysis complete. Analyzed ${panelAnalyses.length} panels successfully.`);
      return response;
      
    } catch (error) {
      console.error(`❌ Visual continuity analysis failed:`, error);
      return {
        success: false,
        totalPanelsAnalyzed: 0,
        panelAnalyses: [],
        characterSummary: [],
        overallInsights: {
          settingConsistency: "unknown",
          notablePatterns: []
        },
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Analyze a single panel for character appearances
   */
  private async analyzeSinglePanel(
    panelInfo: { panelNumber: number; imageUrl: string },
    characterNames: string[],
    projectContext?: { title: string; genre?: string; artStyle?: string },
    analysisOptions?: { focusOnConsistency?: boolean; detailLevel?: 'basic' | 'detailed' | 'comprehensive' }
  ): Promise<PanelVisualAnalysis> {
    
    try {
      // Download and convert image to base64
      const imageData = await this.downloadImageAsBase64(panelInfo.imageUrl);
      
      // Build analysis prompt
      const analysisPrompt = this.buildAnalysisPrompt(
        characterNames,
        projectContext,
        analysisOptions
      );
      
      // Use Gemini Vision API to analyze the image with JSON output and timeout
      const response = await this.generateContentWithTimeout({
        model: "gemini-2.5-flash-image-preview",
        contents: [
          {
            inlineData: {
              mimeType: imageData.mimeType,
              data: imageData.data
            }
          },
          { text: analysisPrompt }
        ],
        config: {
          temperature: 0.1, // Low temperature for consistent analysis
          maxOutputTokens: 2048,
          responseMimeType: "application/json"
        }
      }, 60000); // 60 second timeout for Gemini API
      
      if (!response.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error("No analysis response received from Gemini");
      }
      
      const analysisText = response.candidates[0].content.parts[0].text;
      console.log(`🔍 Raw JSON analysis for panel ${panelInfo.panelNumber}:`, analysisText.substring(0, 200) + "...");
      
      // Parse the JSON response
      const analysisData = this.parseJsonResponse(analysisText);
      const characterAnalyses = this.extractCharacterAnalyses(analysisData, characterNames);
      const sceneAnalysis = this.extractSceneAnalysis(analysisData);
      
      return {
        panelNumber: panelInfo.panelNumber,
        imageUrl: panelInfo.imageUrl,
        analysisSuccess: true,
        characters: characterAnalyses,
        overallScene: sceneAnalysis,
        analysisTimestamp: new Date()
      };
      
    } catch (error) {
      console.error(`❌ Error analyzing panel ${panelInfo.panelNumber}:`, error);
      throw error;
    }
  }
  
  /**
   * Build the analysis prompt for Gemini Vision API
   */
  private buildAnalysisPrompt(
    characterNames: string[],
    projectContext?: { title: string; genre?: string; artStyle?: string },
    analysisOptions?: { focusOnConsistency?: boolean; detailLevel?: 'basic' | 'detailed' | 'comprehensive' }
  ): string {
    const detailLevel = analysisOptions?.detailLevel || 'detailed';
    const focusOnConsistency = analysisOptions?.focusOnConsistency ?? true;
    
    const prompt = `COMIC PANEL CHARACTER APPEARANCE ANALYSIS

Analyze this comic panel image and return a structured JSON response with character appearances and scene analysis.

TARGET CHARACTERS: ${characterNames.join(", ")}

${projectContext ? `CONTEXT:
- Project: ${projectContext.title}
- Genre: ${projectContext.genre || "Unknown"}
- Art Style: ${projectContext.artStyle || "Comic book style"}` : ""}

ANALYSIS REQUIREMENTS:
1. For each target character, determine if they are present in this panel
2. If present, provide detailed visual description
3. Focus on consistency-critical details: clothing, hair, physical features
4. Note any accessories or distinctive elements
5. Describe their pose, expression, and what they're doing

${focusOnConsistency ? `CONSISTENCY FOCUS:
- Pay special attention to character-identifying features
- Note any potential inconsistencies or unusual variations
- Consider if clothing changes are logical for the scene
` : ""}

Return ONLY a valid JSON object with this exact structure:

{
  "characters": [
    {
      "characterName": "string",
      "isPresent": boolean,
      "confidence": number, // 0-100
      "visualDetails": {
        "clothing": {
          "upperBody": "string",
          "lowerBody": "string",
          "outerwear": "string or null",
          "accessories": ["string"],
          "colors": ["string"],
          "style": "string"
        },
        "hair": {
          "color": "string",
          "style": "string",
          "length": "string",
          "texture": "string"
        },
        "physicalAppearance": {
          "skinTone": "string",
          "eyeColor": "string or null",
          "facialExpression": "string",
          "bodyLanguage": "string",
          "pose": "string"
        },
        "accessories": {
          "jewelry": ["string"],
          "glasses": boolean,
          "hat": "string or null",
          "other": ["string"]
        },
        "location": {
          "position": "string",
          "interaction": "string"
        }
      }
    }
  ],
  "overallScene": {
    "setting": "string",
    "lighting": "string",
    "mood": "string",
    "timeOfDay": "string or null"
  }
}

Analyze the image thoroughly and return valid JSON only.`;
    
    return prompt;
  }
  
  /**
   * Parse and validate JSON response from Gemini API using Zod schemas
   */
  private parseJsonResponse(jsonText: string): any {
    try {
      // Parse JSON first
      const jsonData = JSON.parse(jsonText);
      
      // Validate against Zod schema
      const validationResult = GeminiAnalysisResponseSchema.safeParse(jsonData);
      
      if (!validationResult.success) {
        console.error('JSON validation failed:', validationResult.error.format());
        console.error('Raw response:', jsonText.substring(0, 500));
        throw new Error(`Invalid JSON response structure from Gemini API: ${validationResult.error.message}`);
      }
      
      return validationResult.data;
    } catch (error) {
      if (error instanceof SyntaxError) {
        console.error('Failed to parse JSON response:', error);
        console.error('Raw response:', jsonText.substring(0, 500));
        throw new Error(`Invalid JSON response format from Gemini API: ${error.message}`);
      }
      throw error; // Re-throw validation errors as-is
    }
  }
  
  /**
   * Extract character analyses from JSON response
   */
  private extractCharacterAnalyses(
    analysisData: any,
    characterNames: string[]
  ): CharacterAppearanceAnalysis[] {
    const characterAnalyses: CharacterAppearanceAnalysis[] = [];
    
    // Extract characters from JSON response
    const characters = analysisData?.characters || [];
    
    for (const characterData of characters) {
      try {
        if (characterNames.includes(characterData.characterName)) {
          const analysis: CharacterAppearanceAnalysis = {
            characterName: characterData.characterName,
            isPresent: characterData.isPresent || false,
            confidence: characterData.confidence || 50
          };
          
          if (analysis.isPresent && characterData.visualDetails) {
            analysis.visualDetails = {
              clothing: {
                upperBody: characterData.visualDetails.clothing?.upperBody || 'not specified',
                lowerBody: characterData.visualDetails.clothing?.lowerBody || 'not specified',
                outerwear: characterData.visualDetails.clothing?.outerwear,
                accessories: characterData.visualDetails.clothing?.accessories || [],
                colors: characterData.visualDetails.clothing?.colors || [],
                style: characterData.visualDetails.clothing?.style || 'casual'
              },
              hair: {
                color: characterData.visualDetails.hair?.color || 'not specified',
                style: characterData.visualDetails.hair?.style || 'not specified',
                length: characterData.visualDetails.hair?.length || 'medium',
                texture: characterData.visualDetails.hair?.texture || 'straight'
              },
              physicalAppearance: {
                skinTone: characterData.visualDetails.physicalAppearance?.skinTone || 'medium',
                eyeColor: characterData.visualDetails.physicalAppearance?.eyeColor,
                facialExpression: characterData.visualDetails.physicalAppearance?.facialExpression || 'neutral',
                bodyLanguage: characterData.visualDetails.physicalAppearance?.bodyLanguage || 'relaxed',
                pose: characterData.visualDetails.physicalAppearance?.pose || 'standing'
              },
              accessories: {
                jewelry: characterData.visualDetails.accessories?.jewelry || [],
                glasses: characterData.visualDetails.accessories?.glasses || false,
                hat: characterData.visualDetails.accessories?.hat,
                other: characterData.visualDetails.accessories?.other || []
              },
              location: {
                position: characterData.visualDetails.location?.position || 'center',
                interaction: characterData.visualDetails.location?.interaction || 'standing'
              }
            };
          }
          
          characterAnalyses.push(analysis);
        }
      } catch (error) {
        console.error('Error processing character data:', error);
      }
    }
    
    // Add any missing characters as not present
    for (const characterName of characterNames) {
      if (!characterAnalyses.find(c => c.characterName === characterName)) {
        characterAnalyses.push({
          characterName,
          isPresent: false,
          confidence: 100
        });
      }
    }
    
    return characterAnalyses;
  }
  
  
  /**
   * Extract scene analysis from JSON response
   */
  private extractSceneAnalysis(analysisData: any): {
    setting: string;
    lighting: string;
    mood: string;
    timeOfDay?: string;
  } {
    const scene = analysisData?.overallScene || {};
    return {
      setting: scene.setting || 'indoor scene',
      lighting: scene.lighting || 'natural',
      mood: scene.mood || 'neutral',
      timeOfDay: scene.timeOfDay
    };
  }
  
  /**
   * Generate character summary across all panels
   */
  private generateCharacterSummary(
    panelAnalyses: PanelVisualAnalysis[],
    characterNames: string[]
  ): Array<{
    characterName: string;
    appearedInPanels: number[];
    consistencyScore: number;
    commonAppearance: {
      mostCommonClothing: string;
      mostCommonHairStyle: string;
      consistentFeatures: string[];
    };
    variations: Array<{
      panelNumber: number;
      changes: string[];
      significance: 'minor' | 'moderate' | 'major';
    }>;
  }> {
    return characterNames.map(characterName => {
      const characterAppearances = panelAnalyses
        .map(panel => ({
          panelNumber: panel.panelNumber,
          character: panel.characters.find(c => c.characterName === characterName && c.isPresent)
        }))
        .filter(item => item.character) as Array<{
          panelNumber: number;
          character: CharacterAppearanceAnalysis;
        }>;
      
      const appearedInPanels = characterAppearances.map(item => item.panelNumber);
      
      // Calculate consistency score (simplified)
      const consistencyScore = this.calculateConsistencyScore(characterAppearances);
      
      // Find most common appearances
      const commonAppearance = this.findCommonAppearance(characterAppearances);
      
      // Identify variations
      const variations = this.identifyVariations(characterAppearances);
      
      return {
        characterName,
        appearedInPanels,
        consistencyScore,
        commonAppearance,
        variations
      };
    });
  }
  
  /**
   * Generate overall insights from the analysis
   */
  private generateOverallInsights(panelAnalyses: PanelVisualAnalysis[]): {
    settingConsistency: string;
    timeProgression?: string;
    notablePatterns: string[];
  } {
    const settings = panelAnalyses.map(p => p.overallScene.setting);
    const lightingConditions = panelAnalyses.map(p => p.overallScene.lighting);
    
    const settingConsistency = this.analyzeSettingConsistency(settings);
    const timeProgression = this.analyzeTimeProgression(panelAnalyses);
    const notablePatterns = this.identifyNotablePatterns(panelAnalyses);
    
    return {
      settingConsistency,
      timeProgression,
      notablePatterns
    };
  }
  
  // Utility methods for analysis
  
  private calculateConsistencyScore(appearances: Array<{
    panelNumber: number;
    character: CharacterAppearanceAnalysis;
  }>): number {
    if (appearances.length <= 1) return 100;
    
    // Compare specific attributes across appearances for real consistency scoring
    const scores: number[] = [];
    
    // Compare each appearance with the first one as baseline
    const baseline = appearances[0].character.visualDetails;
    if (!baseline) return 50; // No baseline to compare against
    
    for (let i = 1; i < appearances.length; i++) {
      const current = appearances[i].character.visualDetails;
      if (!current) {
        scores.push(0); // No details to compare
        continue;
      }
      
      const attributeScores: number[] = [];
      
      // Hair consistency (high importance)
      const hairColorMatch = this.compareAttribute(baseline.hair.color, current.hair.color);
      const hairStyleMatch = this.compareAttribute(baseline.hair.style, current.hair.style);
      const hairLengthMatch = this.compareAttribute(baseline.hair.length, current.hair.length);
      attributeScores.push(hairColorMatch * 0.4, hairStyleMatch * 0.3, hairLengthMatch * 0.3);
      
      // Clothing consistency (medium importance - can change logically)
      const upperBodyMatch = this.compareAttribute(baseline.clothing.upperBody, current.clothing.upperBody);
      const lowerBodyMatch = this.compareAttribute(baseline.clothing.lowerBody, current.clothing.lowerBody);
      const clothingStyleMatch = this.compareAttribute(baseline.clothing.style, current.clothing.style);
      attributeScores.push(upperBodyMatch * 0.2, lowerBodyMatch * 0.2, clothingStyleMatch * 0.1);
      
      // Physical appearance consistency (very high importance)
      const skinToneMatch = this.compareAttribute(baseline.physicalAppearance.skinTone, current.physicalAppearance.skinTone);
      const eyeColorMatch = this.compareOptionalAttribute(baseline.physicalAppearance.eyeColor, current.physicalAppearance.eyeColor);
      attributeScores.push(skinToneMatch * 0.5, eyeColorMatch * 0.3);
      
      // Accessories consistency (low importance - accessories can change)
      const glassesMatch = baseline.accessories.glasses === current.accessories.glasses ? 100 : 60;
      const jewelryMatch = this.compareArrayAttribute(baseline.accessories.jewelry || [], current.accessories.jewelry || []);
      attributeScores.push(glassesMatch * 0.05, jewelryMatch * 0.05);
      
      // Calculate weighted average for this appearance
      const appearanceScore = attributeScores.reduce((sum, score) => sum + score, 0) / attributeScores.length;
      scores.push(appearanceScore);
    }
    
    // Calculate overall consistency score
    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    return Math.round(Math.max(0, Math.min(100, averageScore)));
  }
  
  /**
   * Compare two string attributes for similarity
   */
  private compareAttribute(baseline: string, current: string): number {
    if (!baseline || !current) return 50; // Neutral score for missing data
    
    baseline = baseline.toLowerCase().trim();
    current = current.toLowerCase().trim();
    
    if (baseline === current) return 100; // Perfect match
    
    // Check for semantic similarity
    if (this.areSemanticallyEquivalent(baseline, current)) return 95;
    
    // Check for partial matches (e.g., "blue shirt" vs "light blue shirt")
    if (baseline.includes(current) || current.includes(baseline)) return 80;
    
    // Check for color variations (e.g., "dark blue" vs "navy blue")
    if (this.areColorVariations(baseline, current)) return 75;
    
    // Different but related (e.g., "shirt" vs "t-shirt")
    if (this.areRelatedTerms(baseline, current)) return 60;
    
    return 20; // Very different
  }
  
  /**
   * Compare optional attributes (can be null)
   */
  private compareOptionalAttribute(baseline?: string, current?: string): number {
    if (!baseline && !current) return 100; // Both null/undefined
    if (!baseline || !current) return 70; // One is missing
    return this.compareAttribute(baseline, current);
  }
  
  /**
   * Compare array attributes for similarity
   */
  private compareArrayAttribute(baseline: string[], current: string[]): number {
    if (baseline.length === 0 && current.length === 0) return 100;
    if (baseline.length === 0 || current.length === 0) return 50;
    
    const baselineSet = new Set(baseline.map(item => item.toLowerCase().trim()));
    const currentSet = new Set(current.map(item => item.toLowerCase().trim()));
    
    const intersection = new Set(Array.from(baselineSet).filter(x => currentSet.has(x)));
    const union = new Set([...Array.from(baselineSet), ...Array.from(currentSet)]);
    
    return Math.round((intersection.size / union.size) * 100);
  }
  
  /**
   * Check if two terms are semantically equivalent
   */
  private areSemanticallyEquivalent(baseline: string, current: string): boolean {
    const equivalents = [
      ['blonde', 'blond', 'yellow', 'golden'],
      ['brunette', 'brown', 'dark brown'],
      ['shirt', 't-shirt', 'tee'],
      ['pants', 'trousers', 'slacks'],
      ['sneakers', 'shoes', 'trainers'],
      ['glasses', 'spectacles', 'eyeglasses'],
      ['cap', 'hat', 'beanie'],
      ['short', 'brief', 'cropped'],
      ['long', 'lengthy', 'extended'],
      ['medium', 'average', 'moderate']
    ];
    
    for (const group of equivalents) {
      if (group.includes(baseline) && group.includes(current)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Check if two terms are color variations
   */
  private areColorVariations(baseline: string, current: string): boolean {
    const colorFamilies = [
      ['blue', 'navy', 'royal blue', 'sky blue', 'light blue', 'dark blue'],
      ['red', 'crimson', 'scarlet', 'maroon', 'cherry', 'pink'],
      ['green', 'forest green', 'lime', 'emerald', 'sage'],
      ['black', 'charcoal', 'dark gray', 'onyx'],
      ['white', 'cream', 'ivory', 'off-white', 'pearl'],
      ['brown', 'tan', 'beige', 'chocolate', 'coffee', 'chestnut']
    ];
    
    for (const family of colorFamilies) {
      if (family.some(color => baseline.includes(color)) && 
          family.some(color => current.includes(color))) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Check if two terms are related but different
   */
  private areRelatedTerms(baseline: string, current: string): boolean {
    const relatedGroups = [
      ['shirt', 'blouse', 'top', 'sweater', 'jacket'],
      ['pants', 'shorts', 'skirt', 'dress'],
      ['shoes', 'boots', 'sandals', 'sneakers'],
      ['straight', 'wavy', 'curly', 'kinky'],
      ['casual', 'formal', 'athletic', 'business']
    ];
    
    for (const group of relatedGroups) {
      if (group.includes(baseline) && group.includes(current)) {
        return true;
      }
    }
    
    return false;
  }
  
  private findCommonAppearance(appearances: Array<{
    panelNumber: number;
    character: CharacterAppearanceAnalysis;
  }>): {
    mostCommonClothing: string;
    mostCommonHairStyle: string;
    consistentFeatures: string[];
  } {
    if (appearances.length === 0) {
      return {
        mostCommonClothing: 'not observed',
        mostCommonHairStyle: 'not observed',
        consistentFeatures: []
      };
    }
    
    // Find most common clothing and hair style (simplified)
    const clothingDescriptions = appearances
      .map(a => a.character.visualDetails?.clothing.upperBody)
      .filter(Boolean);
    
    const hairStyles = appearances
      .map(a => a.character.visualDetails?.hair.style)
      .filter(Boolean);
    
    return {
      mostCommonClothing: clothingDescriptions[0] || 'not specified',
      mostCommonHairStyle: hairStyles[0] || 'not specified',
      consistentFeatures: ['skin tone', 'eye color'] // Placeholder
    };
  }
  
  private identifyVariations(appearances: Array<{
    panelNumber: number;
    character: CharacterAppearanceAnalysis;
  }>): Array<{
    panelNumber: number;
    changes: string[];
    significance: 'minor' | 'moderate' | 'major';
  }> {
    // Simplified variation detection
    return appearances.map(appearance => ({
      panelNumber: appearance.panelNumber,
      changes: [], // Would compare with baseline appearance
      significance: 'minor' as const
    }));
  }
  
  private analyzeSettingConsistency(settings: string[]): string {
    const uniqueSettings = Array.from(new Set(settings));
    if (uniqueSettings.length === 1) {
      return `Consistent setting: ${uniqueSettings[0]}`;
    } else {
      return `Multiple settings: ${uniqueSettings.join(', ')}`;
    }
  }
  
  private analyzeTimeProgression(panelAnalyses: PanelVisualAnalysis[]): string | undefined {
    const timesOfDay = panelAnalyses
      .map(p => p.overallScene.timeOfDay)
      .filter(Boolean);
    
    if (timesOfDay.length > 1) {
      return `Time progression: ${timesOfDay.join(' → ')}`;
    }
    
    return undefined;
  }
  
  private identifyNotablePatterns(panelAnalyses: PanelVisualAnalysis[]): string[] {
    const patterns: string[] = [];
    
    // Analyze lighting patterns
    const lightingTypes = panelAnalyses.map(p => p.overallScene.lighting);
    const uniqueLighting = Array.from(new Set(lightingTypes));
    if (uniqueLighting.length > 2) {
      patterns.push(`Varied lighting conditions: ${uniqueLighting.join(', ')}`);
    }
    
    // Analyze mood patterns
    const moods = panelAnalyses.map(p => p.overallScene.mood);
    const uniqueMoods = Array.from(new Set(moods));
    if (uniqueMoods.length > 1) {
      patterns.push(`Mood progression: ${uniqueMoods.join(' → ')}`);
    }
    
    return patterns;
  }
  
  /**
   * Helper method to download image from URL and convert to base64
   * (Borrowed from GeminiService pattern)
   */
  private async downloadImageAsBase64(imageUrl: string): Promise<{ data: string; mimeType: string }> {
    try {
      // Security validation first
      if (!this.validateImageUrl(imageUrl)) {
        throw new Error(`URL validation failed for security reasons: ${imageUrl}`);
      }
      
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
        
        // Check file size limits
        if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
          throw new Error(`Image too large: ${buffer.length} bytes (max: ${MAX_IMAGE_SIZE_BYTES})`);
        }
        
        const base64Data = buffer.toString('base64');
        
        console.log(`Successfully downloaded object storage file: ${imageUrl} (${buffer.length} bytes)`);
        
        return {
          data: base64Data,
          mimeType: contentType
        };
      } else {
        // Handle external URLs via fetch with timeout and size limits
        console.log('Using fetch for external URL:', imageUrl);
        
        const response = await this.fetchWithTimeout(imageUrl);
        if (!response.ok) {
          throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
        }
        
        // Check content length before downloading
        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > MAX_IMAGE_SIZE_BYTES) {
          throw new Error(`Image too large: ${contentLength} bytes (max: ${MAX_IMAGE_SIZE_BYTES})`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        
        // Double-check actual size
        if (arrayBuffer.byteLength > MAX_IMAGE_SIZE_BYTES) {
          throw new Error(`Image too large: ${arrayBuffer.byteLength} bytes (max: ${MAX_IMAGE_SIZE_BYTES})`);
        }
        
        const buffer = Buffer.from(arrayBuffer);
        const base64Data = buffer.toString('base64');
        
        // Determine MIME type from content type or file extension
        const contentType = response.headers.get('content-type') || 'image/png';
        
        console.log(`Successfully downloaded external image: ${imageUrl} (${buffer.length} bytes)`);
        
        return {
          data: base64Data,
          mimeType: contentType
        };
      }
    } catch (error) {
      console.error('Error downloading image:', error);
      throw new Error(`Failed to download image for analysis: ${error}`);
    }
  }
  
  /**
   * Generate continuity guidance for character generation prompts
   * This is the key integration method for other services
   */
  async generateContinuityGuidance(
    analysisResponse: VisualContinuityAnalysisResponse
  ): Promise<ContinuityGuidance> {
    try {
      if (!analysisResponse.success || analysisResponse.characterSummary.length === 0) {
        return {
          success: false,
          characterGuidance: [],
          error: "No valid analysis data to generate guidance from"
        };
      }
      
      const characterGuidance = analysisResponse.characterSummary.map(character => {
        // Find the most recent appearance for this character
        const mostRecentPanel = Math.max(...character.appearedInPanels);
        const mostRecentAppearance = analysisResponse.panelAnalyses
          .find(panel => panel.panelNumber === mostRecentPanel)
          ?.characters.find(c => c.characterName === character.characterName && c.isPresent);
        
        // Build key attributes from common appearance and most recent data
        const keyAttributes = this.buildKeyAttributes(character, mostRecentAppearance);
        
        // Generate ready-to-use prompt segment
        const prompt = this.buildCharacterPrompt(character.characterName, keyAttributes, character.consistencyScore);
        
        return {
          characterName: character.characterName,
          prompt,
          keyAttributes,
          consistencyScore: character.consistencyScore,
          lastSeenPanel: mostRecentPanel
        };
      });
      
      // Generate scene guidance if we have panel data
      const sceneGuidance = this.buildSceneGuidance(analysisResponse);
      
      return {
        success: true,
        characterGuidance,
        sceneGuidance
      };
      
    } catch (error) {
      console.error('Failed to generate continuity guidance:', error);
      return {
        success: false,
        characterGuidance: [],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Build key attributes from character analysis
   */
  private buildKeyAttributes(
    character: VisualContinuityAnalysisResponse['characterSummary'][0],
    mostRecentAppearance?: CharacterAppearanceAnalysis
  ): ContinuityGuidance['characterGuidance'][0]['keyAttributes'] {
    // Use most recent appearance if available, fallback to common appearance
    const visualDetails = mostRecentAppearance?.visualDetails;
    
    return {
      hair: visualDetails?.hair 
        ? `${visualDetails.hair.color} ${visualDetails.hair.style} hair, ${visualDetails.hair.length} length, ${visualDetails.hair.texture} texture`
        : character.commonAppearance.mostCommonHairStyle || 'hair not specified',
      
      clothing: visualDetails?.clothing
        ? `${visualDetails.clothing.upperBody}, ${visualDetails.clothing.lowerBody}${visualDetails.clothing.outerwear ? ', ' + visualDetails.clothing.outerwear : ''}`
        : character.commonAppearance.mostCommonClothing || 'clothing not specified',
      
      physicalFeatures: visualDetails?.physicalAppearance
        ? `${visualDetails.physicalAppearance.skinTone} skin${visualDetails.physicalAppearance.eyeColor ? ', ' + visualDetails.physicalAppearance.eyeColor + ' eyes' : ''}`
        : 'physical features consistent with previous panels',
      
      accessories: visualDetails?.accessories
        ? [
            ...(visualDetails.accessories.jewelry || []),
            ...(visualDetails.accessories.glasses ? ['glasses'] : []),
            ...(visualDetails.accessories.hat ? [visualDetails.accessories.hat] : []),
            ...(visualDetails.accessories.other || [])
          ].join(', ') || 'no accessories'
        : 'accessories consistent with previous panels'
    };
  }
  
  /**
   * Build character-specific prompt segment
   */
  private buildCharacterPrompt(
    characterName: string,
    keyAttributes: ContinuityGuidance['characterGuidance'][0]['keyAttributes'],
    consistencyScore: number
  ): string {
    const consistencyLevel = consistencyScore >= 85 ? 'high' : consistencyScore >= 70 ? 'moderate' : 'low';
    
    let prompt = `${characterName}: `;
    
    // Add visual consistency note if score is concerning
    if (consistencyScore < 70) {
      prompt += `[CONSISTENCY ALERT: ${consistencyScore}% - verify appearance matches previous panels] `;
    }
    
    // Add key visual elements
    prompt += keyAttributes.hair;
    if (keyAttributes.clothing !== 'clothing not specified') {
      prompt += `, wearing ${keyAttributes.clothing}`;
    }
    if (keyAttributes.physicalFeatures !== 'physical features consistent with previous panels') {
      prompt += `, ${keyAttributes.physicalFeatures}`;
    }
    if (keyAttributes.accessories !== 'no accessories' && keyAttributes.accessories !== 'accessories consistent with previous panels') {
      prompt += `, with ${keyAttributes.accessories}`;
    }
    
    // Add style consistency instruction
    prompt += `. Maintain visual consistency with established character design.`;
    
    return prompt;
  }
  
  /**
   * Build scene guidance from overall insights
   */
  private buildSceneGuidance(
    analysisResponse: VisualContinuityAnalysisResponse
  ): ContinuityGuidance['sceneGuidance'] {
    const insights = analysisResponse.overallInsights;
    const recentPanels = analysisResponse.panelAnalyses.slice(-3); // Last 3 panels
    
    // Analyze lighting patterns
    const lightingTypes = recentPanels.map(p => p.overallScene.lighting);
    const mostCommonLighting = this.findMostCommon(lightingTypes);
    
    // Analyze mood patterns  
    const moods = recentPanels.map(p => p.overallScene.mood);
    const mostCommonMood = this.findMostCommon(moods);
    
    return {
      settingConsistency: insights.settingConsistency,
      lightingPattern: mostCommonLighting ? `Continue with ${mostCommonLighting} lighting` : 'Lighting not established',
      suggestedMood: mostCommonMood ? `Maintain ${mostCommonMood} mood` : 'Mood not established'
    };
  }
  
  /**
   * Find most common element in array
   */
  private findMostCommon(arr: string[]): string | null {
    if (arr.length === 0) return null;
    
    const frequency: { [key: string]: number } = {};
    arr.forEach(item => {
      frequency[item] = (frequency[item] || 0) + 1;
    });
    
    return Object.keys(frequency).reduce((a, b) => frequency[a] > frequency[b] ? a : b);
  }
}

// Export singleton instance
export const visualContinuityService = new VisualContinuityService();