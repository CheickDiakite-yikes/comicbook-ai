import { ParallelGenerationManager, ParallelGenerationRequest, ParallelGenerationTask, ParallelGenerationOptions } from './ParallelGenerationManager';
import { IStorage } from '../storage';
import { GenerateImageRequest, geminiService } from '../gemini';
import { CREDIT_COSTS, CreditOperationType } from '../creditMiddleware';
import { ResourceManager } from './ResourceManager';
import { SharedStateManager } from './SharedStateManager';

export interface ParallelPanelGenerationRequest {
  projectId: string;
  pageId?: string;
  panels: Array<{
    id: string;
    prompt: string;
    panelNumber: number;
    dependencies?: string[]; // Panel IDs this depends on
    priority?: number;
  }>;
  options?: Partial<ParallelGenerationOptions>;
}

export interface ParallelPageGenerationRequest {
  projectId: string;
  pages: Array<{
    id: string;
    pageNumber: number;
    script: any;
    layout: any;
    dependencies?: string[]; // Page IDs this depends on
    priority?: number;
  }>;
  options?: Partial<ParallelGenerationOptions>;
}

export interface ParallelBatchGenerationRequest {
  projectId: string;
  batches: Array<{
    type: 'panels' | 'pages' | 'backgrounds' | 'covers';
    items: any[];
    batchPriority: number;
  }>;
  options?: Partial<ParallelGenerationOptions>;
}

export class ParallelGenerationService {
  private manager: ParallelGenerationManager;
  private storage: IStorage;
  private resourceManager: ResourceManager;
  private sharedStateManager: SharedStateManager;

  constructor(storage: IStorage) {
    this.storage = storage;
    this.manager = new ParallelGenerationManager(storage);
    this.resourceManager = new ResourceManager();
    this.sharedStateManager = new SharedStateManager();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.manager.on('sessionStarted', (sessionId, result) => {
      console.log(`🚀 Parallel generation session started: ${sessionId}`);
    });

    this.manager.on('sessionCompleted', (sessionId, result) => {
      console.log(`✅ Parallel generation session completed: ${sessionId}`);
      console.log(`  - Total tasks: ${result.totalTasks}`);
      console.log(`  - Completed: ${result.completedTasks}`);
      console.log(`  - Failed: ${result.failedTasks}`);
      
      // RESOURCE MANAGEMENT: Release resources when session completes
      this.resourceManager.endSession(result.userId, sessionId, result.endTime ? (result.endTime.getTime() - result.startTime.getTime()) / 1000 : 0);
    });

    this.manager.on('taskCompleted', (sessionId, taskId, result) => {
      console.log(`📝 Task completed: ${taskId} in session ${sessionId}`);
      
      // CHARACTER CONSISTENCY: Update character states after task completion
      if (result.status === 'completed') {
        this.sharedStateManager.updateCharacterStates(taskId, result);
      }
    });

    this.manager.on('taskFailed', (sessionId, taskId, error) => {
      console.error(`❌ Task failed: ${taskId} in session ${sessionId}`, error);
    });

    this.manager.on('progressUpdate', (sessionId, progress) => {
      console.log(`📊 Progress update for ${sessionId}: ${progress.progress}%`);
    });
    
    this.manager.on('sessionFailed', (sessionId, result, error) => {
      console.error(`❌ Parallel generation session failed: ${sessionId}`, error);
      
      // RESOURCE MANAGEMENT: Release resources when session fails
      this.resourceManager.endSession(result.userId, sessionId, 0);
    });
    
    this.manager.on('sessionCancelled', (sessionId, result) => {
      console.log(`🚫 Parallel generation session cancelled: ${sessionId}`);
      
      // RESOURCE MANAGEMENT: Release resources when session is cancelled
      this.resourceManager.cancelSession(result.userId, sessionId);
    });
  }

