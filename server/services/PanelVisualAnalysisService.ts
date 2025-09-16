import { VisualContinuityService } from './VisualContinuityService';
import { IStorage } from '../storage';
import { PanelCharacterState } from '@shared/schema';

/**
 * Service responsible for automatically capturing and storing visual analysis results
 * when comic panels are generated. Integrates with VisualContinuityService for AI-powered
 * character appearance analysis and stores results in the database for consistency tracking.
 */
export class PanelVisualAnalysisService {
  private visualContinuityService: VisualContinuityService;
  private storage: IStorage;
  private processingQueue: Map<string, Promise<void>> = new Map();

  constructor(storage: IStorage) {
    this.storage = storage;
    this.visualContinuityService = new VisualContinuityService();
  }

  /**
   * Automatically analyze and store visual character data for a generated panel
   * This method should be called immediately after a panel image is generated
   */
  async captureVisualAnalysis(
    panelId: string, 
    imageUrl: string, 
    projectCharacters: Array<{ id: string; name: string }>,
    options: {
      skipIfExists?: boolean;
      retryOnFailure?: boolean;
      maxRetries?: number;
    } = {}
  ): Promise<PanelCharacterState[]> {
    const { skipIfExists = true, retryOnFailure = true, maxRetries = 2 } = options;

    // Check if analysis already exists
    if (skipIfExists) {
      const existingStates = await this.storage.getPanelCharacterStates(panelId);
      const hasVisualAnalysis = existingStates.some(state => state.visualAnalysisPerformed);
      if (hasVisualAnalysis) {
        console.log(`📊 Visual analysis already exists for panel ${panelId}, skipping`);
        return existingStates;
      }
    }

    // Prevent duplicate processing
    const processingKey = `${panelId}_${imageUrl}`;
    if (this.processingQueue.has(processingKey)) {
      console.log(`⏳ Visual analysis already in progress for panel ${panelId}`);
      return await this.processingQueue.get(processingKey)!.then(() => 
        this.storage.getPanelCharacterStates(panelId)
      );
    }

    // Create processing promise
    const processingPromise = this.performVisualAnalysis(
      panelId, 
      imageUrl, 
      projectCharacters, 
      retryOnFailure,
      maxRetries
    );

    this.processingQueue.set(processingKey, processingPromise);

    try {
      await processingPromise;
      return await this.storage.getPanelCharacterStates(panelId);
    } finally {
      this.processingQueue.delete(processingKey);
    }
  }

