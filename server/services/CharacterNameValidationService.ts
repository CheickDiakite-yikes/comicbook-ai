/**
 * Character Name Validation Service
 * 
 * Validates that character names are consistent across all generated content
 * Prevents the critical bug where AI uses nicknames instead of canonical names
 */

export interface CharacterNameValidationError {
  type: 'name_mismatch' | 'nickname_usage' | 'inconsistent_reference';
  characterName: string;
  field: string;
  description: string;
  suggestedFix: string;
}

export interface NicknameMapping {
  nickname: string;
  canonicalName: string;
  confidence: number; // 0-1 score indicating confidence in the mapping
  context: string; // The context where this nickname was found
  mappingSource: 'phonetic' | 'fuzzy' | 'contextual' | 'manual';
}

export interface CharacterNameValidationResult {
  isValid: boolean;
  errors: CharacterNameValidationError[];
  warnings: string[];
  correctedCharacterBible?: any; // The corrected version with fixes applied
  correctionsMade: Array<{
    field: string;
    from: string;
    to: string;
    characterName: string;
  }>;
  nicknameMappings?: NicknameMapping[]; // Detected nickname mappings
  mappingStats?: {
    totalNicknamesDetected: number;
    highConfidenceMappings: number;
    textReplacements: number;
  };
}

export class CharacterNameValidationService {
  private nicknameMappings: Map<string, NicknameMapping> = new Map();
  private contextualHints: string[] = [
    'character', 'protagonist', 'hero', 'villain', 'person', 'individual',
    'friend', 'enemy', 'ally', 'companion', 'leader', 'warrior', 'mage',
    'does', 'says', 'thinks', 'feels', 'walks', 'runs', 'speaks', 'looks',
    'his', 'her', 'their', 'him', 'them', 'she', 'he', 'they'
  ];
  
