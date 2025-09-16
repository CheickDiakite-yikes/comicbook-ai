/**
 * Test for Enhanced Nickname Mapping System
 * 
 * Tests the advanced nickname detection and mapping capabilities
 * that can handle arbitrary nicknames like 'Torgue'→'Lakshmi Shah' and 'Pim'→'Basma Salim'
 */

import { CharacterNameValidationService } from '../services/CharacterNameValidationService.js';

describe('Enhanced Nickname Mapping System', () => {
  let validationService;
  
  beforeEach(() => {
    validationService = new CharacterNameValidationService();
  });

  test('should detect and map arbitrary nicknames like Torgue→Lakshmi Shah', () => {
    // Mock character bible with nicknames that don't obviously relate to canonical names
    const mockCharacterBible = {
      characters: [
        {
          id: '1',
          name: 'Lakshmi Shah',
          role: 'protagonist',
          bio: 'Torgue is a brilliant engineer who loves solving complex problems. When Torgue encounters difficulties, she never gives up. Her friends often call her by this nickname because of her explosive personality.',
          personality: {
            speechPattern: 'Torgue speaks with confidence and determination.',
            voiceDescription: 'Clear and authoritative voice that commands respect.',
            commonPhrases: ['Torgue always says "Let\'s build something amazing!"'],
            coreTraits: ['Torgue is incredibly persistent', 'Shows great leadership']
          },
          defaultClothingState: {
            styleDescription: 'Torgue prefers practical engineering clothes',
            fittingNotes: 'Always wears her signature tool belt'
          },
          consistencyRules: {
            alwaysTraits: ['Torgue is always carrying some kind of gadget'],
            neverTraits: ['Torgue never backs down from a challenge'],
            warningNotes: ['Remember that Torgue hates being called by her full name in casual settings']
          }
        },
        {
          id: '2', 
          name: 'Basma Salim',
          role: 'supporting character',
          bio: 'Pim is the team\'s communications expert. When Pim needs to relay important information, she does so with precision. Everyone trusts Pim to get the message across clearly.',
          personality: {
            speechPattern: 'Pim speaks in short, clear sentences.',
            commonPhrases: ['Pim often says "Message received and understood"'],
            coreTraits: ['Pim is extremely reliable', 'Has excellent memory']
          }
        }
      ],
      characterRelationships: [
        {
          character1: 'Lakshmi Shah',
          character2: 'Basma Salim', 
          relationshipType: 'colleagues',
          dynamicDescription: 'Torgue and Pim work together seamlessly. When Torgue has an idea, Pim helps communicate it to the team.'
        }
      ]
    };

    const canonicalNames = ['Lakshmi Shah', 'Basma Salim'];
    const validationResult = validationService.validateCharacterBible(mockCharacterBible, canonicalNames);

    // Verify nickname mappings were detected
    expect(validationResult.nicknameMappings).toBeDefined();
    expect(validationResult.nicknameMappings.length).toBeGreaterThan(0);
    
    // Look for specific nickname mappings
    const torgueMapping = validationResult.nicknameMappings.find(m => m.nickname === 'Torgue');
    const pimMapping = validationResult.nicknameMappings.find(m => m.nickname === 'Pim');
    
    expect(torgueMapping).toBeDefined();
    expect(torgueMapping.canonicalName).toBe('Lakshmi Shah');
    expect(torgueMapping.confidence).toBeGreaterThan(0.5);
    
    expect(pimMapping).toBeDefined(); 
    expect(pimMapping.canonicalName).toBe('Basma Salim');
    expect(pimMapping.confidence).toBeGreaterThan(0.5);

    // Verify text replacements were made
    expect(validationResult.correctionsMade.length).toBeGreaterThan(0);
    
    // Check that the corrected character bible has canonical names
    const correctedBible = validationResult.correctedCharacterBible;
    const lakshmiChar = correctedBible.characters.find(c => c.name === 'Lakshmi Shah');
    const basmaChar = correctedBible.characters.find(c => c.name === 'Basma Salim');
    
    // All instances of 'Torgue' should be replaced with 'Lakshmi Shah'
    expect(lakshmiChar.bio).toContain('Lakshmi Shah');
    expect(lakshmiChar.bio).not.toContain('Torgue');
    expect(lakshmiChar.personality.speechPattern).toContain('Lakshmi Shah');
    
    // All instances of 'Pim' should be replaced with 'Basma Salim' 
    expect(basmaChar.bio).toContain('Basma Salim');
    expect(basmaChar.bio).not.toContain('Pim');
    expect(basmaChar.personality.speechPattern).toContain('Basma Salim');
    
    // Check relationship descriptions
    expect(correctedBible.characterRelationships[0].dynamicDescription).toContain('Lakshmi Shah');
    expect(correctedBible.characterRelationships[0].dynamicDescription).toContain('Basma Salim');
    expect(correctedBible.characterRelationships[0].dynamicDescription).not.toContain('Torgue');
    expect(correctedBible.characterRelationships[0].dynamicDescription).not.toContain('Pim');

    console.log('🎯 NICKNAME MAPPING TEST RESULTS:');
    console.log('Detected mappings:', validationResult.nicknameMappings);
    console.log('Corrections made:', validationResult.correctionsMade.length);
    console.log('Mapping statistics:', validationResult.mappingStats);
  });

  test('should handle context-aware detection to avoid false positives', () => {
    const mockCharacterBible = {
      characters: [
        {
          id: '1',
          name: 'John Smith',
          role: 'protagonist', 
          bio: 'John loves to visit the park in Boston. The city of Boston has great history. When John walks through Boston Common, he feels at peace.',
          personality: {
            commonPhrases: ['John often mentions Boston weather']
          }
        }
      ]
    };

    const canonicalNames = ['John Smith'];
    const validationResult = validationService.validateCharacterBible(mockCharacterBible, canonicalNames);
    
    // 'Boston' should NOT be detected as a character nickname since it's clearly a place name
    const bostonMapping = validationResult.nicknameMappings?.find(m => m.nickname === 'Boston');
    expect(bostonMapping).toBeUndefined();
    
    // Should still detect legitimate character references
    expect(validationResult.correctionsMade.some(c => c.to === 'John Smith')).toBeTruthy();
  });

  test('should use multiple matching strategies (phonetic, fuzzy, contextual)', () => {
    const mockCharacterBible = {
      characters: [
        {
          id: '1',
          name: 'Catherine Williams',
          role: 'protagonist',
          bio: 'Kate is brilliant at solving mysteries. When Kate investigates, she never misses a clue. Everyone calls Kate the best detective in town.',
          personality: {
            commonPhrases: ['Kate always says "The truth will surface"'],
            speechPattern: 'Kate speaks with analytical precision.'
          }
        }
      ]
    };

    const canonicalNames = ['Catherine Williams'];
    const validationResult = validationService.validateCharacterBible(mockCharacterBible, canonicalNames);

    // 'Kate' should be mapped to 'Catherine Williams' (fuzzy matching - Kate is short for Catherine)
    const kateMapping = validationResult.nicknameMappings?.find(m => m.nickname === 'Kate');
    expect(kateMapping).toBeDefined();
    expect(kateMapping.canonicalName).toBe('Catherine Williams');
    expect(['fuzzy', 'contextual', 'phonetic']).toContain(kateMapping.mappingSource);
    
    console.log('🧠 MATCHING STRATEGY TEST:');
    console.log('Kate mapping source:', kateMapping?.mappingSource);
    console.log('Kate mapping confidence:', kateMapping?.confidence);
  });
});