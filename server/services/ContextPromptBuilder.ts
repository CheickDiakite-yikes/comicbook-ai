import type { StoryContext } from "@shared/schema";

export interface OutfitSpecification {
  type: string;
  style: string;
  colors?: string[];
  description?: string;
  pattern?: string;
  fabric?: string;
  formality?: number;
  modesty?: number;
}

export interface CharacterData {
  id: string;
  name: string;
  visualDescriptors?: string;
  alwaysTraits?: string;
  neverTraits?: string;
  currentOutfit?: any;
  wardrobePresets?: any;
}

export interface ContextualOutfitSuggestion {
  type: string;
  style: string;
  colors: string[];
  reasoning: string;
  confidence: number; // 0-100
  tags: string[];
}

/**
 * ContextPromptBuilder intelligently combines outfit specifications with story context
 * to generate more relevant and narrative-appropriate AI prompts for outfit generation.
 */
export class ContextPromptBuilder {
  
  /**
   * Build an intelligent AI prompt that considers story context, character traits,
   * and scene requirements for outfit generation.
   */
  buildContextualPrompt(
    outfit: OutfitSpecification,
    characters: CharacterData[],
    context?: StoryContext
  ): string {
    let prompt = this.buildBaseOutfitPrompt(outfit);
    
    // Add story context layers
    if (context) {
      prompt = this.enhanceWithProjectContext(prompt, context);
      prompt = this.enhanceWithSceneContext(prompt, context);
      prompt = this.enhanceWithPanelContext(prompt, context);
    }
    
    // Add character-specific context
    prompt = this.enhanceWithCharacterContext(prompt, characters, context);
    
    // Add quality and style modifiers
    prompt += this.buildQualityModifiers(context);
    
    return prompt;
  }

  /**
   * Build a contextual negative prompt that includes character restrictions
   * and scene-inappropriate elements.
   */
  buildContextualNegativePrompt(
    characters: CharacterData[],
    context?: StoryContext
  ): string {
    let negativePrompt = "low quality, blurry, distorted, deformed, anatomy errors";
    
    // Add character never traits
    characters.forEach(char => {
      if (char.neverTraits) {
        negativePrompt += `, ${char.neverTraits}`;
      }
    });

    // Add context-specific negative elements
    if (context) {
      negativePrompt += this.buildContextualNegativeElements(context);
    }

    return negativePrompt;
  }

