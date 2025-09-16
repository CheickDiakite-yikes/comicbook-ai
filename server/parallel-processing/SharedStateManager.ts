import EventEmitter from 'events';
import { IStorage } from '../storage';
import { GenerateImageResponse } from '../gemini';
import { PanelCharacterState } from '@shared/schema';

export interface CharacterState {
  id: string;
  name: string;
  currentAppearance: {
    physicalTraits: string[];
    clothing: string;
    accessories: string[];
    mood: string;
    location: string;
  };
  // Enhanced visual analysis tracking
  visualAnalysis: {
    latestAnalysisTimestamp?: Date;
    latestPanelState?: PanelCharacterState;
    consistentFeatures: {
      hair: { color?: string; style?: string; length?: string; texture?: string };
      clothing: { upperBody?: string; lowerBody?: string; outerwear?: string; colors?: string[] };
      physical: { skinTone?: string; eyeColor?: string };
      accessories: { jewelry?: string[]; glasses?: boolean; hat?: string };
    };
    appearanceHistory: Array<{
      panelId: string;
      timestamp: Date;
      confidence: number;
      changes: string[];
    }>;
    averageConfidenceScore: number;
    totalAnalysisCount: number;
  };
  lastSeenPanelId?: string;
  lastUpdated: Date;
  consistencyRules: {
    alwaysTraits: string[];
    neverTraits: string[];
    colorScheme: string;
  };
  referenceImageUrls: string[];
}

export interface ProjectSharedState {
  projectId: string;
  title: string;
  characters: Map<string, CharacterState>;
  globalStyle: {
    artStyle: string;
    colorPalette: string[];
    mood: string;
    lighting: string;
  };
  storyContext: {
    currentScene: string;
    timeOfDay: string;
    location: string;
    atmosphere: string;
  };
  lastUpdated: Date;
  version: number;
}

export class SharedStateManager extends EventEmitter {
  private projectStates: Map<string, ProjectSharedState> = new Map();
  private locks: Map<string, Set<string>> = new Map(); // projectId -> set of locked character IDs
  private lockTimeouts: Map<string, NodeJS.Timeout> = new Map();

  async initializeProject(projectId: string, storage: IStorage): Promise<void> {
    try {
      const project = await storage.getProject(projectId);
      if (!project) {
        throw new Error(`Project ${projectId} not found`);
      }

      const characters = await storage.getProjectCharacters(projectId);
      const characterStates = new Map<string, CharacterState>();

      // Initialize character states from database
      for (const character of characters) {
        const characterState: CharacterState = {
          id: character.id,
          name: character.name,
          currentAppearance: {
            physicalTraits: this.parseTraits(character.visualDescriptors || ''),
            clothing: 'default outfit',
            accessories: [],
            mood: 'neutral',
            location: 'unknown'
          },
          // Initialize visual analysis tracking
          visualAnalysis: {
            consistentFeatures: {
              hair: {},
              clothing: {},
              physical: {},
              accessories: {}
            },
            appearanceHistory: [],
            averageConfidenceScore: 0,
            totalAnalysisCount: 0
          },
          lastUpdated: new Date(),
          consistencyRules: {
            alwaysTraits: this.parseTraits(character.alwaysTraits || ''),
            neverTraits: this.parseTraits(character.neverTraits || ''),
            colorScheme: character.colorScheme || 'default'
          },
          referenceImageUrls: character.referenceImageUrl ? [character.referenceImageUrl] : []
        };
        characterStates.set(character.name, characterState);
      }

      const sharedState: ProjectSharedState = {
        projectId,
        title: project.title,
        characters: characterStates,
        globalStyle: {
          artStyle: project.artStyle || 'default',
          colorPalette: [],
          mood: 'neutral',
          lighting: 'natural'
        },
        storyContext: {
          currentScene: 'opening',
          timeOfDay: 'day',
          location: 'unknown',
          atmosphere: 'neutral'
        },
        lastUpdated: new Date(),
        version: 1
      };

      this.projectStates.set(projectId, sharedState);
      this.emit('projectInitialized', projectId, sharedState);

    } catch (error) {
      this.emit('error', 'Failed to initialize project state', error);
      throw error;
    }
  }

