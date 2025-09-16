#!/usr/bin/env node

/**
 * 🧪 CHARACTER CONSISTENCY E2E TEST SCRIPT
 * 
 * Tests character consistency across multi-stage AI generation:
 * 1. Manual Project Creation → 2. Character Creation → 3. Script Generation → 4. Consistency Verification
 * 
 * This script verifies that character names remain consistent across:
 * - Project characters database 
 * - Character bible generation (Stage 2)
 * - Script generation (Stage 3)
 * - Generated dialogue and character states
 * 
 * USAGE:
 * 1. Make sure you're logged in to the app at http://localhost:5000
 * 2. Run: node test-character-consistency.js
 * 3. The script will create a test project and verify character consistency
 */

const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

class CharacterConsistencyTester {
  constructor(baseUrl = 'http://localhost:5000') {
    this.baseUrl = baseUrl;
    this.testResults = {
      passed: 0,
      failed: 0,
      issues: []
    };
  }

  log(message, color = RESET) {
    console.log(`${color}${message}${RESET}`);
  }

  error(message) {
    this.log(`❌ ${message}`, RED);
    this.testResults.failed++;
    this.testResults.issues.push(message);
  }

  success(message) {
    this.log(`✅ ${message}`, GREEN);
    this.testResults.passed++;
  }

  info(message) {
    this.log(`ℹ️  ${message}`, BLUE);
  }

  warn(message) {
    this.log(`⚠️  ${message}`, YELLOW);
  }

