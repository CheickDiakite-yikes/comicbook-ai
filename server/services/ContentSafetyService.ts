import { GoogleGenAI } from "@google/genai";
import type { ContentRating } from "@shared/schema";

export interface ContentClassification {
  rating: ContentRating;
  safetyScore: number; // 0-100, where 100 is completely safe
  categories: string[]; // detected content categories
  flags: {
    explicitSexual: boolean;
    suggestive: boolean;
    violentContent: boolean;
    adultThemes: boolean;
    profanity: boolean;
    drugSubstances: boolean;
    medicalContent: boolean;
    politicalContent: boolean;
  };
  explanation: string; // why this rating was assigned
  blockedKeywords: string[]; // specific terms that triggered flags
}

export interface ContentAnalysisRequest {
  text: string;
  context?: string; // additional context like "character description", "outfit description"
  userId?: string; // for personalized filtering
  requestId?: string; // for tracking
}

/**
 * Enterprise-grade content safety service that classifies text content
 * and determines appropriate age ratings and access controls.
 * 
 * Uses multiple detection methods:
 * 1. AI-powered content classification via Gemini
 * 2. Keyword-based pattern matching
 * 3. Contextual analysis based on usage patterns
 * 4. Cumulative risk assessment
 */
export class ContentSafetyService {
  private ai: GoogleGenAI;
  
  // Comprehensive keyword lists for different content categories
  private readonly adultKeywords = [
    // Explicit sexual content
    'nude', 'naked', 'topless', 'bottomless', 'sexual', 'intercourse', 'sex', 'porn', 'xxx',
    'orgasm', 'masturbation', 'genitals', 'penis', 'vagina', 'breasts', 'nipples',
    
    // Suggestive content
    'seductive', 'sensual', 'erotic', 'provocative', 'sultry', 'tempting', 'alluring',
    'revealing', 'skimpy', 'tight-fitting', 'low-cut', 'see-through', 'transparent',
    'lingerie', 'underwear', 'bra', 'panties', 'thong', 'corset', 'bondage',
    
    // Adult themes
    'fetish', 'kink', 'dominant', 'submissive', 'latex', 'leather', 'chains',
    'whip', 'handcuffs', 'collar', 'gag', 'rope', 'tied up',
    
    // Anatomy references in sexual context
    'cleavage', 'bust', 'curves', 'assets', 'endowed', 'voluptuous', 'ample'
  ];
  
  private readonly matureKeywords = [
    // Violence and weapons
    'blood', 'gore', 'violence', 'weapon', 'gun', 'knife', 'sword', 'fight', 'battle',
    'death', 'kill', 'murder', 'assault', 'attack', 'wound', 'injury',
    
    // Substance use
    'alcohol', 'beer', 'wine', 'drunk', 'drinking', 'smoking', 'cigarette', 'cigar',
    'drugs', 'cocaine', 'marijuana', 'weed', 'pills', 'injection', 'needle',
    
    // Mature themes
    'betrayal', 'revenge', 'torture', 'suffering', 'abuse', 'trauma',
    'depression', 'suicide', 'self-harm', 'mental illness',
    
    // Mild suggestive content
    'attractive', 'beautiful', 'handsome', 'gorgeous', 'sexy', 'hot', 'stunning',
    'swimwear', 'bikini', 'swimming suit', 'beach wear'
  ];
  
  private readonly profanityKeywords = [
    // Common profanity (partial list for detection)
    'fuck', 'shit', 'damn', 'hell', 'ass', 'bitch', 'bastard', 'crap',
    'piss', 'cock', 'dick', 'pussy', 'slut', 'whore', 'fag', 'retard'
  ];

  constructor() {
    this.ai = new GoogleGenAI({ 
      apiKey: process.env.GEMINI_API_KEY || "" 
    });
  }

  /**
   * Classify text content for safety and age appropriateness
   */
  async classifyContent(request: ContentAnalysisRequest): Promise<ContentClassification> {
    const { text, context, userId, requestId } = request;
    
    console.log(`🔍 Content Safety Analysis [${requestId}]: Analyzing ${text.length} characters`);
    
    try {
      // Step 1: Keyword-based rapid screening
      const keywordAnalysis = this.performKeywordAnalysis(text);
      
      // Step 2: AI-powered content classification
      const aiAnalysis = await this.performAIClassification(text, context);
      
      // Step 3: Combine results for final classification
      const finalClassification = this.combineAnalysisResults(keywordAnalysis, aiAnalysis);
      
      console.log(`✅ Content Classification [${requestId}]: ${finalClassification.rating} (Score: ${finalClassification.safetyScore})`);
      
      return finalClassification;
      
    } catch (error) {
      console.error(`❌ Content Safety Analysis Error [${requestId}]:`, error);
      
      // On error, fail securely - treat as potentially unsafe
      return {
        rating: "Adult",
        safetyScore: 0,
        categories: ["error_classification"],
        flags: {
          explicitSexual: true, // err on side of caution
          suggestive: true,
          violentContent: false,
          adultThemes: true,
          profanity: false,
          drugSubstances: false,
          medicalContent: false,
          politicalContent: false,
        },
        explanation: "Content classification failed - defaulting to restricted access for safety",
        blockedKeywords: [],
      };
    }
  }

