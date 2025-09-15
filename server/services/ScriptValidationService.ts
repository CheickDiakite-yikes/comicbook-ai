import { IStorage } from '../storage';
import { geminiService } from '../gemini';
import {
  ScriptValidationRequest,
  ValidationResult,
  FullStructuredScript,
  ScriptPanelWithDialogue,
  Character,
  CharacterConsistencyRule,
  CharacterAppearanceProfile,
  PanelCharacterState,
  InsertScriptValidationReport,
  InsertValidationIssue,
  InsertCharacterConsistencyViolation,
} from '@shared/schema';

interface ValidationIssue {
  id: string;
  severity: 'critical' | 'warning' | 'suggestion';
  category: string;
  title: string;
  description: string;
  suggestion?: string;
  affectedElements: string[];
  confidence: number;
}

interface CharacterConsistencyContext {
  character: Character;
  appearanceProfile?: CharacterAppearanceProfile;
  consistencyRules: CharacterConsistencyRule[];
  panelStates: Array<{
    panelId: string;
    panelNumber: number;
    pageNumber: number;
    state: PanelCharacterState;
  }>;
}

export class ScriptValidationService {
  constructor(private storage: IStorage) {}

  /**
   * Main validation entry point
   */
  async validateScript(request: ScriptValidationRequest): Promise<ValidationResult> {
    console.log(`🔍 Starting script validation for project ${request.projectId}`);

    // Get full project data
    const project = await this.storage.getProject(request.projectId);
    if (!project) {
      throw new Error(`Project not found: ${request.projectId}`);
    }

    let structuredScript: FullStructuredScript | undefined;
    if (request.structuredScriptId) {
      structuredScript = await this.storage.getProjectStructuredScript(request.projectId);
    }

    // Initialize validation categories
    const issues: ValidationIssue[] = [];
    const characterConsistencyIssues: ValidationIssue[] = [];
    const storyCoherenceIssues: ValidationIssue[] = [];
    const technicalCompletenessIssues: ValidationIssue[] = [];

    // 1. Character Consistency Validation
    if (!request.validationCategories || request.validationCategories.includes('character_consistency')) {
      console.log('🎭 Validating character consistency...');
      const characterIssues = await this.validateCharacterConsistency(project.id, structuredScript);
      characterConsistencyIssues.push(...characterIssues);
      issues.push(...characterIssues);
    }

    // 2. Story Coherence Validation
    if (!request.validationCategories || request.validationCategories.includes('story_coherence')) {
      console.log('📚 Validating story coherence...');
      const coherenceIssues = await this.validateStoryCoherence(project, structuredScript);
      storyCoherenceIssues.push(...coherenceIssues);
      issues.push(...coherenceIssues);
    }

    // 3. Technical Completeness Validation
    if (!request.validationCategories || request.validationCategories.includes('technical_completeness')) {
      console.log('🎬 Validating technical completeness...');
      const technicalIssues = await this.validateTechnicalCompleteness(structuredScript);
      technicalCompletenessIssues.push(...technicalIssues);
      issues.push(...technicalIssues);
    }

    // Calculate scores and generate report
    const result = await this.generateValidationReport({
      issues,
      characterConsistencyIssues,
      storyCoherenceIssues,
      technicalCompletenessIssues,
      project,
      structuredScript,
      generateSuggestions: request.generateSuggestions,
    });

    // Save validation report to database
    await this.saveValidationReport(request, result);

    console.log(`✅ Validation completed. Overall score: ${result.overallScore}`);
    return result;
  }

  /**
   * Validate character consistency across panels using existing tracking infrastructure
   */
  private async validateCharacterConsistency(
    projectId: string,
    structuredScript?: FullStructuredScript
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    
    try {
      // Get all characters for this project
      const characters = await this.storage.getProjectCharacters(projectId);
      
      for (const character of characters) {
        const context = await this.buildCharacterConsistencyContext(character);
        
        // Check appearance consistency violations
        const appearanceIssues = await this.checkAppearanceConsistency(context);
        issues.push(...appearanceIssues);
        
        // Check consistency rule violations
        const ruleViolations = await this.checkConsistencyRuleViolations(context);
        issues.push(...ruleViolations);
        
        // Check for missing character data
        const missingDataIssues = await this.checkMissingCharacterData(context);
        issues.push(...missingDataIssues);
      }

      // Cross-panel consistency checks
      if (structuredScript) {
        const crossPanelIssues = await this.validateCrossPanelConsistency(structuredScript, characters);
        issues.push(...crossPanelIssues);
      }

    } catch (error) {
      console.error('Error validating character consistency:', error);
      issues.push({
        id: `char_consistency_error_${Date.now()}`,
        severity: 'warning',
        category: 'validation_error',
        title: 'Character Consistency Validation Error',
        description: `Unable to fully validate character consistency: ${error instanceof Error ? error.message : 'Unknown error'}`,
        affectedElements: [projectId],
        confidence: 50,
      });
    }

    return issues;
  }

