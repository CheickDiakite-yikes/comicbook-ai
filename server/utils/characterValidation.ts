import { IStorage } from "../storage";

export interface CharacterValidationError {
  type: 'unknown_character' | 'invalid_name' | 'case_mismatch';
  characterName: string;
  normalizedName: string;
  location: string; // Where in the script/dialogue the character appears
  suggestions?: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: CharacterValidationError[];
  validCharacters: string[];
  unknownCharacters: string[];
}

/**
 * Normalize character names for consistent comparison
 * Handles case, whitespace, and common variations
 */
export function normalizeCharacterName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' '); // Normalize whitespace
}

/**
 * Create a character name lookup map for fast validation
 */
export function createCharacterNameMap(characters: Array<{ name: string; id: string }>): Map<string, { original: string; id: string }> {
  const characterMap = new Map<string, { original: string; id: string }>();
  
  for (const character of characters) {
    const normalized = normalizeCharacterName(character.name);
    characterMap.set(normalized, { 
      original: character.name, 
      id: character.id 
    });
  }
  
  return characterMap;
}

/**
 * Find closest character name matches using Levenshtein distance
 */
export function findClosestMatches(unknownName: string, validNames: string[], maxDistance: number = 2): string[] {
  function levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }
  
  const normalizedUnknown = normalizeCharacterName(unknownName);
  const matches = [];
  
  for (const validName of validNames) {
    const normalizedValid = normalizeCharacterName(validName);
    const distance = levenshteinDistance(normalizedUnknown, normalizedValid);
    
    if (distance <= maxDistance) {
      matches.push(validName);
    }
  }
  
  return matches.sort((a, b) => {
    const distA = levenshteinDistance(normalizedUnknown, normalizeCharacterName(a));
    const distB = levenshteinDistance(normalizedUnknown, normalizeCharacterName(b));
    return distA - distB;
  });
}

/**
 * Extract all character names from a structured script
 */
export function extractCharacterNamesFromScript(script: any): string[] {
  const characterNames = new Set<string>();
  
  if (!script || !script.pages || !Array.isArray(script.pages)) {
    return [];
  }
  
  for (const page of script.pages) {
    // Add characters mentioned in page.characters array
    if (page.characters && Array.isArray(page.characters)) {
      page.characters.forEach((char: string) => characterNames.add(char));
    }
    
    // Extract from panels
    if (page.panels && Array.isArray(page.panels)) {
      for (const panel of page.panels) {
        // Extract from dialogue
        if (panel.dialogue && Array.isArray(panel.dialogue)) {
          panel.dialogue.forEach((dialogue: any) => {
            if (dialogue.characterName) {
              characterNames.add(dialogue.characterName);
            }
          });
        }
        
        // Extract from character emotions
        if (panel.characterEmotions && typeof panel.characterEmotions === 'object') {
          Object.keys(panel.characterEmotions).forEach(charName => {
            characterNames.add(charName);
          });
        }
        
        // Extract from character states (for multi-stage scripts)
        if (panel.characterStates && Array.isArray(panel.characterStates)) {
          panel.characterStates.forEach((state: any) => {
            if (state.characterName) {
              characterNames.add(state.characterName);
            }
          });
        }
      }
    }
  }
  
  return Array.from(characterNames);
}

/**
 * Validate all character names in a script against project characters
 */