  async getSharedContext(projectId: string): Promise<any> {
    const state = this.projectStates.get(projectId);
    if (!state) {
      throw new Error(`Project state not found: ${projectId}`);
    }

    return {
      characters: Array.from(state.characters.values()).map(char => ({
        name: char.name,
        visualDescriptors: char.currentAppearance.physicalTraits.join(', '),
        role: 'character', // You might want to store this in the character state
        alwaysTraits: char.consistencyRules.alwaysTraits.join(', '),
        neverTraits: char.consistencyRules.neverTraits.join(', '),
        colorScheme: char.consistencyRules.colorScheme,
        referenceImageUrl: char.referenceImageUrls[0]
      })),
      settings: [{
        name: state.storyContext.location,
        description: `${state.storyContext.atmosphere} atmosphere at ${state.storyContext.timeOfDay}`
      }],
      styleRules: `Art style: ${state.globalStyle.artStyle}. Color palette: ${state.globalStyle.colorPalette.join(', ')}. Overall mood: ${state.globalStyle.mood}.`,
      characterStates: Array.from(state.characters.values()).map(char => ({
        name: char.name,
        visualDescriptors: [
          ...char.currentAppearance.physicalTraits,
          char.currentAppearance.clothing,
          ...char.currentAppearance.accessories
        ].join(', '),
        role: 'character'
      }))
    };
  }

  async lockCharacter(projectId: string, characterName: string, timeoutMs: number = 30000): Promise<boolean> {
    const lockKey = `${projectId}:${characterName}`;
    
    if (!this.locks.has(projectId)) {
      this.locks.set(projectId, new Set());
    }
    
    const projectLocks = this.locks.get(projectId)!;
    
    if (projectLocks.has(characterName)) {
      return false; // Character is already locked
    }
    
    projectLocks.add(characterName);
    
    // Set up timeout to auto-release lock
    const timeout = setTimeout(() => {
      this.unlockCharacter(projectId, characterName);
      this.emit('lockTimeout', projectId, characterName);
    }, timeoutMs);
    
    this.lockTimeouts.set(lockKey, timeout);
    this.emit('characterLocked', projectId, characterName);
    
    return true;
  }

  unlockCharacter(projectId: string, characterName: string): boolean {
    const lockKey = `${projectId}:${characterName}`;
    const projectLocks = this.locks.get(projectId);
    
    if (!projectLocks || !projectLocks.has(characterName)) {
      return false; // Character wasn't locked
    }
    
    projectLocks.delete(characterName);
    
    // Clear timeout
    const timeout = this.lockTimeouts.get(lockKey);
    if (timeout) {
      clearTimeout(timeout);
      this.lockTimeouts.delete(lockKey);
    }
    
    this.emit('characterUnlocked', projectId, characterName);
    return true;
  }

  async updateCharacterStates(projectId: string, taskId: string, result: GenerateImageResponse): Promise<void> {
    // FIXED: Accept projectId directly instead of trying to extract from taskId
    const state = this.projectStates.get(projectId);
    
    if (!state) {
      return; // Project state not found
    }

    try {
      // This is a simplified implementation - in reality, you'd parse the result
      // to extract character state changes from the generated image
      
      // For now, just update the last seen panel for characters mentioned in the prompt
      const prompt = this.extractPromptFromResult(result);
      const mentionedCharacters = this.extractCharacterMentions(prompt, state);
      
      for (const characterName of mentionedCharacters) {
        const character = state.characters.get(characterName);
        if (character) {
          character.lastSeenPanelId = taskId;
          character.lastUpdated = new Date();
          
          // Update appearance based on generation result
          this.updateCharacterAppearanceFromResult(character, result, prompt);
        }
      }

      state.version++;
      state.lastUpdated = new Date();
      
      this.emit('characterStatesUpdated', projectId, mentionedCharacters);

    } catch (error) {
      this.emit('error', 'Failed to update character states', error);
    }
  }