  /**
   * Perform the actual visual analysis and storage
   */
  private async performVisualAnalysis(
    panelId: string,
    imageUrl: string,
    projectCharacters: Array<{ id: string; name: string }>,
    retryOnFailure: boolean,
    maxRetries: number
  ): Promise<void> {
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= maxRetries) {
      try {
        console.log(`🔍 Starting visual analysis for panel ${panelId} (attempt ${attempt + 1}/${maxRetries + 1})`);
        
        // Analyze the panel using VisualContinuityService
        const analysisResult = await this.visualContinuityService.analyzeCharacterAppearances({
          panelImageUrls: [{ panelNumber: 1, imageUrl }], // Single panel analysis
          characterNames: projectCharacters.map(c => c.name),
          analysisOptions: {
            focusOnConsistency: true,
            detailLevel: 'detailed'
          }
        });

        if (!analysisResult?.success || !analysisResult.panelAnalyses || analysisResult.panelAnalyses.length === 0) {
          console.log(`⚠️ No panel analysis results for panel ${panelId}`);
          // Still mark analysis as complete even if no characters found
          await this.storage.markVisualAnalysisComplete(panelId, projectCharacters.map((c: { id: string; name: string }) => c.id));
          return;
        }

        // Extract character data from the first panel analysis (we only sent one panel)
        const panelAnalysis = analysisResult.panelAnalyses[0];
        if (!panelAnalysis?.characters || panelAnalysis.characters.length === 0) {
          console.log(`⚠️ No characters detected in panel ${panelId}`);
          // Still mark analysis as complete even if no characters found
          await this.storage.markVisualAnalysisComplete(panelId, projectCharacters.map((c: { id: string; name: string }) => c.id));
          return;
        }

        // Map character names to IDs and prepare analysis results
        const analysisResults = {
          characters: panelAnalysis.characters.map((char: any) => {
            const projectChar = projectCharacters.find((pc: { id: string; name: string }) => 
              pc.name.toLowerCase() === char.characterName.toLowerCase()
            );
            
            return {
              characterId: projectChar?.id || char.characterName, // Fallback to name if ID not found
              characterName: char.characterName,
              isPresent: char.isPresent,
              confidence: char.confidence,
              visualDetails: char.visualDetails
            };
          }),
          rawAnalysisData: analysisResult,
          analysisTimestamp: new Date()
        };

        // Store the visual analysis results
        const storedStates = await this.storage.storeVisualAnalysisResults(panelId, analysisResults);
        
        console.log(`✅ Successfully stored visual analysis for panel ${panelId}: ${storedStates.length} character states`);
        
        // Log summary of what was captured
        storedStates.forEach(state => {
          const confidence = state.confidenceScore ? `${state.confidenceScore}%` : 'N/A';
          console.log(`  - Character ${state.characterId}: Present=${state.isPresent}, Confidence=${confidence}`);
        });

        return; // Success - exit retry loop

      } catch (error) {
        lastError = error as Error;
        attempt++;
        
        console.error(`❌ Visual analysis failed for panel ${panelId} (attempt ${attempt}/${maxRetries + 1}):`, error);
        
        if (attempt <= maxRetries && retryOnFailure) {
          const backoffDelay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5s
          console.log(`⏳ Retrying in ${backoffDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }
      }
    }

    // All retries failed
    console.error(`💥 Visual analysis failed permanently for panel ${panelId} after ${maxRetries + 1} attempts:`, lastError);
    
    // Store partial analysis state to indicate failure
    try {
      const characterIds = projectCharacters.map(c => c.id);
      await this.storage.markVisualAnalysisComplete(panelId, characterIds);
      console.log(`📝 Marked visual analysis as attempted for panel ${panelId}`);
    } catch (storageError) {
      console.error(`❌ Failed to mark analysis attempt for panel ${panelId}:`, storageError);
    }
    
    throw lastError || new Error(`Visual analysis failed after ${maxRetries + 1} attempts`);
  }

  /**
   * Batch analyze multiple panels for a project
   * Useful for analyzing existing panels or catching up on missing analysis
   */
  async batchAnalyzePanels(
    panelData: Array<{
      panelId: string;
      imageUrl: string;
    }>,
    projectCharacters: Array<{ id: string; name: string }>,
    options: {
      maxConcurrent?: number;
      skipIfExists?: boolean;
    } = {}
  ): Promise<{
    successful: string[];
    failed: Array<{ panelId: string; error: string }>;
  }> {
    const { maxConcurrent = 3, skipIfExists = true } = options;
    const results = { successful: [], failed: [] } as {
      successful: string[];
      failed: Array<{ panelId: string; error: string }>;
    };

    console.log(`🔄 Starting batch visual analysis for ${panelData.length} panels`);

    // Process panels in batches to avoid overwhelming the API
    for (let i = 0; i < panelData.length; i += maxConcurrent) {
      const batch = panelData.slice(i, i + maxConcurrent);
      const batchPromises = batch.map(async ({ panelId, imageUrl }) => {
        try {
          await this.captureVisualAnalysis(panelId, imageUrl, projectCharacters, { 
            skipIfExists,
            retryOnFailure: true,
            maxRetries: 1 // Reduced retries for batch processing
          });
          results.successful.push(panelId);
          return { success: true, panelId };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.failed.push({ panelId, error: errorMessage });
          return { success: false, panelId, error: errorMessage };
        }
      });

      // Wait for current batch to complete before starting next batch
      const batchResults = await Promise.allSettled(batchPromises);
      console.log(`📊 Batch ${Math.floor(i / maxConcurrent) + 1} completed: ${batchResults.length} panels processed`);
    }

    console.log(`✅ Batch analysis complete: ${results.successful.length} successful, ${results.failed.length} failed`);
    return results;
  }

  /**
   * Get visual analysis summary for a project
   */
  async getProjectVisualAnalysisSummary(projectId: string): Promise<{
    totalPanels: number;
    analyzedPanels: number;
    pendingPanels: number;
    charactersTracked: number;
    averageConfidenceScore: number;
  }> {
    const summary = await this.storage.getProjectCharacterVisualSummary(projectId);
    
    return {
      totalPanels: 0, // Would need additional project panels query
      analyzedPanels: summary.reduce((sum, char) => sum + char.visualAnalysisCount, 0),
      pendingPanels: 0, // Would need calculation
      charactersTracked: summary.length,
      averageConfidenceScore: summary.length > 0 
        ? summary.reduce((sum, char) => sum + char.averageConfidenceScore, 0) / summary.length 
        : 0
    };
  }

  /**
   * Force re-analysis of a panel (ignoring existing analysis)
   */
  async forceReanalyzePanel(
    panelId: string,
    imageUrl: string,
    projectCharacters: Array<{ id: string; name: string }>
  ): Promise<PanelCharacterState[]> {
    console.log(`🔄 Force re-analyzing panel ${panelId}`);
    return await this.captureVisualAnalysis(panelId, imageUrl, projectCharacters, {
      skipIfExists: false,
      retryOnFailure: true,
      maxRetries: 2
    });
  }
}