  /**
   * Fast keyword-based analysis for immediate screening
   */
  private performKeywordAnalysis(text: string): Partial<ContentClassification> {
    const lowerText = text.toLowerCase();
    const blockedKeywords: string[] = [];
    
    // Check for adult content keywords
    const adultMatches = this.adultKeywords.filter(keyword => {
      if (lowerText.includes(keyword.toLowerCase())) {
        blockedKeywords.push(keyword);
        return true;
      }
      return false;
    });
    
    // Check for mature content keywords  
    const matureMatches = this.matureKeywords.filter(keyword => {
      if (lowerText.includes(keyword.toLowerCase())) {
        blockedKeywords.push(keyword);
        return true;
      }
      return false;
    });
    
    // Check for profanity
    const profanityMatches = this.profanityKeywords.filter(keyword => {
      if (lowerText.includes(keyword.toLowerCase())) {
        blockedKeywords.push(keyword);
        return true;
      }
      return false;
    });

    let rating: ContentRating = "General";
    let safetyScore = 100;
    const categories: string[] = [];
    const flags = {
      explicitSexual: false,
      suggestive: false,
      violentContent: false,
      adultThemes: false,
      profanity: false,
      drugSubstances: false,
      medicalContent: false,
      politicalContent: false,
    };

    if (adultMatches.length > 0) {
      rating = "Adult";
      safetyScore = Math.max(0, 30 - (adultMatches.length * 10));
      categories.push("adult_content", "sexual_content");
      flags.explicitSexual = true;
      flags.adultThemes = true;
    } else if (matureMatches.length > 0) {
      rating = "Mature";
      safetyScore = Math.max(30, 70 - (matureMatches.length * 5));
      categories.push("mature_content");
      flags.suggestive = true;
    }
    
    if (profanityMatches.length > 0) {
      flags.profanity = true;
      safetyScore = Math.max(0, safetyScore - (profanityMatches.length * 15));
      categories.push("profanity");
    }

    return {
      rating,
      safetyScore,
      categories,
      flags,
      blockedKeywords,
    };
  }