  /**
   * Validate character bible for name consistency and automatically fix issues
   * Enhanced with dynamic nickname mapping
   */
  validateCharacterBible(characterBible: any, originalCharacterNames: string[]): CharacterNameValidationResult {
    const errors: CharacterNameValidationError[] = [];
    const warnings: string[] = [];
    const correctionsMade: Array<{field: string; from: string; to: string; characterName: string}> = [];
    
    console.log('🔍 VALIDATION: Starting character name validation...');
    console.log('🔍 VALIDATION: Original character names:', originalCharacterNames);
    
    if (!characterBible?.characters) {
      errors.push({
        type: 'inconsistent_reference',
        characterName: 'unknown',
        field: 'characters',
        description: 'Character bible missing characters array',
        suggestedFix: 'Regenerate character bible with proper structure'
      });
      return { isValid: false, errors, warnings, correctionsMade };
    }
    
    // Create deep copy for corrections
    const correctedBible = JSON.parse(JSON.stringify(characterBible));
    
    // PHASE 1: Pre-analysis - Build dynamic nickname mappings
    console.log('🔍 VALIDATION: Phase 1 - Building dynamic nickname mappings...');
    this.buildDynamicNicknameMappings(correctedBible, originalCharacterNames);
    
    // Check each character in the bible
    for (let charIndex = 0; charIndex < correctedBible.characters.length; charIndex++) {
      const character = correctedBible.characters[charIndex];
      const charName = character.name;
      console.log(`🔍 VALIDATION: Checking character "${charName}"`);
      
      // Validate and correct text fields
      const fieldsToCheck = [
        { path: 'bio', value: character.bio },
        { path: 'personality.speechPattern', value: character.personality?.speechPattern },
        { path: 'personality.voiceDescription', value: character.personality?.voiceDescription },
        { path: 'defaultClothingState.styleDescription', value: character.defaultClothingState?.styleDescription },
        { path: 'defaultClothingState.fittingNotes', value: character.defaultClothingState?.fittingNotes }
      ];
      
      for (const field of fieldsToCheck) {
        if (field.value && typeof field.value === 'string') {
          const result = this.validateAndCorrectText(field.value, charName, originalCharacterNames, field.path);
          
          if (result.correctedText !== field.value) {
            // Apply correction to the copied bible
            this.setNestedProperty(character, field.path, result.correctedText);
            
            // Track correction
            correctionsMade.push({
              field: `characters[${charIndex}].${field.path}`,
              from: field.value,
              to: result.correctedText,
              characterName: charName
            });
            
            console.log(`🔧 CORRECTION: Fixed ${field.path} for ${charName}`);
            console.log(`   Before: "${field.value.substring(0, 100)}..."`);
            console.log(`   After: "${result.correctedText.substring(0, 100)}..."`);
          }
          
          errors.push(...result.errors);
        }
      }
      
      // Validate and correct array fields
      this.validateAndCorrectArrayFields(character, charName, originalCharacterNames, charIndex, correctionsMade, errors);
    }
    
    // Validate and correct character relationships
    if (correctedBible.characterRelationships && Array.isArray(correctedBible.characterRelationships)) {
      for (let i = 0; i < correctedBible.characterRelationships.length; i++) {
        const relationship = correctedBible.characterRelationships[i];
        
        if (relationship.dynamicDescription) {
          const result = this.validateAndCorrectText(
            relationship.dynamicDescription, 
            '', 
            originalCharacterNames, 
            `characterRelationships[${i}].dynamicDescription`
          );
          
          if (result.correctedText !== relationship.dynamicDescription) {
            correctedBible.characterRelationships[i].dynamicDescription = result.correctedText;
            correctionsMade.push({
              field: `characterRelationships[${i}].dynamicDescription`,
              from: relationship.dynamicDescription,
              to: result.correctedText,
              characterName: 'relationships'
            });
          }
          
          errors.push(...result.errors);
        }
        
        // Validate character1 and character2 names
        if (relationship.character1 && !originalCharacterNames.includes(relationship.character1)) {
          // Try to find a matching name
          const correctedName = this.findBestCharacterNameMatch(relationship.character1, originalCharacterNames);
          if (correctedName) {
            correctedBible.characterRelationships[i].character1 = correctedName;
            correctionsMade.push({
              field: `characterRelationships[${i}].character1`,
              from: relationship.character1,
              to: correctedName,
              characterName: 'relationships'
            });
            console.log(`🔧 CORRECTION: Fixed character1 "${relationship.character1}" -> "${correctedName}"`);
          } else {
            errors.push({
              type: 'name_mismatch',
              characterName: relationship.character1,
              field: `characterRelationships[${i}].character1`,
              description: `Relationship references unknown character "${relationship.character1}"`,
              suggestedFix: `Use one of the canonical character names: ${originalCharacterNames.join(', ')}`
            });
          }
        }
        
        if (relationship.character2 && !originalCharacterNames.includes(relationship.character2)) {
          const correctedName = this.findBestCharacterNameMatch(relationship.character2, originalCharacterNames);
          if (correctedName) {
            correctedBible.characterRelationships[i].character2 = correctedName;
            correctionsMade.push({
              field: `characterRelationships[${i}].character2`,
              from: relationship.character2,
              to: correctedName,
              characterName: 'relationships'
            });
            console.log(`🔧 CORRECTION: Fixed character2 "${relationship.character2}" -> "${correctedName}"`);
          } else {
            errors.push({
              type: 'name_mismatch',
              characterName: relationship.character2,
              field: `characterRelationships[${i}].character2`,
              description: `Relationship references unknown character "${relationship.character2}"`,
              suggestedFix: `Use one of the canonical character names: ${originalCharacterNames.join(', ')}`
            });
          }
        }
      }
    }
    
    const isValid = errors.length === 0;
    
    // Generate nickname mapping statistics
    const mappingStats = {
      totalNicknamesDetected: this.nicknameMappings.size,
      highConfidenceMappings: Array.from(this.nicknameMappings.values()).filter(m => m.confidence >= 0.7).length,
      textReplacements: correctionsMade.filter(c => c.characterName !== 'relationships').length
    };
    
    console.log(`🔍 VALIDATION: Complete. Valid: ${isValid}, Errors: ${errors.length}, Corrections: ${correctionsMade.length}`);
    console.log(`🔍 NICKNAME MAPPINGS: Detected ${mappingStats.totalNicknamesDetected} nicknames, ${mappingStats.highConfidenceMappings} high confidence`);
    if (correctionsMade.length > 0) {
      console.log('🔧 CORRECTIONS MADE:', correctionsMade.length);
      correctionsMade.forEach(correction => {
        console.log(`   ${correction.field}: "${correction.from}" -> "${correction.to}"`);
      });
    }
    if (errors.length > 0) {
      console.log('🔍 REMAINING ERRORS:', errors);
    }
    
    return { 
      isValid, 
      errors, 
      warnings, 
      correctedCharacterBible: correctedBible,
      correctionsMade,
      nicknameMappings: Array.from(this.nicknameMappings.values()),
      mappingStats
    };
  }