  /**
   * Generate multiple panels in parallel - SECURED WITH RESOURCE MANAGEMENT
   */
  async generatePanelsInParallel(
    userId: string,
    request: ParallelPanelGenerationRequest
  ): Promise<string> {
    // RESOURCE MANAGEMENT: Check if user can start this session
    const resourceCheck = await this.resourceManager.canStartSession(
      userId, 
      'pending', 
      request.panels.length
    );
    
    if (!resourceCheck.canStart) {
      throw new Error(`Resource limit exceeded: ${resourceCheck.reason}`);
    }

    // Get project context
    const project = await this.storage.getProject(request.projectId);
    if (!project || project.userId !== userId) {
      throw new Error('Project not found or access denied');
    }
    
    // CHARACTER CONSISTENCY: Initialize shared state for character consistency
    await this.sharedStateManager.initializeProject(request.projectId, this.storage);

    const characters = await this.storage.getProjectCharacters(request.projectId);
    
    // Build project context
    const projectContext = {
      title: project.title,
      genre: project.genre,
      description: project.description,
      artStyle: project.artStyle,
      characters: characters.map(char => ({
        name: char.name,
        role: char.role,
        bio: char.bio,
        visualDescriptors: char.visualDescriptors,
        alwaysTraits: char.alwaysTraits,
        neverTraits: char.neverTraits,
        colorScheme: char.colorScheme,
        referenceImageUrl: char.referenceImageUrl
      }))
    };

    // Create parallel generation tasks
    const tasks: ParallelGenerationTask[] = request.panels.map(panel => ({
      id: `panel_${panel.id}_${Date.now()}`,
      type: 'panel',
      priority: panel.priority || 1,
      dependencies: panel.dependencies || [],
      payload: {
        prompt: panel.prompt,
        panelId: panel.id,
        projectContext,
        panelContext: {
          layoutTemplate: 'default',
          panelNumber: panel.panelNumber,
          aspectRatio: 1.0,
          dimensions: { width: 512, height: 512 },
          panelType: 'dialogue'
        }
      } as GenerateImageRequest
    }));

    // Default options
    const options: ParallelGenerationOptions = {
      maxConcurrency: 4,
      batchSize: 8,
      enableDependencyTracking: true,
      enableCharacterConsistency: true,
      enableProgressTracking: true,
      timeoutMs: 180000, // 3 minutes per task
      retryStrategy: 'exponential',
      priorityMode: 'dependency',
      ...request.options
    };

    // SESSION ID GENERATION: Create unique session ID for resource tracking
    const sessionId = `parallel_panels_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // RESOURCE MANAGEMENT: Reserve resources for this session
    const resourceReserved = await this.resourceManager.startSession(userId, sessionId, request.panels.length);
    if (!resourceReserved) {
      throw new Error('Failed to reserve resources for session - user limit exceeded');
    }

    try {
      // Calculate and check credits (NOTE: Already done in routes but double-check for security)
      const totalCredits = tasks.length * CREDIT_COSTS.panel_generation;
      const hasEnoughCredits = await this.storage.hasEnoughCredits(userId, totalCredits);
      if (!hasEnoughCredits) {
        throw new Error(`Insufficient credits. Required: ${totalCredits}, operation: parallel_panel_generation`);
      }

      // Create parallel generation request
      const parallelRequest: ParallelGenerationRequest = {
        sessionId,
        userId,
        projectId: request.projectId,
        tasks,
        options
      };

      // Start parallel generation
      const startedSessionId = await this.manager.startParallelGeneration(parallelRequest);
      
      console.log(`🎯 Started parallel panel generation: ${startedSessionId} (${tasks.length} panels)`);
      return startedSessionId;
    } catch (error) {
      // RESOURCE MANAGEMENT: Release resources if session failed to start
      await this.resourceManager.endSession(userId, sessionId, 0);
      throw error;
    }
  }

  /**
   * Generate multiple pages in parallel - SECURED WITH RESOURCE MANAGEMENT
   */
  async generatePagesInParallel(
    userId: string,
    request: ParallelPageGenerationRequest
  ): Promise<string> {
    // RESOURCE MANAGEMENT: Check if user can start this session
    const resourceCheck = await this.resourceManager.canStartSession(
      userId, 
      'pending', 
      request.pages.length
    );
    
    if (!resourceCheck.canStart) {
      throw new Error(`Resource limit exceeded: ${resourceCheck.reason}`);
    }

    // Get project context
    const project = await this.storage.getProject(request.projectId);
    if (!project || project.userId !== userId) {
      throw new Error('Project not found or access denied');
    }
    
    // CHARACTER CONSISTENCY: Initialize shared state for character consistency
    await this.sharedStateManager.initializeProject(request.projectId, this.storage);

    // Create tasks for each page (pages contain multiple panels)
    const tasks: ParallelGenerationTask[] = [];
    
    for (const page of request.pages) {
      // Each page might have multiple panels, create tasks for each
      const panels = page.script?.panels || [];
      
      for (let i = 0; i < panels.length; i++) {
        const panel = panels[i];
        tasks.push({
          id: `page_${page.id}_panel_${i}_${Date.now()}`,
          type: 'panel',
          priority: page.priority || 1,
          dependencies: page.dependencies || [],
          payload: {
            prompt: panel.visualDescription || `Panel ${i + 1} for page ${page.pageNumber}`,
            panelId: `${page.id}_panel_${i}`,
            projectContext: await this.buildProjectContext(request.projectId),
            panelContext: {
              layoutTemplate: page.layout?.template || 'default',
              panelNumber: i + 1,
              aspectRatio: 1.0,
              dimensions: { width: 512, height: 512 },
              panelType: panel.panelType || 'dialogue'
            }
          } as GenerateImageRequest
        });
      }
    }

    const options: ParallelGenerationOptions = {
      maxConcurrency: 6,
      batchSize: 12,
      enableDependencyTracking: true,
      enableCharacterConsistency: true,
      enableProgressTracking: true,
      timeoutMs: 240000, // 4 minutes per task
      retryStrategy: 'exponential',
      priorityMode: 'dependency',
      ...request.options
    };

    // Calculate credits (using full page generation cost)
    const totalCredits = request.pages.length * CREDIT_COSTS.full_page_generation;
    const hasEnoughCredits = await this.storage.hasEnoughCredits(userId, totalCredits);
    if (!hasEnoughCredits) {
      throw new Error(`Insufficient credits. Required: ${totalCredits}, operation: parallel_page_generation`);
    }

    // Deduct credits
    await this.storage.deductCredits(
      userId, 
      'parallel_page_generation', 
      totalCredits,
      request.projectId,
      { pageCount: request.pages.length, panelCount: tasks.length }
    );

    const parallelRequest: ParallelGenerationRequest = {
      id: `parallel_pages_${Date.now()}`,
      tasks,
      projectId: request.projectId,
      userId,
      options
    };

    const sessionId = await this.manager.startParallelGeneration(parallelRequest);
    console.log(`📚 Started parallel page generation: ${sessionId} (${request.pages.length} pages, ${tasks.length} panels)`);
    return sessionId;
  }

  /**
   * Generate mixed content in batches (panels, backgrounds, covers, etc.)
   */
  async generateBatchInParallel(
    userId: string,
    request: ParallelBatchGenerationRequest
  ): Promise<string> {
    const tasks: ParallelGenerationTask[] = [];
    let totalCredits = 0;

    // Process each batch
    for (const batch of request.batches) {
      const batchTasks = await this.createBatchTasks(batch, request.projectId);
      tasks.push(...batchTasks);

      // Calculate credits for this batch
      const batchCredits = this.calculateBatchCredits(batch);
      totalCredits += batchCredits;
    }

    // Check credits
    const hasEnoughCredits = await this.storage.hasEnoughCredits(userId, totalCredits);
    if (!hasEnoughCredits) {
      throw new Error(`Insufficient credits. Required: ${totalCredits}, operation: parallel_batch_generation`);
    }

    // Deduct credits
    await this.storage.deductCredits(
      userId, 
      'parallel_batch_generation', 
      totalCredits,
      request.projectId,
      { batchCount: request.batches.length, taskCount: tasks.length }
    );

    const options: ParallelGenerationOptions = {
      maxConcurrency: 8,
      batchSize: 16,
      enableDependencyTracking: true,
      enableCharacterConsistency: true,
      enableProgressTracking: true,
      timeoutMs: 300000, // 5 minutes per task
      retryStrategy: 'exponential',
      priorityMode: 'priority',
      ...request.options
    };

    const parallelRequest: ParallelGenerationRequest = {
      id: `parallel_batch_${Date.now()}`,
      tasks,
      projectId: request.projectId,
      userId,
      options
    };

    const sessionId = await this.manager.startParallelGeneration(parallelRequest);
    console.log(`🎭 Started parallel batch generation: ${sessionId} (${request.batches.length} batches, ${tasks.length} tasks)`);
    return sessionId;
  }

  /**
   * Get session status and progress
   */
  getSessionStatus(sessionId: string) {
    return this.manager.getSessionStatus(sessionId);
  }

  /**
   * Cancel a running session - WITH RESOURCE CLEANUP
   */
  async cancelSession(sessionId: string): Promise<boolean> {
    const result = await this.manager.cancelSession(sessionId);
    
    // RESOURCE MANAGEMENT: If cancellation successful, also clean up resources
    if (result) {
      const sessionStatus = this.manager.getSessionStatus(sessionId);
      if (sessionStatus?.userId) {
        await this.resourceManager.cancelSession(sessionStatus.userId, sessionId);
      }
    }
    
    return result;
  }

  /**
   * Get all sessions for a user
   */
  getUserSessions(userId: string) {
    return this.manager.getUserSessions(userId);
  }

  /**
   * SECURITY: Get the owner of a session for authorization
   */
  getSessionOwner(sessionId: string): string | undefined {
    return this.manager.getSessionOwner(sessionId);
  }

  // Helper methods

  private async buildProjectContext(projectId: string) {
    const project = await this.storage.getProject(projectId);
    const characters = await this.storage.getProjectCharacters(projectId);
    
    return {
      title: project?.title || 'Untitled',
      genre: project?.genre,
      description: project?.description,
      artStyle: project?.artStyle,
      characters: characters.map(char => ({
        name: char.name,
        role: char.role,
        bio: char.bio,
        visualDescriptors: char.visualDescriptors,
        alwaysTraits: char.alwaysTraits,
        neverTraits: char.neverTraits,
        colorScheme: char.colorScheme,
        referenceImageUrl: char.referenceImageUrl
      }))
    };
  }

  private async createBatchTasks(batch: any, projectId: string): Promise<ParallelGenerationTask[]> {
    const tasks: ParallelGenerationTask[] = [];
    const projectContext = await this.buildProjectContext(projectId);

    for (const item of batch.items) {
      const task: ParallelGenerationTask = {
        id: `${batch.type}_${item.id || Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: batch.type === 'panels' ? 'panel' : batch.type.slice(0, -1) as any, // Remove 's' from plural
        priority: batch.batchPriority,
        dependencies: item.dependencies || [],
        payload: {
          prompt: item.prompt || item.description || `Generated ${batch.type}`,
          panelId: item.id,
          projectContext
        } as GenerateImageRequest
      };
      tasks.push(task);
    }

