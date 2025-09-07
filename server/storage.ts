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
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

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
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private projects: Map<string, Project> = new Map();
  private characters: Map<string, Character> = new Map();
  private pages: Map<string, Page> = new Map();
  private panels: Map<string, Panel> = new Map();

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existingUser = Array.from(this.users.values()).find(u => u.email === userData.email);
    
    if (existingUser) {
      const updatedUser: User = {
        ...existingUser,
        ...userData,
        updatedAt: new Date(),
      };
      this.users.set(existingUser.id, updatedUser);
      return updatedUser;
    }

    const user: User = {
      id: randomUUID(),
      email: userData.email || null,
      firstName: userData.firstName || null,
      lastName: userData.lastName || null,
      profileImageUrl: userData.profileImageUrl || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(user.id, user);
    return user;
  }

  // Project operations
  async createProject(userId: string, projectData: InsertProject): Promise<Project> {
    const project: Project = {
      id: randomUUID(),
      userId,
      title: projectData.title,
      description: projectData.description || null,
      genre: projectData.genre || null,
      artStyle: projectData.artStyle || null,
      script: projectData.script || null,
      settings: projectData.settings || null,
      canonRules: projectData.canonRules || null,
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
      projectId: characterData.projectId,
      name: characterData.name,
      role: characterData.role || null,
      bio: characterData.bio || null,
      visualDescriptors: characterData.visualDescriptors || null,
      alwaysTraits: characterData.alwaysTraits || null,
      neverTraits: characterData.neverTraits || null,
      referenceImageUrl: characterData.referenceImageUrl || null,
      colorScheme: characterData.colorScheme || null,
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
      isGenerated: panelData.isGenerated || false,
      generationStatus: panelData.generationStatus || "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.panels.set(panel.id, panel);
    return panel;
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
}

// Database storage implementation
export class DatabaseStorage implements IStorage {
  // User operations (mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
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
    const result = await db.delete(projects).where(eq(projects.id, id));
    return result.rowCount !== null && result.rowCount > 0;
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
}

export const storage = new DatabaseStorage();