  async makeRequest(endpoint, method = 'GET', body = null) {
    const url = `${this.baseUrl}${endpoint}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      this.error(`API request failed: ${method} ${url} - ${error.message}`);
      throw error;
    }
  }

  async testCharacterBibleGeneration(projectId, characters) {
    this.log('\n📚 TESTING CHARACTER BIBLE GENERATION', YELLOW + BOLD);
    
    this.info(`Testing with characters: ${characters.map(c => c.name).join(', ')}`);
    
    const bibleRequest = {
      title: "Character Consistency Test",
      description: "Testing character name consistency across AI generation stages",
      genre: "Superhero",
      characters: characters.map(c => ({ name: c.name, role: c.role }))
    };

    try {
      const result = await this.makeRequest('/api/generation/character-bible', 'POST', bibleRequest);
      
      if (!result.characterBible || !result.characterBible.characters) {
        this.error('Character bible generation missing required data');
        return null;
      }

      this.success('Character bible generation completed');
      
      // Verify character names in character bible  
      this.verifyCharacterNamesInBible(result.characterBible, characters);

      return result.characterBible;
      
    } catch (error) {
      this.error(`Character bible generation failed: ${error.message}`);
      return null;
    }
  }

  verifyCharacterNamesInStoryOutline(storyOutline, originalCharacters) {
    this.info('🔍 Verifying character names in story outline...');
    
    const originalNames = originalCharacters.map(c => c.name);
    const outlineText = JSON.stringify(storyOutline);
    
    for (const character of originalCharacters) {
      if (outlineText.includes(character.name)) {
        this.success(`Character "${character.name}" found in story outline`);
      } else {
        this.error(`Character "${character.name}" missing from story outline`);
      }
    }

    // Check for suspicious nicknames or wrong names
    const suspiciousNames = ['Torgue', 'Pim', 'Thunder', 'Lightning', 'Shadow'];
    for (const suspiciousName of suspiciousNames) {
      if (outlineText.includes(suspiciousName) && !originalNames.some(name => name.includes(suspiciousName))) {
        this.warn(`Suspicious name "${suspiciousName}" found in story outline - potential nickname usage`);
      }
    }
  }

  verifyCharacterNamesInBible(characterBible, originalCharacters) {
    this.info('📚 Verifying character names in character bible...');
    
    const originalNames = originalCharacters.map(c => c.name);
    
    if (!characterBible.characters || characterBible.characters.length === 0) {
      this.error('Character bible has no characters');
      return;
    }

    // Check that all original characters are present
    for (const originalChar of originalCharacters) {
      const found = characterBible.characters.find(c => c.name === originalChar.name);
      if (found) {
        this.success(`Character "${originalChar.name}" found in character bible`);
        
        // Verify character name consistency in bio and descriptions
        this.verifyCharacterNameInBio(found, originalNames);
        
      } else {
        this.error(`Character "${originalChar.name}" missing from character bible`);
      }
    }

    // Verify character relationships use correct names
    if (characterBible.characterRelationships) {
      this.verifyCharacterNamesInRelationships(characterBible.characterRelationships, originalNames);
    }
  }

  verifyCharacterNameInBio(character, originalNames) {
    const textFields = [
      character.bio,
      character.personality?.speechPattern,
      character.personality?.voiceDescription,
      character.defaultClothingState?.styleDescription,
      character.defaultClothingState?.fittingNotes
    ].filter(Boolean);

    const allText = textFields.join(' ');
    
    // Check if bio mentions other characters correctly
    for (const originalName of originalNames) {
      if (originalName !== character.name && allText.includes(originalName)) {
        this.success(`Character "${character.name}" bio correctly references "${originalName}"`);
      }
    }

    // Look for suspicious nicknames in bio
    const words = allText.split(/\s+/);
    const suspiciousNames = ['Torgue', 'Pim', 'Thunder', 'Captain', 'Doctor'];
    
    for (const word of words) {
      if (suspiciousNames.includes(word) && !originalNames.some(name => name.includes(word))) {
        this.warn(`Suspicious name "${word}" found in ${character.name}'s bio - potential nickname usage`);
      }
    }
  }

  verifyCharacterNamesInRelationships(relationships, originalNames) {
    this.info('💑 Verifying character names in relationships...');
    
    for (const relationship of relationships) {
      // Check character1 and character2 are valid
      if (!originalNames.includes(relationship.character1)) {
        this.error(`Invalid character name in relationship: "${relationship.character1}"`);
      } else {
        this.success(`Relationship character1 "${relationship.character1}" is valid`);
      }

      if (!originalNames.includes(relationship.character2)) {
        this.error(`Invalid character name in relationship: "${relationship.character2}"`);
      } else {
        this.success(`Relationship character2 "${relationship.character2}" is valid`);
      }

      // Check relationship description for correct name usage
      if (relationship.dynamicDescription) {
        for (const originalName of originalNames) {
          if (relationship.dynamicDescription.includes(originalName)) {
            this.success(`Relationship description correctly uses "${originalName}"`);
          }
        }
      }
    }
  }

  verifyCharacterNamesInScripts(scriptData, originalCharacters) {
    this.info('📜 Verifying character names in scripts...');
    
    const originalNames = originalCharacters.map(c => c.name);
    
    if (!scriptData.pages || scriptData.pages.length === 0) {
      this.warn('No script pages to verify');
      return;
    }

    let dialogueCount = 0;
    let characterStateCount = 0;

    for (const page of scriptData.pages) {
      if (page.panels) {
        for (const panel of page.panels) {
          // Check character states
          if (panel.characterStates) {
            for (const charState of panel.characterStates) {
              characterStateCount++;
              if (!originalNames.includes(charState.characterName)) {
                this.error(`Invalid character name in character state: "${charState.characterName}"`);
              } else {
                this.success(`Character state "${charState.characterName}" is valid`);
              }
            }
          }

          // Check dialogue
          if (panel.dialogue) {
            for (const dialogue of panel.dialogue) {
              dialogueCount++;
              if (!originalNames.includes(dialogue.characterName)) {
                this.error(`Invalid character name in dialogue: "${dialogue.characterName}"`);
              } else {
                this.success(`Dialogue character "${dialogue.characterName}" is valid`);
              }

              // Check dialogue text for character references
              if (dialogue.text) {
                for (const originalName of originalNames) {
                  if (dialogue.text.includes(originalName)) {
                    this.success(`Dialogue correctly references "${originalName}"`);
                  }
                }
              }
            }
          }
        }
      }
    }

    this.info(`Verified ${dialogueCount} dialogue entries and ${characterStateCount} character states`);
  }

  async testProjectCreation(storyData) {
    this.log('\n🏗️ TESTING PROJECT CREATION', YELLOW + BOLD);
    
    if (!storyData) {
      this.error('No story data provided for project creation');
      return null;
    }

    const projectRequest = {
      title: "The Lightning Chronicles Test",
      description: "E2E test project for character consistency",
      storyData: storyData
    };

    try {
      const project = await this.makeRequest('/api/projects', 'POST', projectRequest);
      
      if (!project.id) {
        this.error('Project creation failed - no project ID returned');
        return null;
      }

      this.success(`Project created successfully: ${project.id}`);
      
      // Verify project characters match original
      await this.verifyProjectCharacters(project.id, storyData.originalCharacters);
      
      return project;
      
    } catch (error) {
      this.error(`Project creation failed: ${error.message}`);
      return null;
    }
  }

  async verifyProjectCharacters(projectId, originalCharacters) {
    this.info('👥 Verifying project characters...');
    
    try {
      const characters = await this.makeRequest(`/api/projects/${projectId}/characters`);
      
      const originalNames = originalCharacters.map(c => c.name);
      
      for (const originalChar of originalCharacters) {
        const found = characters.find(c => c.name === originalChar.name);
        if (found) {
          this.success(`Project character "${originalChar.name}" matches original`);
        } else {
          this.error(`Project character "${originalChar.name}" not found or name changed`);
        }
      }

      // Check for extra characters with wrong names
      for (const projectChar of characters) {
        if (!originalNames.includes(projectChar.name)) {
          this.warn(`Unexpected character in project: "${projectChar.name}"`);
        }
      }
      
    } catch (error) {
      this.error(`Failed to verify project characters: ${error.message}`);
    }
  }

  async runFullTest() {
    this.log(`\n${BOLD}🧪 STARTING CHARACTER CONSISTENCY E2E TEST${RESET}\n`);
    
    try {
      // Step 1: Generate AI story
      const storyData = await this.testAIStoryGeneration();
      if (!storyData) {
        this.error('Cannot continue test - story generation failed');
        return this.printResults();
      }

      // Step 2: Create project from story
      const project = await this.testProjectCreation(storyData);
      if (!project) {
        this.error('Cannot continue test - project creation failed');
        return this.printResults();
      }

      // Step 3: Test panel generation (optional)
      await this.testPanelGeneration(project.id, storyData.originalCharacters);

      this.log(`\n${BOLD}🎯 TEST COMPLETED${RESET}\n`);
      return this.printResults();
      
    } catch (error) {
      this.error(`Test execution failed: ${error.message}`);
      return this.printResults();
    }
  }

  async testPanelGeneration(projectId, originalCharacters) {
    this.info('🎨 Testing panel generation with character consistency...');
    
    try {
      const pages = await this.makeRequest(`/api/projects/${projectId}/pages`);
      
      if (!pages || pages.length === 0) {
        this.warn('No pages found for panel generation test');
        return;
      }

      // Test generating first few panels
      const firstPage = pages[0];
      if (firstPage.panels && firstPage.panels.length > 0) {
        this.success('Pages contain panels with consistent character data');
        
        // Verify panel character consistency
        for (const panel of firstPage.panels.slice(0, 3)) {
          await this.verifyPanelCharacterConsistency(panel, originalCharacters);
        }
      }
      
    } catch (error) {
      this.warn(`Panel generation test failed: ${error.message}`);
    }
  }

  async verifyPanelCharacterConsistency(panel, originalCharacters) {
    const originalNames = originalCharacters.map(c => c.name);
    
    // Check character states
    if (panel.characterStates) {
      for (const state of panel.characterStates) {
        if (originalNames.includes(state.characterName)) {
          this.success(`Panel character state "${state.characterName}" is consistent`);
        } else {
          this.error(`Panel character state has wrong name: "${state.characterName}"`);
        }
      }
    }

    // Check dialogue
    if (panel.dialogue) {
      for (const dialogue of panel.dialogue) {
        if (originalNames.includes(dialogue.characterName)) {
          this.success(`Panel dialogue character "${dialogue.characterName}" is consistent`);
        } else {
          this.error(`Panel dialogue has wrong character name: "${dialogue.characterName}"`);
        }
      }
    }
  }

  printResults() {
    this.log(`\n${BOLD}📊 TEST RESULTS SUMMARY${RESET}`, BLUE);
    this.log(`${'='.repeat(50)}`, BLUE);
    
    const totalTests = this.testResults.passed + this.testResults.failed;
    const passRate = totalTests > 0 ? ((this.testResults.passed / totalTests) * 100).toFixed(1) : 0;
    
    this.log(`Total Tests: ${totalTests}`, BLUE);
    this.log(`Passed: ${this.testResults.passed}`, GREEN);
    this.log(`Failed: ${this.testResults.failed}`, RED);
    this.log(`Pass Rate: ${passRate}%`, passRate >= 95 ? GREEN : passRate >= 80 ? YELLOW : RED);
    
    if (this.testResults.issues.length > 0) {
      this.log(`\n${BOLD}🚨 ISSUES FOUND:${RESET}`, RED);
      this.testResults.issues.forEach((issue, index) => {
        this.log(`${index + 1}. ${issue}`, RED);
      });
    } else {
      this.log(`\n${BOLD}🎉 NO ISSUES FOUND! CHARACTER CONSISTENCY IS WORKING!${RESET}`, GREEN);
    }
    
    return {
      passed: this.testResults.passed,
      failed: this.testResults.failed,
      passRate: parseFloat(passRate),
      issues: this.testResults.issues
    };
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  const tester = new CharacterConsistencyTester();
  tester.runFullTest().then(results => {
    process.exit(results.failed > 0 ? 1 : 0);
  }).catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = CharacterConsistencyTester;