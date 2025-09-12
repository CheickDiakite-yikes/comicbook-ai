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
  redressJobs,
  securityAuditLogs,
  rateLimitingLog,
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
  type RedressJob,
  type InsertRedressJob,
  type SecurityAuditLog,
  type InsertSecurityAuditLog,
  type RateLimitingLog,
  type InsertRateLimitingLog,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, desc, and, sql, count, gte, lte } from "drizzle-orm";

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
  
  // Public projects
  getPublicProjects(genre?: string): Promise<any[]>;
  getUserProjectsWithStats(userId: string): Promise<any[]>;
  
  // Likes
  likeProject(projectId: string, userId: string): Promise<ProjectLike>;
  unlikeProject(projectId: string, userId: string): Promise<boolean>;
  
  // Comments
  getProjectComments(projectId: string): Promise<any[]>;
  createProjectComment(comment: InsertProjectComment): Promise<ProjectComment>;

  // Character library operations
  getUserLibraryCharacters(userId: string): Promise<Character[]>;
  createLibraryCharacter(userId: string, character: Omit<InsertCharacter, 'projectId'>): Promise<Character>;
  updateLibraryCharacter(id: string, userId: string, updates: Partial<InsertCharacter>): Promise<Character | undefined>;
  deleteLibraryCharacter(id: string, userId: string): Promise<boolean>;
  copyCharacterToProject(characterId: string, projectId: string, userId: string): Promise<Character>;

  // Redress job operations
  createRedressJob(job: InsertRedressJob): Promise<RedressJob>;
  getRedressJob(id: string): Promise<RedressJob | undefined>;
  updateRedressJob(id: string, updates: Partial<InsertRedressJob>): Promise<RedressJob | undefined>;
  getUserRedressJobs(userId: string, limit?: number): Promise<RedressJob[]>;
  deleteRedressJob(id: string): Promise<boolean>;

  // Security audit operations - Enterprise security logging
  createSecurityAuditLog(auditLog: InsertSecurityAuditLog): Promise<SecurityAuditLog>;
  getSecurityAuditLogs(filters: {
    userId?: string;
    ipAddress?: string;
    endpoint?: string;
    accessDecision?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<SecurityAuditLog[]>;
  
  // Rate limiting operations
  getRateLimitingStatus(userId?: string, ipAddress?: string, endpoint?: string): Promise<{
    isLimited: boolean;
    currentCount: number;
    windowStart: Date;
    windowEnd: Date;
    limit: number;
  }>;
  updateRateLimitingLog(rateLimitLog: InsertRateLimitingLog): Promise<RateLimitingLog>;
  cleanupExpiredRateLimits(): Promise<number>;
  
  // Additional rate limiting methods for SecurityAuditService  
  getRateLimitCount(key: string, endpoint: string, windowStart: Date, windowEnd: Date): Promise<number>;
  createRateLimitingLog(rateLimitLog: InsertRateLimitingLog): Promise<RateLimitingLog>;
  deleteOldSecurityAuditLogs(cutoffDate: Date): Promise<number>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private projects: Map<string, Project> = new Map();
  private characters: Map<string, Character> = new Map();
  private pages: Map<string, Page> = new Map();
  private panels: Map<string, Panel> = new Map();
  private redressJobs: Map<string, RedressJob> = new Map();
  private securityAuditLogs: Map<string, SecurityAuditLog> = new Map();
  private rateLimitingLogs: Map<string, RateLimitingLog> = new Map();

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
      isAgeVerified: null,
      ageVerifiedAt: null,
      birthMonth: null,
      birthYear: null,
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
      wardrobePresets: characterData.wardrobePresets || null,
      currentOutfit: characterData.currentOutfit || null,
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

    const updatedPage: Page = {
      ...page,
      ...updates,
      updatedAt: new Date(),
    };
    this.pages.set(id, updatedPage);
    return updatedPage;
  }

  async deletePage(id: string): Promise<boolean> {
    return this.pages.delete(id);
  }

  // Panel operations
  async createPanel(panelData: InsertPanel): Promise<Panel> {
    const panel: Panel = {
      id: randomUUID(),
      pageId: panelData.pageId,
      panelNumber: panelData.panelNumber,
      prompt: panelData.prompt || null,
      imageUrl: panelData.imageUrl || null,
      speechBubbles: panelData.speechBubbles || null,
      revisions: panelData.revisions || null,
      isGenerated: panelData.isGenerated || false,
      generationStatus: panelData.generationStatus || "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.panels.set(panel.id, panel);
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

    const updatedPanel: Panel = {
      ...panel,
      ...updates,
      updatedAt: new Date(),
    };
    this.panels.set(id, updatedPanel);
    return updatedPanel;
  }

  async deletePanel(id: string): Promise<boolean> {
    return this.panels.delete(id);
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

  async getPublicProjects(genre?: string): Promise<any[]> {
    return []; // Not implemented for in-memory storage
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

  // Redress job operations
  async createRedressJob(jobData: InsertRedressJob): Promise<RedressJob> {
    const job: RedressJob = {
      id: randomUUID(),
      userId: jobData.userId,
      panelId: jobData.panelId,
      status: jobData.status || "queued",
      originalImageUrl: jobData.originalImageUrl,
      previewImageUrl: jobData.previewImageUrl || null,
      finalImageUrl: jobData.finalImageUrl || null,
      characterIds: jobData.characterIds,
      outfitSpecs: jobData.outfitSpecs,
      isPreview: jobData.isPreview || false,
      strength: jobData.strength || 75,
      progress: jobData.progress || 0,
      errorMessage: jobData.errorMessage || null,
      processingSteps: jobData.processingSteps || null,
      metadata: jobData.metadata || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.redressJobs.set(job.id, job);
    return job;
  }

  async getRedressJob(id: string): Promise<RedressJob | undefined> {
    return this.redressJobs.get(id);
  }

  async updateRedressJob(id: string, updates: Partial<InsertRedressJob>): Promise<RedressJob | undefined> {
    const existing = this.redressJobs.get(id);
    if (!existing) return undefined;

    const updated: RedressJob = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.redressJobs.set(id, updated);
    return updated;
  }

  async getUserRedressJobs(userId: string, limit: number = 50): Promise<RedressJob[]> {
    const userJobs = Array.from(this.redressJobs.values())
      .filter(job => job.userId === userId)
      .sort((a, b) => (b.createdAt || new Date()).getTime() - (a.createdAt || new Date()).getTime())
      .slice(0, limit);
    return userJobs;
  }

  async deleteRedressJob(id: string): Promise<boolean> {
    return this.redressJobs.delete(id);
  }

  // Security audit operations - In-memory implementation
  async createSecurityAuditLog(auditLogData: InsertSecurityAuditLog): Promise<SecurityAuditLog> {
    const auditLog: SecurityAuditLog = {
      id: randomUUID(),
      ...auditLogData,
      createdAt: new Date(),
    };
    this.securityAuditLogs.set(auditLog.id, auditLog);
    return auditLog;
  }

  async getSecurityAuditLogs(filters: any): Promise<SecurityAuditLog[]> {
    let logs = Array.from(this.securityAuditLogs.values());
    
    if (filters.userId) {
      logs = logs.filter(log => log.userId === filters.userId);
    }
    if (filters.ipAddress) {
      logs = logs.filter(log => log.ipAddress === filters.ipAddress);
    }
    if (filters.endpoint) {
      logs = logs.filter(log => log.endpoint === filters.endpoint);
    }
    if (filters.accessDecision) {
      logs = logs.filter(log => log.accessDecision === filters.accessDecision);
    }
    
    return logs
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, filters.limit || 100);
  }

  // Rate limiting operations - In-memory implementation
  async getRateLimitingStatus(userId?: string, ipAddress?: string, endpoint?: string): Promise<any> {
    // Simple in-memory rate limiting for development
    const now = new Date();
    const windowStart = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour window
    
    let currentCount = 0;
    for (const log of this.rateLimitingLogs.values()) {
      if (log.endpoint === endpoint && log.windowStart >= windowStart) {
        if ((userId && log.userId === userId) || (ipAddress && log.ipAddress === ipAddress)) {
          currentCount += log.requestCount;
        }
      }
    }
    
    return {
      isLimited: currentCount >= 100, // 100 requests per hour
      currentCount,
      windowStart,
      windowEnd: new Date(windowStart.getTime() + 60 * 60 * 1000),
      limit: 100,
    };
  }

  async updateRateLimitingLog(rateLimitLogData: InsertRateLimitingLog): Promise<RateLimitingLog> {
    const log: RateLimitingLog = {
      id: randomUUID(),
      ...rateLimitLogData,
      createdAt: new Date(),
    };
    this.rateLimitingLogs.set(log.id, log);
    return log;
  }

  async cleanupExpiredRateLimits(): Promise<number> {
    const now = new Date();
    let deletedCount = 0;
    
    for (const [id, log] of this.rateLimitingLogs.entries()) {
      if (log.windowEnd < now) {
        this.rateLimitingLogs.delete(id);
        deletedCount++;
      }
    }
    
    return deletedCount;
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
          })
          .onConflictDoUpdate({
            target: users.id,
            set: {
              email: userData.email,
              firstName: userData.firstName,
              lastName: userData.lastName,
              profileImageUrl: userData.profileImageUrl,
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
          })
          .onConflictDoUpdate({
            target: users.email, // Use email as conflict target when no ID provided
            set: {
              firstName: userData.firstName,
              lastName: userData.lastName,
              profileImageUrl: userData.profileImageUrl,
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
      // First delete all panels associated with this page
      await db.delete(panels).where(eq(panels.pageId, id));
      
      // Then delete the page itself
      const result = await db.delete(pages).where(eq(pages.id, id));
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error("Error deleting page and associated panels:", error);
      return false;
    }
  }

  // Panel operations
  async createPanel(panelData: InsertPanel): Promise<Panel> {
    const [panel] = await db.insert(panels).values(panelData).returning();
    return panel;
  }

  async getPanel(id: string): Promise<Panel | undefined> {
    const [panel] = await db
      .select()
      .from(panels)
      .where(eq(panels.id, id))
      .limit(1);
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
    const [panel] = await db
      .update(panels)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(panels.id, id))
      .returning();
    return panel || undefined;
  }

  async deletePanel(id: string): Promise<boolean> {
    const result = await db.delete(panels).where(eq(panels.id, id));
    return result.rowCount !== null && result.rowCount > 0;
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

  // ========================================
  // Redress Job Operations
  // ========================================

  async createRedressJob(jobData: InsertRedressJob): Promise<RedressJob> {
    const [job] = await db
      .insert(redressJobs)
      .values(jobData)
      .returning();
    return job;
  }

  async getRedressJob(id: string): Promise<RedressJob | undefined> {
    const [job] = await db
      .select()
      .from(redressJobs)
      .where(eq(redressJobs.id, id));
    return job || undefined;
  }

  async updateRedressJob(id: string, updates: Partial<InsertRedressJob>): Promise<RedressJob | undefined> {
    const [job] = await db
      .update(redressJobs)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(redressJobs.id, id))
      .returning();
    return job || undefined;
  }

  async getUserRedressJobs(userId: string, limit: number = 50): Promise<RedressJob[]> {
    const jobs = await db
      .select()
      .from(redressJobs)
      .where(eq(redressJobs.userId, userId))
      .orderBy(desc(redressJobs.createdAt))
      .limit(limit);
    return jobs;
  }

  async deleteRedressJob(id: string): Promise<boolean> {
    const result = await db
      .delete(redressJobs)
      .where(eq(redressJobs.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Security audit operations - Database implementation
  async createSecurityAuditLog(auditLogData: InsertSecurityAuditLog): Promise<SecurityAuditLog> {
    try {
      const [auditLog] = await db
        .insert(securityAuditLogs)
        .values(auditLogData)
        .returning();
      
      console.log(`🔐 Security Audit Log Created: ${auditLog.accessDecision} for ${auditLog.endpoint}`);
      return auditLog;
    } catch (error) {
      console.error("Error creating security audit log:", error);
      throw error;
    }
  }

  async getSecurityAuditLogs(filters: {
    userId?: string;
    ipAddress?: string;
    endpoint?: string;
    accessDecision?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<SecurityAuditLog[]> {
    try {
      let query = db.select().from(securityAuditLogs);
      
      const conditions: any[] = [];
      
      if (filters.userId) {
        conditions.push(eq(securityAuditLogs.userId, filters.userId));
      }
      if (filters.ipAddress) {
        conditions.push(eq(securityAuditLogs.ipAddress, filters.ipAddress));
      }
      if (filters.endpoint) {
        conditions.push(eq(securityAuditLogs.endpoint, filters.endpoint));
      }
      if (filters.accessDecision) {
        conditions.push(eq(securityAuditLogs.accessDecision, filters.accessDecision));
      }
      if (filters.startDate) {
        conditions.push(gte(securityAuditLogs.createdAt, filters.startDate));
      }
      if (filters.endDate) {
        conditions.push(lte(securityAuditLogs.createdAt, filters.endDate));
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      
      const logs = await query
        .orderBy(desc(securityAuditLogs.createdAt))
        .limit(filters.limit || 100);
      
      return logs;
    } catch (error) {
      console.error("Error fetching security audit logs:", error);
      throw error;
    }
  }

  // Rate limiting operations - Database implementation
  async getRateLimitingStatus(userId?: string, ipAddress?: string, endpoint?: string): Promise<{
    isLimited: boolean;
    currentCount: number;
    windowStart: Date;
    windowEnd: Date;
    limit: number;
  }> {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour window
      
      let query = db.select({
        totalCount: sql<number>`COALESCE(SUM(${rateLimitingLog.requestCount}), 0)`
      }).from(rateLimitingLog);
      
      const conditions: any[] = [
        gte(rateLimitingLog.windowStart, oneHourAgo),
        lte(rateLimitingLog.windowEnd, now)
      ];
      
      if (endpoint) {
        conditions.push(eq(rateLimitingLog.endpoint, endpoint));
      }
      
      if (userId) {
        conditions.push(eq(rateLimitingLog.userId, userId));
      } else if (ipAddress) {
        conditions.push(eq(rateLimitingLog.ipAddress, ipAddress));
      }
      
      query = query.where(and(...conditions));
      
      const result = await query;
      const currentCount = result[0]?.totalCount || 0;
      
      // Different limits based on endpoint sensitivity
      let hourlyLimit = 100; // Default
      if (endpoint?.includes('generate')) {
        hourlyLimit = 50; // Stricter for generation endpoints
      }
      if (endpoint?.includes('redress') || endpoint?.includes('adult')) {
        hourlyLimit = 20; // Very strict for NSFW endpoints
      }
      
      return {
        isLimited: currentCount >= hourlyLimit,
        currentCount,
        windowStart: oneHourAgo,
        windowEnd: now,
        limit: hourlyLimit,
      };
    } catch (error) {
      console.error("Error checking rate limiting status:", error);
      // On error, allow request but log it
      const now = new Date();
      return {
        isLimited: false,
        currentCount: 0,
        windowStart: new Date(now.getTime() - 60 * 60 * 1000),
        windowEnd: now,
        limit: 100,
      };
    }
  }

  async updateRateLimitingLog(rateLimitLogData: InsertRateLimitingLog): Promise<RateLimitingLog> {
    try {
      // First try to find existing log for the same window
      const existingLog = await db
        .select()
        .from(rateLimitingLog)
        .where(
          and(
            eq(rateLimitingLog.userId, rateLimitLogData.userId || ''),
            eq(rateLimitingLog.ipAddress, rateLimitLogData.ipAddress),
            eq(rateLimitingLog.endpoint, rateLimitLogData.endpoint),
            gte(rateLimitingLog.windowStart, rateLimitLogData.windowStart),
            lte(rateLimitingLog.windowEnd, rateLimitLogData.windowEnd)
          )
        )
        .limit(1);
      
      if (existingLog.length > 0) {
        // Update existing log
        const [updatedLog] = await db
          .update(rateLimitingLog)
          .set({
            requestCount: sql`${rateLimitingLog.requestCount} + ${rateLimitLogData.requestCount || 1}`,
            limitExceeded: rateLimitLogData.limitExceeded,
          })
          .where(eq(rateLimitingLog.id, existingLog[0].id))
          .returning();
        
        return updatedLog;
      } else {
        // Create new log
        const [newLog] = await db
          .insert(rateLimitingLog)
          .values(rateLimitLogData)
          .returning();
        
        return newLog;
      }
    } catch (error) {
      console.error("Error updating rate limiting log:", error);
      throw error;
    }
  }

  async cleanupExpiredRateLimits(): Promise<number> {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000); // Clean up logs older than 1 day
      
      const result = await db
        .delete(rateLimitingLog)
        .where(lte(rateLimitingLog.createdAt, oneDayAgo));
      
      const deletedCount = result.rowCount || 0;
      if (deletedCount > 0) {
        console.log(`🧹 Cleaned up ${deletedCount} expired rate limit logs`);
      }
      
      return deletedCount;
    } catch (error) {
      console.error("Error cleaning up expired rate limits:", error);
      return 0;
    }
  }

  // Additional methods for SecurityAuditService
  async getRateLimitCount(key: string, endpoint: string, windowStart: Date, windowEnd: Date): Promise<number> {
    try {
      const result = await db
        .select({ count: sql<number>`sum(${rateLimitingLog.requestCount})` })
        .from(rateLimitingLog)
        .where(
          and(
            eq(rateLimitingLog.endpoint, endpoint),
            gte(rateLimitingLog.windowStart, windowStart),
            lte(rateLimitingLog.windowEnd, windowEnd),
            sql`(${rateLimitingLog.userId} = ${key} OR ${rateLimitingLog.ipAddress} = ${key})`
          )
        );
      
      return result[0]?.count || 0;
    } catch (error) {
      console.error("Error getting rate limit count:", error);
      return 0;
    }
  }

  async createRateLimitingLog(rateLimitLogData: InsertRateLimitingLog): Promise<RateLimitingLog> {
    try {
      const [newLog] = await db
        .insert(rateLimitingLog)
        .values(rateLimitLogData)
        .returning();
      
      return newLog;
    } catch (error) {
      console.error("Error creating rate limiting log:", error);
      throw error;
    }
  }

  async deleteOldSecurityAuditLogs(cutoffDate: Date): Promise<number> {
    try {
      const result = await db
        .delete(securityAuditLogs)
        .where(lte(securityAuditLogs.timestamp, cutoffDate));
      
      const deletedCount = result.rowCount || 0;
      if (deletedCount > 0) {
        console.log(`🧹 Security Audit Cleanup: Removed ${deletedCount} logs older than 90 days`);
      }
      
      return deletedCount;
    } catch (error) {
      console.error("Error cleaning up security audit logs:", error);
      return 0;
    }
  }
}

export const storage = new DatabaseStorage();
