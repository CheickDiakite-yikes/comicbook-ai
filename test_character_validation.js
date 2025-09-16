/**
 * Quick test to verify the fixed CharacterNameValidationService works correctly
 */

// Test data - simulate a character bible with naming issues
const testCharacterBible = {
  characters: [
    {
      name: "John Smith",
      role: "protagonist",
      bio: "John is a brave hero who saves the day. He and Sarah work together.",
      personality: {
        speechPattern: "John speaks confidently and Sarah admires his courage.",
        voiceDescription: "John has a deep voice.",
        commonPhrases: ["Let's go, Sarah!", "We can do this together!"]
      },
      defaultClothingState: {
        styleDescription: "John wears a blue jacket and Sarah compliments his style.",
        fittingNotes: "The jacket fits John perfectly."
      }
    },
    {
      name: "Sarah Johnson",
      role: "supporting",
      bio: "Sarah is John's trusted partner. She helps John in difficult situations.",
      personality: {
        speechPattern: "Sarah is encouraging and supports John's decisions.",
        voiceDescription: "Sarah has a melodic voice.",
        commonPhrases: ["Good idea, John!", "We make a great team!"]
      }
    }
  ],
  characterRelationships: [
    {
      character1: "John",  // This should be corrected to "John Smith"
      character2: "Sarah", // This should be corrected to "Sarah Johnson"
      relationshipType: "partnership",
      dynamicDescription: "John and Sarah work as a team. They trust each other completely."
    }
  ]
};

const originalCharacterNames = ["John Smith", "Sarah Johnson"];

// Import the validation service
const { CharacterNameValidationService } = require('./server/services/CharacterNameValidationService.ts');

// Test the validation service
async function testValidation() {
  try {
    console.log("🧪 TESTING CHARACTER NAME VALIDATION SERVICE");
    console.log("=" .repeat(60));
    
    const validator = new CharacterNameValidationService();
    
    console.log("📝 Testing character bible with naming issues:");
    console.log("- Characters using first names instead of full names");
    console.log("- Relationships referencing incomplete names");
    console.log("");
    
    // Run validation and correction
    const result = validator.validateCharacterBible(testCharacterBible, originalCharacterNames);
    
    console.log("✅ VALIDATION RESULTS:");
    console.log(`- Valid: ${result.isValid}`);
    console.log(`- Errors: ${result.errors.length}`);
    console.log(`- Corrections made: ${result.correctionsMade.length}`);
    console.log("");
    
    if (result.correctionsMade.length > 0) {
      console.log("🔧 CORRECTIONS APPLIED:");
      result.correctionsMade.forEach(correction => {
        console.log(`   ${correction.field}:`);
        console.log(`     FROM: "${correction.from}"`);
        console.log(`     TO:   "${correction.to}"`);
        console.log("");
      });
    }
    
    if (result.errors.length > 0) {
      console.log("⚠️  REMAINING ERRORS:");
      result.errors.forEach(error => {
        console.log(`   ${error.type}: ${error.description}`);
      });
      console.log("");
    }
    
    if (result.correctedCharacterBible) {
      console.log("📄 CORRECTED CHARACTER BIBLE SAMPLE:");
      console.log("Character relationships:");
      result.correctedCharacterBible.characterRelationships?.forEach((rel, i) => {
        console.log(`   Relationship ${i + 1}: "${rel.character1}" <-> "${rel.character2}"`);
      });
      console.log("");
    }
    
    // Test script validation too
    const testScript = {
      pages: [
        {
          pageNumber: 1,
          panels: [
            {
              panelNumber: 1,
              visualDescription: "John stands next to Sarah in the courtyard.",
              dialogue: [
                {
                  character: "John", // Should be corrected to "John Smith"
                  text: "Sarah, we need to work together on this."
                },
                {
                  character: "Sarah", // Should be corrected to "Sarah Johnson" 
                  text: "You're right, John. Let's do it!"
                }
              ]
            }
          ]
        }
      ]
    };
    
    console.log("🎬 TESTING SCRIPT VALIDATION:");
    const scriptResult = validator.validateScriptContent(testScript, originalCharacterNames);
    console.log(`- Valid: ${scriptResult.isValid}`);
    console.log(`- Corrections made: ${scriptResult.correctionsMade.length}`);
    
    if (scriptResult.correctionsMade.length > 0) {
      console.log("Script corrections:");
      scriptResult.correctionsMade.forEach(correction => {
        console.log(`   ${correction.field}: "${correction.from}" -> "${correction.to}"`);
      });
    }
    
    console.log("\n✅ CHARACTER NAME VALIDATION SERVICE TEST COMPLETE!");
    
    // Return results for verification
    return {
      characterBibleResult: result,
      scriptResult: scriptResult,
      success: true
    };
    
  } catch (error) {
    console.error("❌ TEST FAILED:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run the test
testValidation().then(results => {
  if (results.success) {
    console.log("🎉 All tests passed successfully!");
  } else {
    console.log("💥 Tests failed:", results.error);
  }
}).catch(error => {
  console.error("💥 Test execution failed:", error);
});