  /**
   * Suggest contextually appropriate outfits based on story context.
   */
  suggestContextualOutfits(
    characters: CharacterData[],
    context?: StoryContext
  ): ContextualOutfitSuggestion[] {
    const suggestions: ContextualOutfitSuggestion[] = [];
    
    if (!context) {
      return this.getDefaultSuggestions();
    }

    // Analyze scene context for outfit appropriateness
    const sceneAnalysis = this.analyzeSceneContext(context);
    
    // Generate suggestions based on different factors
    suggestions.push(...this.generateSceneBasedSuggestions(sceneAnalysis, context));
    suggestions.push(...this.generateGenreBasedSuggestions(context));
    suggestions.push(...this.generateCharacterBasedSuggestions(characters, context));
    
    // Sort by confidence and remove duplicates
    return suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 8) // Limit to top 8 suggestions
      .filter((suggestion, index, arr) => 
        arr.findIndex(s => s.type === suggestion.type && s.style === suggestion.style) === index
      );
  }

  private buildBaseOutfitPrompt(outfit: OutfitSpecification): string {
    let prompt = `${outfit.type} in ${outfit.style} style`;
    
    if (outfit.colors?.length) {
      prompt += `, ${outfit.colors.join(' and ')} colors`;
    }
    
    if (outfit.pattern && outfit.pattern !== 'solid') {
      prompt += `, ${outfit.pattern} pattern`;
    }
    
    if (outfit.fabric) {
      prompt += `, made of ${outfit.fabric}`;
    }

    if (outfit.description) {
      prompt += `, ${outfit.description}`;
    }
    
    return prompt;
  }

  private enhanceWithProjectContext(prompt: string, context: StoryContext): string {
    if (context.projectGenre) {
      prompt += `, appropriate for ${context.projectGenre} genre`;
    }
    
    if (context.projectArtStyle) {
      prompt += `, in ${context.projectArtStyle} art style`;
    }
    
    if (context.projectCanonRules) {
      // Extract clothing-relevant rules
      const clothingRules = this.extractClothingRules(context.projectCanonRules);
      if (clothingRules) {
        prompt += `, following ${clothingRules}`;
      }
    }
    
    return prompt;
  }

  private enhanceWithSceneContext(prompt: string, context: StoryContext): string {
    if (context.pageLocation) {
      prompt += `, suitable for ${context.pageLocation}`;
    }
    
    if (context.pageTimeOfDay) {
      prompt += `, appropriate for ${context.pageTimeOfDay}`;
    }
    
    if (context.pageWeatherConditions) {
      prompt += `, suitable for ${context.pageWeatherConditions} weather`;
    }
    
    if (context.pageMood) {
      prompt += `, matching ${context.pageMood} mood`;
    }
    
    return prompt;
  }

  private enhanceWithPanelContext(prompt: string, context: StoryContext): string {
    if (context.panelAction) {
      // Extract action-relevant clothing needs
      const actionContext = this.extractActionContext(context.panelAction);
      if (actionContext) {
        prompt += `, ${actionContext}`;
      }
    }
    
    if (context.panelMood && context.panelMood !== context.pageMood) {
      prompt += `, fitting ${context.panelMood} panel mood`;
    }
    
    if (context.panelCameraAngle === 'close-up') {
      prompt += `, detailed upper body clothing`;
    } else if (context.panelCameraAngle === 'full-shot') {
      prompt += `, full outfit visible`;
    }
    
    return prompt;
  }

  private enhanceWithCharacterContext(
    prompt: string, 
    characters: CharacterData[], 
    context?: StoryContext
  ): string {
    characters.forEach(char => {
      if (char.visualDescriptors) {
        prompt += `, complementing ${char.visualDescriptors}`;
      }
      
      if (char.alwaysTraits) {
        prompt += `, reflecting ${char.alwaysTraits}`;
      }
      
      // Consider current outfit for consistency
      if (char.currentOutfit && context?.characterCurrentOutfits?.[char.id]) {
        const currentOutfit = context.characterCurrentOutfits[char.id];
        if (currentOutfit.colors) {
          prompt += `, coordinating with existing ${currentOutfit.colors.join(' and ')} colors`;
        }
      }
    });
    
    return prompt;
  }

  private buildQualityModifiers(context?: StoryContext): string {
    let modifiers = ", high quality, detailed, photorealistic";
    
    if (context?.projectArtStyle?.includes('anime')) {
      modifiers += ", anime style";
    } else if (context?.projectArtStyle?.includes('cartoon')) {
      modifiers += ", cartoon style";
    } else if (context?.projectArtStyle?.includes('realistic')) {
      modifiers += ", realistic style";
    }
    
    return modifiers;
  }

  private buildContextualNegativeElements(context: StoryContext): string {
    let negative = "";
    
    // Genre-specific negative elements
    if (context.projectGenre?.includes('comedy')) {
      negative += ", overly serious, formal business attire";
    } else if (context.projectGenre?.includes('horror')) {
      negative += ", bright cheerful colors, cartoon elements";
    } else if (context.projectGenre?.includes('professional')) {
      negative += ", overly casual, inappropriate attire";
    }
    
    // Scene-specific negative elements
    if (context.pageLocation?.includes('beach')) {
      negative += ", heavy winter clothing, formal suits";
    } else if (context.pageLocation?.includes('office')) {
      negative += ", swimwear, overly casual attire";
    } else if (context.pageLocation?.includes('formal event')) {
      negative += ", casual wear, athletic clothing";
    }
    
    // Weather-specific negative elements
    if (context.pageWeatherConditions?.includes('hot')) {
      negative += ", heavy coats, winter clothing";
    } else if (context.pageWeatherConditions?.includes('cold')) {
      negative += ", light summer clothing, swimwear";
    }
    
    return negative;
  }

  private analyzeSceneContext(context: StoryContext): any {
    return {
      formalityLevel: this.determineFormalityLevel(context),
      activityLevel: this.determineActivityLevel(context),
      weatherAppropriate: this.determineWeatherAppropriateness(context),
      locationAppropriate: this.determineLocationAppropriateness(context)
    };
  }

  private determineFormalityLevel(context: StoryContext): number {
    let formality = 50; // Base formality
    
    if (context.pageLocation?.includes('office') || context.pageLocation?.includes('business')) {
      formality += 30;
    } else if (context.pageLocation?.includes('home') || context.pageLocation?.includes('casual')) {
      formality -= 20;
    }
    
    if (context.panelAction?.includes('meeting') || context.panelAction?.includes('presentation')) {
      formality += 25;
    } else if (context.panelAction?.includes('relaxing') || context.panelAction?.includes('hanging out')) {
      formality -= 15;
    }
    
    return Math.max(0, Math.min(100, formality));
  }

  private determineActivityLevel(context: StoryContext): number {
    let activity = 50; // Base activity
    
    if (context.panelAction?.includes('running') || context.panelAction?.includes('fighting')) {
      activity += 40;
    } else if (context.panelAction?.includes('sitting') || context.panelAction?.includes('talking')) {
      activity -= 20;
    }
    
    return Math.max(0, Math.min(100, activity));
  }

  private determineWeatherAppropriateness(context: StoryContext): string[] {
    const appropriate = [];
    
    if (context.pageWeatherConditions?.includes('hot') || context.pageWeatherConditions?.includes('sunny')) {
      appropriate.push('light', 'breathable', 'summer');
    } else if (context.pageWeatherConditions?.includes('cold') || context.pageWeatherConditions?.includes('winter')) {
      appropriate.push('warm', 'layered', 'winter');
    } else if (context.pageWeatherConditions?.includes('rainy')) {
      appropriate.push('waterproof', 'covered');
    }
    
    return appropriate;
  }

  private determineLocationAppropriateness(context: StoryContext): string[] {
    const appropriate = [];
    
    if (context.pageLocation?.includes('beach')) {
      appropriate.push('swimwear', 'casual', 'light');
    } else if (context.pageLocation?.includes('office') || context.pageLocation?.includes('business')) {
      appropriate.push('business', 'professional', 'formal');
    } else if (context.pageLocation?.includes('gym') || context.pageLocation?.includes('sports')) {
      appropriate.push('athletic', 'sporty', 'active');
    } else if (context.pageLocation?.includes('party') || context.pageLocation?.includes('club')) {
      appropriate.push('party', 'stylish', 'trendy');
    }
    
    return appropriate;
  }

  private generateSceneBasedSuggestions(sceneAnalysis: any, context: StoryContext): ContextualOutfitSuggestion[] {
    const suggestions: ContextualOutfitSuggestion[] = [];
    
    // Generate suggestions based on formality level
    if (sceneAnalysis.formalityLevel > 70) {
      suggestions.push({
        type: 'business_suit',
        style: 'professional formal',
        colors: ['navy', 'black', 'charcoal'],
        reasoning: 'High formality context suggests professional attire',
        confidence: 85,
        tags: ['formal', 'professional', 'business']
      });
    } else if (sceneAnalysis.formalityLevel < 30) {
      suggestions.push({
        type: 'casual_wear',
        style: 'relaxed casual',
        colors: ['blue', 'white', 'khaki'],
        reasoning: 'Low formality context suggests casual attire',
        confidence: 80,
        tags: ['casual', 'relaxed', 'comfortable']
      });
    }
    
    // Generate suggestions based on activity level
    if (sceneAnalysis.activityLevel > 70) {
      suggestions.push({
        type: 'athletic_wear',
        style: 'sporty active',
        colors: ['red', 'black', 'white'],
        reasoning: 'High activity context suggests athletic wear',
        confidence: 90,
        tags: ['athletic', 'active', 'sporty']
      });
    }
    
    return suggestions;
  }

  private generateGenreBasedSuggestions(context: StoryContext): ContextualOutfitSuggestion[] {
    const suggestions: ContextualOutfitSuggestion[] = [];
    
    if (context.projectGenre?.includes('fantasy')) {
      suggestions.push({
        type: 'fantasy_clothing',
        style: 'medieval fantasy',
        colors: ['brown', 'green', 'gold'],
        reasoning: 'Fantasy genre suggests medieval or magical attire',
        confidence: 75,
        tags: ['fantasy', 'medieval', 'magical']
      });
    } else if (context.projectGenre?.includes('sci-fi') || context.projectGenre?.includes('futuristic')) {
      suggestions.push({
        type: 'futuristic_clothing',
        style: 'cyberpunk futuristic',
        colors: ['silver', 'blue', 'black'],
        reasoning: 'Sci-fi genre suggests futuristic attire',
        confidence: 80,
        tags: ['sci-fi', 'futuristic', 'tech']
      });
    } else if (context.projectGenre?.includes('comedy')) {
      suggestions.push({
        type: 'casual_wear',
        style: 'fun quirky',
        colors: ['bright', 'colorful', 'mixed'],
        reasoning: 'Comedy genre suggests fun, approachable clothing',
        confidence: 70,
        tags: ['comedy', 'fun', 'quirky']
      });
    }
    
    return suggestions;
  }

  private generateCharacterBasedSuggestions(characters: CharacterData[], context?: StoryContext): ContextualOutfitSuggestion[] {
    const suggestions: ContextualOutfitSuggestion[] = [];
    
    characters.forEach(char => {
      if (char.alwaysTraits?.includes('rebellious')) {
        suggestions.push({
          type: 'casual_wear',
          style: 'edgy rebellious',
          colors: ['black', 'red', 'dark'],
          reasoning: `${char.name}'s rebellious traits suggest edgy styling`,
          confidence: 75,
          tags: ['rebellious', 'edgy', 'alternative']
        });
      } else if (char.alwaysTraits?.includes('elegant') || char.alwaysTraits?.includes('sophisticated')) {
        suggestions.push({
          type: 'evening_wear',
          style: 'elegant sophisticated',
          colors: ['black', 'gold', 'silver'],
          reasoning: `${char.name}'s elegant traits suggest refined attire`,
          confidence: 80,
          tags: ['elegant', 'sophisticated', 'refined']
        });
      } else if (char.alwaysTraits?.includes('sporty') || char.alwaysTraits?.includes('athletic')) {
        suggestions.push({
          type: 'athletic_wear',
          style: 'sporty casual',
          colors: ['blue', 'white', 'red'],
          reasoning: `${char.name}'s sporty traits suggest athletic wear`,
          confidence: 85,
          tags: ['sporty', 'athletic', 'active']
        });
      }
    });
    
    return suggestions;
  }

  private getDefaultSuggestions(): ContextualOutfitSuggestion[] {
    return [
      {
        type: 'casual_wear',
        style: 'modern casual',
        colors: ['blue', 'white'],
        reasoning: 'Default casual option',
        confidence: 60,
        tags: ['casual', 'default']
      },
      {
        type: 'business_suit',
        style: 'professional',
        colors: ['navy', 'white'],
        reasoning: 'Default formal option',
        confidence: 60,
        tags: ['formal', 'default']
      }
    ];
  }

  private extractClothingRules(canonRules: string): string | null {
    // Simple keyword extraction - could be enhanced with NLP
    const clothingKeywords = ['clothing', 'outfit', 'dress', 'wear', 'attire', 'costume', 'uniform'];
    const words = canonRules.toLowerCase().split(' ');
    
    if (words.some(word => clothingKeywords.includes(word))) {
      // Extract relevant sentences containing clothing keywords
      const sentences = canonRules.split(/[.!?]/);
      const clothingSentences = sentences.filter(sentence => 
        clothingKeywords.some(keyword => sentence.toLowerCase().includes(keyword))
      );
      
      return clothingSentences.length > 0 ? clothingSentences[0].trim() : null;
    }
    
    return null;
  }

  private extractActionContext(action: string): string | null {
    // Extract action-relevant clothing context
    const actionMap: Record<string, string> = {
      'running': 'suitable for running and movement',
      'fighting': 'allowing for combat and flexibility',
      'swimming': 'appropriate for water activities',
      'dancing': 'suitable for dancing and movement',
      'working': 'appropriate for work environment',
      'sleeping': 'comfortable for rest',
      'cooking': 'practical for kitchen work',
      'driving': 'comfortable for sitting and driving',
      'climbing': 'suitable for physical activity and climbing'
    };
    
    for (const [actionKeyword, context] of Object.entries(actionMap)) {
      if (action.toLowerCase().includes(actionKeyword)) {
        return context;
      }
    }
    
    return null;
  }
}

export const contextPromptBuilder = new ContextPromptBuilder();