  /**
   * Build comprehensive character consistency context
   */
  private async buildCharacterConsistencyContext(character: Character): Promise<CharacterConsistencyContext> {
    const [appearanceProfile, consistencyRules, rawPanelStates] = await Promise.all([
      this.storage.getCharacterAppearanceProfile(character.id),
      this.storage.getCharacterConsistencyRules(character.id),
      this.storage.getCharacterPanelStates(character.id),
    ]);

    // Transform raw panel states to include panel and page metadata
    const panelStates: CharacterConsistencyContext['panelStates'] = [];
    
    for (const panelState of rawPanelStates) {
      // Get panel information to extract panel number and page info
      const panel = await this.storage.getPanel(panelState.panelId);
      if (panel) {
        const page = await this.storage.getPage(panel.pageId);
        if (page) {
          panelStates.push({
            panelId: panelState.panelId,
            panelNumber: panel.panelNumber,
            pageNumber: page.pageNumber,
            state: panelState,
          });
        }
      }
    }

    return {
      character,
      appearanceProfile,
      consistencyRules,
      panelStates,
    };
  }

  /**
   * Check for appearance consistency violations
   */
  private async checkAppearanceConsistency(context: CharacterConsistencyContext): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    const { character, appearanceProfile } = context;

    // Check if character has appearance profile
    if (!appearanceProfile) {
      issues.push({
        id: `missing_appearance_${character.id}`,
        severity: 'warning',
        category: 'missing_appearance_profile',
        title: `Missing Appearance Profile: ${character.name}`,
        description: `Character "${character.name}" lacks a detailed appearance profile, which may lead to inconsistent visual representation.`,
        suggestion: 'Create a comprehensive appearance profile with physical traits, clothing preferences, and distinctive features.',
        affectedElements: [character.id],
        confidence: 95,
      });
      return issues;
    }

    // Check for conflicting visual descriptors
    if (character.visualDescriptors && appearanceProfile) {
      const conflicts = this.detectVisualDescriptorConflicts(character.visualDescriptors, appearanceProfile);
      issues.push(...conflicts.map(conflict => ({
        id: `visual_conflict_${character.id}_${Date.now()}`,
        severity: 'warning' as const,
        category: 'appearance_conflict',
        title: `Visual Descriptor Conflict: ${character.name}`,
        description: conflict.description,
        suggestion: conflict.suggestion,
        affectedElements: [character.id],
        confidence: conflict.confidence,
      })));
    }

    // Check always/never traits consistency
    if (character.alwaysTraits || character.neverTraits) {
      const traitIssues = this.validateTraitConsistency(character, appearanceProfile);
      issues.push(...traitIssues);
    }

