import EventEmitter from 'events';
import { IStorage } from '../storage';
import { GenerateImageResponse } from '../gemini';

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