  /**
   * AI-powered content classification using Gemini
   */
  private async performAIClassification(text: string, context?: string): Promise<Partial<ContentClassification>> {
    const prompt = `You are a content safety classifier. Analyze the following text and classify it for age appropriateness.

Text to analyze: "${text}"
Context: ${context || "General content"}

Respond with a JSON object containing:
{
  "rating": "General" | "Mature" | "Adult",
  "safetyScore": number (0-100, where 100 is completely safe),
  "categories": string[] (detected content categories),
  "explanation": "Brief explanation of the rating decision",
  "containsExplicitContent": boolean,
  "containsSuggestiveContent": boolean,
  "containsViolence": boolean,
  "containsAdultThemes": boolean,
  "recommendedAgeRestriction": number (minimum age in years)
}

Rating Guidelines:
- General: Safe for all ages, no mature themes
- Mature: Some mature themes, suitable for ages 16+, may contain mild suggestive content, violence, or mature themes
- Adult: Contains explicit sexual content, graphic violence, or adult themes requiring age 18+

Be conservative in your classification - err on the side of higher age restrictions for safety.`;

    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-pro",
        config: {
          responseMimeType: "application/json",
        },
        contents: prompt,
      });

      const analysisResult = JSON.parse(response.text || "{}");
      
      return {
        rating: analysisResult.rating || "Adult", // default to most restrictive
        safetyScore: analysisResult.safetyScore || 0,
        categories: analysisResult.categories || ["ai_classified"],
        explanation: analysisResult.explanation || "AI content classification",
        flags: {
          explicitSexual: analysisResult.containsExplicitContent || false,
          suggestive: analysisResult.containsSuggestiveContent || false,
          violentContent: analysisResult.containsViolence || false,
          adultThemes: analysisResult.containsAdultThemes || false,
          profanity: false, // handled by keyword analysis
          drugSubstances: false,
          medicalContent: false,
          politicalContent: false,
        },
      };
      
    } catch (error) {
      console.error("AI content classification error:", error);
      // Return restrictive fallback
      return {
        rating: "Adult",
        safetyScore: 0,
        categories: ["ai_classification_error"],
        explanation: "AI classification failed - defaulting to restricted",
      };
    }
  }

  /**
   * Combine keyword and AI analysis for final decision
   */
  private combineAnalysisResults(
    keywordAnalysis: Partial<ContentClassification>, 
    aiAnalysis: Partial<ContentClassification>
  ): ContentClassification {
    
    // Take the more restrictive rating
    const ratings = ["General", "Mature", "Adult"];
    const keywordRatingIndex = ratings.indexOf(keywordAnalysis.rating || "General");
    const aiRatingIndex = ratings.indexOf(aiAnalysis.rating || "General");
    const finalRatingIndex = Math.max(keywordRatingIndex, aiRatingIndex);
    const finalRating = ratings[finalRatingIndex] as ContentRating;
    
    // Take the lower safety score (more conservative)
    const finalSafetyScore = Math.min(
      keywordAnalysis.safetyScore || 100,
      aiAnalysis.safetyScore || 100
    );
    
    // Combine categories
    const combinedCategories = [
      ...(keywordAnalysis.categories || []),
      ...(aiAnalysis.categories || [])
    ];
    
    // Combine flags (OR logic - if either detects it, flag it)
    const combinedFlags = {
      explicitSexual: (keywordAnalysis.flags?.explicitSexual || false) || (aiAnalysis.flags?.explicitSexual || false),
      suggestive: (keywordAnalysis.flags?.suggestive || false) || (aiAnalysis.flags?.suggestive || false),
      violentContent: (keywordAnalysis.flags?.violentContent || false) || (aiAnalysis.flags?.violentContent || false),
      adultThemes: (keywordAnalysis.flags?.adultThemes || false) || (aiAnalysis.flags?.adultThemes || false),
      profanity: keywordAnalysis.flags?.profanity || false,
      drugSubstances: (keywordAnalysis.flags?.drugSubstances || false) || (aiAnalysis.flags?.drugSubstances || false),
      medicalContent: (keywordAnalysis.flags?.medicalContent || false) || (aiAnalysis.flags?.medicalContent || false),
      politicalContent: (keywordAnalysis.flags?.politicalContent || false) || (aiAnalysis.flags?.politicalContent || false),
    };
    
    // Create comprehensive explanation
    const explanations = [
      keywordAnalysis.explanation,
      aiAnalysis.explanation
    ].filter(Boolean);
    
    const finalExplanation = explanations.length > 0 
      ? explanations.join(" | ") 
      : `Content classified as ${finalRating}`;
    
    return {
      rating: finalRating,
      safetyScore: finalSafetyScore,
      categories: Array.from(new Set(combinedCategories)), // remove duplicates
      flags: combinedFlags,
      explanation: finalExplanation,
      blockedKeywords: keywordAnalysis.blockedKeywords || [],
    };
  }

  /**
   * Quick content safety check - returns true if content is safe for the given age
   */
  async isContentSafe(text: string, userAge: number, context?: string): Promise<boolean> {
    const classification = await this.classifyContent({ text, context });
    
    // Age requirements based on rating
    switch (classification.rating) {
      case "General":
        return true;
      case "Mature":
        return userAge >= 16;
      case "Adult":
        return userAge >= 18;
      default:
        return false; // err on side of caution
    }
  }

  /**
   * Extract and analyze all text fields from a request object
   */
  async analyzeRequestContent(requestBody: any, context?: string): Promise<ContentClassification> {
    // Extract all text fields from request
    const textFields: string[] = [];
    
    // Common text fields to analyze
    const fieldsToCheck = [
      'prompt', 'description', 'customPrompt', 'customInstructions',
      'bio', 'visualDescriptors', 'genre', 'script', 'title',
      'outfit.description', 'outfit.style', 'character.bio',
      'character.visualDescriptors', 'setting.description'
    ];
    
    // Recursively extract text from nested objects
    const extractText = (obj: any, prefix = ''): void => {
      if (typeof obj === 'string' && obj.trim().length > 0) {
        textFields.push(obj);
      } else if (Array.isArray(obj)) {
        obj.forEach((item, index) => extractText(item, `${prefix}[${index}]`));
      } else if (obj && typeof obj === 'object') {
        Object.keys(obj).forEach(key => {
          extractText(obj[key], prefix ? `${prefix}.${key}` : key);
        });
      }
    };
    
    extractText(requestBody);
    
    // Analyze all extracted text as one combined string
    const combinedText = textFields.join(' | ');
    
    if (combinedText.trim().length === 0) {
      return {
        rating: "General",
        safetyScore: 100,
        categories: ["no_content"],
        flags: {
          explicitSexual: false,
          suggestive: false,
          violentContent: false,
          adultThemes: false,
          profanity: false,
          drugSubstances: false,
          medicalContent: false,
          politicalContent: false,
        },
        explanation: "No text content to analyze",
        blockedKeywords: [],
      };
    }
    
    return this.classifyContent({ 
      text: combinedText, 
      context: context || "API request content"
    });
  }
}

export const contentSafetyService = new ContentSafetyService();