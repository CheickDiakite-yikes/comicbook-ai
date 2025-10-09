import {
  users,
  projects,
  characters,
  pages,
  panels,
  structuredScripts,
  scriptPages,
  scriptPanels,
  scriptDialogue,
  userProfiles,
  projectLikes,
  projectComments,
  userCredits,
  creditTransactions,
  userFeatureEntitlements,
  animationRenderJobs,
  veoSafetyOverrideLogs,
  auditLogs,
  type User,
  type UpsertUser,
  type Project,
  type InsertProject,
  type Character,
  type InsertCharacter,
  type Page,
  type InsertPage,
  type Panel,
  type InsertPanel,
  type StructuredScript,
  type InsertStructuredScript,
  type ScriptPage,
  type InsertScriptPage,
  type ScriptPanel,
  type InsertScriptPanel,
  type ScriptDialogue,
  type InsertScriptDialogue,
  type FullStructuredScript,
  type ScriptPageWithPanels,
  type ScriptPanelWithDialogue,
  type UserProfile,
  type InsertUserProfile,
  type ProjectLike,
  type InsertProjectLike,
  type ProjectComment,
  type InsertProjectComment,
  type UserCredits,
  type InsertUserCredits,
  type CreditTransaction,
  type InsertCreditTransaction,
  type UserFeatureEntitlement,
  type InsertUserFeatureEntitlement,
  type AnimationRenderJob,
  type InsertAnimationRenderJob,
  type VeoSafetyOverrideLog,
  type InsertVeoSafetyOverrideLog,
  type AuditLog,
  type InsertAuditLog,
  type ScriptValidationReport,
  type InsertScriptValidationReport,
  type ValidationIssue,
  type InsertValidationIssue,
  type CharacterConsistencyViolation,
  type InsertCharacterConsistencyViolation,
  type CharacterAppearanceProfile,
  type CharacterConsistencyRule,
  type PanelCharacterState,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, desc, and, sql, count } from "drizzle-orm";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<UpsertUser>): Promise<User | undefined>;

  // Project operations
  createProject(userId: string, project: InsertProject): Promise<Project>;
  getProject(id: string): Promise<Project | undefined>;
  getUserProjects(userId: string): Promise<Project[]>;
  updateProject(id: string, updates: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;

  // Character operations
  createCharacter(character: InsertCharacter): Promise<Character>;
  getCharacter(id: string): Promise<Character | undefined>;
  getProjectCharacters(projectId: string): Promise<Character[]>;
  updateCharacter(id: string, updates: Partial<InsertCharacter>): Promise<Character | undefined>;
  deleteCharacter(id: string): Promise<boolean>;

  // Enhanced Character Profile operations
  createCharacterAppearanceProfile(profile: Partial<CharacterAppearanceProfile>): Promise<CharacterAppearanceProfile>;
  getCharacterAppearanceProfile(characterId: string): Promise<CharacterAppearanceProfile | undefined>;
  updateCharacterAppearanceProfile(characterId: string, updates: Partial<CharacterAppearanceProfile>): Promise<CharacterAppearanceProfile | undefined>;
  
  createCharacterClothingState(clothingState: Partial<any>): Promise<any>;
  getCharacterClothingStates(characterId: string): Promise<any[]>;
  updateCharacterClothingState(id: string, updates: Partial<any>): Promise<any | undefined>;
  
  createCharacterConsistencyRule(rule: Partial<CharacterConsistencyRule>): Promise<CharacterConsistencyRule>;
  getCharacterConsistencyRules(characterId: string): Promise<CharacterConsistencyRule[]>;
  updateCharacterConsistencyRule(id: string, updates: Partial<CharacterConsistencyRule>): Promise<CharacterConsistencyRule | undefined>;

  // Page operations
  createPage(page: InsertPage): Promise<Page>;
  getProjectPages(projectId: string): Promise<Page[]>;
  getPage(id: string): Promise<Page | undefined>;
  updatePage(id: string, updates: Partial<InsertPage>): Promise<Page | undefined>;
  deletePage(id: string): Promise<boolean>;

  // Panel operations
  createPanel(panel: InsertPanel): Promise<Panel>;
  getPanel(id: string): Promise<Panel | undefined>;
  getPagePanels(pageId: string): Promise<Panel[]>;
  updatePanel(id: string, updates: Partial<InsertPanel>): Promise<Panel | undefined>;
  deletePanel(id: string): Promise<boolean>;

  // Global panel operations
  getProjectPanels(projectId: string): Promise<Panel[]>; // Get all panels for a project ordered by global panel number
  calculateNextGlobalPanelNumber(projectId: string): Promise<number>; // Calculate the next global panel number
  recalculateGlobalPanelNumbers(projectId: string): Promise<void>; // Recalculate all global panel numbers for a project
  updatePanelGlobalNumber(panelId: string, globalPanelNumber: number): Promise<Panel | undefined>; // Update specific panel's global number
  
  // Data migration operations
  backfillGlobalPanelNumbers(projectId?: string): Promise<{
    projectsProcessed: number;
    panelsUpdated: number;
    errors: Array<{ projectId: string; error: string }>;
  }>; // Backfill globalPanelNumber for existing projects

  // Structured Script operations
  createStructuredScript(script: InsertStructuredScript): Promise<StructuredScript>;
  getProjectStructuredScript(projectId: string): Promise<FullStructuredScript | undefined>;
  updateStructuredScript(id: string, updates: Partial<InsertStructuredScript>): Promise<StructuredScript | undefined>;
  deleteStructuredScript(id: string): Promise<boolean>;

  // Script Page operations
  createScriptPage(page: InsertScriptPage): Promise<ScriptPage>;
  getScriptPages(scriptId: string): Promise<ScriptPageWithPanels[]>;
  updateScriptPage(id: string, updates: Partial<InsertScriptPage>): Promise<ScriptPage | undefined>;
  deleteScriptPage(id: string): Promise<boolean>;

  // Script Panel operations
  createScriptPanel(panel: InsertScriptPanel): Promise<ScriptPanel>;
  getScriptPanels(pageId: string): Promise<ScriptPanelWithDialogue[]>;
  updateScriptPanel(id: string, updates: Partial<InsertScriptPanel>): Promise<ScriptPanel | undefined>;
  deleteScriptPanel(id: string): Promise<boolean>;

  // Script Dialogue operations
  createScriptDialogue(dialogue: InsertScriptDialogue): Promise<ScriptDialogue>;
  getScriptDialogue(panelId: string): Promise<ScriptDialogue[]>;
  updateScriptDialogue(id: string, updates: Partial<InsertScriptDialogue>): Promise<ScriptDialogue | undefined>;
  deleteScriptDialogue(id: string): Promise<boolean>;

  // Social features operations
  // User profiles
  getUserProfile(userId: string): Promise<UserProfile | undefined>;
  updateUserProfile(userId: string, profile: Partial<InsertUserProfile>): Promise<UserProfile>;

  // AI Credits system
  getCurrentMonthCredits(userId: string): Promise<UserCredits>;
  hasEnoughCredits(userId: string, requiredCredits: number): Promise<boolean>;
  deductCredits(userId: string, operationType: string, creditsToDeduct: number, relatedResourceId?: string, metadata?: any): Promise<{success: boolean, remainingCredits: number}>;
  getCreditTransactions(userId: string, limit?: number): Promise<CreditTransaction[]>;
  resetMonthlyCredits(userId: string, monthlyLimit?: number): Promise<UserCredits>;
  grantBonusCredits(userEmail: string, bonusCredits: number): Promise<{success: boolean, newLimit: number, message: string}>;

  // Feature entitlement operations
  getUserFeatureEntitlements(userId: string): Promise<UserFeatureEntitlement[]>;
  getUserFeatureEntitlement(userId: string, featureKey: string): Promise<UserFeatureEntitlement | undefined>;
  upsertUserFeatureEntitlement(params: InsertUserFeatureEntitlement): Promise<UserFeatureEntitlement>;
  removeUserFeatureEntitlement(userId: string, featureKey: string): Promise<boolean>;
  hasFeatureAccess(userId: string, featureKey: string, allowedPlans?: string[]): Promise<boolean>;

  // Animation render job operations
  createAnimationRenderJob(job: InsertAnimationRenderJob): Promise<AnimationRenderJob>;
  updateAnimationRenderJobStatus(jobId: string, status: string, resultAssetUri?: string | null): Promise<AnimationRenderJob | undefined>;
  getMostRecentAnimationRenderJob(userId: string): Promise<AnimationRenderJob | undefined>;

  // Compliance logging
  logVeoSafetyOverride(entry: InsertVeoSafetyOverrideLog): Promise<VeoSafetyOverrideLog>;
  createAuditLogEntry(entry: InsertAuditLog): Promise<AuditLog>;

  // Public projects
  getPublicProjects(genre?: string): Promise<Array<Project & {
    user: Pick<User, 'id' | 'firstName' | 'lastName'>;
    likesCount: number;
    commentsCount: number;
    isLikedByUser?: boolean;
  }>>;
  getPublicProject(projectId: string): Promise<(Project & { 
    user: Pick<User, 'id' | 'firstName' | 'lastName'>;
    likesCount: number;
    commentsCount: number;
    isLikedByUser?: boolean;
  }) | undefined>;
  getUserProjectsWithStats(userId: string): Promise<Array<Project & {
    likesCount: number;
    commentsCount: number;
    isPublic: boolean;
  }>>;
  
  // Likes
  likeProject(projectId: string, userId: string): Promise<ProjectLike>;
  unlikeProject(projectId: string, userId: string): Promise<boolean>;
  
  // Comments
  getProjectComments(projectId: string): Promise<Array<ProjectComment & {
    user: Pick<User, 'id' | 'firstName' | 'lastName' | 'profileImageUrl'>;
  }>>;
  createProjectComment(comment: InsertProjectComment): Promise<ProjectComment>;

  // Character library operations
  getUserLibraryCharacters(userId: string): Promise<Character[]>;
  createLibraryCharacter(userId: string, character: Omit<InsertCharacter, 'projectId'>): Promise<Character>;
  updateLibraryCharacter(id: string, userId: string, updates: Partial<InsertCharacter>): Promise<Character | undefined>;
  deleteLibraryCharacter(id: string, userId: string): Promise<boolean>;
  copyCharacterToProject(characterId: string, projectId: string, userId: string): Promise<Character>;

  // Script character extraction operations
  getProjectScriptCharacters(projectId: string): Promise<Array<{ name: string; count: number; pageNumbers: number[] }>>;

  // Script Validation operations
  createValidationReport(report: InsertScriptValidationReport): Promise<ScriptValidationReport>;
  getValidationReport(reportId: string): Promise<ScriptValidationReport | undefined>;
  getProjectValidationReports(projectId: string): Promise<ScriptValidationReport[]>;
  createValidationIssue(issue: InsertValidationIssue): Promise<ValidationIssue>;
  getValidationIssues(reportId: string): Promise<ValidationIssue[]>;
  createCharacterConsistencyViolation(violation: InsertCharacterConsistencyViolation): Promise<CharacterConsistencyViolation>;
  getCharacterConsistencyViolations(reportId: string, characterId?: string): Promise<CharacterConsistencyViolation[]>;
  
  // Character consistency operations
  getPanelCharacterStates(panelId: string): Promise<PanelCharacterState[]>;
  getCharacterPanelStates(characterId: string): Promise<PanelCharacterState[]>;
  validateCharacterConsistency(characterId: string, projectId: string): Promise<{
    characterId: string;
    projectId: string;
    consistencyScore: number;
    issues: ValidationIssue[];
    lastValidated: Date;
  }>;
  getCharacterAppearanceHistory(characterId: string, projectId: string): Promise<Array<{
    panelId: string;
    appearance: Partial<PanelCharacterState>;
    timestamp: Date;
  }>>;

  // Enhanced Visual Analysis operations
  createPanelCharacterState(panelCharacterState: Partial<PanelCharacterState>): Promise<PanelCharacterState>;
  updatePanelCharacterState(id: string, updates: Partial<PanelCharacterState>): Promise<PanelCharacterState | undefined>;
  upsertPanelCharacterState(panelId: string, characterId: string, state: Partial<PanelCharacterState>): Promise<PanelCharacterState>;
  
  // Store visual analysis results from VisualContinuityService
  storeVisualAnalysisResults(panelId: string, analysisResults: {
    characters: Array<{
      characterId: string;
      characterName: string;
      isPresent: boolean;
      confidence: number;
      visualDetails?: {
        clothing: {
          upperBody: string;
          lowerBody: string;
          outerwear?: string;
          accessories?: string[];
          colors: string[];
          style: string;
        };
        hair: {
          color: string;
          style: string;
          length: string;
          texture: string;
        };
        physicalAppearance: {
          skinTone: string;
          eyeColor?: string;
          facialExpression: string;
          bodyLanguage: string;
          pose: string;
        };
        accessories: {
          jewelry?: string[];
          glasses?: boolean;
          hat?: string;
          other?: string[];
        };
        location: {
          position: string;
          interaction: string;
        };
      };
    }>;
    rawAnalysisData: any;
    analysisTimestamp: Date;
  }): Promise<PanelCharacterState[]>;

  // Batch visual analysis operations
  getCharacterVisualHistoryDetailed(characterId: string, limit?: number): Promise<Array<{
    panelId: string;
    panelNumber?: number;
    pageNumber?: number;
    appearance: PanelCharacterState;
    timestamp: Date;
    confidenceScore?: number;
    hasVisualAnalysis: boolean;
  }>>;
  
  getProjectCharacterVisualSummary(projectId: string): Promise<Array<{
    characterId: string;
    characterName: string;
    totalAppearances: number;
    averageConfidenceScore: number;
    visualAnalysisCount: number;
    mostCommonClothing: {
      upperBody?: string;
      lowerBody?: string;
      colors: string[];
    };
    consistentFeatures: string[];
    lastAppearancePanel: string;
    lastAnalysisTimestamp?: Date;
  }>>;
  
  // Consistency tracking operations
  identifyVisualInconsistencies(characterId: string, projectId: string): Promise<Array<{
    panelIds: string[];
    inconsistencyType: 'hair' | 'clothing' | 'physical' | 'accessories';
    description: string;
    severity: 'minor' | 'moderate' | 'major';
    expectedValue: string;
    actualValues: string[];
  }>>;
  
  markVisualAnalysisComplete(panelId: string, characterIds: string[]): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private projects: Map<string, Project> = new Map();
  private characters: Map<string, Character> = new Map();
  private pages: Map<string, Page> = new Map();
  private panels: Map<string, Panel> = new Map();
  
  // Validation storage
  private validationReports: Map<string, ScriptValidationReport> = new Map();
  private validationIssues: Map<string, ValidationIssue[]> = new Map();
  private characterConsistencyViolations: Map<string, CharacterConsistencyViolation[]> = new Map();

  // Character consistency storage
  private characterAppearanceProfiles: Map<string, CharacterAppearanceProfile> = new Map();
  private characterConsistencyRules: Map<string, CharacterConsistencyRule[]> = new Map();
  private panelCharacterStates: Map<string, PanelCharacterState[]> = new Map();

  // Feature entitlements & compliance storage
  private featureEntitlements: Map<string, UserFeatureEntitlement[]> = new Map();
  private renderJobs: Map<string, AnimationRenderJob> = new Map();
  private safetyOverrides: Map<string, VeoSafetyOverrideLog> = new Map();
  private auditLogEntries: Map<string, AuditLog> = new Map();

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // First check if user exists by ID (for Google OAuth users with specific IDs)
    if (userData.id) {
      const existingUserById = this.users.get(userData.id);
      if (existingUserById) {
        const updatedUser: User = {
          ...existingUserById,
          ...userData,
          role: userData.role || existingUserById.role || 'user',
          plan: userData.plan || existingUserById.plan || 'free',
          updatedAt: new Date(),
        };
        this.users.set(existingUserById.id, updatedUser);
        return updatedUser;
      }
    }

    // Then check if user exists by email (for existing users)
    const existingUserByEmail = Array.from(this.users.values()).find(u => u.email === userData.email);
    if (existingUserByEmail) {
      const updatedUser: User = {
        ...existingUserByEmail,
        ...userData,
        id: userData.id || existingUserByEmail.id, // Preserve provided ID or keep existing ID
        role: userData.role || existingUserByEmail.role || 'user',
        plan: userData.plan || existingUserByEmail.plan || 'free',
        updatedAt: new Date(),
      };
      // If ID changed, remove old entry and add new one
      if (userData.id && userData.id !== existingUserByEmail.id) {
        this.users.delete(existingUserByEmail.id);
      }
      this.users.set(updatedUser.id, updatedUser);
      return updatedUser;
    }

    // Create new user, using provided ID or generating one
    const user: User = {
      id: userData.id || randomUUID(),
      email: userData.email || null,
      firstName: userData.firstName || null,
      lastName: userData.lastName || null,
      profileImageUrl: userData.profileImageUrl || null,
      role: userData.role || 'user',
      plan: userData.plan || 'free',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(user.id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<UpsertUser>): Promise<User | undefined> {
    const existingUser = this.users.get(id);
    if (!existingUser) return undefined;
    
    const updatedUser: User = {
      ...existingUser,
      ...updates,
      updatedAt: new Date(),
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // Project operations
  async createProject(userId: string, projectData: InsertProject): Promise<Project> {
    const project: Project = {
      id: randomUUID(),
      userId,
      title: projectData.title,
      description: projectData.description || null,
      genre: projectData.genre || null,
      userSelectedGenres: projectData.userSelectedGenres || null,
      artStyle: projectData.artStyle || null,
      script: projectData.script || null,
      settings: projectData.settings || null,
      canonRules: projectData.canonRules || null,
      coverArt: null,
      isPublic: projectData.isPublic || false,
      publicDescription: projectData.publicDescription || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.projects.set(project.id, project);
    return project;
  }

  async getProject(id: string): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async getUserProjects(userId: string): Promise<Project[]> {
    return Array.from(this.projects.values()).filter(p => p.userId === userId);
  }

  async updateProject(id: string, updates: Partial<InsertProject>): Promise<Project | undefined> {
    const project = this.projects.get(id);
    if (!project) return undefined;

    const updatedProject: Project = {
      ...project,
      ...updates,
      updatedAt: new Date(),
    };
    this.projects.set(id, updatedProject);
    return updatedProject;
  }

  async deleteProject(id: string): Promise<boolean> {
    return this.projects.delete(id);
  }

  // Character operations
  async createCharacter(characterData: InsertCharacter): Promise<Character> {
    const character: Character = {
      id: randomUUID(),
      projectId: characterData.projectId || null,
      userId: characterData.userId || null,
      name: characterData.name,
      role: characterData.role || null,
      bio: characterData.bio || null,
      visualDescriptors: characterData.visualDescriptors || null,
      alwaysTraits: characterData.alwaysTraits || null,
      neverTraits: characterData.neverTraits || null,
      referenceImageUrl: characterData.referenceImageUrl || null,
      colorScheme: characterData.colorScheme || null,
      isLibraryCharacter: characterData.isLibraryCharacter || false,
      createdAt: new Date(),
    };
    this.characters.set(character.id, character);
    return character;
  }

  async getCharacter(id: string): Promise<Character | undefined> {
    return this.characters.get(id);
  }

  async getProjectCharacters(projectId: string): Promise<Character[]> {
    return Array.from(this.characters.values()).filter(c => c.projectId === projectId);
  }

  async updateCharacter(id: string, updates: Partial<InsertCharacter>): Promise<Character | undefined> {
    const character = this.characters.get(id);
    if (!character) return undefined;

    const updatedCharacter: Character = { ...character, ...updates };
    this.characters.set(id, updatedCharacter);
    return updatedCharacter;
  }

  async deleteCharacter(id: string): Promise<boolean> {
    return this.characters.delete(id);
  }

  // Page operations
  async createPage(pageData: InsertPage): Promise<Page> {
    const page: Page = {
      id: randomUUID(),
      projectId: pageData.projectId,
      pageNumber: pageData.pageNumber,
      layoutTemplate: pageData.layoutTemplate,
      backgroundImageUrl: pageData.backgroundImageUrl || null,
      panels: pageData.panels || null,
      scriptSnippet: pageData.scriptSnippet || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.pages.set(page.id, page);
    return page;
  }

  async getProjectPages(projectId: string): Promise<Page[]> {
    return Array.from(this.pages.values())
      .filter(p => p.projectId === projectId)
      .sort((a, b) => a.pageNumber - b.pageNumber);
  }

  async getPage(id: string): Promise<Page | undefined> {
    return this.pages.get(id);
  }

  async updatePage(id: string, updates: Partial<InsertPage>): Promise<Page | undefined> {
    const page = this.pages.get(id);
    if (!page) return undefined;

    // Check if pageNumber changed
    const pageOrderChanged = updates.pageNumber !== undefined && updates.pageNumber !== page.pageNumber;

    const updatedPage: Page = {
      ...page,
      ...updates,
      updatedAt: new Date(),
    };
    this.pages.set(id, updatedPage);
    
    // Trigger recalculation if page order changed
    if (pageOrderChanged) {
      await this.recalculateGlobalPanelNumbers(updatedPage.projectId);
    }
    
    return updatedPage;
  }

  async deletePage(id: string): Promise<boolean> {
    const page = this.pages.get(id);
    if (!page) return false;
    
    const projectId = page.projectId;
    
    // Delete all panels associated with this page
    const panelsToDelete = Array.from(this.panels.values()).filter(p => p.pageId === id);
    panelsToDelete.forEach(panel => this.panels.delete(panel.id));
    
    // Delete the page
    const success = this.pages.delete(id);
    
    // Trigger recalculation if deletion was successful
    if (success) {
      await this.recalculateGlobalPanelNumbers(projectId);
    }
    
    return success;
  }

  // Panel operations
  async createPanel(panelData: InsertPanel): Promise<Panel> {
    // Calculate global panel number for this project
    const page = this.pages.get(panelData.pageId);
    const globalPanelNumber = page ? await this.calculateNextGlobalPanelNumber(page.projectId) : null;
    
    const panel: Panel = {
      id: randomUUID(),
      pageId: panelData.pageId,
      panelNumber: panelData.panelNumber,
      globalPanelNumber,
      prompt: panelData.prompt || null,
      imageUrl: panelData.imageUrl || null,
      speechBubbles: panelData.speechBubbles || null,
      isGenerated: panelData.isGenerated || false,
      generationStatus: panelData.generationStatus || "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.panels.set(panel.id, panel);
    
    // Trigger full resequencing to maintain chronological order
    if (page) {
      await this.recalculateGlobalPanelNumbers(page.projectId);
    }
    
    return panel;
  }

  async getPanel(id: string): Promise<Panel | undefined> {
    return this.panels.get(id);
  }

  async getPagePanels(pageId: string): Promise<Panel[]> {
    return Array.from(this.panels.values())
      .filter(p => p.pageId === pageId)
      .sort((a, b) => a.panelNumber - b.panelNumber);
  }

  async updatePanel(id: string, updates: Partial<InsertPanel>): Promise<Panel | undefined> {
    const panel = this.panels.get(id);
    if (!panel) return undefined;

    // Check if panelNumber or pageId changed
    const panelOrderChanged = (
      updates.panelNumber !== undefined && updates.panelNumber !== panel.panelNumber
    ) || (
      updates.pageId !== undefined && updates.pageId !== panel.pageId
    );

    const updatedPanel: Panel = {
      ...panel,
      ...updates,
      updatedAt: new Date(),
    };
    this.panels.set(id, updatedPanel);
    
    // Trigger recalculation if panel order changed
    if (panelOrderChanged) {
      const page = this.pages.get(updatedPanel.pageId);
      if (page) {
        await this.recalculateGlobalPanelNumbers(page.projectId);
      }
    }
    
    return updatedPanel;
  }

  async deletePanel(id: string): Promise<boolean> {
    const panel = this.panels.get(id);
    if (!panel) return false;
    
    const page = this.pages.get(panel.pageId);
    const success = this.panels.delete(id);
    
    // Trigger recalculation if deletion was successful
    if (success && page) {
      await this.recalculateGlobalPanelNumbers(page.projectId);
    }
    
    return success;
  }

  // Global panel operations
  async getProjectPanels(projectId: string): Promise<Panel[]> {
    const projectPages = Array.from(this.pages.values()).filter(p => p.projectId === projectId);
    const pageIds = new Set(projectPages.map(p => p.id));
    
    return Array.from(this.panels.values())
      .filter(p => pageIds.has(p.pageId))
      .sort((a, b) => {
        // Deterministic sort: null globalPanelNumbers go to end using Infinity
        const aGlobal = a.globalPanelNumber ?? Infinity;
        const bGlobal = b.globalPanelNumber ?? Infinity;
        
        if (aGlobal !== bGlobal) {
          return aGlobal - bGlobal;
        }
        
        // Stable secondary sort by page number, then panel number
        const pageA = this.pages.get(a.pageId);
        const pageB = this.pages.get(b.pageId);
        if (pageA && pageB && pageA.pageNumber !== pageB.pageNumber) {
          return pageA.pageNumber - pageB.pageNumber;
        }
        return a.panelNumber - b.panelNumber;
      });
  }

  async calculateNextGlobalPanelNumber(projectId: string): Promise<number> {
    try {
      const projectPanels = await this.getProjectPanels(projectId);
      
      // Handle empty projects safely
      if (projectPanels.length === 0) {
        return 1;
      }
      
      // Filter out null values and find max
      const validNumbers = projectPanels
        .map(p => p.globalPanelNumber)
        .filter((num): num is number => num !== null);
      
      const maxGlobalNumber = validNumbers.length > 0 ? Math.max(...validNumbers) : 0;
      return maxGlobalNumber + 1;
    } catch (error) {
      console.error(`MemStorage: Error calculating next global panel number for project ${projectId}:`, error);
      return 1; // Safe fallback
    }
  }

  async recalculateGlobalPanelNumbers(projectId: string): Promise<void> {
    try {
      // Get project pages for sorting reference
      const projectPages = Array.from(this.pages.values()).filter(p => p.projectId === projectId);
      const pageIds = new Set(projectPages.map(p => p.id));
      
      // Get panels and sort deterministically by page number, then panel number
      const projectPanels = Array.from(this.panels.values())
        .filter(p => pageIds.has(p.pageId))
        .map(panel => {
          const page = this.pages.get(panel.pageId);
          if (!page) {
            throw new Error(`Page not found for panel ${panel.id}`);
          }
          return { panel, page };
        })
        .sort((a, b) => {
          if (a.page.pageNumber !== b.page.pageNumber) {
            return a.page.pageNumber - b.page.pageNumber;
          }
          return a.panel.panelNumber - b.panel.panelNumber;
        });

      // Assign sequential global panel numbers (1..N)
      for (let i = 0; i < projectPanels.length; i++) {
        const { panel } = projectPanels[i];
        const updatedPanel: Panel = {
          ...panel,
          globalPanelNumber: i + 1,
          updatedAt: new Date(),
        };
        this.panels.set(panel.id, updatedPanel);
      }
    } catch (error) {
      console.error(`MemStorage: Error recalculating global panel numbers for project ${projectId}:`, error);
      throw error; // Re-throw to ensure calling code knows about the failure
    }
  }

  async updatePanelGlobalNumber(panelId: string, globalPanelNumber: number): Promise<Panel | undefined> {
    const panel = this.panels.get(panelId);
    if (!panel) return undefined;

    const updatedPanel: Panel = {
      ...panel,
      globalPanelNumber,
      updatedAt: new Date(),
    };
    this.panels.set(panelId, updatedPanel);
    
    // Trigger full re-sequencing to maintain 1..N contiguity
    const page = this.pages.get(panel.pageId);
    if (page) {
      await this.recalculateGlobalPanelNumbers(page.projectId);
    }
    
    return updatedPanel;
  }

  // Data migration operations for MemStorage
  async backfillGlobalPanelNumbers(projectId?: string): Promise<{
    projectsProcessed: number;
    panelsUpdated: number;
    errors: Array<{ projectId: string; error: string }>;
  }> {
    const errors: Array<{ projectId: string; error: string }> = [];
    let projectsProcessed = 0;
    let panelsUpdated = 0;

    try {
      // Get all projects or just the specified one
      const projectsToProcess = projectId
        ? Array.from(this.projects.values()).filter(p => p.id === projectId)
        : Array.from(this.projects.values());

      console.log(`🔄 MemStorage: Starting global panel number backfill for ${projectsToProcess.length} projects...`);

      for (const project of projectsToProcess) {
        try {
          console.log(`🔄 MemStorage: Processing project ${project.id} (${project.title})`);
          
          // Get all panels for this project ordered by page number, then panel number
          const projectPages = Array.from(this.pages.values()).filter(p => p.projectId === project.id);
          const pageIds = new Set(projectPages.map(p => p.id));
          
          const projectPanels = Array.from(this.panels.values())
            .filter(p => pageIds.has(p.pageId))
            .map(panel => {
              const page = this.pages.get(panel.pageId)!;
              return { panel, page };
            })
            .sort((a, b) => {
              if (a.page.pageNumber !== b.page.pageNumber) {
                return a.page.pageNumber - b.page.pageNumber;
              }
              return a.panel.panelNumber - b.panel.panelNumber;
            });

          if (projectPanels.length === 0) {
            console.log(`  ⚠️  MemStorage: No panels found for project ${project.id}`);
            continue;
          }

          // Update each panel with sequential global panel numbers
          let updateCount = 0;
          for (let i = 0; i < projectPanels.length; i++) {
            const { panel } = projectPanels[i];
            const newGlobalNumber = i + 1;
            
            // Only update if the number is different to avoid unnecessary operations
            if (panel.globalPanelNumber !== newGlobalNumber) {
              const updatedPanel: Panel = {
                ...panel,
                globalPanelNumber: newGlobalNumber,
                updatedAt: new Date(),
              };
              this.panels.set(panel.id, updatedPanel);
              updateCount++;
            }
          }
          
          console.log(`  ✅ MemStorage: Updated ${updateCount}/${projectPanels.length} panels for project ${project.id}`);
          panelsUpdated += updateCount;
          projectsProcessed++;
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`  ❌ MemStorage: Error processing project ${project.id}:`, errorMessage);
          errors.push({ projectId: project.id, error: errorMessage });
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`MemStorage: Critical error during backfill: ${errorMessage}`);
    }

    console.log(`🎉 MemStorage: Backfill completed. Processed ${projectsProcessed} projects, updated ${panelsUpdated} panels, ${errors.length} errors`);
    
    return {
      projectsProcessed,
      panelsUpdated,
      errors,
    };
  }

  // Structured Script operations - Not implemented in MemStorage
  async createStructuredScript(script: InsertStructuredScript): Promise<StructuredScript> {
    throw new Error("Structured scripts not implemented in MemStorage");
  }

  async getProjectStructuredScript(projectId: string): Promise<FullStructuredScript | undefined> {
    throw new Error("Structured scripts not implemented in MemStorage");
  }

  async updateStructuredScript(id: string, updates: Partial<InsertStructuredScript>): Promise<StructuredScript | undefined> {
    throw new Error("Structured scripts not implemented in MemStorage");
  }

  async deleteStructuredScript(id: string): Promise<boolean> {
    throw new Error("Structured scripts not implemented in MemStorage");
  }

  async createScriptPage(page: InsertScriptPage): Promise<ScriptPage> {
    throw new Error("Structured scripts not implemented in MemStorage");
  }

  async getScriptPages(scriptId: string): Promise<ScriptPageWithPanels[]> {
    throw new Error("Structured scripts not implemented in MemStorage");
  }

  async updateScriptPage(id: string, updates: Partial<InsertScriptPage>): Promise<ScriptPage | undefined> {
    throw new Error("Structured scripts not implemented in MemStorage");
  }

  async deleteScriptPage(id: string): Promise<boolean> {
    throw new Error("Structured scripts not implemented in MemStorage");
  }

  async createScriptPanel(panel: InsertScriptPanel): Promise<ScriptPanel> {
    throw new Error("Structured scripts not implemented in MemStorage");
  }

  async getScriptPanels(pageId: string): Promise<ScriptPanelWithDialogue[]> {
    throw new Error("Structured scripts not implemented in MemStorage");
  }

  async updateScriptPanel(id: string, updates: Partial<InsertScriptPanel>): Promise<ScriptPanel | undefined> {
    throw new Error("Structured scripts not implemented in MemStorage");
  }

  async deleteScriptPanel(id: string): Promise<boolean> {
    throw new Error("Structured scripts not implemented in MemStorage");
  }

  async createScriptDialogue(dialogue: InsertScriptDialogue): Promise<ScriptDialogue> {
    throw new Error("Structured scripts not implemented in MemStorage");
  }

  async getScriptDialogue(panelId: string): Promise<ScriptDialogue[]> {
    throw new Error("Structured scripts not implemented in MemStorage");
  }

  async updateScriptDialogue(id: string, updates: Partial<InsertScriptDialogue>): Promise<ScriptDialogue | undefined> {
    throw new Error("Structured scripts not implemented in MemStorage");
  }

  async deleteScriptDialogue(id: string): Promise<boolean> {
    throw new Error("Structured scripts not implemented in MemStorage");
  }

  // Social features placeholder methods for MemStorage
  async getUserProfile(userId: string): Promise<UserProfile | undefined> {
    return undefined; // Not implemented for in-memory storage
  }

  async updateUserProfile(userId: string, profile: Partial<InsertUserProfile>): Promise<UserProfile> {
    throw new Error("Social features not implemented for in-memory storage");
  }

  // AI Credits placeholder methods for MemStorage
  async getCurrentMonthCredits(userId: string): Promise<UserCredits> {
    const now = new Date();
    return {
      id: "mem-credits",
      userId: userId,
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      creditsUsed: 0,
      monthlyLimit: 200,
      createdAt: now,
      updatedAt: now,
    };
  }

  async hasEnoughCredits(userId: string, requiredCredits: number): Promise<boolean> {
    return true; // Allow all operations in MemStorage
  }

  async deductCredits(userId: string, operationType: string, creditsToDeduct: number, relatedResourceId?: string, metadata?: any): Promise<{success: boolean, remainingCredits: number}> {
    return { success: true, remainingCredits: 200 }; // Simulate success in MemStorage
  }

  async getCreditTransactions(userId: string, limit?: number): Promise<CreditTransaction[]> {
    return []; // No transaction history in MemStorage
  }

  async resetMonthlyCredits(userId: string, monthlyLimit: number = 200): Promise<UserCredits> {
    return this.getCurrentMonthCredits(userId);
  }

  async grantBonusCredits(userEmail: string, bonusCredits: number): Promise<{success: boolean, newLimit: number, message: string}> {
    // MemStorage implementation (for testing only)
    return {
      success: true,
      newLimit: 200 + bonusCredits,
      message: `MemStorage: Would grant ${bonusCredits} credits to ${userEmail}`
    };
  }

  async getUserFeatureEntitlements(userId: string): Promise<UserFeatureEntitlement[]> {
    return this.featureEntitlements.get(userId) ?? [];
  }

  async getUserFeatureEntitlement(userId: string, featureKey: string): Promise<UserFeatureEntitlement | undefined> {
    return (this.featureEntitlements.get(userId) ?? []).find(ent => ent.featureKey === featureKey);
  }

  async upsertUserFeatureEntitlement(params: InsertUserFeatureEntitlement): Promise<UserFeatureEntitlement> {
    const list = this.featureEntitlements.get(params.userId) ?? [];
    const now = new Date();
    const existingIndex = list.findIndex(ent => ent.featureKey === params.featureKey);

    if (existingIndex >= 0) {
      const existing = list[existingIndex];
      const updated: UserFeatureEntitlement = {
        ...existing,
        ...params,
        metadata: params.metadata ?? existing.metadata ?? null,
        grantedBy: params.grantedBy ?? existing.grantedBy ?? null,
        grantedReason: params.grantedReason ?? existing.grantedReason ?? null,
        updatedAt: now,
      };
      list[existingIndex] = updated;
      this.featureEntitlements.set(params.userId, list);
      return updated;
    }

    const record: UserFeatureEntitlement = {
      id: randomUUID(),
      userId: params.userId,
      featureKey: params.featureKey,
      isEnabled: params.isEnabled ?? false,
      plan: params.plan ?? null,
      isAdminOverride: params.isAdminOverride ?? false,
      grantedBy: params.grantedBy ?? null,
      grantedReason: params.grantedReason ?? null,
      metadata: params.metadata ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.featureEntitlements.set(params.userId, [...list, record]);
    return record;
  }

  async removeUserFeatureEntitlement(userId: string, featureKey: string): Promise<boolean> {
    const list = this.featureEntitlements.get(userId);
    if (!list) return false;
    const next = list.filter(ent => ent.featureKey !== featureKey);
    this.featureEntitlements.set(userId, next);
    return next.length !== list.length;
  }

  async hasFeatureAccess(userId: string, featureKey: string, allowedPlans: string[] = []): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user) return false;
    if ((user.role ?? 'user') === 'admin') {
      return true;
    }

    if (allowedPlans.length > 0 && allowedPlans.includes(user.plan ?? '')) {
      return true;
    }

    const entitlement = await this.getUserFeatureEntitlement(userId, featureKey);
    if (!entitlement) {
      return false;
    }

    if (entitlement.isAdminOverride) {
      return true;
    }

    if (entitlement.isEnabled) {
      return true;
    }

    if (entitlement.plan && entitlement.plan === user.plan) {
      return true;
    }

    return false;
  }

  async createAnimationRenderJob(job: InsertAnimationRenderJob): Promise<AnimationRenderJob> {
    const now = new Date();
    const record: AnimationRenderJob = {
      id: randomUUID(),
      userId: job.userId,
      prompt: job.prompt,
      promptDiff: job.promptDiff ?? null,
      model: job.model ?? null,
      settings: job.settings ?? null,
      status: job.status ?? 'pending',
      resultAssetUri: job.resultAssetUri ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.renderJobs.set(record.id, record);
    return record;
  }

  async updateAnimationRenderJobStatus(jobId: string, status: string, resultAssetUri?: string | null): Promise<AnimationRenderJob | undefined> {
    const existing = this.renderJobs.get(jobId);
    if (!existing) return undefined;

    const updated: AnimationRenderJob = {
      ...existing,
      status,
      resultAssetUri: resultAssetUri ?? existing.resultAssetUri,
      updatedAt: new Date(),
    };
    this.renderJobs.set(jobId, updated);
    return updated;
  }

  async getMostRecentAnimationRenderJob(userId: string): Promise<AnimationRenderJob | undefined> {
    const jobs = Array.from(this.renderJobs.values()).filter(job => job.userId === userId);
    return jobs.sort((a, b) => (b.createdAt?.getTime?.() ?? 0) - (a.createdAt?.getTime?.() ?? 0))[0];
  }

  async logVeoSafetyOverride(entry: InsertVeoSafetyOverrideLog): Promise<VeoSafetyOverrideLog> {
    const record: VeoSafetyOverrideLog = {
      id: randomUUID(),
      renderJobId: entry.renderJobId ?? null,
      userId: entry.userId,
      justification: entry.justification ?? null,
      requestedSettings: entry.requestedSettings,
      defaultSettings: entry.defaultSettings,
      createdAt: new Date(),
    };
    this.safetyOverrides.set(record.id, record);
    return record;
  }

  async createAuditLogEntry(entry: InsertAuditLog): Promise<AuditLog> {
    const record: AuditLog = {
      id: randomUUID(),
      userId: entry.userId ?? null,
      action: entry.action,
      resourceType: entry.resourceType ?? null,
      resourceId: entry.resourceId ?? null,
      metadata: entry.metadata ?? null,
      createdAt: new Date(),
    };
    this.auditLogEntries.set(record.id, record);
    return record;
  }

  async getPublicProjects(genre?: string): Promise<any[]> {
    return []; // Not implemented for in-memory storage
  }

  async getPublicProject(projectId: string): Promise<any | undefined> {
    return undefined; // Not implemented for in-memory storage
  }

  async getUserProjectsWithStats(userId: string): Promise<any[]> {
    return []; // Not implemented for in-memory storage
  }

  async likeProject(projectId: string, userId: string): Promise<ProjectLike> {
    throw new Error("Social features not implemented for in-memory storage");
  }

  async unlikeProject(projectId: string, userId: string): Promise<boolean> {
    return false; // Not implemented for in-memory storage
  }

  async getProjectComments(projectId: string): Promise<any[]> {
    return []; // Not implemented for in-memory storage
  }

  async createProjectComment(comment: InsertProjectComment): Promise<ProjectComment> {
    throw new Error("Social features not implemented for in-memory storage");
  }

  // Character library placeholder methods for MemStorage
  async getUserLibraryCharacters(userId: string): Promise<Character[]> {
    return []; // Not implemented for in-memory storage
  }

  async createLibraryCharacter(userId: string, character: Omit<InsertCharacter, 'projectId'>): Promise<Character> {
    throw new Error("Character library not implemented for in-memory storage");
  }

  async updateLibraryCharacter(id: string, userId: string, updates: Partial<InsertCharacter>): Promise<Character | undefined> {
    return undefined; // Not implemented for in-memory storage
  }

  async deleteLibraryCharacter(id: string, userId: string): Promise<boolean> {
    return false; // Not implemented for in-memory storage
  }

  async copyCharacterToProject(characterId: string, projectId: string, userId: string): Promise<Character> {
    throw new Error("Character library not implemented for in-memory storage");
  }

  // Script character extraction - Not implemented for in-memory storage
  async getProjectScriptCharacters(projectId: string): Promise<Array<{ name: string; count: number; pageNumbers: number[] }>> {
    throw new Error("Script character extraction not implemented for in-memory storage");
  }

  // Enhanced Character Profile operations - Not implemented for in-memory storage
  async createCharacterAppearanceProfile(profile: any): Promise<any> {
    throw new Error("Enhanced character profiles not implemented for in-memory storage");
  }

  async getCharacterAppearanceProfile(characterId: string): Promise<any | undefined> {
    return undefined;
  }

  async updateCharacterAppearanceProfile(characterId: string, updates: any): Promise<any | undefined> {
    return undefined;
  }
  
  async createCharacterClothingState(clothingState: any): Promise<any> {
    throw new Error("Enhanced character profiles not implemented for in-memory storage");
  }

  async getCharacterClothingStates(characterId: string): Promise<any[]> {
    return [];
  }

  async updateCharacterClothingState(id: string, updates: any): Promise<any | undefined> {
    return undefined;
  }
  
  async createCharacterConsistencyRule(rule: any): Promise<any> {
    throw new Error("Enhanced character profiles not implemented for in-memory storage");
  }

  async getCharacterConsistencyRules(characterId: string): Promise<any[]> {
    return [];
  }

  async updateCharacterConsistencyRule(id: string, updates: any): Promise<any | undefined> {
    return undefined;
  }

  // Script Validation operations - MemStorage implementation
  async createValidationReport(reportData: InsertScriptValidationReport): Promise<ScriptValidationReport> {
    const report: ScriptValidationReport = {
      id: randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
      status: reportData.status || null,
      projectId: reportData.projectId,
      structuredScriptId: reportData.structuredScriptId || null,
      validationType: reportData.validationType,
      overallScore: reportData.overallScore,
      validationResults: reportData.validationResults || null,
      recommendationsCount: reportData.recommendationsCount || null,
      criticalIssuesCount: reportData.criticalIssuesCount || null,
      warningIssuesCount: reportData.warningIssuesCount || null,
    };
    this.validationReports.set(report.id, report);
    return report;
  }

  async getValidationReport(reportId: string): Promise<ScriptValidationReport | undefined> {
    return this.validationReports.get(reportId);
  }

  async getProjectValidationReports(projectId: string): Promise<ScriptValidationReport[]> {
    return Array.from(this.validationReports.values())
      .filter(report => report.projectId === projectId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async createValidationIssue(issueData: InsertValidationIssue): Promise<ValidationIssue> {
    const issue: ValidationIssue = {
      id: randomUUID(),
      createdAt: new Date(),
      title: issueData.title,
      description: issueData.description,
      reportId: issueData.reportId,
      issueType: issueData.issueType,
      severity: issueData.severity,
      category: issueData.category,
      suggestion: issueData.suggestion || null,
      affectedElements: issueData.affectedElements || null,
      confidence: issueData.confidence || null,
      isResolved: issueData.isResolved || null,
    };
    
    if (!this.validationIssues.has(issue.reportId)) {
      this.validationIssues.set(issue.reportId, []);
    }
    this.validationIssues.get(issue.reportId)!.push(issue);
    return issue;
  }

  async getValidationIssues(reportId: string): Promise<ValidationIssue[]> {
    return this.validationIssues.get(reportId) || [];
  }

  async createCharacterConsistencyViolation(violationData: InsertCharacterConsistencyViolation): Promise<CharacterConsistencyViolation> {
    const violation: CharacterConsistencyViolation = {
      id: randomUUID(),
      createdAt: new Date(),
      description: violationData.description,
      characterId: violationData.characterId,
      pageNumber: violationData.pageNumber || null,
      panelNumber: violationData.panelNumber || null,
      reportId: violationData.reportId,
      severity: violationData.severity,
      characterName: violationData.characterName,
      ruleId: violationData.ruleId || null,
      violationType: violationData.violationType,
      panelIds: violationData.panelIds || null,
      expectedValue: violationData.expectedValue || null,
      actualValue: violationData.actualValue || null,
    };
    
    if (!this.characterConsistencyViolations.has(violation.reportId)) {
      this.characterConsistencyViolations.set(violation.reportId, []);
    }
    this.characterConsistencyViolations.get(violation.reportId)!.push(violation);
    return violation;
  }

  async getCharacterConsistencyViolations(reportId: string, characterId?: string): Promise<CharacterConsistencyViolation[]> {
    const violations = this.characterConsistencyViolations.get(reportId) || [];
    if (characterId) {
      return violations.filter(v => v.characterId === characterId);
    }
    return violations;
  }

  // Character consistency operations
  async getPanelCharacterStates(panelId: string): Promise<PanelCharacterState[]> {
    return this.panelCharacterStates.get(panelId) || [];
  }

  async getCharacterPanelStates(characterId: string): Promise<PanelCharacterState[]> {
    const allStates: PanelCharacterState[] = [];
    for (const states of Array.from(this.panelCharacterStates.values())) {
      allStates.push(...states.filter((state: PanelCharacterState) => state.characterId === characterId));
    }
    return allStates.sort((a, b) => {
      const aTime = a.createdAt?.getTime() || 0;
      const bTime = b.createdAt?.getTime() || 0;
      return aTime - bTime;
    });
  }

  async validateCharacterConsistency(characterId: string, projectId: string): Promise<{
    characterId: string;
    projectId: string;
    consistencyScore: number;
    issues: ValidationIssue[];
    lastValidated: Date;
  }> {
    // This would implement character consistency validation logic
    // For now, return placeholder data
    return {
      characterId,
      projectId,
      consistencyScore: 85,
      issues: [],
      lastValidated: new Date(),
    };
  }

  async getCharacterAppearanceHistory(characterId: string, projectId: string): Promise<Array<{
    panelId: string;
    appearance: Partial<PanelCharacterState>;
    timestamp: Date;
  }>> {
    // Get all panel states for this character in chronological order
    const panelStates = await this.getCharacterPanelStates(characterId);
    return panelStates.map(state => ({
      panelId: state.panelId,
      appearance: {
        emotion: state.emotion,
        facialExpression: state.facialExpression,
        bodyLanguage: state.bodyLanguage,
        position: state.position,
        pose: state.pose,
        visibility: state.visibility,
        lightingCondition: state.lightingCondition,
        temporaryChanges: state.temporaryChanges,
        injuriesVisible: state.injuriesVisible,
      },
      timestamp: state.createdAt || new Date(),
    }));
  }

  // Enhanced Visual Analysis operations - MemStorage implementation
  async createPanelCharacterState(panelCharacterStateData: Partial<PanelCharacterState>): Promise<PanelCharacterState> {
    const panelCharacterState: PanelCharacterState = {
      id: randomUUID(),
      panelId: panelCharacterStateData.panelId || '',
      characterId: panelCharacterStateData.characterId || '',
      clothingStateId: panelCharacterStateData.clothingStateId || null,
      isPresent: panelCharacterStateData.isPresent || null,
      confidenceScore: panelCharacterStateData.confidenceScore || null,
      detectedUpperBody: panelCharacterStateData.detectedUpperBody || null,
      detectedLowerBody: panelCharacterStateData.detectedLowerBody || null,
      detectedOuterwear: panelCharacterStateData.detectedOuterwear || null,
      detectedClothingColors: panelCharacterStateData.detectedClothingColors || null,
      detectedClothingStyle: panelCharacterStateData.detectedClothingStyle || null,
      detectedClothingAccessories: panelCharacterStateData.detectedClothingAccessories || null,
      detectedHairColor: panelCharacterStateData.detectedHairColor || null,
      detectedHairStyle: panelCharacterStateData.detectedHairStyle || null,
      detectedHairLength: panelCharacterStateData.detectedHairLength || null,
      detectedHairTexture: panelCharacterStateData.detectedHairTexture || null,
      detectedSkinTone: panelCharacterStateData.detectedSkinTone || null,
      detectedEyeColor: panelCharacterStateData.detectedEyeColor || null,
      detectedJewelry: panelCharacterStateData.detectedJewelry || null,
      detectedGlasses: panelCharacterStateData.detectedGlasses || null,
      detectedHat: panelCharacterStateData.detectedHat || null,
      detectedOtherAccessories: panelCharacterStateData.detectedOtherAccessories || null,
      emotion: panelCharacterStateData.emotion || null,
      facialExpression: panelCharacterStateData.facialExpression || null,
      bodyLanguage: panelCharacterStateData.bodyLanguage || null,
      position: panelCharacterStateData.position || null,
      pose: panelCharacterStateData.pose || null,
      detectedPose: panelCharacterStateData.detectedPose || null,
      facingDirection: panelCharacterStateData.facingDirection || null,
      visibility: panelCharacterStateData.visibility || null,
      screenPosition: panelCharacterStateData.screenPosition || null,
      detectedScreenPosition: panelCharacterStateData.detectedScreenPosition || null,
      detectedInteraction: panelCharacterStateData.detectedInteraction || null,
      lightingCondition: panelCharacterStateData.lightingCondition || null,
      visualEffects: panelCharacterStateData.visualEffects || null,
      temporaryChanges: panelCharacterStateData.temporaryChanges || null,
      injuriesVisible: panelCharacterStateData.injuriesVisible || null,
      interactingWith: panelCharacterStateData.interactingWith || null,
      proximityToOthers: panelCharacterStateData.proximityToOthers || null,
      generationPrompt: panelCharacterStateData.generationPrompt || null,
      consistencyNotes: panelCharacterStateData.consistencyNotes || null,
      visualAnalysisPerformed: panelCharacterStateData.visualAnalysisPerformed || null,
      visualAnalysisTimestamp: panelCharacterStateData.visualAnalysisTimestamp || null,
      visualAnalysisRawData: panelCharacterStateData.visualAnalysisRawData || null,
      consistencyViolations: panelCharacterStateData.consistencyViolations || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store in the panelCharacterStates map
    if (!this.panelCharacterStates.has(panelCharacterState.panelId)) {
      this.panelCharacterStates.set(panelCharacterState.panelId, []);
    }
    this.panelCharacterStates.get(panelCharacterState.panelId)!.push(panelCharacterState);

    return panelCharacterState;
  }

  async updatePanelCharacterState(id: string, updates: Partial<PanelCharacterState>): Promise<PanelCharacterState | undefined> {
    // Find the character state in all panels
    for (const [panelId, states] of this.panelCharacterStates.entries()) {
      const stateIndex = states.findIndex(state => state.id === id);
      if (stateIndex !== -1) {
        const updatedState = {
          ...states[stateIndex],
          ...updates,
          updatedAt: new Date(),
        };
        states[stateIndex] = updatedState;
        return updatedState;
      }
    }
    return undefined;
  }

  async upsertPanelCharacterState(panelId: string, characterId: string, state: Partial<PanelCharacterState>): Promise<PanelCharacterState> {
    // Try to find existing state for this panel and character
    const existingStates = this.panelCharacterStates.get(panelId) || [];
    const existingStateIndex = existingStates.findIndex(s => s.characterId === characterId);

    if (existingStateIndex !== -1) {
      // Update existing state
      const updatedState = {
        ...existingStates[existingStateIndex],
        ...state,
        updatedAt: new Date(),
      };
      existingStates[existingStateIndex] = updatedState;
      return updatedState;
    } else {
      // Create new state
      return await this.createPanelCharacterState({
        ...state,
        panelId,
        characterId,
      });
    }
  }

  async storeVisualAnalysisResults(panelId: string, analysisResults: {
    characters: Array<{
      characterId: string;
      characterName: string;
      isPresent: boolean;
      confidence: number;
      visualDetails?: any;
    }>;
    rawAnalysisData: any;
    analysisTimestamp: Date;
  }): Promise<PanelCharacterState[]> {
    const results: PanelCharacterState[] = [];

    for (const characterResult of analysisResults.characters) {
      const visualDetails = characterResult.visualDetails;
      
      const panelCharacterState = await this.upsertPanelCharacterState(
        panelId,
        characterResult.characterId,
        {
          isPresent: characterResult.isPresent,
          confidenceScore: characterResult.confidence,
          // Clothing details
          detectedUpperBody: visualDetails?.clothing?.upperBody,
          detectedLowerBody: visualDetails?.clothing?.lowerBody,
          detectedOuterwear: visualDetails?.clothing?.outerwear,
          detectedClothingColors: visualDetails?.clothing?.colors,
          detectedClothingStyle: visualDetails?.clothing?.style,
          detectedClothingAccessories: visualDetails?.clothing?.accessories,
          // Hair details
          detectedHairColor: visualDetails?.hair?.color,
          detectedHairStyle: visualDetails?.hair?.style,
          detectedHairLength: visualDetails?.hair?.length,
          detectedHairTexture: visualDetails?.hair?.texture,
          // Physical appearance
          detectedSkinTone: visualDetails?.physicalAppearance?.skinTone,
          detectedEyeColor: visualDetails?.physicalAppearance?.eyeColor,
          detectedPose: visualDetails?.physicalAppearance?.pose,
          // Accessories
          detectedJewelry: visualDetails?.accessories?.jewelry,
          detectedGlasses: visualDetails?.accessories?.glasses,
          detectedHat: visualDetails?.accessories?.hat,
          detectedOtherAccessories: visualDetails?.accessories?.other,
          // Location
          detectedScreenPosition: visualDetails?.location?.position,
          detectedInteraction: visualDetails?.location?.interaction,
          // Analysis metadata
          visualAnalysisPerformed: true,
          visualAnalysisTimestamp: analysisResults.analysisTimestamp,
          visualAnalysisRawData: analysisResults.rawAnalysisData,
        }
      );
      
      results.push(panelCharacterState);
    }

    return results;
  }

  async getCharacterVisualHistoryDetailed(characterId: string, limit?: number): Promise<Array<{
    panelId: string;
    panelNumber?: number;
    pageNumber?: number;
    appearance: PanelCharacterState;
    timestamp: Date;
    confidenceScore?: number;
    hasVisualAnalysis: boolean;
  }>> {
    const panelStates = await this.getCharacterPanelStates(characterId);
    const result = panelStates.map(state => ({
      panelId: state.panelId,
      appearance: state,
      timestamp: state.createdAt || new Date(),
      confidenceScore: state.confidenceScore || undefined,
      hasVisualAnalysis: state.visualAnalysisPerformed || false,
    }));

    return limit ? result.slice(0, limit) : result;
  }

  async getProjectCharacterVisualSummary(projectId: string): Promise<Array<{
    characterId: string;
    characterName: string;
    totalAppearances: number;
    averageConfidenceScore: number;
    visualAnalysisCount: number;
    mostCommonClothing: {
      upperBody?: string;
      lowerBody?: string;
      colors: string[];
    };
    consistentFeatures: string[];
    lastAppearancePanel: string;
    lastAnalysisTimestamp?: Date;
  }>> {
    // This would require cross-referencing with projects and characters
    // For MemStorage, return empty array as this is a complex aggregation
    return [];
  }

  async identifyVisualInconsistencies(characterId: string, projectId: string): Promise<Array<{
    panelIds: string[];
    inconsistencyType: 'hair' | 'clothing' | 'physical' | 'accessories';
    description: string;
    severity: 'minor' | 'moderate' | 'major';
    expectedValue: string;
    actualValues: string[];
  }>> {
    // This would analyze all character appearances for inconsistencies
    // For MemStorage, return empty array as this requires complex logic
    return [];
  }

  async markVisualAnalysisComplete(panelId: string, characterIds: string[]): Promise<boolean> {
    const panelStates = this.panelCharacterStates.get(panelId) || [];
    let updated = false;

    for (const characterId of characterIds) {
      const stateIndex = panelStates.findIndex(s => s.characterId === characterId);
      if (stateIndex !== -1) {
        panelStates[stateIndex] = {
          ...panelStates[stateIndex],
          visualAnalysisPerformed: true,
          visualAnalysisTimestamp: new Date(),
          updatedAt: new Date(),
        };
        updated = true;
      }
    }

    return updated;
  }
}

// Database storage implementation
export class DatabaseStorage implements IStorage {
  // User operations (mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    console.log(`🔥 DatabaseStorage: Getting user with ID: ${id}`);
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      if (user) {
        console.log(`🔥 DatabaseStorage: User found:`, { id: user.id, email: user.email, firstName: user.firstName });
      } else {
        console.log(`🔥 DatabaseStorage: User NOT found for ID: ${id}`);
      }
      return user || undefined;
    } catch (error) {
      console.error(`🔥 DatabaseStorage: ERROR getting user ${id}:`, error);
      throw error;
    }
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    console.log(`🔥 DatabaseStorage: Starting upsertUser for ID: ${userData.id}`);
    console.log(`🔥 DatabaseStorage: User data:`, userData);
    
    try {
      // If userData has an explicit ID, try to insert/upsert with that ID
      if (userData.id) {
        const [user] = await db
          .insert(users)
          .values({
            ...userData,
            id: userData.id, // Explicitly set the ID to override column default
            role: userData.role ?? 'user',
            plan: userData.plan ?? 'free',
          })
          .onConflictDoUpdate({
            target: users.id,
            set: {
              email: userData.email,
              firstName: userData.firstName,
              lastName: userData.lastName,
              profileImageUrl: userData.profileImageUrl,
              ...(userData.role ? { role: userData.role } : {}),
              ...(userData.plan ? { plan: userData.plan } : {}),
              updatedAt: new Date(),
            },
          })
          .returning();
        
        console.log(`🔥 DatabaseStorage: Successfully upserted user with explicit ID:`, { 
          id: user.id, 
          email: user.email, 
          firstName: user.firstName,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        });
        
        return user;
      } else {
        // If no explicit ID, let database generate one
        const [user] = await db
          .insert(users)
          .values({
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            profileImageUrl: userData.profileImageUrl,
            role: userData.role ?? 'user',
            plan: userData.plan ?? 'free',
          })
          .onConflictDoUpdate({
            target: users.email, // Use email as conflict target when no ID provided
            set: {
              firstName: userData.firstName,
              lastName: userData.lastName,
              profileImageUrl: userData.profileImageUrl,
              ...(userData.role ? { role: userData.role } : {}),
              ...(userData.plan ? { plan: userData.plan } : {}),
              updatedAt: new Date(),
            },
          })
          .returning();
        
        console.log(`🔥 DatabaseStorage: Successfully upserted user with generated ID:`, { 
          id: user.id, 
          email: user.email, 
          firstName: user.firstName,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        });
        
        return user;
      }
    } catch (error) {
      console.error(`🔥 DatabaseStorage: CRITICAL ERROR during upsertUser:`, error);
      console.error(`🔥 DatabaseStorage: Failed userData:`, userData);
      console.error(`🔥 DatabaseStorage: Error details:`, {
        message: error instanceof Error ? error.message : String(error),
        code: (error as any)?.code,
        constraint: (error as any)?.constraint,
        detail: (error as any)?.detail,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  async updateUser(id: string, updates: Partial<UpsertUser>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  // Project operations
  async createProject(userId: string, projectData: InsertProject): Promise<Project> {
    const [project] = await db
      .insert(projects)
      .values({
        ...projectData,
        userId,
      })
      .returning();
    return project;
  }

  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project || undefined;
  }

  async getUserProjects(userId: string): Promise<Project[]> {
    return await db
      .select()
      .from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(desc(projects.updatedAt));
  }

  async updateProject(id: string, updates: Partial<InsertProject>): Promise<Project | undefined> {
    const [project] = await db
      .update(projects)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return project || undefined;
  }

  async deleteProject(id: string): Promise<boolean> {
    try {
      // Delete associated structured scripts first to avoid foreign key constraints
      const structuredScript = await this.getProjectStructuredScript(id);
      if (structuredScript) {
        await this.deleteStructuredScript(structuredScript.id);
      }
      
      // Delete all characters associated with this project
      await db.delete(characters).where(eq(characters.projectId, id));
      
      // Delete all pages and panels for this project
      const projectPages = await db.select().from(pages).where(eq(pages.projectId, id));
      for (const page of projectPages) {
        await db.delete(panels).where(eq(panels.pageId, page.id));
      }
      await db.delete(pages).where(eq(pages.projectId, id));
      
      // Finally delete the project
      const result = await db.delete(projects).where(eq(projects.id, id));
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error("Error deleting project:", error);
      return false;
    }
  }

  // Character operations
  async createCharacter(characterData: InsertCharacter): Promise<Character> {
    const [character] = await db.insert(characters).values(characterData).returning();
    return character;
  }

  async getCharacter(id: string): Promise<Character | undefined> {
    const [character] = await db.select().from(characters).where(eq(characters.id, id));
    return character || undefined;
  }

  async getProjectCharacters(projectId: string): Promise<Character[]> {
    return await db
      .select()
      .from(characters)
      .where(eq(characters.projectId, projectId))
      .orderBy(desc(characters.createdAt));
  }

  async updateCharacter(id: string, updates: Partial<InsertCharacter>): Promise<Character | undefined> {
    const [character] = await db
      .update(characters)
      .set(updates)
      .where(eq(characters.id, id))
      .returning();
    return character || undefined;
  }

  async deleteCharacter(id: string): Promise<boolean> {
    const result = await db.delete(characters).where(eq(characters.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Enhanced Character Profile operations
  async createCharacterAppearanceProfile(profile: any): Promise<any> {
    const { characterAppearanceProfiles } = await import("@shared/schema");
    const [created] = await db
      .insert(characterAppearanceProfiles)
      .values(profile)
      .returning();
    return created;
  }

  async getCharacterAppearanceProfile(characterId: string): Promise<any | undefined> {
    const { characterAppearanceProfiles } = await import("@shared/schema");
    const [profile] = await db
      .select()
      .from(characterAppearanceProfiles)
      .where(eq(characterAppearanceProfiles.characterId, characterId));
    return profile || undefined;
  }

  async updateCharacterAppearanceProfile(characterId: string, updates: any): Promise<any | undefined> {
    const { characterAppearanceProfiles } = await import("@shared/schema");
    const [updated] = await db
      .update(characterAppearanceProfiles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(characterAppearanceProfiles.characterId, characterId))
      .returning();
    return updated;
  }

  async createCharacterClothingState(clothingState: any): Promise<any> {
    const { characterClothingStates } = await import("@shared/schema");
    const [created] = await db
      .insert(characterClothingStates)
      .values(clothingState)
      .returning();
    return created;
  }

  async getCharacterClothingStates(characterId: string): Promise<any[]> {
    const { characterClothingStates } = await import("@shared/schema");
    return await db
      .select()
      .from(characterClothingStates)
      .where(eq(characterClothingStates.characterId, characterId));
  }

  async updateCharacterClothingState(id: string, updates: any): Promise<any | undefined> {
    const { characterClothingStates } = await import("@shared/schema");
    const [updated] = await db
      .update(characterClothingStates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(characterClothingStates.id, id))
      .returning();
    return updated;
  }

  async createCharacterConsistencyRule(rule: any): Promise<any> {
    const { characterConsistencyRules } = await import("@shared/schema");
    const [created] = await db
      .insert(characterConsistencyRules)
      .values(rule)
      .returning();
    return created;
  }

  async getCharacterConsistencyRules(characterId: string): Promise<any[]> {
    const { characterConsistencyRules } = await import("@shared/schema");
    return await db
      .select()
      .from(characterConsistencyRules)
      .where(eq(characterConsistencyRules.characterId, characterId));
  }

  async updateCharacterConsistencyRule(id: string, updates: any): Promise<any | undefined> {
    const { characterConsistencyRules } = await import("@shared/schema");
    const [updated] = await db
      .update(characterConsistencyRules)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(characterConsistencyRules.id, id))
      .returning();
    return updated;
  }

  // Page operations
  async createPage(pageData: InsertPage): Promise<Page> {
    const [page] = await db.insert(pages).values(pageData).returning();
    return page;
  }

  async getProjectPages(projectId: string): Promise<Page[]> {
    return await db
      .select()
      .from(pages)
      .where(eq(pages.projectId, projectId))
      .orderBy(pages.pageNumber);
  }

  async getPage(id: string): Promise<Page | undefined> {
    const [page] = await db.select().from(pages).where(eq(pages.id, id));
    return page || undefined;
  }

  async updatePage(id: string, updates: Partial<InsertPage>): Promise<Page | undefined> {
    const [page] = await db
      .update(pages)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(pages.id, id))
      .returning();
    
    // If page number was updated, trigger recalculation
    if (page && updates.pageNumber !== undefined) {
      await this.recalculateGlobalPanelNumbers(page.projectId);
    }
    
    return page || undefined;
  }

  async updatePageBackground(pageId: string, backgroundImageUrl: string): Promise<Page | undefined> {
    const [page] = await db
      .update(pages)
      .set({ backgroundImageUrl, updatedAt: new Date() })
      .where(eq(pages.id, pageId))
      .returning();
    return page || undefined;
  }

  async deletePage(id: string): Promise<boolean> {
    try {
      // Get project info before deletion for recalculation
      const [pageInfo] = await db
        .select({ projectId: pages.projectId })
        .from(pages)
        .where(eq(pages.id, id));
      
      // First delete all panels associated with this page
      await db.delete(panels).where(eq(panels.pageId, id));
      
      // Then delete the page itself
      const result = await db.delete(pages).where(eq(pages.id, id));
      const success = result.rowCount !== null && result.rowCount > 0;
      
      // Trigger recalculation if deletion was successful and we found the project
      if (success && pageInfo) {
        await this.recalculateGlobalPanelNumbers(pageInfo.projectId);
      }
      
      return success;
    } catch (error) {
      console.error("Error deleting page and associated panels:", error);
      return false;
    }
  }

  // Panel operations
  async createPanel(panelData: InsertPanel): Promise<Panel> {
    // Get the page to determine the project, then calculate global panel number
    const [page] = await db.select().from(pages).where(eq(pages.id, panelData.pageId));
    if (!page) {
      throw new Error(`Page with id ${panelData.pageId} not found`);
    }
    
    const globalPanelNumber = await this.calculateNextGlobalPanelNumber(page.projectId);
    
    const [panel] = await db.insert(panels).values({
      ...panelData,
      globalPanelNumber,
    }).returning();
    
    // Trigger full resequencing to maintain chronological order
    await this.recalculateGlobalPanelNumbers(page.projectId);
    
    return panel;
  }

  async getPanel(id: string): Promise<Panel | undefined> {
    const [panel] = await db.select().from(panels).where(eq(panels.id, id));
    return panel;
  }

  async getPagePanels(pageId: string): Promise<Panel[]> {
    return await db
      .select()
      .from(panels)
      .where(eq(panels.pageId, pageId))
      .orderBy(panels.panelNumber);
  }

  async updatePanel(id: string, updates: Partial<InsertPanel>): Promise<Panel | undefined> {
    // Get current panel to check for order changes
    const [currentPanel] = await db.select().from(panels).where(eq(panels.id, id));
    if (!currentPanel) return undefined;
    
    // Check if panelNumber or pageId changed
    const panelOrderChanged = (
      updates.panelNumber !== undefined && updates.panelNumber !== currentPanel.panelNumber
    ) || (
      updates.pageId !== undefined && updates.pageId !== currentPanel.pageId
    );

    const [panel] = await db
      .update(panels)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(panels.id, id))
      .returning();
    
    // Trigger recalculation if panel order changed
    if (panel && panelOrderChanged) {
      const [page] = await db.select().from(pages).where(eq(pages.id, panel.pageId));
      if (page) {
        await this.recalculateGlobalPanelNumbers(page.projectId);
      }
    }
    
    return panel || undefined;
  }

  async deletePanel(id: string): Promise<boolean> {
    // Get the panel and project info before deletion for recalculation
    const [panelWithPage] = await db
      .select({
        panelId: panels.id,
        projectId: pages.projectId,
      })
      .from(panels)
      .innerJoin(pages, eq(panels.pageId, pages.id))
      .where(eq(panels.id, id));
    
    const result = await db.delete(panels).where(eq(panels.id, id));
    const success = result.rowCount !== null && result.rowCount > 0;
    
    // Trigger recalculation if deletion was successful and we found the project
    if (success && panelWithPage) {
      await this.recalculateGlobalPanelNumbers(panelWithPage.projectId);
    }
    
    return success;
  }

  // Global panel operations
  async getProjectPanels(projectId: string): Promise<Panel[]> {
    const results = await db
      .select({
        panel: panels,
        page: pages,
      })
      .from(panels)
      .innerJoin(pages, eq(panels.pageId, pages.id))
      .where(eq(pages.projectId, projectId))
      .orderBy(pages.pageNumber, panels.panelNumber); // Fallback ordering
    
    const panelList = results.map(result => result.panel);
    
    // Deterministic sort: null globalPanelNumbers go to end using Infinity
    return panelList.sort((a, b) => {
      const aGlobal = a.globalPanelNumber ?? Infinity;
      const bGlobal = b.globalPanelNumber ?? Infinity;
      
      if (aGlobal !== bGlobal) {
        return aGlobal - bGlobal;
      }
      
      // Stable secondary sort: get page info for deterministic ordering
      const aPageResult = results.find(r => r.panel.id === a.id);
      const bPageResult = results.find(r => r.panel.id === b.id);
      
      if (aPageResult && bPageResult) {
        if (aPageResult.page.pageNumber !== bPageResult.page.pageNumber) {
          return aPageResult.page.pageNumber - bPageResult.page.pageNumber;
        }
        return a.panelNumber - b.panelNumber;
      }
      
      return 0;
    });
  }

  async calculateNextGlobalPanelNumber(projectId: string): Promise<number> {
    try {
      const result = await db
        .select({ maxGlobalNumber: sql<number>`MAX(COALESCE(${panels.globalPanelNumber}, 0))` })
        .from(panels)
        .innerJoin(pages, eq(panels.pageId, pages.id))
        .where(eq(pages.projectId, projectId));
      
      const maxNumber = result[0]?.maxGlobalNumber || 0;
      return Math.max(1, maxNumber + 1); // Ensure minimum of 1
    } catch (error) {
      console.error(`DbStorage: Error calculating next global panel number for project ${projectId}:`, error);
      return 1; // Safe fallback
    }
  }

  async recalculateGlobalPanelNumbers(projectId: string): Promise<void> {
    try {
      // Get all panels for the project ordered by page number, then panel number
      const projectPanels = await db
        .select()
        .from(panels)
        .innerJoin(pages, eq(panels.pageId, pages.id))
        .where(eq(pages.projectId, projectId))
        .orderBy(pages.pageNumber, panels.panelNumber);

      // Update each panel with sequential global panel numbers (1..N)
      for (let i = 0; i < projectPanels.length; i++) {
        const panel = projectPanels[i].panels;
        await db
          .update(panels)
          .set({ 
            globalPanelNumber: i + 1, 
            updatedAt: new Date() 
          })
          .where(eq(panels.id, panel.id));
      }
    } catch (error) {
      console.error(`DbStorage: Error recalculating global panel numbers for project ${projectId}:`, error);
      throw error; // Re-throw to ensure calling code knows about the failure
    }
  }

  async updatePanelGlobalNumber(panelId: string, globalPanelNumber: number): Promise<Panel | undefined> {
    // Get the panel to determine project for recalculation
    const [panelWithPage] = await db
      .select({
        panel: panels,
        projectId: pages.projectId,
      })
      .from(panels)
      .innerJoin(pages, eq(panels.pageId, pages.id))
      .where(eq(panels.id, panelId));
    
    if (!panelWithPage) {
      return undefined;
    }
    
    const [panel] = await db
      .update(panels)
      .set({ 
        globalPanelNumber, 
        updatedAt: new Date() 
      })
      .where(eq(panels.id, panelId))
      .returning();
    
    // Trigger full re-sequencing to maintain 1..N contiguity without gaps
    await this.recalculateGlobalPanelNumbers(panelWithPage.projectId);
    
    return panel || undefined;
  }

  // Data migration method to backfill globalPanelNumber for existing projects
  async backfillGlobalPanelNumbers(projectId?: string): Promise<{
    projectsProcessed: number;
    panelsUpdated: number;
    errors: Array<{ projectId: string; error: string }>;
  }> {
    const errors: Array<{ projectId: string; error: string }> = [];
    let projectsProcessed = 0;
    let panelsUpdated = 0;

    try {
      // Get all projects or just the specified one
      const projectsToProcess = projectId 
        ? await db.select().from(projects).where(eq(projects.id, projectId))
        : await db.select().from(projects);

      console.log(`🔄 Starting global panel number backfill for ${projectsToProcess.length} projects...`);

      for (const project of projectsToProcess) {
        try {
          console.log(`🔄 Processing project ${project.id} (${project.title})`);
          
          // Get all panels for this project ordered by page number, then panel number
          const projectPanels = await db
            .select({
              panelId: panels.id,
              pageNumber: pages.pageNumber,
              panelNumber: panels.panelNumber,
              currentGlobalNumber: panels.globalPanelNumber,
            })
            .from(panels)
            .innerJoin(pages, eq(panels.pageId, pages.id))
            .where(eq(pages.projectId, project.id))
            .orderBy(pages.pageNumber, panels.panelNumber);

          if (projectPanels.length === 0) {
            console.log(`  ⚠️  No panels found for project ${project.id}`);
            continue;
          }

          // Update each panel with sequential global panel numbers
          let updateCount = 0;
          for (let i = 0; i < projectPanels.length; i++) {
            const panel = projectPanels[i];
            const newGlobalNumber = i + 1;
            
            // Only update if the number is different to avoid unnecessary writes
            if (panel.currentGlobalNumber !== newGlobalNumber) {
              await db
                .update(panels)
                .set({ 
                  globalPanelNumber: newGlobalNumber, 
                  updatedAt: new Date() 
                })
                .where(eq(panels.id, panel.panelId));
              
              updateCount++;
            }
          }
          
          console.log(`  ✅ Updated ${updateCount}/${projectPanels.length} panels for project ${project.id}`);
          panelsUpdated += updateCount;
          projectsProcessed++;
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`  ❌ Error processing project ${project.id}:`, errorMessage);
          errors.push({ projectId: project.id, error: errorMessage });
        }
      }

      console.log(`✅ Backfill complete! Processed ${projectsProcessed} projects, updated ${panelsUpdated} panels`);
      if (errors.length > 0) {
        console.error(`❌ Encountered ${errors.length} errors during backfill`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("❌ Critical error during backfill:", errorMessage);
      throw error;
    }

    return {
      projectsProcessed,
      panelsUpdated,
      errors,
    };
  }

  // Structured Script operations
  async createStructuredScript(scriptData: InsertStructuredScript): Promise<StructuredScript> {
    const [script] = await db.insert(structuredScripts).values(scriptData).returning();
    return script;
  }

  async getProjectStructuredScript(projectId: string): Promise<FullStructuredScript | undefined> {
    // Get the active structured script for the project
    const [script] = await db
      .select()
      .from(structuredScripts)
      .where(and(eq(structuredScripts.projectId, projectId), eq(structuredScripts.isActive, true)))
      .orderBy(desc(structuredScripts.createdAt));

    if (!script) return undefined;

    // Get all pages with panels and dialogue
    const pages = await this.getScriptPages(script.id);

    return {
      ...script,
      pages,
    };
  }

  async updateStructuredScript(id: string, updates: Partial<InsertStructuredScript>): Promise<StructuredScript | undefined> {
    const [script] = await db
      .update(structuredScripts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(structuredScripts.id, id))
      .returning();
    return script || undefined;
  }

  async deleteStructuredScript(id: string): Promise<boolean> {
    try {
      // Delete in cascade order: dialogue -> panels -> pages -> script
      const pages = await db.select().from(scriptPages).where(eq(scriptPages.structuredScriptId, id));
      
      for (const page of pages) {
        const panels = await db.select().from(scriptPanels).where(eq(scriptPanels.scriptPageId, page.id));
        
        for (const panel of panels) {
          await db.delete(scriptDialogue).where(eq(scriptDialogue.scriptPanelId, panel.id));
        }
        
        await db.delete(scriptPanels).where(eq(scriptPanels.scriptPageId, page.id));
      }
      
      await db.delete(scriptPages).where(eq(scriptPages.structuredScriptId, id));
      const result = await db.delete(structuredScripts).where(eq(structuredScripts.id, id));
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error("Error deleting structured script:", error);
      return false;
    }
  }

  // Script Page operations
  async createScriptPage(pageData: InsertScriptPage): Promise<ScriptPage> {
    const [page] = await db.insert(scriptPages).values(pageData).returning();
    return page;
  }

  async getScriptPages(scriptId: string): Promise<ScriptPageWithPanels[]> {
    const pages = await db
      .select()
      .from(scriptPages)
      .where(eq(scriptPages.structuredScriptId, scriptId))
      .orderBy(scriptPages.pageNumber);

    const pagesWithPanels: ScriptPageWithPanels[] = [];
    
    for (const page of pages) {
      const panels = await this.getScriptPanels(page.id);
      pagesWithPanels.push({
        ...page,
        panels,
      });
    }

    return pagesWithPanels;
  }

  async updateScriptPage(id: string, updates: Partial<InsertScriptPage>): Promise<ScriptPage | undefined> {
    const [page] = await db
      .update(scriptPages)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(scriptPages.id, id))
      .returning();
    return page || undefined;
  }

  async deleteScriptPage(id: string): Promise<boolean> {
    try {
      // Delete panels and their dialogue first
      const panels = await db.select().from(scriptPanels).where(eq(scriptPanels.scriptPageId, id));
      
      for (const panel of panels) {
        await db.delete(scriptDialogue).where(eq(scriptDialogue.scriptPanelId, panel.id));
      }
      
      await db.delete(scriptPanels).where(eq(scriptPanels.scriptPageId, id));
      const result = await db.delete(scriptPages).where(eq(scriptPages.id, id));
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error("Error deleting script page:", error);
      return false;
    }
  }

  // Script Panel operations
  async createScriptPanel(panelData: InsertScriptPanel): Promise<ScriptPanel> {
    const [panel] = await db.insert(scriptPanels).values(panelData).returning();
    return panel;
  }

  async getScriptPanels(pageId: string): Promise<ScriptPanelWithDialogue[]> {
    const panels = await db
      .select()
      .from(scriptPanels)
      .where(eq(scriptPanels.scriptPageId, pageId))
      .orderBy(scriptPanels.panelNumber);

    const panelsWithDialogue: ScriptPanelWithDialogue[] = [];
    
    for (const panel of panels) {
      const dialogue = await this.getScriptDialogue(panel.id);
      panelsWithDialogue.push({
        ...panel,
        dialogue,
      });
    }

    return panelsWithDialogue;
  }

  async updateScriptPanel(id: string, updates: Partial<InsertScriptPanel>): Promise<ScriptPanel | undefined> {
    const [panel] = await db
      .update(scriptPanels)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(scriptPanels.id, id))
      .returning();
    return panel || undefined;
  }

  async deleteScriptPanel(id: string): Promise<boolean> {
    try {
      await db.delete(scriptDialogue).where(eq(scriptDialogue.scriptPanelId, id));
      const result = await db.delete(scriptPanels).where(eq(scriptPanels.id, id));
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error("Error deleting script panel:", error);
      return false;
    }
  }

  // Script Dialogue operations
  async createScriptDialogue(dialogueData: InsertScriptDialogue): Promise<ScriptDialogue> {
    const [dialogue] = await db.insert(scriptDialogue).values(dialogueData).returning();
    return dialogue;
  }

  async getScriptDialogue(panelId: string): Promise<ScriptDialogue[]> {
    return await db
      .select()
      .from(scriptDialogue)
      .where(eq(scriptDialogue.scriptPanelId, panelId))
      .orderBy(scriptDialogue.orderIndex);
  }

  async updateScriptDialogue(id: string, updates: Partial<InsertScriptDialogue>): Promise<ScriptDialogue | undefined> {
    const [dialogue] = await db
      .update(scriptDialogue)
      .set(updates)
      .where(eq(scriptDialogue.id, id))
      .returning();
    return dialogue || undefined;
  }

  async deleteScriptDialogue(id: string): Promise<boolean> {
    const result = await db.delete(scriptDialogue).where(eq(scriptDialogue.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // ========================================
  // Character Library Operations
  // ========================================

  // Get all library characters for a user
  async getUserLibraryCharacters(userId: string): Promise<Character[]> {
    return await db
      .select()
      .from(characters)
      .where(and(eq(characters.userId, userId), eq(characters.isLibraryCharacter, true)))
      .orderBy(desc(characters.createdAt));
  }

  // Create a library character
  async createLibraryCharacter(userId: string, characterData: Omit<InsertCharacter, 'projectId'>): Promise<Character> {
    const [character] = await db
      .insert(characters)
      .values({
        ...characterData,
        userId,
        isLibraryCharacter: true,
        projectId: null,
      })
      .returning();
    return character;
  }

  // Update a library character (only if owned by user)
  async updateLibraryCharacter(id: string, userId: string, updates: Partial<InsertCharacter>): Promise<Character | undefined> {
    const [character] = await db
      .update(characters)
      .set(updates)
      .where(and(
        eq(characters.id, id),
        eq(characters.userId, userId),
        eq(characters.isLibraryCharacter, true)
      ))
      .returning();
    return character || undefined;
  }

  // Delete a library character (only if owned by user)
  async deleteLibraryCharacter(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(characters)
      .where(and(
        eq(characters.id, id),
        eq(characters.userId, userId),
        eq(characters.isLibraryCharacter, true)
      ));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Copy a library character to a project
  async copyCharacterToProject(characterId: string, projectId: string, userId: string): Promise<Character> {
    // First get the library character
    const [libraryCharacter] = await db
      .select()
      .from(characters)
      .where(and(
        eq(characters.id, characterId),
        eq(characters.userId, userId),
        eq(characters.isLibraryCharacter, true)
      ));

    if (!libraryCharacter) {
      throw new Error("Library character not found or not owned by user");
    }

    // Create a project character copy (without library character fields)
    const [projectCharacter] = await db
      .insert(characters)
      .values({
        projectId,
        userId: null, // Project characters don't have userId
        name: libraryCharacter.name,
        role: libraryCharacter.role,
        bio: libraryCharacter.bio,
        visualDescriptors: libraryCharacter.visualDescriptors,
        alwaysTraits: libraryCharacter.alwaysTraits,
        neverTraits: libraryCharacter.neverTraits,
        referenceImageUrl: libraryCharacter.referenceImageUrl,
        colorScheme: libraryCharacter.colorScheme,
        isLibraryCharacter: false,
      })
      .returning();

    return projectCharacter;
  }

  // ========================================
  // Social Features Operations
  // ========================================

  // User profiles
  async getUserProfile(userId: string): Promise<UserProfile | undefined> {
    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId));
    return profile || undefined;
  }

  async updateUserProfile(userId: string, profileData: Partial<InsertUserProfile>): Promise<UserProfile> {
    const [profile] = await db
      .insert(userProfiles)
      .values({
        ...profileData,
        userId,
      })
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: {
          ...profileData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return profile;
  }

  // ========================================
  // AI CREDITS SYSTEM IMPLEMENTATION
  // ========================================

  async getCurrentMonthCredits(userId: string): Promise<UserCredits> {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // JavaScript months are 0-indexed

    // Try to get existing record for current month
    const [existingRecord] = await db
      .select()
      .from(userCredits)
      .where(
        and(
          eq(userCredits.userId, userId),
          eq(userCredits.year, currentYear),
          eq(userCredits.month, currentMonth)
        )
      );

    if (existingRecord) {
      return existingRecord;
    }

    // Create new record for current month
    const [newRecord] = await db
      .insert(userCredits)
      .values({
        userId,
        year: currentYear,
        month: currentMonth,
        creditsUsed: 0,
        monthlyLimit: 200,
      })
      .returning();

    return newRecord;
  }

  async hasEnoughCredits(userId: string, requiredCredits: number): Promise<boolean> {
    const monthlyRecord = await this.getCurrentMonthCredits(userId);
    const remainingCredits = monthlyRecord.monthlyLimit - monthlyRecord.creditsUsed;
    return remainingCredits >= requiredCredits;
  }

  async deductCredits(
    userId: string, 
    operationType: string, 
    creditsToDeduct: number, 
    relatedResourceId?: string, 
    metadata?: any
  ): Promise<{success: boolean, remainingCredits: number}> {
    try {
      // Get current month record
      const monthlyRecord = await this.getCurrentMonthCredits(userId);
      const remainingCredits = monthlyRecord.monthlyLimit - monthlyRecord.creditsUsed;

      if (remainingCredits < creditsToDeduct) {
        return { success: false, remainingCredits };
      }

      // Update credits used
      const newCreditsUsed = monthlyRecord.creditsUsed + creditsToDeduct;
      await db
        .update(userCredits)
        .set({ 
          creditsUsed: newCreditsUsed,
          updatedAt: new Date()
        })
        .where(eq(userCredits.id, monthlyRecord.id));

      const finalRemainingCredits = monthlyRecord.monthlyLimit - newCreditsUsed;

      // Log the transaction
      await db
        .insert(creditTransactions)
        .values({
          userId,
          operationType,
          creditsDeducted: creditsToDeduct,
          remainingCredits: finalRemainingCredits,
          relatedResourceId,
          metadata,
        });

      return { success: true, remainingCredits: finalRemainingCredits };
    } catch (error) {
      console.error("Error deducting credits:", error);
      return { success: false, remainingCredits: 0 };
    }
  }

  async getCreditTransactions(userId: string, limit: number = 50): Promise<CreditTransaction[]> {
    const transactions = await db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.userId, userId))
      .orderBy(desc(creditTransactions.createdAt))
      .limit(limit);

    return transactions;
  }

  async resetMonthlyCredits(userId: string, monthlyLimit: number = 200): Promise<UserCredits> {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const [updatedRecord] = await db
      .insert(userCredits)
      .values({
        userId,
        year: currentYear,
        month: currentMonth,
        creditsUsed: 0,
        monthlyLimit,
      })
      .onConflictDoUpdate({
        target: [userCredits.userId, userCredits.year, userCredits.month],
        set: {
          creditsUsed: 0,
          monthlyLimit,
          updatedAt: new Date(),
        },
      })
      .returning();

    return updatedRecord;
  }

  async grantBonusCredits(userEmail: string, bonusCredits: number): Promise<{success: boolean, newLimit: number, message: string}> {
    try {
      // Find user by email
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, userEmail));

      if (!user) {
        return {
          success: false,
          newLimit: 0,
          message: `User with email ${userEmail} not found`
        };
      }

      // IDEMPOTENCY CHECK: Look for existing admin bonus transaction
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      const idempotencyKey = `admin_bonus_${userEmail}_${currentYear}_${currentMonth}_${bonusCredits}`;
      
      const [existingTransaction] = await db
        .select()
        .from(creditTransactions)
        .where(
          and(
            eq(creditTransactions.userId, user.id),
            eq(creditTransactions.operationType, "admin_bonus"),
            eq(creditTransactions.relatedResourceId, idempotencyKey)
          )
        )
        .limit(1);

      if (existingTransaction) {
        const monthlyRecord = await this.getCurrentMonthCredits(user.id);
        return {
          success: true,
          newLimit: monthlyRecord.monthlyLimit,
          message: `Bonus credits already granted to ${userEmail}. Current monthly limit: ${monthlyRecord.monthlyLimit}`
        };
      }

      // Get current month credits record
      const monthlyRecord = await this.getCurrentMonthCredits(user.id);
      const newLimit = monthlyRecord.monthlyLimit + bonusCredits;

      // Update the monthly limit
      await db
        .update(userCredits)
        .set({ 
          monthlyLimit: newLimit,
          updatedAt: new Date()
        })
        .where(eq(userCredits.id, monthlyRecord.id));

      // Log the admin bonus transaction for idempotency
      await db
        .insert(creditTransactions)
        .values({
          userId: user.id,
          operationType: "admin_bonus",
          creditsDeducted: -bonusCredits, // Negative to indicate credit addition
          remainingCredits: newLimit - monthlyRecord.creditsUsed,
          relatedResourceId: idempotencyKey,
          metadata: {
            adminAction: "deployment_bonus",
            originalLimit: monthlyRecord.monthlyLimit,
            bonusAmount: bonusCredits,
            email: userEmail,
            timestamp: now.toISOString()
          }
        });

      console.log(`✅ ADMIN: Granted ${bonusCredits} bonus credits to ${userEmail}. New limit: ${newLimit}`);

      return {
        success: true,
        newLimit,
        message: `Successfully granted ${bonusCredits} bonus credits to ${userEmail}. New monthly limit: ${newLimit}`
      };
    } catch (error) {
      console.error("Error granting bonus credits:", error);
      return {
        success: false,
        newLimit: 0,
        message: `Failed to grant credits: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async getUserFeatureEntitlements(userId: string): Promise<UserFeatureEntitlement[]> {
    return await db
      .select()
      .from(userFeatureEntitlements)
      .where(eq(userFeatureEntitlements.userId, userId));
  }

  async getUserFeatureEntitlement(userId: string, featureKey: string): Promise<UserFeatureEntitlement | undefined> {
    const [entitlement] = await db
      .select()
      .from(userFeatureEntitlements)
      .where(
        and(
          eq(userFeatureEntitlements.userId, userId),
          eq(userFeatureEntitlements.featureKey, featureKey)
        )
      )
      .limit(1);
    return entitlement || undefined;
  }

  async upsertUserFeatureEntitlement(params: InsertUserFeatureEntitlement): Promise<UserFeatureEntitlement> {
    const now = new Date();
    const [record] = await db
      .insert(userFeatureEntitlements)
      .values({
        userId: params.userId,
        featureKey: params.featureKey,
        isEnabled: params.isEnabled ?? false,
        plan: params.plan ?? null,
        isAdminOverride: params.isAdminOverride ?? false,
        grantedBy: params.grantedBy ?? null,
        grantedReason: params.grantedReason ?? null,
        metadata: params.metadata ?? null,
      })
      .onConflictDoUpdate({
        target: [userFeatureEntitlements.userId, userFeatureEntitlements.featureKey],
        set: {
          isEnabled: params.isEnabled ?? false,
          plan: params.plan ?? null,
          isAdminOverride: params.isAdminOverride ?? false,
          grantedBy: params.grantedBy ?? null,
          grantedReason: params.grantedReason ?? null,
          metadata: params.metadata ?? null,
          updatedAt: now,
        },
      })
      .returning();

    return record;
  }

  async removeUserFeatureEntitlement(userId: string, featureKey: string): Promise<boolean> {
    const result = await db
      .delete(userFeatureEntitlements)
      .where(
        and(
          eq(userFeatureEntitlements.userId, userId),
          eq(userFeatureEntitlements.featureKey, featureKey)
        )
      );
    return result.rowCount !== null && result.rowCount > 0;
  }

  async hasFeatureAccess(userId: string, featureKey: string, allowedPlans: string[] = []): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user) {
      return false;
    }

    if (user.role === 'admin') {
      return true;
    }

    if (allowedPlans.length > 0 && allowedPlans.includes(user.plan ?? '')) {
      return true;
    }

    const entitlement = await this.getUserFeatureEntitlement(userId, featureKey);
    if (!entitlement) {
      return false;
    }

    if (entitlement.isAdminOverride) {
      return true;
    }

    if (entitlement.isEnabled) {
      return true;
    }

    if (entitlement.plan && entitlement.plan === user.plan) {
      return true;
    }

    return false;
  }

  async createAnimationRenderJob(job: InsertAnimationRenderJob): Promise<AnimationRenderJob> {
    const [record] = await db
      .insert(animationRenderJobs)
      .values({
        userId: job.userId,
        prompt: job.prompt,
        promptDiff: job.promptDiff ?? null,
        model: job.model ?? null,
        settings: job.settings ?? null,
        status: job.status ?? 'pending',
        resultAssetUri: job.resultAssetUri ?? null,
      })
      .returning();

    return record;
  }

  async updateAnimationRenderJobStatus(jobId: string, status: string, resultAssetUri?: string | null): Promise<AnimationRenderJob | undefined> {
    const [record] = await db
      .update(animationRenderJobs)
      .set({
        status,
        ...(resultAssetUri !== undefined ? { resultAssetUri } : {}),
        updatedAt: new Date(),
      })
      .where(eq(animationRenderJobs.id, jobId))
      .returning();

    return record || undefined;
  }

  async getMostRecentAnimationRenderJob(userId: string): Promise<AnimationRenderJob | undefined> {
    const [record] = await db
      .select()
      .from(animationRenderJobs)
      .where(eq(animationRenderJobs.userId, userId))
      .orderBy(desc(animationRenderJobs.createdAt))
      .limit(1);

    return record || undefined;
  }

  async logVeoSafetyOverride(entry: InsertVeoSafetyOverrideLog): Promise<VeoSafetyOverrideLog> {
    const [record] = await db
      .insert(veoSafetyOverrideLogs)
      .values({
        renderJobId: entry.renderJobId ?? null,
        userId: entry.userId,
        justification: entry.justification ?? null,
        requestedSettings: entry.requestedSettings,
        defaultSettings: entry.defaultSettings,
      })
      .returning();

    return record;
  }

  async createAuditLogEntry(entry: InsertAuditLog): Promise<AuditLog> {
    const [record] = await db
      .insert(auditLogs)
      .values({
        userId: entry.userId ?? null,
        action: entry.action,
        resourceType: entry.resourceType ?? null,
        resourceId: entry.resourceId ?? null,
        metadata: entry.metadata ?? null,
      })
      .returning();

    return record;
  }

  // Public projects with like/comment counts
  async getPublicProjects(genre?: string): Promise<any[]> {
    let query = db
      .select({
        id: projects.id,
        userId: projects.userId,
        title: projects.title,
        description: projects.description,
        publicDescription: projects.publicDescription,
        genre: projects.genre,
        artStyle: projects.artStyle,
        isPublic: projects.isPublic,
        coverArt: projects.coverArt,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        userEmail: users.email,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userProfileImageUrl: users.profileImageUrl,
      })
      .from(projects)
      .innerJoin(users, eq(projects.userId, users.id))
      .where(eq(projects.isPublic, true));

    if (genre) {
      query = db
        .select({
          id: projects.id,
          userId: projects.userId,
          title: projects.title,
          description: projects.description,
          publicDescription: projects.publicDescription,
          genre: projects.genre,
          artStyle: projects.artStyle,
          isPublic: projects.isPublic,
          coverArt: projects.coverArt,
          createdAt: projects.createdAt,
          updatedAt: projects.updatedAt,
          userEmail: users.email,
          userFirstName: users.firstName,
          userLastName: users.lastName,
          userProfileImageUrl: users.profileImageUrl,
        })
        .from(projects)
        .innerJoin(users, eq(projects.userId, users.id))
        .where(and(eq(projects.isPublic, true), eq(projects.genre, genre)));
    }

    const publicProjects = await query.orderBy(desc(projects.createdAt));

    // Enrich with like/comment counts and current user like status
    const enrichedProjects = await Promise.all(
      publicProjects.map(async (project) => {
        // Get likes count
        const [likesResult] = await db
          .select({ count: count() })
          .from(projectLikes)
          .where(eq(projectLikes.projectId, project.id));
        const likesCount = likesResult?.count || 0;

        // Get comments count
        const [commentsResult] = await db
          .select({ count: count() })
          .from(projectComments)
          .where(eq(projectComments.projectId, project.id));
        const commentsCount = commentsResult?.count || 0;

        return {
          ...project,
          previewImageUrl: project.coverArt, // Map coverArt to previewImageUrl for frontend
          user: {
            id: project.userId,
            email: project.userEmail,
            firstName: project.userFirstName,
            lastName: project.userLastName,
            profileImageUrl: project.userProfileImageUrl,
          },
          likesCount,
          commentsCount,
          isLikedByCurrentUser: false, // This will be set on the frontend per user
        };
      })
    );

    return enrichedProjects;
  }

  // Get single public project with enriched data for social sharing
  async getPublicProject(projectId: string): Promise<any | undefined> {
    try {
      const [projectResult] = await db
        .select({
          id: projects.id,
          userId: projects.userId,
          title: projects.title,
          description: projects.description,
          publicDescription: projects.publicDescription,
          genre: projects.genre,
          userSelectedGenres: projects.userSelectedGenres,
          artStyle: projects.artStyle,
          coverArt: projects.coverArt,
          isPublic: projects.isPublic,
          createdAt: projects.createdAt,
          updatedAt: projects.updatedAt,
          userEmail: users.email,
          userFirstName: users.firstName,
          userLastName: users.lastName,
          userProfileImageUrl: users.profileImageUrl,
        })
        .from(projects)
        .innerJoin(users, eq(projects.userId, users.id))
        .where(and(eq(projects.id, projectId), eq(projects.isPublic, true)));

      if (!projectResult) {
        return undefined;
      }

      // Get likes count
      const [likesResult] = await db
        .select({ count: count() })
        .from(projectLikes)
        .where(eq(projectLikes.projectId, projectId));
      const likesCount = likesResult?.count || 0;

      // Get comments count
      const [commentsResult] = await db
        .select({ count: count() })
        .from(projectComments)
        .where(eq(projectComments.projectId, projectId));
      const commentsCount = commentsResult?.count || 0;

      // Get pages count
      const [pagesResult] = await db
        .select({ count: count() })
        .from(pages)
        .where(eq(pages.projectId, projectId));
      const pagesCount = pagesResult?.count || 0;

      return {
        ...projectResult,
        previewImageUrl: projectResult.coverArt, // Map coverArt to previewImageUrl for frontend
        user: {
          id: projectResult.userId,
          email: projectResult.userEmail,
          firstName: projectResult.userFirstName,
          lastName: projectResult.userLastName,
          profileImageUrl: projectResult.userProfileImageUrl,
        },
        likesCount,
        commentsCount,
        pagesCount,
      };
    } catch (error) {
      console.error('Error getting public project:', error);
      return undefined;
    }
  }

  // User projects with stats for profile page
  async getUserProjectsWithStats(userId: string): Promise<any[]> {
    const userProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(desc(projects.updatedAt));

    // Enrich with stats using simple count queries
    const enrichedProjects = await Promise.all(
      userProjects.map(async (project) => {
        // Get likes count
        const [likesResult] = await db
          .select({ count: count() })
          .from(projectLikes)
          .where(eq(projectLikes.projectId, project.id));
        const likesCount = likesResult?.count || 0;

        // Get comments count
        const [commentsResult] = await db
          .select({ count: count() })
          .from(projectComments)
          .where(eq(projectComments.projectId, project.id));
        const commentsCount = commentsResult?.count || 0;

        // Get pages count
        const [pagesResult] = await db
          .select({ count: count() })
          .from(pages)
          .where(eq(pages.projectId, project.id));
        const pagesCount = pagesResult?.count || 0;

        return {
          ...project,
          likesCount,
          commentsCount,
          pagesCount,
        };
      })
    );

    return enrichedProjects;
  }

  // Likes
  async likeProject(projectId: string, userId: string): Promise<ProjectLike> {
    const [like] = await db
      .insert(projectLikes)
      .values({
        projectId,
        userId,
      })
      .onConflictDoNothing()
      .returning();
    return like;
  }

  async unlikeProject(projectId: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(projectLikes)
      .where(and(eq(projectLikes.projectId, projectId), eq(projectLikes.userId, userId)));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Comments
  async getProjectComments(projectId: string): Promise<any[]> {
    const comments = await db
      .select({
        id: projectComments.id,
        projectId: projectComments.projectId,
        userId: projectComments.userId,
        comment: projectComments.comment,
        createdAt: projectComments.createdAt,
        updatedAt: projectComments.updatedAt,
        userEmail: users.email,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userProfileImageUrl: users.profileImageUrl,
      })
      .from(projectComments)
      .innerJoin(users, eq(projectComments.userId, users.id))
      .where(eq(projectComments.projectId, projectId))
      .orderBy(desc(projectComments.createdAt));

    return comments.map(comment => ({
      ...comment,
      user: {
        id: comment.userId,
        email: comment.userEmail,
        firstName: comment.userFirstName,
        lastName: comment.userLastName,
        profileImageUrl: comment.userProfileImageUrl,
      },
    }));
  }

  async createProjectComment(commentData: InsertProjectComment): Promise<ProjectComment> {
    const [comment] = await db
      .insert(projectComments)
      .values(commentData)
      .returning();
    return comment;
  }

  // Extract script characters and aggregate with metadata
  async getProjectScriptCharacters(projectId: string): Promise<Array<{ name: string; count: number; pageNumbers: number[] }>> {
    // Get existing project characters for exclusion
    const existingCharacters = await db
      .select({ name: characters.name })
      .from(characters)
      .where(eq(characters.projectId, projectId));
    
    const existingCharacterNames = new Set(
      existingCharacters.map(char => char.name.toLowerCase())
    );

    // Get structured script for this project
    const [structuredScript] = await db
      .select({ id: structuredScripts.id })
      .from(structuredScripts)
      .where(and(eq(structuredScripts.projectId, projectId), eq(structuredScripts.isActive, true)));

    if (!structuredScript) {
      return []; // No script exists yet
    }

    // Query script panels for characters arrays and page numbers
    const scriptPanelCharacters = await db
      .select({
        characters: scriptPanels.characters,
        pageNumber: scriptPages.pageNumber,
      })
      .from(scriptPanels)
      .innerJoin(scriptPages, eq(scriptPanels.scriptPageId, scriptPages.id))
      .where(eq(scriptPages.structuredScriptId, structuredScript.id));

    // Query script dialogue for individual character names
    const scriptDialogueCharacters = await db
      .select({
        character: scriptDialogue.character,
        pageNumber: scriptPages.pageNumber,
      })
      .from(scriptDialogue)
      .innerJoin(scriptPanels, eq(scriptDialogue.scriptPanelId, scriptPanels.id))
      .innerJoin(scriptPages, eq(scriptPanels.scriptPageId, scriptPages.id))
      .where(eq(scriptPages.structuredScriptId, structuredScript.id));

    // Aggregate characters with metadata
    const characterMap = new Map<string, { count: number; pageNumbers: Set<number> }>();

    // Process script panel characters (arrays)
    scriptPanelCharacters.forEach(({ characters: charArray, pageNumber }) => {
      if (charArray && Array.isArray(charArray)) {
        charArray.forEach((charName: string) => {
          if (charName && typeof charName === 'string') {
            const normalizedName = charName.trim();
            const lowerCaseName = normalizedName.toLowerCase();
            
            // Skip if already exists as project character
            if (existingCharacterNames.has(lowerCaseName)) return;
            
            if (!characterMap.has(lowerCaseName)) {
              characterMap.set(lowerCaseName, { 
                count: 0, 
                pageNumbers: new Set() 
              });
            }
            
            const entry = characterMap.get(lowerCaseName)!;
            entry.count++;
            entry.pageNumbers.add(pageNumber);
          }
        });
      }
    });

    // Process script dialogue characters (individual names)
    scriptDialogueCharacters.forEach(({ character: charName, pageNumber }) => {
      if (charName && typeof charName === 'string') {
        const normalizedName = charName.trim();
        const lowerCaseName = normalizedName.toLowerCase();
        
        // Skip if already exists as project character
        if (existingCharacterNames.has(lowerCaseName)) return;
        
        if (!characterMap.has(lowerCaseName)) {
          characterMap.set(lowerCaseName, { 
            count: 0, 
            pageNumbers: new Set() 
          });
        }
        
        const entry = characterMap.get(lowerCaseName)!;
        entry.count++;
        entry.pageNumbers.add(pageNumber);
      }
    });

    // Convert to final format, preserving original case from first occurrence
    const result: Array<{ name: string; count: number; pageNumbers: number[] }> = [];
    
    characterMap.forEach(({ count, pageNumbers }, lowerCaseName) => {
      // Find the original case version from our data sources
      let originalName = lowerCaseName;
      
      // Search in panel characters
      for (const { characters: charArray } of scriptPanelCharacters) {
        if (charArray && Array.isArray(charArray)) {
          const found = charArray.find((name: string) => 
            name && typeof name === 'string' && name.trim().toLowerCase() === lowerCaseName
          );
          if (found) {
            originalName = found.trim();
            break;
          }
        }
      }
      
      // Search in dialogue characters if not found in panels
      if (originalName === lowerCaseName) {
        const found = scriptDialogueCharacters.find(({ character }) => 
          character && character.trim().toLowerCase() === lowerCaseName
        );
        if (found) {
          originalName = found.character.trim();
        }
      }
      
      result.push({
        name: originalName,
        count,
        pageNumbers: Array.from(pageNumbers).sort((a, b) => a - b),
      });
    });

    // Sort by count (descending) then by name (ascending)
    return result.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });
  }

  // Script Validation operations - Database implementation
  async createValidationReport(reportData: InsertScriptValidationReport): Promise<ScriptValidationReport> {
    const { scriptValidationReports } = await import("@shared/schema");
    const [report] = await db
      .insert(scriptValidationReports)
      .values({
        ...reportData,
        status: reportData.status || null,
        structuredScriptId: reportData.structuredScriptId || null,
        validationResults: reportData.validationResults || null,
        recommendationsCount: reportData.recommendationsCount || null,
        criticalIssuesCount: reportData.criticalIssuesCount || null,
        warningIssuesCount: reportData.warningIssuesCount || null,
      })
      .returning();
    return report;
  }

  async getValidationReport(reportId: string): Promise<ScriptValidationReport | undefined> {
    const { scriptValidationReports } = await import("@shared/schema");
    const [report] = await db
      .select()
      .from(scriptValidationReports)
      .where(eq(scriptValidationReports.id, reportId));
    return report || undefined;
  }

  async getProjectValidationReports(projectId: string): Promise<ScriptValidationReport[]> {
    const { scriptValidationReports } = await import("@shared/schema");
    return await db
      .select()
      .from(scriptValidationReports)
      .where(eq(scriptValidationReports.projectId, projectId))
      .orderBy(desc(scriptValidationReports.createdAt));
  }

  async createValidationIssue(issueData: InsertValidationIssue): Promise<ValidationIssue> {
    const { validationIssues } = await import("@shared/schema");
    const [issue] = await db
      .insert(validationIssues)
      .values({
        ...issueData,
        suggestion: issueData.suggestion || null,
        affectedElements: issueData.affectedElements || null,
        confidence: issueData.confidence || null,
        isResolved: issueData.isResolved || null,
      })
      .returning();
    return issue;
  }

  async getValidationIssues(reportId: string): Promise<ValidationIssue[]> {
    const { validationIssues } = await import("@shared/schema");
    return await db
      .select()
      .from(validationIssues)
      .where(eq(validationIssues.reportId, reportId))
      .orderBy(validationIssues.createdAt);
  }

  async createCharacterConsistencyViolation(violationData: InsertCharacterConsistencyViolation): Promise<CharacterConsistencyViolation> {
    const { characterConsistencyViolations } = await import("@shared/schema");
    const [violation] = await db
      .insert(characterConsistencyViolations)
      .values({
        ...violationData,
        ruleId: violationData.ruleId || null,
        pageNumber: violationData.pageNumber || null,
        panelNumber: violationData.panelNumber || null,
        panelIds: violationData.panelIds || null,
        expectedValue: violationData.expectedValue || null,
        actualValue: violationData.actualValue || null,
      })
      .returning();
    return violation;
  }

  async getCharacterConsistencyViolations(reportId: string, characterId?: string): Promise<CharacterConsistencyViolation[]> {
    const { characterConsistencyViolations } = await import("@shared/schema");
    const whereConditions = [eq(characterConsistencyViolations.reportId, reportId)];
    
    if (characterId) {
      whereConditions.push(eq(characterConsistencyViolations.characterId, characterId));
    }
    
    return await db
      .select()
      .from(characterConsistencyViolations)
      .where(and(...whereConditions))
      .orderBy(characterConsistencyViolations.createdAt);
  }

  // Character consistency operations - Database implementation
  async getPanelCharacterStates(panelId: string): Promise<PanelCharacterState[]> {
    const { panelCharacterStates } = await import("@shared/schema");
    return await db
      .select()
      .from(panelCharacterStates)
      .where(eq(panelCharacterStates.panelId, panelId))
      .orderBy(panelCharacterStates.createdAt);
  }

  async getCharacterPanelStates(characterId: string): Promise<PanelCharacterState[]> {
    const { panelCharacterStates } = await import("@shared/schema");
    return await db
      .select()
      .from(panelCharacterStates)
      .where(eq(panelCharacterStates.characterId, characterId))
      .orderBy(panelCharacterStates.createdAt);
  }

  async validateCharacterConsistency(characterId: string, projectId: string): Promise<{
    characterId: string;
    projectId: string;
    consistencyScore: number;
    issues: ValidationIssue[];
    lastValidated: Date;
  }> {
    // This would implement character consistency validation logic
    // For now, return placeholder data
    return {
      characterId,
      projectId,
      consistencyScore: 85,
      issues: [],
      lastValidated: new Date(),
    };
  }

  async getCharacterAppearanceHistory(characterId: string, projectId: string): Promise<Array<{
    panelId: string;
    appearance: Partial<PanelCharacterState>;
    timestamp: Date;
  }>> {
    // Get all panel states for this character in chronological order
    const panelStates = await this.getCharacterPanelStates(characterId);
    return panelStates.map(state => ({
      panelId: state.panelId,
      appearance: {
        emotion: state.emotion,
        facialExpression: state.facialExpression,
        bodyLanguage: state.bodyLanguage,
        position: state.position,
        pose: state.pose,
        visibility: state.visibility,
        lightingCondition: state.lightingCondition,
        temporaryChanges: state.temporaryChanges,
        injuriesVisible: state.injuriesVisible,
      },
      timestamp: state.createdAt || new Date(),
    }));
  }

  // Enhanced Visual Analysis operations - DatabaseStorage implementation
  async createPanelCharacterState(panelCharacterState: Partial<PanelCharacterState>): Promise<PanelCharacterState> {
    const { panelCharacterStates } = await import("@shared/schema");
    const newState = {
      ...panelCharacterState,
      id: panelCharacterState.id || randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const [created] = await db.insert(panelCharacterStates).values(newState).returning();
    return created;
  }

  async updatePanelCharacterState(id: string, updates: Partial<PanelCharacterState>): Promise<PanelCharacterState | undefined> {
    const { panelCharacterStates } = await import("@shared/schema");
    const [updated] = await db
      .update(panelCharacterStates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(panelCharacterStates.id, id))
      .returning();
    
    return updated;
  }

  async upsertPanelCharacterState(panelId: string, characterId: string, state: Partial<PanelCharacterState>): Promise<PanelCharacterState> {
    const { panelCharacterStates } = await import("@shared/schema");
    
    // Try to find existing state
    const [existing] = await db
      .select()
      .from(panelCharacterStates)
      .where(
        and(
          eq(panelCharacterStates.panelId, panelId),
          eq(panelCharacterStates.characterId, characterId)
        )
      );

    if (existing) {
      // Update existing
      return await this.updatePanelCharacterState(existing.id, state) || existing;
    } else {
      // Create new
      return await this.createPanelCharacterState({
        ...state,
        panelId,
        characterId,
        id: randomUUID(),
      });
    }
  }

  async storeVisualAnalysisResults(panelId: string, analysisResults: {
    characters: Array<{
      characterId: string;
      characterName: string;
      isPresent: boolean;
      confidence: number;
      visualDetails?: any;
    }>;
    rawAnalysisData: any;
    analysisTimestamp: Date;
  }): Promise<PanelCharacterState[]> {
    const results: PanelCharacterState[] = [];
    
    for (const character of analysisResults.characters) {
      const visualDetails = character.visualDetails;
      const state = await this.upsertPanelCharacterState(panelId, character.characterId, {
        characterName: character.characterName,
        isPresent: character.isPresent,
        confidenceScore: character.confidence,
        visualAnalysisPerformed: true,
        visualAnalysisTimestamp: analysisResults.analysisTimestamp,
        rawVisualAnalysisData: analysisResults.rawAnalysisData,
        
        // Extract visual details
        detectedHairColor: visualDetails?.hair?.color,
        detectedHairStyle: visualDetails?.hair?.style,
        detectedHairLength: visualDetails?.hair?.length,
        detectedHairTexture: visualDetails?.hair?.texture,
        detectedUpperBody: visualDetails?.clothing?.upperBody,
        detectedLowerBody: visualDetails?.clothing?.lowerBody,
        detectedOuterwear: visualDetails?.clothing?.outerwear,
        detectedClothingColors: visualDetails?.clothing?.colors,
        detectedSkinTone: visualDetails?.physicalAppearance?.skinTone,
        detectedEyeColor: visualDetails?.physicalAppearance?.eyeColor,
        facialExpression: visualDetails?.physicalAppearance?.facialExpression,
        bodyLanguage: visualDetails?.physicalAppearance?.bodyLanguage,
        detectedPose: visualDetails?.physicalAppearance?.pose,
        detectedJewelry: visualDetails?.accessories?.jewelry,
        detectedGlasses: visualDetails?.accessories?.glasses,
        detectedHat: visualDetails?.accessories?.hat,
        detectedScreenPosition: visualDetails?.location?.position,
      });
      
      results.push(state);
    }
    
    return results;
  }

  async getCharacterVisualHistoryDetailed(characterId: string, limit?: number): Promise<Array<{
    panelId: string;
    panelNumber?: number;
    pageNumber?: number;
    appearance: PanelCharacterState;
    timestamp: Date;
    confidenceScore?: number;
    hasVisualAnalysis: boolean;
  }>> {
    const { panelCharacterStates, panels, pages } = await import("@shared/schema");
    
    let query = db
      .select({
        state: panelCharacterStates,
        panel: panels,
        page: pages,
      })
      .from(panelCharacterStates)
      .leftJoin(panels, eq(panelCharacterStates.panelId, panels.id))
      .leftJoin(pages, eq(panels.pageId, pages.id))
      .where(eq(panelCharacterStates.characterId, characterId))
      .orderBy(desc(panelCharacterStates.createdAt));

    if (limit) {
      query = query.limit(limit);
    }

    const results = await query;
    
    return results.map(row => ({
      panelId: row.state.panelId,
      panelNumber: row.panel?.panelNumber,
      pageNumber: row.page?.pageNumber,
      appearance: row.state,
      timestamp: row.state.createdAt || new Date(),
      confidenceScore: row.state.confidenceScore || undefined,
      hasVisualAnalysis: row.state.visualAnalysisPerformed || false,
    }));
  }

  async getProjectCharacterVisualSummary(projectId: string): Promise<Array<{
    characterId: string;
    characterName: string;
    totalAppearances: number;
    averageConfidenceScore: number;
    visualAnalysisCount: number;
    mostCommonClothing: {
      upperBody?: string;
      lowerBody?: string;
      colors: string[];
    };
    consistentFeatures: string[];
    lastAppearancePanel: string;
    lastAnalysisTimestamp?: Date;
  }>> {
    const { panelCharacterStates, panels, pages } = await import("@shared/schema");
    
    // Get all character states for the project
    const states = await db
      .select()
      .from(panelCharacterStates)
      .leftJoin(panels, eq(panelCharacterStates.panelId, panels.id))
      .leftJoin(pages, eq(panels.pageId, pages.id))
      .where(eq(pages.projectId, projectId));

    // Group by character and calculate summaries
    const characterGroups = new Map<string, any[]>();
    states.forEach(row => {
      const characterId = row.panel_character_states.characterId;
      if (!characterGroups.has(characterId)) {
        characterGroups.set(characterId, []);
      }
      characterGroups.get(characterId)!.push(row.panel_character_states);
    });

    const summaries = [];
    for (const [characterId, characterStates] of characterGroups) {
      const visualAnalysisStates = characterStates.filter(s => s.visualAnalysisPerformed);
      const totalConfidence = visualAnalysisStates.reduce((sum, s) => sum + (s.confidenceScore || 0), 0);
      
      summaries.push({
        characterId,
        characterName: characterStates[0]?.characterName || '',
        totalAppearances: characterStates.length,
        averageConfidenceScore: visualAnalysisStates.length > 0 ? totalConfidence / visualAnalysisStates.length : 0,
        visualAnalysisCount: visualAnalysisStates.length,
        mostCommonClothing: {
          upperBody: this.findMostCommon(characterStates.map(s => s.detectedUpperBody).filter(Boolean)),
          lowerBody: this.findMostCommon(characterStates.map(s => s.detectedLowerBody).filter(Boolean)),
          colors: this.extractAllClothingColors(characterStates),
        },
        consistentFeatures: this.identifyConsistentFeatures(characterStates),
        lastAppearancePanel: characterStates[characterStates.length - 1]?.panelId || '',
        lastAnalysisTimestamp: Math.max(...visualAnalysisStates.map(s => s.visualAnalysisTimestamp?.getTime() || 0)) || undefined,
      });
    }

    return summaries;
  }

  async identifyVisualInconsistencies(characterId: string, projectId: string): Promise<Array<{
    panelIds: string[];
    inconsistencyType: 'hair' | 'clothing' | 'physical' | 'accessories';
    description: string;
    severity: 'minor' | 'moderate' | 'major';
    expectedValue: string;
    actualValues: string[];
  }>> {
    // Get character visual history
    const history = await this.getCharacterVisualHistoryDetailed(characterId);
    const inconsistencies = [];

    // Check hair color consistency
    const hairColors = history.map(h => h.appearance.detectedHairColor).filter(Boolean);
    if (new Set(hairColors).size > 1) {
      inconsistencies.push({
        panelIds: history.filter(h => h.appearance.detectedHairColor).map(h => h.panelId),
        inconsistencyType: 'hair' as const,
        description: 'Hair color varies across panels',
        severity: 'moderate' as const,
        expectedValue: this.findMostCommon(hairColors) || '',
        actualValues: Array.from(new Set(hairColors)),
      });
    }

    // Add more consistency checks here...

    return inconsistencies;
  }

  async markVisualAnalysisComplete(panelId: string, characterIds: string[]): Promise<boolean> {
    const { panelCharacterStates } = await import("@shared/schema");
    
    try {
      await db
        .update(panelCharacterStates)
        .set({ 
          visualAnalysisPerformed: true,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(panelCharacterStates.panelId, panelId),
            inArray(panelCharacterStates.characterId, characterIds)
          )
        );
      
      return true;
    } catch (error) {
      console.error('Error marking visual analysis complete:', error);
      return false;
    }
  }

  // Helper methods for visual analysis
  private findMostCommon(items: string[]): string | undefined {
    if (items.length === 0) return undefined;
    
    const counts = new Map<string, number>();
    items.forEach(item => counts.set(item, (counts.get(item) || 0) + 1));
    
    let mostCommon = '';
    let maxCount = 0;
    counts.forEach((count, item) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = item;
      }
    });
    
    return mostCommon;
  }

  private extractAllClothingColors(states: any[]): string[] {
    const colors = new Set<string>();
    states.forEach(state => {
      if (state.detectedClothingColors && Array.isArray(state.detectedClothingColors)) {
        state.detectedClothingColors.forEach((color: string) => colors.add(color));
      }
    });
    return Array.from(colors);
  }

  private identifyConsistentFeatures(states: any[]): string[] {
    const features = [];
    
    // Check for consistent features across states
    const hairColors = states.map(s => s.detectedHairColor).filter(Boolean);
    if (new Set(hairColors).size === 1 && hairColors.length > 1) {
      features.push(`Hair color: ${hairColors[0]}`);
    }
    
    const hairStyles = states.map(s => s.detectedHairStyle).filter(Boolean);
    if (new Set(hairStyles).size === 1 && hairStyles.length > 1) {
      features.push(`Hair style: ${hairStyles[0]}`);
    }
    
    // Add more feature checks...
    
    return features;
  }
}

export const storage = new DatabaseStorage();