export async function validateScriptCharacters(
  script: any, 
  projectId: string, 
  storage: IStorage
): Promise<ValidationResult> {
  try {
    // Get project characters
    const projectCharacters = await storage.getProjectCharacters(projectId);
    const characterMap = createCharacterNameMap(projectCharacters);
    const validCharacterNames = projectCharacters.map(c => c.name);
    
    // Extract all character names from script
    const scriptCharacterNames = extractCharacterNamesFromScript(script);
    
    const errors: CharacterValidationError[] = [];
    const validCharacters: string[] = [];
    const unknownCharacters: string[] = [];
    
    for (const characterName of scriptCharacterNames) {
      const normalized = normalizeCharacterName(characterName);
      
      if (characterMap.has(normalized)) {
        validCharacters.push(characterName);
      } else {
        unknownCharacters.push(characterName);
        
        // Find suggestions for unknown characters
        const suggestions = findClosestMatches(characterName, validCharacterNames, 2);
        
        errors.push({
          type: 'unknown_character',
          characterName,
          normalizedName: normalized,
          location: 'script_dialogue',
          suggestions: suggestions.length > 0 ? suggestions : undefined
        });
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      validCharacters,
      unknownCharacters
    };
  } catch (error) {
    console.error('Error validating script characters:', error);
    return {
      isValid: false,
      errors: [{
        type: 'invalid_name',
        characterName: 'validation_error',
        normalizedName: 'validation_error',
        location: 'validation_system',
      }],
      validCharacters: [],
      unknownCharacters: []
    };
  }
}

/**
 * Validate character names before panel generation
 */
/**
 * Extract character names from free text prompts
 */
function extractCharacterNamesFromPrompt(prompt: string, validCharacterNames: string[]): string[] {
  const foundCharacters = new Set<string>();
  
  if (!prompt || typeof prompt !== 'string') {
    return [];
  }
  
  // Create case-insensitive search patterns for each character
  for (const characterName of validCharacterNames) {
    // Create regex patterns to match character names in various contexts
    const patterns = [
      // Exact name match (word boundaries)
      new RegExp(`\\b${characterName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'),
      // Possessive form (name's)
      new RegExp(`\\b${characterName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'s\\b`, 'gi'),
      // With titles (Mr./Ms./Dr. etc.)
      new RegExp(`\\b(?:Mr|Ms|Mrs|Dr|Captain|Professor)\\.?\\s+${characterName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
    ];
    
    // Check if any pattern matches
    const hasMatch = patterns.some(pattern => pattern.test(prompt));
    
    if (hasMatch) {
      foundCharacters.add(characterName);
    }
  }
  
  return Array.from(foundCharacters);
}

export async function validatePanelCharacters(
  panelData: any,
  projectId: string,
  storage: IStorage
): Promise<ValidationResult> {
  try {
    // Get project characters
    const projectCharacters = await storage.getProjectCharacters(projectId);
    const characterMap = createCharacterNameMap(projectCharacters);
    const validCharacterNames = projectCharacters.map(c => c.name);
    
    const characterNames = new Set<string>();
    const errors: CharacterValidationError[] = [];
    
    // 🔍 NEW: Extract character names from free text prompt
    if (panelData.prompt && typeof panelData.prompt === 'string') {
      const promptCharacters = extractCharacterNamesFromPrompt(panelData.prompt, validCharacterNames);
      promptCharacters.forEach(charName => {
        characterNames.add(charName);
        console.log(`🎯 Found character "${charName}" in prompt text`);
      });
    }
    
    // Extract character names from panel dialogue (existing logic)
    if (panelData.dialogue && Array.isArray(panelData.dialogue)) {
      panelData.dialogue.forEach((dialogue: any, index: number) => {
        if (dialogue.characterName) {
          characterNames.add(dialogue.characterName);
          
          const normalized = normalizeCharacterName(dialogue.characterName);
          if (!characterMap.has(normalized)) {
            const suggestions = findClosestMatches(dialogue.characterName, validCharacterNames, 2);
            
            errors.push({
              type: 'unknown_character',
              characterName: dialogue.characterName,
              normalizedName: normalized,
              location: `panel_dialogue[${index}]`,
              suggestions: suggestions.length > 0 ? suggestions : undefined
            });
          }
        }
      });
    }
    
    // Extract from character emotions (existing logic)
    if (panelData.characterEmotions && typeof panelData.characterEmotions === 'object') {
      Object.keys(panelData.characterEmotions).forEach(charName => {
        characterNames.add(charName);
        
        const normalized = normalizeCharacterName(charName);
        if (!characterMap.has(normalized)) {
          const suggestions = findClosestMatches(charName, validCharacterNames, 2);
          
          errors.push({
            type: 'unknown_character',
            characterName: charName,
            normalizedName: normalized,
            location: 'panel_character_emotions',
            suggestions: suggestions.length > 0 ? suggestions : undefined
          });
        }
      });
    }
    
    // 🎯 CRITICAL FIX: Be more permissive - if we have project characters available
    // and no explicit character validation errors, allow the generation to proceed
    // This prevents the "0 valid characters found" issue from blocking generations
    if (characterNames.size === 0 && projectCharacters.length > 0) {
      console.log(`🔄 No explicit characters found in request, but ${projectCharacters.length} project characters available - allowing generation to proceed with all project characters`);
      
      // Add all project characters as "available" for the prompt enhancer
      validCharacterNames.forEach(name => characterNames.add(name));
    }
    
    const validCharacters = Array.from(characterNames).filter(name => 
      characterMap.has(normalizeCharacterName(name))
    );
    
    const unknownCharacters = Array.from(characterNames).filter(name => 
      !characterMap.has(normalizeCharacterName(name))
    );
    
    console.log(`🎯 Panel validation results: ${validCharacters.length} valid, ${unknownCharacters.length} unknown, ${projectCharacters.length} total project characters`);
    
    return {
      isValid: errors.length === 0,
      errors,
      validCharacters,
      unknownCharacters
    };
  } catch (error) {
    console.error('Error validating panel characters:', error);
    return {
      isValid: false,
      errors: [{
        type: 'invalid_name',
        characterName: 'validation_error',
        normalizedName: 'validation_error',
        location: 'validation_system',
      }],
      validCharacters: [],
      unknownCharacters: []
    };
  }
}

/**
 * Create character name enum array for JSON schema
 */
export function createCharacterNameEnum(characters: Array<{ name: string }>): string[] {
  return characters.map(c => c.name).sort();
}

/**
 * Build instruction text for AI about using only defined characters
 */
export function buildCharacterConstraintInstructions(characters: Array<{ name: string }>): string {
  const characterNames = characters.map(c => c.name);
  
  return `CRITICAL CHARACTER CONSTRAINT:
You must ONLY use these specific character names in dialogue and character references:
${characterNames.map(name => `- "${name}"`).join('\n')}

STRICT RULES:
- Do NOT invent new characters
- Do NOT use variations or nicknames unless explicitly provided
- Do NOT create background characters or unnamed speakers
- Every piece of dialogue must be attributed to one of the listed characters
- If a scene needs more characters, use only the provided ones

VALIDATION: Any script containing character names not in this exact list will be rejected and regenerated.`;
}