  /**
   * BUILD DYNAMIC NICKNAME MAPPINGS
   * Phase 1: Analyze all text in character bible to identify potential nicknames
   */
  private buildDynamicNicknameMappings(characterBible: any, canonicalNames: string[]): void {
    console.log('🔍 NICKNAME MAPPING: Starting dynamic analysis...');
    
    // Clear previous mappings
    this.nicknameMappings.clear();
    
    // Extract all text content from the character bible
    const allTextContent = this.extractAllTextContent(characterBible);
    console.log(`🔍 NICKNAME MAPPING: Extracted ${allTextContent.length} text segments`);
    
    // Find all proper nouns that might be character references
    const potentialNicknames = this.extractPotentialCharacterReferences(allTextContent, canonicalNames);
    console.log(`🔍 NICKNAME MAPPING: Found ${potentialNicknames.length} potential nicknames`);
    
    // Build mappings using multiple strategies
    for (const nickname of potentialNicknames) {
      const mapping = this.createNicknameMappingForCandidate(nickname, canonicalNames, allTextContent);
      if (mapping && mapping.confidence >= 0.5) {
        this.nicknameMappings.set(nickname.name.toLowerCase(), mapping);
        console.log(`🎯 MAPPED: "${nickname.name}" -> "${mapping.canonicalName}" (confidence: ${mapping.confidence.toFixed(2)})`);
      }
    }
    
    console.log(`🔍 NICKNAME MAPPING: Built ${this.nicknameMappings.size} nickname mappings`);
  }

  /**
   * Extract all text content from character bible for analysis
   */
  private extractAllTextContent(characterBible: any): Array<{text: string; source: string; characterContext?: string}> {
    const textSegments: Array<{text: string; source: string; characterContext?: string}> = [];
    
    if (!characterBible?.characters) return textSegments;
    
    for (const character of characterBible.characters) {
      const characterName = character.name;
      
      // Extract text from various character fields
      const fields = [
        { path: 'bio', value: character.bio },
        { path: 'personality.speechPattern', value: character.personality?.speechPattern },
        { path: 'personality.voiceDescription', value: character.personality?.voiceDescription },
        { path: 'defaultClothingState.styleDescription', value: character.defaultClothingState?.styleDescription },
        { path: 'defaultClothingState.fittingNotes', value: character.defaultClothingState?.fittingNotes }
      ];
      
      for (const field of fields) {
        if (field.value && typeof field.value === 'string' && field.value.length > 10) {
          textSegments.push({
            text: field.value,
            source: `character_${characterName}_${field.path}`,
            characterContext: characterName
          });
        }
      }
      
      // Extract from array fields
      const arrayFields = [
        character.personality?.commonPhrases || [],
        character.personality?.coreTraits || [],
        character.personality?.motivations || [],
        character.personality?.fears || [],
        character.personality?.quirks || [],
        character.consistencyRules?.alwaysTraits || [],
        character.consistencyRules?.neverTraits || [],
        character.consistencyRules?.warningNotes || []
      ];
      
      for (const array of arrayFields) {
        if (Array.isArray(array)) {
          for (const item of array) {
            if (typeof item === 'string' && item.length > 5) {
              textSegments.push({
                text: item,
                source: `character_${characterName}_array_field`,
                characterContext: characterName
              });
            }
          }
        }
      }
    }
    
    // Extract from character relationships
    if (characterBible.characterRelationships && Array.isArray(characterBible.characterRelationships)) {
      for (const relationship of characterBible.characterRelationships) {
        if (relationship.dynamicDescription && relationship.dynamicDescription.length > 10) {
          textSegments.push({
            text: relationship.dynamicDescription,
            source: 'character_relationships',
            characterContext: `${relationship.character1}_${relationship.character2}`
          });
        }
      }
    }
    
    return textSegments;
  }

  /**
   * Extract potential character references (proper nouns) from text content
   */
  private extractPotentialCharacterReferences(
    textSegments: Array<{text: string; source: string; characterContext?: string}>,
    canonicalNames: string[]
  ): Array<{name: string; contexts: Array<{text: string; source: string; characterContext?: string}>}> {
    const potentialNicknames = new Map<string, Array<{text: string; source: string; characterContext?: string}>>();
    
    for (const segment of textSegments) {
      // Extract proper nouns (capitalized words)
      const properNouns = segment.text.match(/\b[A-Z][a-z]{2,12}\b/g) || [];
      
      for (const noun of properNouns) {
        // Skip if it's already a canonical name or part of one
        if (this.isCanonicalName(noun, canonicalNames)) {
          continue;
        }
        
        // Skip common words
        if (this.isCommonWord(noun)) {
          continue;
        }
        
        // Check if this appears in character-like context
        if (this.appearsInCharacterContext(noun, segment.text)) {
          if (!potentialNicknames.has(noun.toLowerCase())) {
            potentialNicknames.set(noun.toLowerCase(), []);
          }
          potentialNicknames.get(noun.toLowerCase())!.push(segment);
        }
      }
    }
    
    // Convert to array format and filter by frequency
    return Array.from(potentialNicknames.entries())
      .filter(([name, contexts]) => contexts.length >= 1) // Must appear at least once in character context
      .map(([name, contexts]) => ({ name, contexts }))
      .sort((a, b) => b.contexts.length - a.contexts.length); // Sort by frequency
  }

