/**
 * Quick test for Enhanced Nickname Mapping System
 * Tests the specific examples: 'Torgue'→'Lakshmi Shah' and 'Pim'→'Basma Salim'
 */

import { CharacterNameValidationService } from './services/CharacterNameValidationService.js';

async function testEnhancedNicknameMapping() {
  console.log('🧪 TESTING Enhanced Nickname Mapping System');
  console.log('=' .repeat(60));
  
  const validationService = new CharacterNameValidationService();

  // Test case: Mock character bible with arbitrary nicknames
  const mockCharacterBible = {
    characters: [
      {
        id: '1',
        name: 'Lakshmi Shah',
        role: 'protagonist',
        bio: 'Torgue is a brilliant engineer who loves solving complex problems. When Torgue encounters difficulties, she never gives up. Her friends often call her by this nickname because of her explosive personality. Torgue has worked on many important projects.',
        personality: {
          speechPattern: 'Torgue speaks with confidence and determination.',
          voiceDescription: 'Clear and authoritative voice that commands respect.',
          commonPhrases: ['Torgue always says "Let\'s build something amazing!"', 'When Torgue gets excited, everyone knows it'],
          coreTraits: ['Torgue is incredibly persistent', 'Shows great leadership when Torgue takes charge']
        },
        defaultClothingState: {
          styleDescription: 'Torgue prefers practical engineering clothes that allow for movement',
          fittingNotes: 'Always wears her signature tool belt. Torgue never goes anywhere without it.'
        },
        consistencyRules: {
          alwaysTraits: ['Torgue is always carrying some kind of gadget or tool'],
          neverTraits: ['Torgue never backs down from a challenge or gives up'],
          warningNotes: ['Remember that Torgue hates being called by her full name in casual settings']
        }
      },
      {
        id: '2', 
        name: 'Basma Salim',
        role: 'supporting character',
        bio: 'Pim is the team\'s communications expert and strategic coordinator. When Pim needs to relay important information, she does so with precision and clarity. Everyone trusts Pim to get the message across effectively. Pim has an exceptional memory for details.',
        personality: {
          speechPattern: 'Pim speaks in short, clear sentences that cut to the heart of the matter.',
          commonPhrases: ['Pim often says "Message received and understood"', 'When Pim speaks, people listen carefully'],
          coreTraits: ['Pim is extremely reliable in all situations', 'Has excellent memory that Pim uses effectively']
        },
        defaultClothingState: {
          styleDescription: 'Pim wears professional but comfortable clothing suitable for long work sessions',
          fittingNotes: 'Pim always has a communication device visible somewhere on her outfit'
        }
      }
    ],
    characterRelationships: [
      {
        character1: 'Lakshmi Shah',
        character2: 'Basma Salim', 
        relationshipType: 'colleagues',
        dynamicDescription: 'Torgue and Pim work together seamlessly as a perfect team. When Torgue has a brilliant engineering idea, Pim helps communicate it clearly to the rest of the team. The collaboration between Torgue and Pim is legendary in their organization.'
      }
    ]
  };

  const canonicalNames = ['Lakshmi Shah', 'Basma Salim'];
  
  console.log('📝 Original Character Bible Sample:');
  console.log('Character 1 Bio:', mockCharacterBible.characters[0].bio.substring(0, 100) + '...');
  console.log('Character 2 Bio:', mockCharacterBible.characters[1].bio.substring(0, 100) + '...');
  console.log('Relationship:', mockCharacterBible.characterRelationships[0].dynamicDescription.substring(0, 100) + '...');
  
  console.log('\n🔍 Running Enhanced Nickname Validation...');
  const validationResult = validationService.validateCharacterBible(mockCharacterBible, canonicalNames);

  console.log('\n📊 RESULTS:');
  console.log('✅ Validation completed');
  console.log(`🏷️  Nickname mappings detected: ${validationResult.nicknameMappings?.length || 0}`);
  console.log(`🔧 Text corrections made: ${validationResult.correctionsMade?.length || 0}`);
  console.log(`📈 Mapping statistics:`, validationResult.mappingStats);

  if (validationResult.nicknameMappings && validationResult.nicknameMappings.length > 0) {
    console.log('\n🎯 DETECTED NICKNAME MAPPINGS:');
    validationResult.nicknameMappings.forEach(mapping => {
      console.log(`   "${mapping.nickname}" → "${mapping.canonicalName}"`);
      console.log(`     Confidence: ${(mapping.confidence * 100).toFixed(1)}%`);
      console.log(`     Source: ${mapping.mappingSource}`);
      console.log(`     Context: "${mapping.context.substring(0, 60)}..."`);
      console.log('');
    });
  }

  if (validationResult.correctionsMade && validationResult.correctionsMade.length > 0) {
    console.log('🔧 SAMPLE CORRECTIONS MADE:');
    validationResult.correctionsMade.slice(0, 5).forEach(correction => {
      console.log(`   Field: ${correction.field}`);
      console.log(`   Before: "${correction.from.substring(0, 80)}..."`);
      console.log(`   After: "${correction.to.substring(0, 80)}..."`);
      console.log('');
    });
  }

  if (validationResult.correctedCharacterBible) {
    console.log('✨ CORRECTED CHARACTER BIBLE SAMPLE:');
    const correctedBible = validationResult.correctedCharacterBible;
    console.log('Character 1 Bio:', correctedBible.characters[0].bio.substring(0, 100) + '...');
    console.log('Character 2 Bio:', correctedBible.characters[1].bio.substring(0, 100) + '...');
    console.log('Relationship:', correctedBible.characterRelationships[0].dynamicDescription.substring(0, 100) + '...');
    
    // Verify specific mappings worked
    const lakshmiChar = correctedBible.characters.find(c => c.name === 'Lakshmi Shah');
    const basmaChar = correctedBible.characters.find(c => c.name === 'Basma Salim');
    
    console.log('\n🎯 VERIFICATION CHECKS:');
    console.log('✅ Torgue → Lakshmi Shah mapping:', lakshmiChar.bio.includes('Lakshmi Shah') ? 'SUCCESS' : 'FAILED');
    console.log('✅ Pim → Basma Salim mapping:', basmaChar.bio.includes('Basma Salim') ? 'SUCCESS' : 'FAILED');
    console.log('❌ No remaining "Torgue":', !lakshmiChar.bio.includes('Torgue') ? 'SUCCESS' : 'FAILED'); 
    console.log('❌ No remaining "Pim":', !basmaChar.bio.includes('Pim') ? 'SUCCESS' : 'FAILED');
  }

  console.log('\n🏁 TEST COMPLETE');
  console.log('=' .repeat(60));
}

// Run the test
testEnhancedNicknameMapping().catch(console.error);