    return tasks;
  }

  private calculateBatchCredits(batch: any): number {
    const itemCount = batch.items.length;
    
    switch (batch.type) {
      case 'panels':
        return itemCount * CREDIT_COSTS.panel_generation;
      case 'backgrounds':
        return itemCount * CREDIT_COSTS.background_generation;
      case 'covers':
        return itemCount * CREDIT_COSTS.cover_art_generation;
      case 'pages':
        return itemCount * CREDIT_COSTS.full_page_generation;
      default:
        return itemCount * CREDIT_COSTS.panel_generation; // Default fallback
    }
  }

  // RESOURCE MANAGEMENT: Expose resource management capabilities
  getUserResourceStats(userId: string) {
    return this.resourceManager.getUserStats(userId);
  }
  
  getSystemResourceStats() {
    return this.resourceManager.getSystemStats();
  }
  
  // CHARACTER CONSISTENCY: Expose character consistency capabilities
  async getSharedContext(projectId: string) {
    return this.sharedStateManager.getSharedContext(projectId);
  }
  
  async lockCharacter(projectId: string, characterName: string): Promise<boolean> {
    return this.sharedStateManager.lockCharacter(projectId, characterName);
  }
  
  async unlockCharacter(projectId: string, characterName: string): Promise<boolean> {
    return this.sharedStateManager.unlockCharacter(projectId, characterName);
  }

  /**
   * Shutdown the service - WITH RESOURCE CLEANUP
   */
  async shutdown(): Promise<void> {
    // RESOURCE MANAGEMENT: Shutdown resource manager first
    this.resourceManager.shutdown();
    
    // Then shutdown the main manager
    await this.manager.shutdown();
  }
}