  /**
   * Create a nickname mapping for a candidate using multiple strategies
   */
  private createNicknameMappingForCandidate(
    nickname: {name: string; contexts: Array<{text: string; source: string; characterContext?: string}>},
    canonicalNames: string[],
    allTextContent: Array<{text: string; source: string; characterContext?: string}>
  ): NicknameMapping | null {
    let bestMapping: NicknameMapping | null = null;
    let bestScore = 0;
    
    for (const canonicalName of canonicalNames) {
      // Strategy 1: Phonetic matching
      const phoneticScore = this.calculatePhoneticSimilarity(nickname.name, canonicalName);
      if (phoneticScore > 0.3) {
        const mapping: NicknameMapping = {
          nickname: nickname.name,
          canonicalName,
          confidence: phoneticScore * 0.8, // Slightly discount phonetic matches
          context: nickname.contexts[0].text.substring(0, 100),
          mappingSource: 'phonetic'
        };
        if (mapping.confidence > bestScore) {
          bestMapping = mapping;
          bestScore = mapping.confidence;
        }
      }
      
      // Strategy 2: Fuzzy matching (enhanced Levenshtein)
      const fuzzyScore = this.calculateEnhancedFuzzySimilarity(nickname.name, canonicalName);
      if (fuzzyScore > 0.4) {
        const mapping: NicknameMapping = {
          nickname: nickname.name,
          canonicalName,
          confidence: fuzzyScore * 0.9,
          context: nickname.contexts[0].text.substring(0, 100),
          mappingSource: 'fuzzy'
        };
        if (mapping.confidence > bestScore) {
          bestMapping = mapping;
          bestScore = mapping.confidence;
        }
      }
      
      // Strategy 3: Contextual analysis - check if they appear in similar contexts
      const contextualScore = this.calculateContextualSimilarity(nickname, canonicalName, allTextContent);
      if (contextualScore > 0.5) {
        const mapping: NicknameMapping = {
          nickname: nickname.name,
          canonicalName,
          confidence: contextualScore,
          context: nickname.contexts[0].text.substring(0, 100),
          mappingSource: 'contextual'
        };
        if (mapping.confidence > bestScore) {
          bestMapping = mapping;
          bestScore = mapping.confidence;
        }
      }
    }
    
    return bestMapping;
  }
  
  /**
   * ENHANCED text validation using dynamic nickname mappings
   */
  private validateAndCorrectText(
    text: string,
    currentCharacterName: string,
    allCharacterNames: string[],
    fieldName: string
  ): { correctedText: string; errors: CharacterNameValidationError[] } {
    const errors: CharacterNameValidationError[] = [];
    let correctedText = text;
    
    console.log(`🔍 Checking text field: ${fieldName} for character: ${currentCharacterName}`);
    
    // PHASE 1: Apply nickname mappings first (most important)
    for (const [nickname, mapping] of this.nicknameMappings.entries()) {
      const nicknamePattern = new RegExp(`\\b${mapping.nickname}\\b`, 'g');
      if (correctedText.match(nicknamePattern)) {
        const beforeText = correctedText;
        correctedText = correctedText.replace(nicknamePattern, mapping.canonicalName);
        console.log(`🎯 NICKNAME REPLACEMENT: "${mapping.nickname}" -> "${mapping.canonicalName}" (confidence: ${mapping.confidence.toFixed(2)})`);
        console.log(`   Context: "${beforeText.substring(beforeText.indexOf(mapping.nickname) - 20, beforeText.indexOf(mapping.nickname) + 50)}"`);
      }
    }
    
    // PHASE 2: Traditional corrections for canonical names
    for (const canonicalName of allCharacterNames) {
      if (!canonicalName || !canonicalName.includes(' ')) continue; // Skip single word names
      
      const firstName = canonicalName.split(' ')[0];
      const lastName = canonicalName.split(' ').slice(1).join(' ');
      
      // Pattern 1: Replace first name only with full name when it's clearly referring to the character
      const firstNamePattern = new RegExp(`\\b${firstName}\\b(?!\\s+${lastName.split(' ')[0]})`, 'g');
      if (correctedText.match(firstNamePattern)) {
        const matches = correctedText.match(firstNamePattern) || [];
        // Only replace if the context suggests it's referring to this character
        // Check if the full name appears less frequently than first name
        const fullNameMatches = (correctedText.match(new RegExp(`\\b${canonicalName}\\b`, 'g')) || []).length;
        if (matches.length > fullNameMatches) {
          correctedText = correctedText.replace(firstNamePattern, canonicalName);
          console.log(`🔧 CORRECTION: Replaced "${firstName}" with "${canonicalName}" in ${fieldName}`);
        }
      }
    }
    
    // PHASE 3: Check for remaining problematic patterns
    const problematicPatterns = this.detectProblematicPatterns(correctedText, currentCharacterName, allCharacterNames);
    errors.push(...problematicPatterns);
    
    return { correctedText, errors };
  }