    return issues;
  }

  /**
   * Detect conflicts between visual descriptors and appearance profile
   */
  private detectVisualDescriptorConflicts(
    visualDescriptors: string,
    appearanceProfile: CharacterAppearanceProfile
  ): Array<{ description: string; suggestion: string; confidence: number }> {
    const conflicts = [];
    const descriptors = visualDescriptors.toLowerCase();

    // Check hair color conflicts
    if (appearanceProfile.hairColor) {
      const profileHairColor = appearanceProfile.hairColor.toLowerCase();
      const commonHairColors = ['black', 'brown', 'blonde', 'red', 'gray', 'white'];
      
      for (const color of commonHairColors) {
        if (descriptors.includes(color + ' hair') && !profileHairColor.includes(color)) {
          conflicts.push({
            description: `Visual descriptors mention "${color} hair" but appearance profile specifies "${appearanceProfile.hairColor}" hair.`,
            suggestion: `Update either the visual descriptors or appearance profile to maintain consistent hair color.`,
            confidence: 85,
          });
        }
      }
    }

    // Check eye color conflicts
    if (appearanceProfile.eyeColor) {
      const profileEyeColor = appearanceProfile.eyeColor.toLowerCase();
      const commonEyeColors = ['blue', 'brown', 'green', 'hazel', 'gray'];
      
      for (const color of commonEyeColors) {
        if (descriptors.includes(color + ' eyes') && !profileEyeColor.includes(color)) {
          conflicts.push({
            description: `Visual descriptors mention "${color} eyes" but appearance profile specifies "${appearanceProfile.eyeColor}" eyes.`,
            suggestion: `Ensure eye color consistency between visual descriptors and appearance profile.`,
            confidence: 90,
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Validate trait consistency
   */
  private validateTraitConsistency(
    character: Character,
    appearanceProfile: CharacterAppearanceProfile
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check always traits
    if (character.alwaysTraits) {
      const alwaysTraits = character.alwaysTraits.toLowerCase().split(',').map(t => t.trim());
      
      for (const trait of alwaysTraits) {
        if (trait.includes('glasses') && appearanceProfile.glasses === 'none') {
          issues.push({
            id: `always_trait_violation_${character.id}_glasses`,
            severity: 'critical',
            category: 'trait_violation',
            title: `Always Trait Violation: ${character.name}`,
            description: `Character has "always wears glasses" trait but appearance profile shows no glasses.`,
            suggestion: 'Update appearance profile to include glasses or modify always traits.',
            affectedElements: [character.id],
            confidence: 95,
          });
        }
      }
    }

    // Check never traits
    if (character.neverTraits) {
      const neverTraits = character.neverTraits.toLowerCase().split(',').map(t => t.trim());
      
      for (const trait of neverTraits) {
        if (trait.includes('beard') && appearanceProfile.facialHair?.includes('beard')) {
          issues.push({
            id: `never_trait_violation_${character.id}_beard`,
            severity: 'critical',
            category: 'trait_violation',
            title: `Never Trait Violation: ${character.name}`,
            description: `Character has "never has beard" trait but appearance profile shows facial hair.`,
            suggestion: 'Remove beard from appearance profile or modify never traits.',
            affectedElements: [character.id],
            confidence: 95,
          });
        }
      }
    }

    return issues;
  }

  /**
   * Check consistency rule violations
   */
  private async checkConsistencyRuleViolations(context: CharacterConsistencyContext): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    const { character, consistencyRules } = context;

    for (const rule of consistencyRules) {
      if (!rule.isActive) continue;

      // Check rule enforcement based on type
      switch (rule.ruleType) {
        case 'appearance':
          if (rule.mustInclude && rule.mustInclude.length > 0) {
            const missingElements = this.checkMustIncludeElements(character, rule.mustInclude);
            if (missingElements.length > 0) {
              issues.push({
                id: `rule_violation_${rule.id}_missing`,
                severity: rule.enforcement === 'strict' ? 'critical' : 'warning',
                category: 'consistency_rule_violation',
                title: `Missing Required Elements: ${character.name}`,
                description: `Rule "${rule.ruleName}" requires these elements but they are missing: ${missingElements.join(', ')}`,
                suggestion: `Add the missing elements: ${missingElements.join(', ')}`,
                affectedElements: [character.id],
                confidence: 90,
              });
            }
          }

          if (rule.mustNotInclude && rule.mustNotInclude.length > 0) {
            const forbiddenElements = this.checkMustNotIncludeElements(character, rule.mustNotInclude);
            if (forbiddenElements.length > 0) {
              issues.push({
                id: `rule_violation_${rule.id}_forbidden`,
                severity: rule.enforcement === 'strict' ? 'critical' : 'warning',
                category: 'consistency_rule_violation',
                title: `Forbidden Elements Present: ${character.name}`,
                description: `Rule "${rule.ruleName}" forbids these elements but they are present: ${forbiddenElements.join(', ')}`,
                suggestion: `Remove the forbidden elements: ${forbiddenElements.join(', ')}`,
                affectedElements: [character.id],
                confidence: 85,
              });
            }
          }
          break;
      }
    }

    return issues;
  }

  /**
   * Check for missing required character data
   */
  private async checkMissingCharacterData(context: CharacterConsistencyContext): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    const { character } = context;

    // Check for essential character information
    if (!character.visualDescriptors || character.visualDescriptors.trim().length < 20) {
      issues.push({
        id: `missing_visual_descriptors_${character.id}`,
        severity: 'warning',
        category: 'missing_data',
        title: `Insufficient Visual Descriptors: ${character.name}`,
        description: 'Character lacks detailed visual descriptors, which may result in inconsistent AI generation.',
        suggestion: 'Add comprehensive visual descriptors including physical appearance, clothing style, and distinctive features.',
        affectedElements: [character.id],
        confidence: 95,
      });
    }

    if (!character.alwaysTraits) {
      issues.push({
        id: `missing_always_traits_${character.id}`,
        severity: 'suggestion',
        category: 'missing_data',
        title: `Missing Always Traits: ${character.name}`,
        description: 'Character has no "always traits" defined, which could help maintain consistency.',
        suggestion: 'Define traits that should always be present in this character (e.g., "always wears glasses", "always has confident posture").',
        affectedElements: [character.id],
        confidence: 70,
      });
    }

    return issues;
  }

  /**
   * Validate cross-panel consistency using stored panel states
   */
  private async validateCrossPanelConsistency(
    structuredScript: FullStructuredScript,
    characters: Character[]
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    
    for (const character of characters) {
      // Get the character's context with actual panel states
      const context = await this.buildCharacterConsistencyContext(character);
      
      if (context.panelStates.length > 1) {
        // Check consistency across actual panel states
        const stateConsistencyIssues = await this.validatePanelStateConsistency(context);
        issues.push(...stateConsistencyIssues);
        
        // Check appearance profile violations
        const profileViolations = await this.checkAppearanceProfileViolations(context);
        issues.push(...profileViolations);
        
        // Check consistency rule violations across panels
        const ruleViolations = await this.checkCrossPageRuleViolations(context);
        issues.push(...ruleViolations);
      }
      
      // Also check structured script mentions if available
      if (structuredScript) {
        const characterAppearances = this.extractCharacterAppearances(structuredScript, character.name);
        if (characterAppearances.length > 1) {
          const scriptInconsistencies = this.detectAppearanceInconsistencies(characterAppearances, character);
          issues.push(...scriptInconsistencies);
        }
      }
    }

    return issues;
  }

  /**
   * Validate consistency across panel states for a character
   */
  private async validatePanelStateConsistency(context: CharacterConsistencyContext): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    const { character, panelStates, appearanceProfile } = context;
    
    // Sort panel states by page/panel order
    const sortedStates = panelStates.sort((a, b) => {
      if (a.pageNumber !== b.pageNumber) return a.pageNumber - b.pageNumber;
      return a.panelNumber - b.panelNumber;
    });

    // Check for sudden emotional changes without narrative justification
    for (let i = 1; i < sortedStates.length; i++) {
      const prevState = sortedStates[i - 1].state;
      const currentState = sortedStates[i].state;
      
      if (prevState.emotion && currentState.emotion && 
          this.isEmotionalJump(prevState.emotion, currentState.emotion)) {
        issues.push({
          id: `emotional_jump_${character.id}_${currentState.panelId}`,
          severity: 'warning',
          category: 'emotional_consistency',
          title: `Sudden Emotional Change: ${character.name}`,
          description: `Character "${character.name}" transitions from "${prevState.emotion}" to "${currentState.emotion}" between page ${sortedStates[i-1].pageNumber} panel ${sortedStates[i-1].panelNumber} and page ${sortedStates[i].pageNumber} panel ${sortedStates[i].panelNumber}`,
          suggestion: 'Consider adding narrative justification for the emotional transition or smoothing the change.',
          affectedElements: [currentState.panelId, prevState.panelId],
          confidence: 75,
        });
      }
    }

    // Check for appearance profile violations
    if (appearanceProfile) {
      for (const panelState of sortedStates) {
        const violations = this.checkPanelStateAgainstProfile(panelState.state, appearanceProfile, character);
        issues.push(...violations.map(violation => ({
          ...violation,
          affectedElements: [panelState.panelId, ...violation.affectedElements],
        })));
      }
    }

    return issues;
  }

  /**
   * Check if an emotional transition is too jarring
   */
  private isEmotionalJump(prevEmotion: string, currentEmotion: string): boolean {
    const emotionalDistance: Record<string, Record<string, number>> = {
      'happy': { 'angry': 3, 'sad': 2, 'surprised': 1, 'neutral': 1 },
      'angry': { 'happy': 3, 'sad': 1, 'surprised': 2, 'neutral': 2 },
      'sad': { 'happy': 2, 'angry': 1, 'surprised': 2, 'neutral': 1 },
      'surprised': { 'happy': 1, 'angry': 2, 'sad': 2, 'neutral': 1 },
      'neutral': { 'happy': 1, 'angry': 2, 'sad': 1, 'surprised': 1 },
    };
    
    const distance = emotionalDistance[prevEmotion.toLowerCase()]?.[currentEmotion.toLowerCase()] || 0;
    return distance >= 3; // Consider distance 3+ as jarring
  }

  /**
   * Check panel state against appearance profile
   */
  private checkPanelStateAgainstProfile(
    panelState: PanelCharacterState, 
    profile: CharacterAppearanceProfile, 
    character: Character
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check for consistency violations based on profile
    if (profile.eyeColor && panelState.temporaryChanges) {
      const eyeColorChanges = panelState.temporaryChanges.toLowerCase();
      if (eyeColorChanges.includes('eye') && !eyeColorChanges.includes(profile.eyeColor.toLowerCase())) {
        issues.push({
          id: `eye_color_violation_${character.id}_${panelState.panelId}`,
          severity: 'warning',
          category: 'appearance_violation',
          title: `Eye Color Inconsistency: ${character.name}`,
          description: `Character's eyes appear different from profile. Profile: ${profile.eyeColor}, Panel changes: ${panelState.temporaryChanges}`,
          affectedElements: [character.id],
          confidence: 80,
        });
      }
    }

    return issues;
  }

  /**
   * Check for appearance profile violations across all panels
   */
  private async checkAppearanceProfileViolations(context: CharacterConsistencyContext): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    const { character, panelStates, appearanceProfile } = context;
    
    if (!appearanceProfile) return issues;

    for (const panelState of panelStates) {
      const violations = this.checkPanelStateAgainstProfile(panelState.state, appearanceProfile, character);
      issues.push(...violations);
    }

    return issues;
  }

  /**
   * Check consistency rule violations across pages
   */
  private async checkCrossPageRuleViolations(context: CharacterConsistencyContext): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    const { character, panelStates, consistencyRules } = context;

    for (const rule of consistencyRules) {
      if (rule.ruleType === 'always_present') {
        // Check if required elements are always present
        for (const panelState of panelStates) {
          if (!this.checkRuleCompliance(panelState.state, rule)) {
            issues.push({
              id: `rule_violation_${character.id}_${rule.id}_${panelState.panelId}`,
              severity: 'warning',
              category: 'consistency_rule_violation',
              title: `Consistency Rule Violation: ${character.name}`,
              description: `Rule "${rule.ruleName}" violated in page ${panelState.pageNumber}, panel ${panelState.panelNumber}`,
              suggestion: rule.suggestion || `Ensure "${rule.ruleName}" is properly applied`,
              affectedElements: [panelState.panelId],
              confidence: 85,
            });
          }
        }
      }
    }

    return issues;
  }

  /**
   * Check if a panel state complies with a consistency rule
   */
  private checkRuleCompliance(panelState: PanelCharacterState, rule: CharacterConsistencyRule): boolean {
    // Simple implementation - check if rule elements are mentioned in panel description
    const ruleElements = rule.ruleDescription?.toLowerCase() || '';
    const panelDescription = [
      panelState.pose,
      panelState.facialExpression,
      panelState.bodyLanguage,
      panelState.visualNotes
    ].filter(Boolean).join(' ').toLowerCase();

    // For 'always_present' rules, check if key elements are mentioned
    if (rule.ruleType === 'always_present' && rule.requiredElements) {
      return rule.requiredElements.every(element => 
        panelDescription.includes(element.toLowerCase())
      );
    }

    return true; // Default to compliant if we can't determine
  }

  /**
   * Extract character appearances from structured script
   */
  private extractCharacterAppearances(
    structuredScript: FullStructuredScript,
    characterName: string
  ): Array<{
    pageNumber: number;
    panelNumber: number;
    description: string;
    panelId: string;
  }> {
    const appearances = [];

    for (const page of structuredScript.pages) {
      for (const panel of page.panels) {
        // Check if character is mentioned in panel
        if (panel.characters && panel.characters.includes(characterName)) {
          appearances.push({
            pageNumber: page.pageNumber,
            panelNumber: panel.panelNumber,
            description: panel.sceneDescription || panel.action || '',
            panelId: panel.id,
          });
        }

        // Also check dialogue
        if (panel.dialogue) {
          for (const dialogue of panel.dialogue) {
            if (dialogue.character === characterName) {
              appearances.push({
                pageNumber: page.pageNumber,
                panelNumber: panel.panelNumber,
                description: panel.sceneDescription || panel.action || '',
                panelId: panel.id,
              });
              break;
            }
          }
        }
      }
    }

    return appearances;
  }

  /**
   * Detect appearance inconsistencies across panels
   */
  private detectAppearanceInconsistencies(
    appearances: Array<{
      pageNumber: number;
      panelNumber: number;
      description: string;
      panelId: string;
    }>,
    character: Character
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Use AI to analyze consistency across appearances
    if (appearances.length >= 2) {
      // For now, implement basic keyword-based checking
      // This could be enhanced with AI analysis later
      const descriptions = appearances.map(a => a.description.toLowerCase());
      const firstDescription = descriptions[0];
      
      for (let i = 1; i < descriptions.length; i++) {
        const inconsistencies = this.findDescriptionInconsistencies(firstDescription, descriptions[i]);
        if (inconsistencies.length > 0) {
          issues.push({
            id: `appearance_inconsistency_${character.id}_${appearances[0].panelId}_${appearances[i].panelId}`,
            severity: 'warning',
            category: 'appearance_inconsistency',
            title: `Appearance Inconsistency: ${character.name}`,
            description: `Inconsistent character description between Panel ${appearances[0].pageNumber}.${appearances[0].panelNumber} and Panel ${appearances[i].pageNumber}.${appearances[i].panelNumber}`,
            suggestion: 'Review character descriptions and ensure consistency in physical appearance, clothing, and other visual elements.',
            affectedElements: [appearances[0].panelId, appearances[i].panelId],
            confidence: 60,
          });
        }
      }
    }

    return issues;
  }

  /**
   * Validate story coherence
   */
  private async validateStoryCoherence(
    project: any,
    structuredScript?: FullStructuredScript
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    if (!structuredScript || !structuredScript.pages || structuredScript.pages.length === 0) {
      issues.push({
        id: `no_script_${project.id}`,
        severity: 'critical',
        category: 'missing_script',
        title: 'No Structured Script Available',
        description: 'Project lacks a structured script, making story coherence validation impossible.',
        suggestion: 'Generate a structured script for this project to enable comprehensive validation.',
        affectedElements: [project.id],
        confidence: 100,
      });
      return issues;
    }

    // Check narrative flow between pages
    const narrativeFlowIssues = await this.validateNarrativeFlow(structuredScript);
    issues.push(...narrativeFlowIssues);

    // Check character behavior consistency
    const behaviorIssues = await this.validateCharacterBehavior(structuredScript);
    issues.push(...behaviorIssues);

    // Check timeline consistency
    const timelineIssues = await this.validateTimeline(structuredScript);
    issues.push(...timelineIssues);

    // Check scene transitions
    const transitionIssues = await this.validateSceneTransitions(structuredScript);
    issues.push(...transitionIssues);

    return issues;
  }

  /**
   * Validate technical completeness
   */
  private async validateTechnicalCompleteness(structuredScript?: FullStructuredScript): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    if (!structuredScript || !structuredScript.pages) {
      return issues;
    }

    for (const page of structuredScript.pages) {
      // Check page-level completeness
      if (!page.setting || page.setting.trim().length < 10) {
        issues.push({
          id: `incomplete_page_setting_${page.id}`,
          severity: 'warning',
          category: 'missing_technical_data',
          title: `Incomplete Page Setting: Page ${page.pageNumber}`,
          description: 'Page lacks a comprehensive setting description.',
          suggestion: 'Add detailed setting description including location, time, and environmental context.',
          affectedElements: [page.id],
          confidence: 90,
        });
      }

      for (const panel of page.panels) {
        // Check essential panel fields
        if (!panel.sceneDescription || panel.sceneDescription.trim().length < 20) {
          issues.push({
            id: `missing_scene_description_${panel.id}`,
            severity: 'critical',
            category: 'missing_technical_data',
            title: `Missing Scene Description: Page ${page.pageNumber}, Panel ${panel.panelNumber}`,
            description: 'Panel lacks adequate scene description for AI generation.',
            suggestion: 'Add comprehensive scene description including character actions, environment, and visual details.',
            affectedElements: [panel.id],
            confidence: 95,
          });
        }

        // Check cinematography fields
        if (!panel.cameraAngle) {
          issues.push({
            id: `missing_camera_angle_${panel.id}`,
            severity: 'warning',
            category: 'missing_cinematography',
            title: `Missing Camera Angle: Page ${page.pageNumber}, Panel ${panel.panelNumber}`,
            description: 'Panel lacks camera angle specification.',
            suggestion: 'Specify camera angle (eye_level, high_angle, low_angle, etc.) for professional cinematography.',
            affectedElements: [panel.id],
            confidence: 80,
          });
        }

        if (!panel.shotType) {
          issues.push({
            id: `missing_shot_type_${panel.id}`,
            severity: 'warning',
            category: 'missing_cinematography',
            title: `Missing Shot Type: Page ${page.pageNumber}, Panel ${panel.panelNumber}`,
            description: 'Panel lacks shot type specification.',
            suggestion: 'Specify shot type (wide, medium, close_up, etc.) for proper framing.',
            affectedElements: [panel.id],
            confidence: 80,
          });
        }

        // Check lighting information
        if (!panel.primaryLightSource && !panel.lightingMood) {
          issues.push({
            id: `missing_lighting_${panel.id}`,
            severity: 'suggestion',
            category: 'missing_technical_detail',
            title: `Missing Lighting Information: Page ${page.pageNumber}, Panel ${panel.panelNumber}`,
            description: 'Panel lacks lighting specifications.',
            suggestion: 'Add lighting details (primary light source, mood, direction) for better visual consistency.',
            affectedElements: [panel.id],
            confidence: 70,
          });
        }

        // Check environmental details
        if (!panel.locationSpecifics && !panel.atmosphere) {
          issues.push({
            id: `missing_environment_${panel.id}`,
            severity: 'suggestion',
            category: 'missing_environmental',
            title: `Missing Environmental Details: Page ${page.pageNumber}, Panel ${panel.panelNumber}`,
            description: 'Panel lacks environmental context.',
            suggestion: 'Add environmental details (location specifics, atmosphere, weather) for richer scenes.',
            affectedElements: [panel.id],
            confidence: 65,
          });
        }
      }
    }

    return issues;
  }

  /**
   * Generate comprehensive validation report
   */
  private async generateValidationReport({
    issues,
    characterConsistencyIssues,
    storyCoherenceIssues,
    technicalCompletenessIssues,
    project,
    structuredScript,
    generateSuggestions,
  }: {
    issues: ValidationIssue[];
    characterConsistencyIssues: ValidationIssue[];
    storyCoherenceIssues: ValidationIssue[];
    technicalCompletenessIssues: ValidationIssue[];
    project: any;
    structuredScript?: FullStructuredScript;
    generateSuggestions: boolean;
  }): Promise<ValidationResult> {
    
    // Calculate scores
    const totalIssues = issues.length;
    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    const warningIssues = issues.filter(i => i.severity === 'warning').length;
    const suggestions = issues.filter(i => i.severity === 'suggestion').length;

    // Overall score calculation (more complex scoring could be implemented)
    const overallScore = Math.max(0, 100 - (criticalIssues * 15) - (warningIssues * 5) - (suggestions * 1));

    // Category scores
    const characterConsistencyScore = Math.max(0, 100 - (characterConsistencyIssues.filter(i => i.severity === 'critical').length * 15) - (characterConsistencyIssues.filter(i => i.severity === 'warning').length * 5));
    const storyCoherenceScore = Math.max(0, 100 - (storyCoherenceIssues.filter(i => i.severity === 'critical').length * 15) - (storyCoherenceIssues.filter(i => i.severity === 'warning').length * 5));
    const technicalCompletenessScore = Math.max(0, 100 - (technicalCompletenessIssues.filter(i => i.severity === 'critical').length * 15) - (technicalCompletenessIssues.filter(i => i.severity === 'warning').length * 5));

    // Generate recommendations
    const recommendations = generateSuggestions ? await this.generateRecommendations(issues, project) : [];

    return {
      id: `validation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Generate unique ID
      overallScore,
      // Add top-level scores for frontend compatibility
      characterConsistencyScore,
      storyCoherenceScore,
      technicalCompletenessScore,
      summary: {
        totalIssues,
        criticalIssues,
        warningIssues,
        suggestions,
      },
      categories: {
        characterConsistency: {
          score: characterConsistencyScore,
          issues: characterConsistencyIssues,
        },
        storyCoherence: {
          score: storyCoherenceScore,
          issues: storyCoherenceIssues,
        },
        technicalCompleteness: {
          score: technicalCompletenessScore,
          issues: technicalCompletenessIssues,
        },
      },
      recommendations,
    };
  }

  /**
   * Generate actionable recommendations
   */
  private async generateRecommendations(issues: ValidationIssue[], project: any): Promise<Array<{
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    estimatedImpact: string;
  }>> {
    const recommendations = [];

    const criticalIssues = issues.filter(i => i.severity === 'critical');
    const characterIssues = issues.filter(i => i.category.includes('character') || i.category.includes('appearance'));
    const technicalIssues = issues.filter(i => i.category.includes('technical') || i.category.includes('cinematography'));

    if (criticalIssues.length > 0) {
      recommendations.push({
        title: 'Address Critical Issues First',
        description: `There are ${criticalIssues.length} critical issues that need immediate attention. These issues may prevent proper comic generation or result in significant inconsistencies.`,
        priority: 'high' as const,
        estimatedImpact: 'High - Will significantly improve generation quality',
      });
    }

    if (characterIssues.length >= 3) {
      recommendations.push({
        title: 'Improve Character Consistency',
        description: 'Multiple character-related issues detected. Consider creating detailed character appearance profiles and consistency rules to ensure visual coherence across panels.',
        priority: 'high' as const,
        estimatedImpact: 'High - Will ensure consistent character appearance throughout the comic',
      });
    }

    if (technicalIssues.length >= 5) {
      recommendations.push({
        title: 'Enhance Technical Specifications',
        description: 'Many panels lack comprehensive technical details. Adding cinematography specifications, lighting details, and environmental context will improve generation quality.',
        priority: 'medium' as const,
        estimatedImpact: 'Medium - Will enhance visual quality and professional appearance',
      });
    }

    return recommendations;
  }

  /**
   * Save validation report to database
   */
  private async saveValidationReport(request: ScriptValidationRequest, result: ValidationResult): Promise<void> {
    // This would be implemented once the storage methods are added
    console.log(`📊 Validation report would be saved: Score ${result.overallScore}, ${result.summary.totalIssues} issues`);
  }

  // Helper methods for specific validations
  private checkMustIncludeElements(character: Character, mustInclude: string[]): string[] {
    const missing = [];
    const description = (character.visualDescriptors || '').toLowerCase();
    
    for (const element of mustInclude) {
      if (!description.includes(element.toLowerCase())) {
        missing.push(element);
      }
    }
    
    return missing;
  }

  private checkMustNotIncludeElements(character: Character, mustNotInclude: string[]): string[] {
    const forbidden = [];
    const description = (character.visualDescriptors || '').toLowerCase();
    
    for (const element of mustNotInclude) {
      if (description.includes(element.toLowerCase())) {
        forbidden.push(element);
      }
    }
    
    return forbidden;
  }

  private findDescriptionInconsistencies(desc1: string, desc2: string): string[] {
    // Basic implementation - could be enhanced with more sophisticated analysis
    const inconsistencies = [];
    
    // Check for contradictory clothing mentions
    if ((desc1.includes('wearing') && desc2.includes('wearing'))) {
      // This would need more sophisticated analysis
    }
    
    return inconsistencies;
  }

  private async validateNarrativeFlow(structuredScript: FullStructuredScript): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    // Implementation would analyze panel-to-panel flow
    return issues;
  }

  private async validateCharacterBehavior(structuredScript: FullStructuredScript): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    // Implementation would check character consistency in behavior and dialogue
    return issues;
  }

  private async validateTimeline(structuredScript: FullStructuredScript): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    // Implementation would check for timeline inconsistencies
    return issues;
  }

  private async validateSceneTransitions(structuredScript: FullStructuredScript): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    // Implementation would validate scene-to-scene transitions
    return issues;
  }
}