  private updateCharacterAppearanceFromResult(
    character: CharacterState, 
    result: GenerateImageResponse, 
    prompt: string
  ): void {
    // This is a simplified implementation
    // In reality, you'd use AI vision or parsing to extract appearance details
    
    // For now, just update mood based on keywords in the prompt
    if (prompt.includes('angry') || prompt.includes('furious')) {
      character.currentAppearance.mood = 'angry';
    } else if (prompt.includes('happy') || prompt.includes('smiling')) {
      character.currentAppearance.mood = 'happy';
    } else if (prompt.includes('sad') || prompt.includes('crying')) {
      character.currentAppearance.mood = 'sad';
    }
    
    // Update location if mentioned
    const locationKeywords = ['forest', 'city', 'home', 'school', 'park', 'beach'];
    for (const location of locationKeywords) {
      if (prompt.toLowerCase().includes(location)) {
        character.currentAppearance.location = location;
        break;
      }
    }
  }

  updateStoryContext(projectId: string, context: Partial<ProjectSharedState['storyContext']>): boolean {
    const state = this.projectStates.get(projectId);
    if (!state) {
      return false;
    }

    Object.assign(state.storyContext, context);
    state.version++;
    state.lastUpdated = new Date();
    
    this.emit('storyContextUpdated', projectId, context);
    return true;
  }

  getCharacterState(projectId: string, characterName: string): CharacterState | undefined {
    const state = this.projectStates.get(projectId);
    return state?.characters.get(characterName);
  }

  getAllCharacterStates(projectId: string): CharacterState[] {
    const state = this.projectStates.get(projectId);
    return state ? Array.from(state.characters.values()) : [];
  }

  /**
   * Update character states with visual analysis results from PanelCharacterState data
   */
  async updateCharacterStatesWithVisualAnalysis(
    projectId: string, 
    panelId: string, 
    panelCharacterStates: PanelCharacterState[]
  ): Promise<void> {
    const state = this.projectStates.get(projectId);
    
    if (!state) {
      console.warn(`Project state not found for ${projectId}`);
      return;
    }

    try {
      console.log(`🔍 Updating character states with visual analysis for panel ${panelId}`);
      
      for (const panelState of panelCharacterStates) {
        // Find character by ID or name
        const character = this.findCharacterByIdOrName(state, panelState.characterId);
        
        if (!character) {
          console.warn(`Character not found for panel state: ${panelState.characterId}`);
          continue;
        }

        // Update latest panel state and timestamp
        character.visualAnalysis.latestPanelState = panelState;
        character.visualAnalysis.latestAnalysisTimestamp = panelState.visualAnalysisTimestamp || new Date();
        
        // Update consistent features based on detected values
        this.updateConsistentFeatures(character, panelState);
        
        // Add to appearance history
        this.addToAppearanceHistory(character, panelId, panelState);
        
        // Update confidence tracking
        this.updateConfidenceTracking(character, panelState);
        
        // Update current appearance with visual analysis data
        this.updateCurrentAppearanceFromAnalysis(character, panelState);
        
        character.lastSeenPanelId = panelId;
        character.lastUpdated = new Date();
        
        console.log(`✅ Updated character state for ${character.name} with confidence ${panelState.confidenceScore}%`);
      }

      state.version++;
      state.lastUpdated = new Date();
      
      const updatedCharacterNames = panelCharacterStates.map(ps => 
        this.findCharacterByIdOrName(state, ps.characterId)?.name || ps.characterId
      ).filter(Boolean);
      
      this.emit('characterStatesUpdatedWithVisualAnalysis', projectId, panelId, updatedCharacterNames);

    } catch (error) {
      console.error('Error updating character states with visual analysis:', error);
      this.emit('error', error);
    }
  }