  /**
   * Check if a word is already a canonical character name or part of one
   */
  private isCanonicalName(word: string, canonicalNames: string[]): boolean {
    for (const canonicalName of canonicalNames) {
      if (canonicalName.toLowerCase().includes(word.toLowerCase())) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if a word appears in character-like context
   */
  private appearsInCharacterContext(word: string, text: string): boolean {
    const wordIndex = text.toLowerCase().indexOf(word.toLowerCase());
    if (wordIndex === -1) return false;
    
    // Get context around the word (50 chars before and after)
    const contextStart = Math.max(0, wordIndex - 50);
    const contextEnd = Math.min(text.length, wordIndex + word.length + 50);
    const context = text.substring(contextStart, contextEnd).toLowerCase();
    
    // Check for character-indicating patterns
    const characterPatterns = [
      // Action patterns
      word.toLowerCase() + ' walks',
      word.toLowerCase() + ' says',
      word.toLowerCase() + ' thinks',
      word.toLowerCase() + ' looks',
      word.toLowerCase() + ' runs',
      word.toLowerCase() + ' speaks',
      word.toLowerCase() + ' feels',
      word.toLowerCase() + ' does',
      word.toLowerCase() + ' goes',
      word.toLowerCase() + ' comes',
      word.toLowerCase() + ' moves',
      word.toLowerCase() + ' stands',
      
      // Pronoun references
      word.toLowerCase() + ' is',
      word.toLowerCase() + ' was',
      word.toLowerCase() + ' has',
      word.toLowerCase() + ' had',
      word.toLowerCase() + ' will',
      
      // Possessive patterns
      word.toLowerCase() + "'s",
      word.toLowerCase() + ' his',
      word.toLowerCase() + ' her',
      word.toLowerCase() + ' their'
    ];
    
    for (const pattern of characterPatterns) {
      if (context.includes(pattern)) {
        return true;
      }
    }
    
    // Check for contextual hints nearby
    const characterHints = this.contextualHints;
    for (const hint of characterHints) {
      if (context.includes(hint.toLowerCase())) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Calculate phonetic similarity using Soundex-like algorithm
   */
  private calculatePhoneticSimilarity(name1: string, name2: string): number {
    const soundex1 = this.generateSoundex(name1);
    const soundex2 = this.generateSoundex(name2);
    
    if (soundex1 === soundex2) {
      return 0.9; // High confidence for exact phonetic match
    }
    
    // Check if the first parts of the names sound similar
    const firstName1 = name1.split(' ')[0];
    const firstName2 = name2.split(' ')[0];
    const firstSoundex1 = this.generateSoundex(firstName1);
    const firstSoundex2 = this.generateSoundex(firstName2);
    
    if (firstSoundex1 === firstSoundex2) {
      return 0.7; // Good confidence for first name phonetic match
    }
    
    // Check for partial phonetic similarity
    const similarity = this.calculateSimilarity(soundex1, soundex2);
    return similarity > 0.6 ? similarity * 0.6 : 0; // Discount phonetic partial matches
  }

  /**
   * Generate a simple Soundex-like code for phonetic matching
   */
  private generateSoundex(name: string): string {
    if (!name || name.length === 0) return '';
    
    const cleaned = name.toLowerCase().replace(/[^a-z]/g, '');
    if (cleaned.length === 0) return '';
    
    // Keep first letter
    let soundex = cleaned[0].toUpperCase();
    
    // Replace letters with numbers based on sound groups
    const replacements: { [key: string]: string } = {
      'b': '1', 'f': '1', 'p': '1', 'v': '1',
      'c': '2', 'g': '2', 'j': '2', 'k': '2', 'q': '2', 's': '2', 'x': '2', 'z': '2',
      'd': '3', 't': '3',
      'l': '4',
      'm': '5', 'n': '5',
      'r': '6'
    };
    
    let code = '';
    for (let i = 1; i < cleaned.length; i++) {
      const char = cleaned[i];
      if (replacements[char]) {
        if (code[code.length - 1] !== replacements[char]) {
          code += replacements[char];
        }
      }
    }
    
    // Pad or truncate to 4 characters
    soundex += code.padEnd(3, '0').substring(0, 3);
    
    return soundex;
  }

  /**
   * Enhanced fuzzy similarity that considers name structure
   */
  private calculateEnhancedFuzzySimilarity(nickname: string, canonicalName: string): number {
    // Check if nickname is a substring of any part of canonical name
    const canonicalParts = canonicalName.toLowerCase().split(' ');
    const nicknameLower = nickname.toLowerCase();
    
    for (const part of canonicalParts) {
      if (part.includes(nicknameLower) || nicknameLower.includes(part)) {
        return 0.8; // High confidence for substring match
      }
    }
    
    // Check edit distance similarity
    const similarity = this.calculateSimilarity(nickname, canonicalName);
    if (similarity > 0.6) {
      return similarity;
    }
    
    // Check first name similarity specifically
    const firstCanonical = canonicalParts[0];
    const firstSimilarity = this.calculateSimilarity(nickname, firstCanonical);
    if (firstSimilarity > 0.5) {
      return firstSimilarity * 0.9; // Slightly discount partial name matches
    }
    
    return 0;
  }

  /**
   * Calculate contextual similarity based on how the names are used
   */
  private calculateContextualSimilarity(
    nickname: {name: string; contexts: Array<{text: string; source: string; characterContext?: string}>},
    canonicalName: string,
    allTextContent: Array<{text: string; source: string; characterContext?: string}>
  ): number {
    // Find contexts where the canonical name appears
    const canonicalContexts = allTextContent.filter(segment => 
      segment.text.toLowerCase().includes(canonicalName.toLowerCase()) ||
      segment.characterContext === canonicalName
    );
    
    if (canonicalContexts.length === 0) {
      return 0; // Can't compare if canonical name doesn't appear anywhere
    }
    
    // Calculate similarity of contexts
    let totalSimilarity = 0;
    let comparisons = 0;
    
    for (const nicknameContext of nickname.contexts) {
      for (const canonicalContext of canonicalContexts) {
        // Compare the text contexts using word overlap
        const nicknameWords = new Set(nicknameContext.text.toLowerCase().split(/\s+/));
        const canonicalWords = new Set(canonicalContext.text.toLowerCase().split(/\s+/));
        
        const intersection = new Set([...nicknameWords].filter(word => canonicalWords.has(word)));
        const union = new Set([...nicknameWords, ...canonicalWords]);
        
        const contextSimilarity = intersection.size / union.size;
        totalSimilarity += contextSimilarity;
        comparisons++;
        
        // Bonus if they appear in similar source types
        if (nicknameContext.source.includes('character_') && canonicalContext.source.includes('character_')) {
          totalSimilarity += 0.1;
        }
      }
    }
    
    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }
  
  /**
   * Detect problematic patterns that require manual intervention
   */
  private detectProblematicPatterns(
    text: string, 
    currentCharacterName: string, 
    allCharacterNames: string[]
  ): CharacterNameValidationError[] {
    const errors: CharacterNameValidationError[] = [];
    
    // Look for character names that don't match any canonical names
    const wordsInText = text.match(/\b[A-Z][a-z]+\b/g) || [];
    const potentialCharacterNames = wordsInText.filter(word => 
      word.length >= 3 && 
      word.length <= 15 &&
      !allCharacterNames.some(name => name.includes(word)) &&
      !this.isCommonWord(word)
    );
    
    for (const suspiciousName of potentialCharacterNames) {
      // Check if it appears multiple times (suggesting it's a character reference)
      const occurrences = (text.match(new RegExp(`\\b${suspiciousName}\\b`, 'g')) || []).length;
      if (occurrences > 1) {
        errors.push({
          type: 'name_mismatch',
          characterName: suspiciousName,
          field: 'text_analysis',
          description: `Suspicious character name "${suspiciousName}" appears ${occurrences} times but doesn't match canonical names`,
          suggestedFix: `Verify if "${suspiciousName}" should be one of: ${allCharacterNames.join(', ')}`
        });
      }
    }
    
    return errors;
  }
  
  /**
   * Check if a word is a common English word (not a character name)
   */
  private isCommonWord(word: string): boolean {
    const commonWords = [
      'The', 'And', 'But', 'For', 'Not', 'Yet', 'So', 'Or', 'As', 'If', 'When', 'Where', 'How', 'Why', 'What', 'Who',
      'This', 'That', 'These', 'Those', 'Here', 'There', 'Now', 'Then', 'Today', 'Tomorrow', 'Yesterday',
      'Good', 'Bad', 'Big', 'Small', 'New', 'Old', 'Young', 'Fast', 'Slow', 'High', 'Low', 'Long', 'Short',
      'House', 'Home', 'School', 'Work', 'City', 'Town', 'Street', 'Road', 'Park', 'Store', 'Shop',
      'Love', 'Hate', 'Like', 'Want', 'Need', 'Know', 'Think', 'Feel', 'Look', 'See', 'Hear', 'Say', 'Tell',
      'Time', 'Day', 'Night', 'Week', 'Month', 'Year', 'Hour', 'Minute', 'Second',
      'People', 'Person', 'Man', 'Woman', 'Child', 'Boy', 'Girl', 'Family', 'Friend', 'Enemy'
    ];
    return commonWords.includes(word);
  }
  
  /**
   * Utility to set nested property on object
   */
  private setNestedProperty(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
  }
  
  /**
   * Validate and correct array fields that might contain character names
   */
  private validateAndCorrectArrayFields(
    character: any, 
    currentCharacterName: string, 
    allCharacterNames: string[], 
    charIndex: number,
    correctionsMade: Array<{field: string; from: string; to: string; characterName: string}>,
    errors: CharacterNameValidationError[]
  ): void {
    const arrayFields = [
      { path: 'personality.commonPhrases', data: character.personality?.commonPhrases },
      { path: 'personality.coreTraits', data: character.personality?.coreTraits },
      { path: 'personality.motivations', data: character.personality?.motivations },
      { path: 'personality.fears', data: character.personality?.fears },
      { path: 'personality.quirks', data: character.personality?.quirks },
      { path: 'consistencyRules.alwaysTraits', data: character.consistencyRules?.alwaysTraits },
      { path: 'consistencyRules.neverTraits', data: character.consistencyRules?.neverTraits },
      { path: 'consistencyRules.warningNotes', data: character.consistencyRules?.warningNotes }
    ];
    
    for (const field of arrayFields) {
      if (field.data && Array.isArray(field.data)) {
        for (let i = 0; i < field.data.length; i++) {
          if (typeof field.data[i] === 'string') {
            const result = this.validateAndCorrectText(
              field.data[i],
              currentCharacterName,
              allCharacterNames,
              `${field.path}[${i}]`
            );
            
            if (result.correctedText !== field.data[i]) {
              // Update the array item
              field.data[i] = result.correctedText;
              
              // Track correction
              correctionsMade.push({
                field: `characters[${charIndex}].${field.path}[${i}]`,
                from: field.data[i],
                to: result.correctedText,
                characterName: currentCharacterName
              });
              
              console.log(`🔧 CORRECTION: Fixed array item ${field.path}[${i}] for ${currentCharacterName}`);
            }
            
            errors.push(...result.errors);
          }
        }
      }
    }
  }
  
  /**
   * Find the best character name match for a potentially incorrect name
   */
  private findBestCharacterNameMatch(incorrectName: string, canonicalNames: string[]): string | null {
    if (!incorrectName) return null;
    
    // Direct match
    if (canonicalNames.includes(incorrectName)) {
      return incorrectName;
    }
    
    // Check if it's a first name that matches a canonical character
    for (const canonicalName of canonicalNames) {
      const parts = canonicalName.split(' ');
      const firstName = parts[0];
      const lastName = parts.length > 1 ? parts[parts.length - 1] : '';
      
      // Exact first name match
      if (incorrectName === firstName) {
        return canonicalName;
      }
      
      // Exact last name match
      if (incorrectName === lastName && lastName) {
        return canonicalName;
      }
      
      // Case insensitive match
      if (incorrectName.toLowerCase() === firstName.toLowerCase() || 
          (lastName && incorrectName.toLowerCase() === lastName.toLowerCase())) {
        return canonicalName;
      }
    }
    
    // Fuzzy matching - check for similar names (simple edit distance)
    let bestMatch: string | null = null;
    let bestScore = 0;
    
    for (const canonicalName of canonicalNames) {
      const similarity = this.calculateSimilarity(incorrectName.toLowerCase(), canonicalName.toLowerCase());
      if (similarity > 0.6 && similarity > bestScore) { // 60% similarity threshold
        bestMatch = canonicalName;
        bestScore = similarity;
      }
    }
    
    return bestMatch;
  }
  
  /**
   * Calculate string similarity using a simple algorithm
   */
  private calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }
  
  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    
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

  /**
   * Validate script content for character name consistency
   */
  validateScriptContent(script: any, characterNames: string[]): CharacterNameValidationResult {
    const errors: CharacterNameValidationError[] = [];
    const warnings: string[] = [];
    const correctionsMade: Array<{field: string; from: string; to: string; characterName: string}> = [];
    
    console.log('🔍 SCRIPT VALIDATION: Checking script for character name consistency...');
    
    if (!script?.pages) {
      return { isValid: true, errors, warnings, correctionsMade };
    }
    
    // Create a deep copy for corrections
    const correctedScript = JSON.parse(JSON.stringify(script));
    
    for (let pageIndex = 0; pageIndex < correctedScript.pages.length; pageIndex++) {
      const page = correctedScript.pages[pageIndex];
      if (page.panels) {
        for (let panelIndex = 0; panelIndex < page.panels.length; panelIndex++) {
          const panel = page.panels[panelIndex];
          
          // Check visual descriptions
          if (panel.visualDescription) {
            const result = this.validateAndCorrectText(
              panel.visualDescription,
              '',
              characterNames,
              `page_${page.pageNumber}_panel_${panel.panelNumber}_visualDescription`
            );
            
            if (result.correctedText !== panel.visualDescription) {
              correctedScript.pages[pageIndex].panels[panelIndex].visualDescription = result.correctedText;
              correctionsMade.push({
                field: `pages[${pageIndex}].panels[${panelIndex}].visualDescription`,
                from: panel.visualDescription,
                to: result.correctedText,
                characterName: 'script'
              });
            }
            
            errors.push(...result.errors);
          }
          
          // Check dialogue
          if (panel.dialogue) {
            for (let dialogueIndex = 0; dialogueIndex < panel.dialogue.length; dialogueIndex++) {
              const dialogue = panel.dialogue[dialogueIndex];
              if (dialogue.character && !characterNames.includes(dialogue.character)) {
                // Try to find a matching character name
                const correctedName = this.findBestCharacterNameMatch(dialogue.character, characterNames);
                if (correctedName) {
                  correctedScript.pages[pageIndex].panels[panelIndex].dialogue[dialogueIndex].character = correctedName;
                  correctionsMade.push({
                    field: `pages[${pageIndex}].panels[${panelIndex}].dialogue[${dialogueIndex}].character`,
                    from: dialogue.character,
                    to: correctedName,
                    characterName: 'script'
                  });
                  console.log(`🔧 SCRIPT CORRECTION: Fixed character name "${dialogue.character}" -> "${correctedName}"`);
                } else {
                  errors.push({
                    type: 'name_mismatch',
                    characterName: dialogue.character,
                    field: `page_${page.pageNumber}_panel_${panel.panelNumber}_dialogue`,
                    description: `Script references unknown character "${dialogue.character}"`,
                    suggestedFix: `Use one of the canonical character names: ${characterNames.join(', ')}`
                  });
                }
              }
              
              // Also check dialogue text for character name references
              if (dialogue.text) {
                const result = this.validateAndCorrectText(
                  dialogue.text,
                  dialogue.character,
                  characterNames,
                  `page_${page.pageNumber}_panel_${panel.panelNumber}_dialogue_text`
                );
                
                if (result.correctedText !== dialogue.text) {
                  correctedScript.pages[pageIndex].panels[panelIndex].dialogue[dialogueIndex].text = result.correctedText;
                  correctionsMade.push({
                    field: `pages[${pageIndex}].panels[${panelIndex}].dialogue[${dialogueIndex}].text`,
                    from: dialogue.text,
                    to: result.correctedText,
                    characterName: dialogue.character
                  });
                }
                
                errors.push(...result.errors);
              }
            }
          }
        }
      }
    }
    
    const isValid = errors.length === 0;
    console.log(`🔍 SCRIPT VALIDATION: Complete. Valid: ${isValid}, Errors: ${errors.length}, Corrections: ${correctionsMade.length}`);
    
    return { 
      isValid, 
      errors, 
      warnings, 
      correctedCharacterBible: correctedScript, // For scripts, we return the corrected script
      correctionsMade 
    };
  }
  
  /**
   * Generate a character name mapping report for debugging
   */
  generateCharacterMappingReport(
    projectCharacters: any[],
    characterBible?: any,
    scriptContent?: any
  ): string {
    let report = '🔍 CHARACTER NAME MAPPING REPORT\n';
    report += '=' .repeat(50) + '\n\n';
    
    report += 'PROJECT CHARACTERS:\n';
    for (const char of projectCharacters) {
      report += `- Name: "${char.name}" | Role: "${char.role}"\n`;
      report += `  Bio excerpt: "${char.bio?.substring(0, 100) || 'N/A'}..."\n\n`;
    }
    
    if (characterBible?.characters) {
      report += 'CHARACTER BIBLE NAMES:\n';
      for (const char of characterBible.characters) {
        report += `- Name: "${char.name}" | Role: "${char.role || 'N/A'}"\n`;
        report += `  Bio excerpt: "${char.bio?.substring(0, 100) || 'N/A'}..."\n\n`;
      }
    }
    
    return report;
  }
  
}