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
}

export class CharacterNameValidationService {
  
  /**
   * Validate character bible for name consistency and automatically fix issues
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
    
    console.log(`🔍 VALIDATION: Complete. Valid: ${isValid}, Errors: ${errors.length}, Corrections: ${correctionsMade.length}`);
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
      correctionsMade 
    };
  }
  
  /**
   * Validate and correct text for character name consistency (NEW IMPLEMENTATION)
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
    
    // For each canonical character name, look for problematic patterns
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
      
      // Pattern 2: Look for potential nicknames or variations
      // This is a generic approach that looks for uncommon names that might be nicknames
      const wordsInText = correctedText.match(/\b[A-Z][a-z]+\b/g) || [];
      for (const word of wordsInText) {
        if (word.length >= 3 && word.length <= 8 && 
            !allCharacterNames.some(name => name.includes(word)) &&
            !['The', 'And', 'But', 'For', 'Not', 'Yet', 'So'].includes(word)) {
          // This might be a nickname - check if it appears in context with character descriptions
          const context = correctedText.toLowerCase();
          const characterKeywords = ['character', 'person', 'individual', 'protagonist', 'hero', 'villain', 'friend'];
          
          if (characterKeywords.some(keyword => context.includes(keyword))) {
            // Likely a character reference - suggest using canonical name instead
            // But we'll only flag this as a warning, not auto-correct
            console.log(`⚠️  Potential nickname "${word}" detected in ${fieldName} - may need manual review`);
          }
        }
      }
    }
    
    // Pattern 3: Check for mismatched character names in relationships/descriptions
    for (const canonicalName of allCharacterNames) {
      if (canonicalName !== currentCharacterName && correctedText.includes(canonicalName)) {
        // This is correct usage - character descriptions can reference other characters
        continue;
      }
    }
    
    // Only return errors for truly uncorrectable issues
    if (correctedText === text) {
      // No corrections were made, check for issues that need manual intervention
      const problematicPatterns = this.detectProblematicPatterns(text, currentCharacterName, allCharacterNames);
      errors.push(...problematicPatterns);
    }
    
    return { correctedText, errors };
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