  /**
   * Get visual analysis summary for characters in a project
   */
  getCharacterVisualAnalysisSummary(projectId: string): Array<{
    characterId: string;
    characterName: string;
    latestAnalysisTimestamp?: Date;
    averageConfidenceScore: number;
    totalAnalysisCount: number;
    consistentFeatures: any;
    lastSeenPanel?: string;
  }> {
    const state = this.projectStates.get(projectId);
    
    if (!state) {
      return [];
    }

    return Array.from(state.characters.values()).map(character => ({
      characterId: character.id,
      characterName: character.name,
      latestAnalysisTimestamp: character.visualAnalysis.latestAnalysisTimestamp,
      averageConfidenceScore: character.visualAnalysis.averageConfidenceScore,
      totalAnalysisCount: character.visualAnalysis.totalAnalysisCount,
      consistentFeatures: character.visualAnalysis.consistentFeatures,
      lastSeenPanel: character.lastSeenPanelId
    }));
  }

  /**
   * Get character appearance history for a specific character
   */
  getCharacterAppearanceHistory(projectId: string, characterName: string): Array<{
    panelId: string;
    timestamp: Date;
    confidence: number;
    changes: string[];
  }> {
    const state = this.projectStates.get(projectId);
    
    if (!state) {
      return [];
    }

    const character = state.characters.get(characterName);
    if (!character) {
      return [];
    }

    return character.visualAnalysis.appearanceHistory;
  }

  // Helper methods for visual analysis integration
  private findCharacterByIdOrName(state: ProjectSharedState, characterId: string): CharacterState | undefined {
    // First try to find by ID
    const characterList = Array.from(state.characters.values());
    for (const character of characterList) {
      if (character.id === characterId) {
        return character;
      }
    }
    
    // Fallback to finding by name
    return state.characters.get(characterId);
  }

  private updateConsistentFeatures(character: CharacterState, panelState: PanelCharacterState): void {
    const features = character.visualAnalysis.consistentFeatures;
    
    // Update hair features if detected
    if (panelState.detectedHairColor) features.hair.color = panelState.detectedHairColor;
    if (panelState.detectedHairStyle) features.hair.style = panelState.detectedHairStyle;
    if (panelState.detectedHairLength) features.hair.length = panelState.detectedHairLength;
    if (panelState.detectedHairTexture) features.hair.texture = panelState.detectedHairTexture;
    
    // Update clothing features
    if (panelState.detectedUpperBody) features.clothing.upperBody = panelState.detectedUpperBody;
    if (panelState.detectedLowerBody) features.clothing.lowerBody = panelState.detectedLowerBody;
    if (panelState.detectedOuterwear) features.clothing.outerwear = panelState.detectedOuterwear;
    if (panelState.detectedClothingColors) features.clothing.colors = panelState.detectedClothingColors;
    
    // Update physical features
    if (panelState.detectedSkinTone) features.physical.skinTone = panelState.detectedSkinTone;
    if (panelState.detectedEyeColor) features.physical.eyeColor = panelState.detectedEyeColor;
    
    // Update accessories
    if (panelState.detectedJewelry) features.accessories.jewelry = panelState.detectedJewelry;
    if (panelState.detectedGlasses !== null) features.accessories.glasses = panelState.detectedGlasses;
    if (panelState.detectedHat) features.accessories.hat = panelState.detectedHat;
  }

  private addToAppearanceHistory(character: CharacterState, panelId: string, panelState: PanelCharacterState): void {
    const history = character.visualAnalysis.appearanceHistory;
    const confidence = panelState.confidenceScore || 0;
    
    // Determine what changed compared to previous appearance
    const changes: string[] = [];
    if (panelState.detectedUpperBody) changes.push(`clothing: ${panelState.detectedUpperBody}`);
    if (panelState.detectedHairStyle) changes.push(`hair: ${panelState.detectedHairStyle}`);
    if (panelState.detectedPose) changes.push(`pose: ${panelState.detectedPose}`);
    
    history.push({
      panelId,
      timestamp: panelState.visualAnalysisTimestamp || new Date(),
      confidence,
      changes
    });
    
    // Keep only the last 20 entries to avoid memory growth
    if (history.length > 20) {
      history.splice(0, history.length - 20);
    }
  }

  private updateConfidenceTracking(character: CharacterState, panelState: PanelCharacterState): void {
    const analysis = character.visualAnalysis;
    const confidence = panelState.confidenceScore || 0;
    
    // Update rolling average confidence score
    const currentTotal = analysis.averageConfidenceScore * analysis.totalAnalysisCount;
    analysis.totalAnalysisCount++;
    analysis.averageConfidenceScore = (currentTotal + confidence) / analysis.totalAnalysisCount;
  }

  private updateCurrentAppearanceFromAnalysis(character: CharacterState, panelState: PanelCharacterState): void {
    const appearance = character.currentAppearance;
    
    // Update clothing
    if (panelState.detectedUpperBody && panelState.detectedLowerBody) {
      appearance.clothing = `${panelState.detectedUpperBody}, ${panelState.detectedLowerBody}`;
      if (panelState.detectedOuterwear) {
        appearance.clothing += `, ${panelState.detectedOuterwear}`;
      }
    }
    
    // Update accessories
    const accessories: string[] = [];
    if (panelState.detectedJewelry) accessories.push(...panelState.detectedJewelry);
    if (panelState.detectedGlasses) accessories.push('glasses');
    if (panelState.detectedHat) accessories.push(panelState.detectedHat);
    appearance.accessories = accessories;
    
    // Update mood based on facial expression
    if (panelState.facialExpression) {
      appearance.mood = panelState.facialExpression;
    }
    
    // Update location based on screen position
    if (panelState.detectedScreenPosition) {
      appearance.location = panelState.detectedScreenPosition;
    }
  }

  cleanupProject(projectId: string): void {
    // Clear locks
    const projectLocks = this.locks.get(projectId);
    if (projectLocks) {
      for (const characterName of Array.from(projectLocks)) {
        this.unlockCharacter(projectId, characterName);
      }
      this.locks.delete(projectId);
    }

    // Clear project state
    this.projectStates.delete(projectId);
    
    this.emit('projectCleaned', projectId);
  }

  // Utility methods
  private parseTraits(traitsString: string): string[] {
    return traitsString
      .split(',')
      .map(trait => trait.trim())
      .filter(trait => trait.length > 0);
  }

  private parseColorPalette(paletteString: string): string[] {
    return paletteString
      .split(',')
      .map(color => color.trim())
      .filter(color => color.length > 0);
  }

  // SECURITY FIX: Removed extractProjectIdFromTaskId method
  // ProjectId should always be provided explicitly from authenticated sources, 
  // never derived from parsing taskId or other untrusted data

  private extractPromptFromResult(result: GenerateImageResponse): string {
    // You'd need to store the original prompt in the result or pass it separately
    return ''; // Placeholder
  }

  private extractCharacterMentions(prompt: string, state: ProjectSharedState): string[] {
    const characterNames = Array.from(state.characters.keys());
    return characterNames.filter(name => 
      prompt.toLowerCase().includes(name.toLowerCase())
    );
  }

  getStats(): {
    totalProjects: number;
    totalCharacters: number;
    activeLocks: number;
  } {
    const totalCharacters = Array.from(this.projectStates.values())
      .reduce((sum, state) => sum + state.characters.size, 0);
    
    const activeLocks = Array.from(this.locks.values())
      .reduce((sum, locks) => sum + locks.size, 0);

    return {
      totalProjects: this.projectStates.size,
      totalCharacters,
      activeLocks
    };
  }
}