import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import {
  insertProjectSchema,
  insertCharacterSchema,
  insertPageSchema,
  insertPanelSchema,
  insertUserProfileSchema,
  insertProjectLikeSchema,
  insertProjectCommentSchema,
  insertCharacterFromScriptSchema,
  parallelPanelGenerationSchema,
  parallelPageGenerationSchema,
  parallelBatchGenerationSchema,
  scriptValidationRequestSchema,
  ScriptValidationRequest,
  ValidationResult,
  createPanelVideoRequestSchema,
  panelVideoJobStatusResponseSchema,
  updatePanelVideoApprovalSchema,
  PanelVideoJob,
} from "@shared/schema";
import { veoJobRequestSchema } from "@shared/veo";
import { geminiService } from "./gemini";
import { ParallelGenerationService } from "./parallel-processing";
import { ScriptValidationService } from "./services/ScriptValidationService";
import { ContinuityContextService } from "./services/ContinuityContextService";
import { SharedStateManager } from "./parallel-processing/SharedStateManager";
import { PanelVisualAnalysisService } from "./services/PanelVisualAnalysisService";
import { PanelVideoQAService } from "./services/PanelVideoQAService";
import { MultiPageConsistencyTracker } from "./MultiPageConsistencyTracker";
import { AnimationJobError, animationJobService } from "./services/AnimationJobService";
import { veo3AnimationRenderJobService } from "./services/Veo3AnimationRenderJobService";
import { z } from "zod";
import { requireCredits, getProjectIdFromParams, getProjectIdFromBody, getPanelIdFromBody, getPageIdFromRequest, createOperationMetadata, calculateParallelCredits } from "./creditMiddleware";
import { isSocialCrawler, isLinkPreviewRequest } from "./utils/socialCrawlers";
import { generateSSRHTML, generateFallbackHTML } from "./utils/htmlGenerator";
import { resolveUserId } from "./utils/authHelpers";
import { requireFeatureEntitlement } from "./middleware/featureEntitlements";
import { requireAdmin } from "./middleware/requireAdmin";
import { logger } from "./logger";
import { promptOrchestrator } from "./services/PromptOrchestrator";
import {
  panelVideoJobService,
  PanelVideoJobEvent,
  PanelAnimationRateLimitError,
} from "./services/PanelVideoJobService";

// Helper function to get user ID from different auth providers
function getUserId(user: any): string {
  if (user.provider === 'google') {
    return user.id;
  }
  // Replit Auth
  return user.claims?.sub;
}

// Helper function to calculate character consistency readiness
function calculateCharacterConsistencyReadiness(character: any): number {
  let score = 0;
  if (character.referenceImageUrl) score += 40;
  if (character.visualDescriptors) score += 30;
  if (character.alwaysTraits) score += 15;
  if (character.neverTraits) score += 15;
  return score;
}

// Helper function to generate consistency recommendations
function generateConsistencyRecommendations(characters: any[], pages: any[]): string[] {
  const recommendations = [];
  
  const charactersWithoutPortraits = characters.filter(c => !c.referenceImageUrl);
  if (charactersWithoutPortraits.length > 0) {
    recommendations.push(`Generate reference portraits for ${charactersWithoutPortraits.length} characters`);
  }
  
  const charactersWithoutDescriptors = characters.filter(c => !c.visualDescriptors);
  if (charactersWithoutDescriptors.length > 0) {
    recommendations.push(`Add visual descriptors to ${charactersWithoutDescriptors.length} characters`);
  }
  
  if (pages.length === 0) {
    recommendations.push("Create story pages to test character consistency");
  }
  
  return recommendations;
}

// Initialize services
const parallelGenerationService = new ParallelGenerationService(storage);
const scriptValidationService = new ScriptValidationService(storage);
const sharedStateManager = new SharedStateManager();
const multiPageConsistencyTracker = new MultiPageConsistencyTracker();
const panelVisualAnalysisService = new PanelVisualAnalysisService(storage, multiPageConsistencyTracker);

const ANIMATION_ALLOWED_PLANS = ["pro", "enterprise"];

const animationJobSchema = z.object({
  prompt: z.string().min(1),
  safetySettings: z
    .array(
      z.object({
        category: z.string().min(1),
        threshold: z.string().min(1),
      }),
    )
    .optional(),
  justification: z.string().min(10).optional(),
  model: z.string().min(1).optional(),
  generationConfig: z.record(z.any()).optional(),
  tools: z.array(z.record(z.any())).optional(),
  responseMimeType: z.string().optional(),
  mediaFormats: z.array(z.string()).optional(),
});

const featureEntitlementMutationSchema = z.object({
  userId: z.string().min(1),
  enabled: z.boolean().optional(),
  adminOverride: z.boolean().optional(),
  plan: z.string().min(1).optional(),
  grantedReason: z.string().min(3).optional(),
  metadata: z.record(z.any()).optional(),
});
const panelVideoQAService = new PanelVideoQAService(storage);
const continuityContextService = new ContinuityContextService(storage, sharedStateManager);

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Expose continuity context service for downstream orchestrators
  app.locals.continuityContextService = continuityContextService;

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = resolveUserId(req.user);
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Credits API endpoint
  app.get('/api/credits', isAuthenticated, async (req: any, res) => {
    try {
      const userId = resolveUserId(req.user);
      const user = await storage.getUser(userId);

      // Check if user is admin (unlimited credits)
      const isAdmin = user?.email === "zorovt18@gmail.com";
      
      if (isAdmin) {
        res.json({
          isAdmin: true,
          monthlyLimit: null,
          currentCredits: null,
          remainingCredits: "Unlimited",
          creditsPercentage: 100
        });
        return;
      }

      // Get user's current credit status  
      const creditStatus = await storage.getCurrentMonthCredits(userId);
      const monthlyLimit = creditStatus.monthlyLimit;
      const remainingCredits = monthlyLimit - creditStatus.creditsUsed;
      const creditsPercentage = Math.round((remainingCredits / monthlyLimit) * 100);

      res.json({
        isAdmin: false,
        monthlyLimit,
        currentCredits: remainingCredits,
        remainingCredits,
        creditsPercentage,
        // lastReset field removed as it's not part of the schema
      });
    } catch (error) {
      console.error("Error fetching credits:", error);
      res.status(500).json({ message: "Failed to fetch credits" });
    }
  });

  app.get('/api/consistency/tracker-summary', isAuthenticated, (req: any, res) => {
    try {
      const summary = multiPageConsistencyTracker.getSummary();
      res.json(summary);
    } catch (error) {
      console.error('Error fetching consistency tracker summary:', error);
      res.status(500).json({ message: 'Failed to fetch consistency tracker summary' });
    }
  });

  app.put('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = resolveUserId(req.user);
      const { firstName, lastName } = req.body;

      const updatedUser = await storage.updateUser(userId, {
        firstName: firstName || null,
        lastName: lastName || null,
      });

      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.post(
    '/api/animations/jobs',
    isAuthenticated,
    requireFeatureEntitlement('animation_generation', { allowedPlans: ANIMATION_ALLOWED_PLANS }),
    async (req: any, res, next) => {
      try {
        const payload = veoJobRequestSchema.parse(req.body);
        const userId = resolveUserId(req.user);
        const job = await veo3AnimationRenderJobService.createJob(userId, payload);
        res.status(202).json({ job });
      } catch (error) {
        next(error);
      }
    },
  );

  app.get(
    '/api/animations/jobs/recent',
    isAuthenticated,
    requireFeatureEntitlement('animation_generation', { allowedPlans: ANIMATION_ALLOWED_PLANS }),
    async (req: any, res, next) => {
      try {
        const userId = resolveUserId(req.user);
        const job = await storage.getMostRecentAnimationRenderJob(userId);
        if (!job) {
          return res.status(404).json({ message: 'No animation jobs found.' });
        }
        res.json({ job });
      } catch (error) {
        next(error);
      }
    },
  );

  app.get(
    '/api/animations/jobs',
    isAuthenticated,
    requireFeatureEntitlement('animation_generation', { allowedPlans: ANIMATION_ALLOWED_PLANS }),
    async (req: any, res, next) => {
      try {
        const userId = resolveUserId(req.user);
        const parsedLimit = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : NaN;
        const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 50) : 10;
        const jobs = await veo3AnimationRenderJobService.listJobsForUser(userId, { limit });
        res.json({ jobs });
      } catch (error) {
        next(error);
      }
    },
  );

  app.get(
    '/api/animations/jobs/:jobId',
    isAuthenticated,
    requireFeatureEntitlement('animation_generation', { allowedPlans: ANIMATION_ALLOWED_PLANS }),
    async (req: any, res, next) => {
      try {
        const userId = resolveUserId(req.user);
        const { jobId } = req.params;
        const job = await veo3AnimationRenderJobService.getJobForUser(jobId, userId);
        if (!job) {
          return res.status(404).json({ message: 'Animation job not found.' });
        }
        res.json({ job });
      } catch (error) {
        next(error);
      }
    },
  );

  // Video proxy endpoint - streams videos from Google with authentication
  app.get(
    '/api/animations/jobs/:jobId/video',
    isAuthenticated,
    async (req: any, res, next) => {
      try {
        const userId = resolveUserId(req.user);
        const { jobId } = req.params;
        
        // Get the job to verify ownership and get video URL
        const job = await veo3AnimationRenderJobService.getJobForUser(jobId, userId);
        if (!job) {
          return res.status(404).json({ message: 'Animation job not found.' });
        }
        
        if (!job.resultAssetUri) {
          return res.status(404).json({ message: 'Video not available yet.' });
        }
        
        // Fetch video from Google with API key
        const apiKey = process.env.VEO_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
          return res.status(500).json({ message: 'API key not configured.' });
        }
        
        const videoResponse = await fetch(job.resultAssetUri, {
          headers: {
            'x-goog-api-key': apiKey,
          },
        });
        
        if (!videoResponse.ok) {
          logger.error('Failed to fetch video from Google', {
            status: videoResponse.status,
            statusText: videoResponse.statusText,
            jobId,
            videoUri: job.resultAssetUri,
          });
          return res.status(500).json({ message: 'Failed to fetch video.' });
        }
        
        // Stream the video to the client
        res.setHeader('Content-Type', videoResponse.headers.get('content-type') || 'video/mp4');
        const contentLength = videoResponse.headers.get('content-length');
        if (contentLength) {
          res.setHeader('Content-Length', contentLength);
        }
        
        // @ts-ignore - Node.js streams compatibility
        videoResponse.body.pipe(res);
      } catch (error) {
        next(error);
      }
    },
  );

  app.post(
    '/api/admin/features/:featureKey/entitlements',
    isAuthenticated,
    requireAdmin,
    async (req: any, res, next) => {
      try {
        const { featureKey } = req.params;
        const payload = featureEntitlementMutationSchema.parse(req.body);
        const adminUserId = resolveUserId(req.user);

        const entitlement = await storage.upsertUserFeatureEntitlement({
          userId: payload.userId,
          featureKey,
          isEnabled: payload.enabled ?? false,
          isAdminOverride: payload.adminOverride ?? false,
          plan: payload.plan ?? null,
          grantedReason: payload.grantedReason ?? null,
          metadata: payload.metadata ?? null,
          grantedBy: adminUserId,
        });

        await logger.audit('feature.entitlement.updated', {
          userId: adminUserId,
          resourceType: 'feature',
          resourceId: featureKey,
          metadata: {
            targetUserId: payload.userId,
            isEnabled: entitlement.isEnabled,
            isAdminOverride: entitlement.isAdminOverride,
            plan: entitlement.plan,
          },
        });

        res.json({ entitlement });
      } catch (error) {
        next(error);
      }
    },
  );

  app.delete(
    '/api/admin/features/:featureKey/entitlements/:userId',
    isAuthenticated,
    requireAdmin,
    async (req: any, res, next) => {
      try {
        const { featureKey, userId: targetUserId } = req.params;
        const adminUserId = resolveUserId(req.user);
        const removed = await storage.removeUserFeatureEntitlement(targetUserId, featureKey);

        await logger.audit('feature.entitlement.removed', {
          userId: adminUserId,
          resourceType: 'feature',
          resourceId: featureKey,
          metadata: { targetUserId, removed },
        });

        if (!removed) {
          return res.status(404).json({ message: 'Entitlement not found.' });
        }

        res.status(204).send();
      } catch (error) {
        next(error);
      }
    },
  );
  // Animation job status routes
  app.get('/api/animation-jobs', isAuthenticated, (req: any, res) => {
    const userId = getUserId(req.user);
    const jobs = animationJobService.getJobsForUser(userId);
    res.json({ jobs });
  });

  app.post('/api/animation-jobs/:jobId/retry', isAuthenticated, (req: any, res) => {
    try {
      const userId = getUserId(req.user);
      const jobId = req.params.jobId;
      const job = animationJobService.retryJob(jobId, userId, req.body?.metadata);
      res.json({ job });
    } catch (error) {
      if (error instanceof AnimationJobError) {
        return res.status(error.statusCode).json({ message: error.message });
      }

      console.error('Error retrying animation job:', error);
      res.status(500).json({ message: 'Failed to retry animation job' });
    }
  });

  app.get('/api/animation-jobs/stream', isAuthenticated, (req: any, res) => {
    const userId = getUserId(req.user);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    res.flushHeaders?.();

    const sendSnapshot = () => {
      const snapshot = animationJobService.getJobsForUser(userId);
      res.write(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);
    };

    const heartbeat = setInterval(() => {
      res.write(`event: heartbeat\ndata: {"ts":${Date.now()}}\n\n`);
    }, 25000);

    const unsubscribe = animationJobService.subscribe((job) => {
      if (job.userId !== userId) {
        return;
      }

      res.write(`event: status\ndata: ${JSON.stringify(job)}\n\n`);
    });

    sendSnapshot();

    const close = () => {
      clearInterval(heartbeat);
      unsubscribe();
      res.end();
    };

    req.on('close', close);
    req.on('error', close);
  });

  // Image upload routes
  app.post("/api/upload/presigned-url", isAuthenticated, async (req: any, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  // Update user profile image
  app.put("/api/auth/user/profile-image", isAuthenticated, async (req: any, res) => {
    try {
      const userId = resolveUserId(req.user);
      const { imageURL } = req.body;

      if (!imageURL) {
        return res.status(400).json({ error: "imageURL is required" });
      }

      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        imageURL,
        {
          owner: userId,
          visibility: "public", // Profile images are public
        },
        {
          variantType: "canonical",
          lifecycleTag: null,
        }
      );

      // Update user's profile image URL
      const updatedUser = await storage.updateUser(userId, {
        profileImageUrl: objectPath,
      });

      res.json({ user: updatedUser, objectPath });
    } catch (error) {
      console.error("Error updating profile image:", error);
      res.status(500).json({ error: "Failed to update profile image" });
    }
  });

  // Update user banner image
  app.put("/api/auth/user/banner-image", isAuthenticated, async (req: any, res) => {
    try {
      const userId = resolveUserId(req.user);
      const { imageURL } = req.body;

      if (!imageURL) {
        return res.status(400).json({ error: "imageURL is required" });
      }

      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        imageURL,
        {
          owner: userId,
          visibility: "public", // Banner images are public
        },
        {
          variantType: "canonical",
          lifecycleTag: null,
        }
      );

      // Update or create user profile with banner image
      await storage.updateUserProfile(userId, {
        bannerImageUrl: objectPath,
      });

      res.json({ objectPath });
    } catch (error) {
      console.error("Error updating banner image:", error);
      res.status(500).json({ error: "Failed to update banner image" });
    }
  });

  // Serve uploaded images
  app.get("/objects/:objectPath(*)", async (req: any, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      if (req.query?.signed === "1" || req.query?.signed === "true") {
        const downloadFileName = typeof req.query?.filename === "string" ? req.query.filename : undefined;
        const signed = await objectStorageService.getSignedObjectDownloadURL(req.path, {
          downloadFileName,
        });
        return res.json(signed);
      }

      const objectFile = await objectStorageService.getObjectEntityFile(
        req.path,
      );
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Project routes
  app.post("/api/projects", isAuthenticated, async (req: any, res) => {
    try {
      const userId = resolveUserId(req.user);
      const projectData = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(userId, projectData);
      res.json(project);
    } catch (error) {
      console.error("Error creating project:", error);
      res.status(400).json({ message: "Failed to create project" });
    }
  });

  app.get("/api/projects", isAuthenticated, async (req: any, res) => {
    try {
      const userId = resolveUserId(req.user);
      const projects = await storage.getUserProjects(userId);
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = resolveUserId(req.user);
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  app.put("/api/projects/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = resolveUserId(req.user);
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      const updates = insertProjectSchema.partial().parse(req.body);
      const updatedProject = await storage.updateProject(req.params.id, updates);
      res.json(updatedProject);
    } catch (error) {
      console.error("Error updating project:", error);
      res.status(400).json({ message: "Failed to update project" });
    }
  });

  app.delete("/api/projects/:id", isAuthenticated, async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      const userId = resolveUserId(req.user);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      await storage.deleteProject(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting project:", error);
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  // Character routes
  app.post("/api/projects/:projectId/characters", isAuthenticated, async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      const userId = resolveUserId(req.user);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ message: "Project not found" });
      }

      const characterData = insertCharacterSchema.parse({
        ...req.body,
        projectId: req.params.projectId,
      });
      
      // Handle referenceImageUrl with ObjectStorage ACL policy
      if (characterData.referenceImageUrl) {
        const objectStorageService = new ObjectStorageService();
        
        // Apply ACL policy and get normalized path
        const normalizedPath = await objectStorageService.trySetObjectEntityAclPolicy(
          characterData.referenceImageUrl,
          {
            owner: userId,
            visibility: "public", // Character reference images are public for consistency
          },
          {
            variantType: "canonical",
            lifecycleTag: null,
          }
        );
        
        // Update with normalized path
        characterData.referenceImageUrl = normalizedPath;
      }
      
      const character = await storage.createCharacter(characterData);
      res.json(character);
    } catch (error) {
      console.error("Error creating character:", error);
      res.status(400).json({ message: "Failed to create character" });
    }
  });

  app.get("/api/projects/:projectId/characters", isAuthenticated, async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      const userId = resolveUserId(req.user);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ message: "Project not found" });
      }

      const characters = await storage.getProjectCharacters(req.params.projectId);
      res.json(characters);
    } catch (error) {
      console.error("Error fetching characters:", error);
      res.status(500).json({ message: "Failed to fetch characters" });
    }
  });

  // Update character route
  app.put("/api/characters/:id", isAuthenticated, async (req: any, res) => {
    try {
      const character = await storage.getCharacter(req.params.id);
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }

      // Check if character belongs to a project or is a library character
      if (!character.projectId) {
        return res.status(400).json({ message: "Use library character API for library characters" });
      }

      const project = await storage.getProject(character.projectId);
      const userId = resolveUserId(req.user);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ message: "Project not found" });
      }

      const updates = insertCharacterSchema.partial().parse(req.body);
      
      // Handle referenceImageUrl with ObjectStorage ACL policy
      if (updates.referenceImageUrl) {
        const objectStorageService = new ObjectStorageService();
        
        // Apply ACL policy and get normalized path
        const normalizedPath = await objectStorageService.trySetObjectEntityAclPolicy(
          updates.referenceImageUrl,
          {
            owner: userId,
            visibility: "public", // Character reference images are public for consistency
          },
          {
            variantType: "canonical",
            lifecycleTag: null,
          }
        );
        
        // Update with normalized path
        updates.referenceImageUrl = normalizedPath;
      }
      
      const updatedCharacter = await storage.updateCharacter(req.params.id, updates);
      res.json(updatedCharacter);
    } catch (error) {
      console.error("Error updating character:", error);
      res.status(400).json({ message: "Failed to update character" });
    }
  });

  // Delete character route
  app.delete("/api/characters/:id", isAuthenticated, async (req: any, res) => {
    try {
      const character = await storage.getCharacter(req.params.id);
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }

      // Check if character belongs to a project or is a library character
      if (!character.projectId) {
        return res.status(400).json({ message: "Use library character API for library characters" });
      }

      const project = await storage.getProject(character.projectId);
      const userId = resolveUserId(req.user);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ message: "Project not found" });
      }

      const success = await storage.deleteCharacter(req.params.id);
      if (success) {
        res.json({ success: true, message: "Character deleted successfully" });
      } else {
        res.status(404).json({ message: "Character not found" });
      }
    } catch (error) {
      console.error("Error deleting character:", error);
      res.status(500).json({ message: "Failed to delete character" });
    }
  });

  // ========================================
  // CHARACTER VISUAL ANALYSIS ENDPOINTS
  // ========================================

  // Get character visual analysis summary for a project
  app.get("/api/projects/:projectId/character-visual-analysis", isAuthenticated, async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      const userId = resolveUserId(req.user);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Initialize project state if not already done
      await sharedStateManager.initializeProject(req.params.projectId, storage);
      
      // Get visual analysis summary
      const summary = sharedStateManager.getCharacterVisualAnalysisSummary(req.params.projectId);
      
      res.json({
        projectId: req.params.projectId,
        characters: summary,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching character visual analysis:", error);
      res.status(500).json({ message: "Failed to fetch character visual analysis" });
    }
  });

  // Get character appearance history for a specific character
  app.get("/api/projects/:projectId/characters/:characterName/appearance-history", isAuthenticated, async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      const userId = resolveUserId(req.user);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Initialize project state if not already done
      await sharedStateManager.initializeProject(req.params.projectId, storage);
      
      // Get appearance history for the character
      const history = sharedStateManager.getCharacterAppearanceHistory(
        req.params.projectId, 
        req.params.characterName
      );
      
      res.json({
        projectId: req.params.projectId,
        characterName: req.params.characterName,
        appearanceHistory: history,
        totalEntries: history.length
      });
    } catch (error) {
      console.error("Error fetching character appearance history:", error);
      res.status(500).json({ message: "Failed to fetch character appearance history" });
    }
  });

  // Get panel character states for a specific panel
  app.get("/api/panels/:panelId/character-states", isAuthenticated, async (req: any, res) => {
    try {
      const panel = await storage.getPanel(req.params.panelId);
      if (!panel) {
        return res.status(404).json({ message: "Panel not found" });
      }

      const page = await storage.getPage(panel.pageId);
      if (!page) {
        return res.status(404).json({ message: "Page not found" });
      }

      const project = await storage.getProject(page.projectId);
      const userId = resolveUserId(req.user);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Get panel character states from storage
      const panelCharacterStates = await storage.getPanelCharacterStates(req.params.panelId);
      
      res.json({
        panelId: req.params.panelId,
        characterStates: panelCharacterStates,
        totalCharacters: panelCharacterStates.length
      });
    } catch (error) {
      console.error("Error fetching panel character states:", error);
      res.status(500).json({ message: "Failed to fetch panel character states" });
    }
  });

  app.get("/api/panels/:panelId/video-qa", isAuthenticated, async (req: any, res) => {
    try {
      const panel = await storage.getPanel(req.params.panelId);
      if (!panel) {
        return res.status(404).json({ message: "Panel not found" });
      }

      const page = await storage.getPage(panel.pageId);
      if (!page) {
        return res.status(404).json({ message: "Page not found" });
      }

      const project = await storage.getProject(page.projectId);
      const userId = getUserId(req.user);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ message: "Project not found" });
      }

      const timeline = await panelVideoQAService.getTimeline(req.params.panelId);
      res.json({
        panelId: req.params.panelId,
        timeline
      });
    } catch (error) {
      console.error("Error fetching panel video QA timeline:", error);
      res.status(500).json({ message: "Failed to fetch panel video QA timeline" });
    }
  });

  // Manually trigger visual analysis for a panel
  app.post("/api/panels/:panelId/analyze-visual",
    isAuthenticated,
    requireCredits({
      operationType: "visual_analysis",
      getResourceId: (req) => req.params.panelId,
      getMetadata: (req) => createOperationMetadata(req, { 
        panelId: req.params.panelId,
        forceReanalyze: req.body.forceReanalyze 
      })
    }),
    async (req: any, res) => {
    try {
      const panel = await storage.getPanel(req.params.panelId);
      if (!panel) {
        return res.status(404).json({ message: "Panel not found" });
      }

      const page = await storage.getPage(panel.pageId);
      if (!page) {
        return res.status(404).json({ message: "Page not found" });
      }

      const project = await storage.getProject(page.projectId);
      const userId = resolveUserId(req.user);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ message: "Project not found" });
      }

      if (!panel.imageUrl) {
        return res.status(400).json({ message: "Panel has no image to analyze" });
      }

      const { forceReanalyze = false } = req.body;

      // Get project characters for analysis context
      const characters = await storage.getProjectCharacters(project.id);
      
      // Trigger visual analysis
      const result = await panelVisualAnalysisService.captureVisualAnalysis(
        req.params.panelId,
        panel.imageUrl,
        characters.map(c => ({ id: c.id, name: c.name })),
        {
          skipIfExists: !forceReanalyze,
          retryOnFailure: true,
          maxRetries: 2
        }
      );

      // Update shared state manager with the results
      if (result.length > 0) {
        // Initialize project state if needed
        await sharedStateManager.initializeProject(project.id, storage);
        
        // Update character states with visual analysis results
        await sharedStateManager.updateCharacterStatesWithVisualAnalysis(
          project.id,
          req.params.panelId,
          result
        );
      }

      res.json({
        panelId: req.params.panelId,
        analysisResults: result,
        analysisTimestamp: new Date().toISOString(),
        charactersAnalyzed: result.length
      });
    } catch (error) {
      console.error("Error performing visual analysis:", error);
      res.status(500).json({ message: "Failed to perform visual analysis" });
    }
  });

  app.post("/api/panels/:panelId/video-qa/run", isAuthenticated, async (req: any, res) => {
    try {
      const { videoVersions, projectCharacters, projectContext } = req.body || {};

      if (!Array.isArray(videoVersions) || videoVersions.length === 0) {
        return res.status(400).json({ message: "videoVersions array is required" });
      }

      if (!Array.isArray(projectCharacters) || projectCharacters.length === 0) {
        return res.status(400).json({ message: "projectCharacters array is required" });
      }

      const panel = await storage.getPanel(req.params.panelId);
      if (!panel) {
        return res.status(404).json({ message: "Panel not found" });
      }

      const results = await panelVideoQAService.runQA({
        panelId: req.params.panelId,
        videoVersions,
        projectCharacters,
        projectContext
      });

      res.json({
        panelId: req.params.panelId,
        results
      });
    } catch (error) {
      console.error("Error running panel video QA:", error);
      res.status(500).json({ message: "Failed to run panel video QA" });
    }
  });

  // Panel animation job management
  app.post(
    "/api/animation/panels/:panelId",
    isAuthenticated,
    requireCredits({
      operationType: "panel_animation",
      getResourceId: req => req.params.panelId,
      getMetadata: req =>
        createOperationMetadata(req, {
          durationSeconds: req.body?.durationSeconds,
          motionPreset: req.body?.motionPreset,
        }),
    }),
    async (req: any, res) => {
      try {
        const userId = getUserId(req.user);
        const { panelId } = req.params;

        const validation = createPanelVideoRequestSchema.safeParse(req.body);
        if (!validation.success) {
          return res.status(400).json({
            message: "Invalid request data",
            error: "validation_failed",
            details: validation.error.errors.map(err => ({
              path: err.path.join('.'),
              message: err.message,
            })),
          });
        }

        const panel = await storage.getPanel(panelId);
        if (!panel) {
          return res.status(404).json({ message: "Panel not found", error: "panel_not_found" });
        }

        const page = await storage.getPage(panel.pageId);
        if (!page) {
          return res.status(404).json({ message: "Page not found", error: "page_not_found" });
        }

        const project = await storage.getProject(page.projectId);
        if (!project || project.userId !== userId) {
          return res.status(404).json({ message: "Project not found", error: "project_not_found" });
        }

        const context = await continuityContextService.buildPanelContext(panelId);
        const orchestration = promptOrchestrator.buildPanelAnimationPrompt(
          context,
          validation.data,
        );

        const job = panelVideoJobService.createJob({
          panelId,
          projectId: project.id,
          userId,
          prompt: orchestration.prompt,
          metadata: orchestration.metadata,
          request: validation.data,
        });

        res.status(202).json({
          jobId: job.id,
          status: job.status,
          panelId: job.panelId,
          projectId: job.projectId,
          resultUrl: job.resultUrl,
          approval: job.approval,
          error: job.error,
          history: job.history,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
        });
      } catch (error) {
        if (error instanceof PanelAnimationRateLimitError) {
          const retrySeconds = Math.max(1, Math.ceil(error.retryAfterMs / 1000));
          res.setHeader("Retry-After", retrySeconds.toString());
          return res.status(429).json({
            message: "Panel animation rate limit exceeded",
            error: "rate_limited",
            retryAfterMs: error.retryAfterMs,
          });
        }
        console.error("Error creating panel animation job:", error);
        res.status(500).json({
          message: "Failed to enqueue panel animation job",
          error: "panel_animation_failed",
        });
      }
    },
  );

  app.get("/api/animation/panels/:panelId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req.user);
      const { panelId } = req.params;

      const panel = await storage.getPanel(panelId);
      if (!panel) {
        return res.status(404).json({ message: "Panel not found", error: "panel_not_found" });
      }

      const page = await storage.getPage(panel.pageId);
      if (!page) {
        return res.status(404).json({ message: "Page not found", error: "page_not_found" });
      }

      const project = await storage.getProject(page.projectId);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ message: "Project not found", error: "project_not_found" });
      }

      const requestedJobId = Array.isArray(req.query.jobId)
        ? req.query.jobId[0]
        : req.query.jobId;

      if (typeof requestedJobId === "string" && requestedJobId.length > 0) {
        const job = panelVideoJobService.getJob(requestedJobId, userId);
        if (!job || job.panelId !== panelId) {
          return res.status(404).json({ message: "Job not found", error: "job_not_found" });
        }
        return res.json({ job });
      }

      const jobs: PanelVideoJob[] = panelVideoJobService.getJobsForPanel(panelId, userId);
      const payload = panelVideoJobStatusResponseSchema.parse({ jobs });
      res.json(payload);
    } catch (error) {
      console.error("Error fetching panel animation jobs:", error);
      res.status(500).json({ message: "Failed to fetch panel animation jobs" });
    }
  });

  app.patch("/api/animation/panels/:panelId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req.user);
      const { panelId } = req.params;

      const panel = await storage.getPanel(panelId);
      if (!panel) {
        return res.status(404).json({ message: "Panel not found", error: "panel_not_found" });
      }

      const page = await storage.getPage(panel.pageId);
      if (!page) {
        return res.status(404).json({ message: "Page not found", error: "page_not_found" });
      }

      const project = await storage.getProject(page.projectId);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ message: "Project not found", error: "project_not_found" });
      }

      const validation = updatePanelVideoApprovalSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Invalid approval payload",
          error: "validation_failed",
          details: validation.error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message,
          })),
        });
      }

      const existingJob = panelVideoJobService.getJob(validation.data.jobId, userId);
      if (!existingJob || existingJob.panelId !== panelId) {
        return res.status(404).json({ message: "Job not found", error: "job_not_found" });
      }

      const updatedJob = panelVideoJobService.updateApproval(validation.data, userId);
      res.json({ job: updatedJob });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "Job not found") {
          return res.status(404).json({ message: "Job not found", error: "job_not_found" });
        }
        if (error.message === "Forbidden") {
          return res.status(403).json({ message: "Forbidden", error: "forbidden" });
        }
      }
      console.error("Error updating panel animation job:", error);
      res.status(500).json({ message: "Failed to update panel animation job" });
    }
  });

  app.get("/api/animation/panels/:panelId/events", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req.user);
      const { panelId } = req.params;

      const panel = await storage.getPanel(panelId);
      if (!panel) {
        return res.status(404).json({ message: "Panel not found", error: "panel_not_found" });
      }

      const page = await storage.getPage(panel.pageId);
      if (!page) {
        return res.status(404).json({ message: "Page not found", error: "page_not_found" });
      }

      const project = await storage.getProject(page.projectId);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ message: "Project not found", error: "project_not_found" });
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      (res as any).flushHeaders?.();

      const initialJobs = panelVideoJobService.getJobsForPanel(panelId, userId);
      initialJobs.forEach(job => {
        const event: PanelVideoJobEvent = { type: job.status, job };
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      });

      const listener = (event: PanelVideoJobEvent) => {
        if (event.job.panelId !== panelId || event.job.userId !== userId) {
          return;
        }
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      };

      const unsubscribe = panelVideoJobService.subscribe(listener);

      req.on("close", () => {
        unsubscribe();
        res.end();
      });
    } catch (error) {
      console.error("Error establishing panel animation event stream:", error);
      res.status(500).json({ message: "Failed to establish event stream" });
    }
  });

  // Get visual consistency report for project characters
  app.get("/api/projects/:projectId/visual-consistency-report", isAuthenticated, async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      const userId = resolveUserId(req.user);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Initialize project state if not already done
      await sharedStateManager.initializeProject(req.params.projectId, storage);
      
      // Get visual analysis summary
      const summary = sharedStateManager.getCharacterVisualAnalysisSummary(req.params.projectId);
      
      // Calculate consistency scores and identify potential issues
      const consistencyReport = summary.map(character => {
        const consistencyScore = character.averageConfidenceScore;
        const totalAnalyses = character.totalAnalysisCount;
        
        // Identify potential consistency issues
        const issues: string[] = [];
        if (consistencyScore < 75) {
          issues.push("Low confidence in visual detection");
        }
        if (totalAnalyses < 3) {
          issues.push("Insufficient analysis data");
        }
        
        // Check for feature consistency
        const features = character.consistentFeatures;
        if (!features.hair.color && !features.hair.style) {
          issues.push("Hair appearance not consistently detected");
        }
        if (!features.clothing.upperBody && !features.clothing.lowerBody) {
          issues.push("Clothing not consistently detected");
        }
        
        return {
          ...character,
          consistencyScore,
          issues,
          status: issues.length === 0 ? 'consistent' : 'needs_attention'
        };
      });

      res.json({
        projectId: req.params.projectId,
        reportTimestamp: new Date().toISOString(),
        characters: consistencyReport,
        overallConsistency: {
          totalCharacters: consistencyReport.length,
          consistentCharacters: consistencyReport.filter(c => c.status === 'consistent').length,
          charactersNeedingAttention: consistencyReport.filter(c => c.status === 'needs_attention').length,
          averageConfidence: consistencyReport.reduce((sum, c) => sum + c.consistencyScore, 0) / (consistencyReport.length || 1)
        }
      });
    } catch (error) {
      console.error("Error generating visual consistency report:", error);
      res.status(500).json({ message: "Failed to generate visual consistency report" });
    }
  });

  // Script Characters Routes - Extract characters from script and suggest unmatched ones
  app.get("/api/projects/:projectId/script-characters", isAuthenticated, async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      const userId = resolveUserId(req.user);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ message: "Project not found" });
      }

      const scriptCharacters = await storage.getProjectScriptCharacters(req.params.projectId);
      res.json(scriptCharacters);
    } catch (error) {
      console.error("Error fetching script characters:", error);
      res.status(500).json({ message: "Failed to fetch script characters" });
    }
  });

  app.post("/api/projects/:projectId/characters/from-script", isAuthenticated, async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      const userId = resolveUserId(req.user);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Validate request body
      const { names } = insertCharacterFromScriptSchema.parse(req.body);
      
      // Create characters from script names with minimal data
      const createdCharacters = [];
      for (const name of names) {
        try {
          const characterData = insertCharacterSchema.parse({
            projectId: req.params.projectId,
            name: name.trim(),
            role: "Character", // Default role
            bio: `Character extracted from script. Appears in project story.`,
            visualDescriptors: "", // Empty initially - user can fill in later
            alwaysTraits: "",
            neverTraits: "",
            colorScheme: "",
            referenceImageUrl: null,
            isLibraryCharacter: false,
          });
          
          const character = await storage.createCharacter(characterData);
          createdCharacters.push(character);
        } catch (charError) {
          console.warn(`Failed to create character "${name}":`, charError);
          // Continue with other characters even if one fails
        }
      }

      res.json({ 
        success: true, 
        message: `Successfully created ${createdCharacters.length} character(s)`,
        characters: createdCharacters,
        created: createdCharacters.length,
        attempted: names.length
      });
    } catch (error) {
      console.error("Error creating characters from script:", error);
      res.status(400).json({ message: "Failed to create characters from script" });
    }
  });

  // Page routes
  app.post("/api/projects/:projectId/pages", isAuthenticated, async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      const userId = resolveUserId(req.user);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ message: "Project not found" });
      }

      const pageData = insertPageSchema.parse({
        ...req.body,
        projectId: req.params.projectId,
      });
      const page = await storage.createPage(pageData);
      res.json(page);
    } catch (error) {
      console.error("Error creating page:", error);
      res.status(400).json({ message: "Failed to create page" });
    }
  });

  app.get("/api/projects/:projectId/pages", isAuthenticated, async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      const userId = resolveUserId(req.user);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ message: "Project not found" });
      }

      const pages = await storage.getProjectPages(req.params.projectId);
      res.json(pages);
    } catch (error) {
      console.error("Error fetching pages:", error);
      res.status(500).json({ message: "Failed to fetch pages" });
    }
  });

  // Update page route - CRITICAL: This was missing!
  app.put("/api/pages/:id", isAuthenticated, async (req: any, res) => {
    try {
      const page = await storage.getPage(req.params.id);
      if (!page) {
        return res.status(404).json({ message: "Page not found" });
      }

      const project = await storage.getProject(page.projectId);
      const userId = resolveUserId(req.user);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Parse and validate the update data
      const updates = insertPageSchema.partial().parse(req.body);
      console.log(`📝 UPDATING PAGE ${req.params.id}: layoutTemplate = "${updates.layoutTemplate}"`);
      
      const updatedPage = await storage.updatePage(req.params.id, updates);
      if (!updatedPage) {
        return res.status(404).json({ message: "Page not found" });
      }

      res.json(updatedPage);
    } catch (error) {
      console.error("Error updating page:", error);
      res.status(400).json({ message: "Failed to update page" });
    }
  });

  // Delete page route
  app.delete("/api/pages/:id", isAuthenticated, async (req: any, res) => {
    try {
      const page = await storage.getPage(req.params.id);
      if (!page) {
        return res.status(404).json({ message: "Page not found" });
      }

      const project = await storage.getProject(page.projectId);
      const userId = resolveUserId(req.user);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ message: "Project not found" });
      }

      const success = await storage.deletePage(req.params.id);
      if (success) {
        res.json({ success: true, message: "Page deleted successfully" });
      } else {
        res.status(404).json({ message: "Page not found" });
      }
    } catch (error) {
      console.error("Error deleting page:", error);
      res.status(500).json({ message: "Failed to delete page" });
    }
  });

  // Panel routes
  app.post("/api/pages/:pageId/panels", isAuthenticated, async (req: any, res) => {
    try {
      const page = await storage.getPage(req.params.pageId);
      if (!page) {
        return res.status(404).json({ message: "Page not found" });
      }

      const project = await storage.getProject(page.projectId);
      const userId = resolveUserId(req.user);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ message: "Project not found" });
      }

      const panelData = insertPanelSchema.parse({
        ...req.body,
        pageId: req.params.pageId,
      });
      const panel = await storage.createPanel(panelData);
      res.json(panel);
    } catch (error) {
      console.error("Error creating panel:", error);
      res.status(400).json({ message: "Failed to create panel" });
    }
  });

  app.get("/api/pages/:pageId/panels", isAuthenticated, async (req: any, res) => {
    try {
      const page = await storage.getPage(req.params.pageId);
      if (!page) {
        return res.status(404).json({ message: "Page not found" });
      }

      const project = await storage.getProject(page.projectId);
      const userId = resolveUserId(req.user);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ message: "Project not found" });
      }

      const panels = await storage.getPagePanels(req.params.pageId);
      res.json(panels);
    } catch (error) {
      console.error("Error fetching panels:", error);
      res.status(500).json({ message: "Failed to fetch panels" });
    }
  });

  app.put("/api/panels/:id", isAuthenticated, async (req: any, res) => {
    try {
      const panelData = insertPanelSchema.partial().parse(req.body);
      const panel = await storage.updatePanel(req.params.id, panelData);
      if (!panel) {
        return res.status(404).json({ message: "Panel not found" });
      }
      res.json(panel);
    } catch (error) {
      console.error("Error updating panel:", error);
      res.status(400).json({ message: "Failed to update panel" });
    }
  });

  // AI Generation endpoints - SECURE: projectId from authenticated route params
  app.post("/api/projects/:projectId/generate-image", 
    isAuthenticated,
    requireCredits({
      operationType: "panel_generation",
      getResourceId: getProjectIdFromParams,
      getMetadata: (req) => createOperationMetadata(req, { 
        prompt: req.body.prompt?.substring(0, 100) 
      })
    }),
    async (req: any, res) => {
    try {
      // SECURITY FIX: projectId now comes from authenticated route params, not user-controlled request body
      const projectId = req.params.projectId;
      const userId = resolveUserId(req.user);
      
      // Verify user owns the project before any processing
      const project = await storage.getProject(projectId);
      if (!project || project.userId !== userId) {
        return res.status(403).json({ 
          message: "Access denied: Invalid project or insufficient permissions",
          error: "unauthorized_project_access"
        });
      }
      
      const { 
        prompt, 
        panelId, 
        projectContext, 
        characterContext, 
        styleOptions, 
        panelContext,
        // Optional fields for enhanced context
        currentPageId,
        selectedPanelNumber
      } = req.body;
      
      // Build enhanced context if IDs are provided
      let previousPanelsContext: Array<{panelNumber: number; prompt: string; imageUrl?: string}> = [];
      let crossPageContext: Array<{pageNumber: number; panels: Array<{panelNumber: number; prompt: string; imageUrl?: string}>}> = [];
      let enhancedPrompt = prompt; // Default to original prompt
      
      console.log(`✅ SECURITY: Project ownership validated for user ${userId}, project ${projectId}`);
      
      if (currentPageId && selectedPanelNumber && projectId) {
        console.log(`🎯 ENHANCED CONTEXT: Building rich script-enhanced context for panel ${selectedPanelNumber} on page ${currentPageId}`);
        
        try {
          // Build previousPanelsContext: panels from current page with lower numbers
          const currentPagePanels = await storage.getPagePanels(currentPageId);
          previousPanelsContext = currentPagePanels
            .filter((panel: any) => panel.panelNumber < selectedPanelNumber)
            .sort((a: any, b: any) => a.panelNumber - b.panelNumber)
            .slice(-4) // Take last 4 previous panels for context (increased from 3)
            .map((panel: any) => ({
              panelNumber: panel.panelNumber,
              prompt: panel.prompt || `Panel ${panel.panelNumber}`,
              imageUrl: panel.imageUrl,
            }));
          
          console.log(`📋 Previous panels context: ${previousPanelsContext.length} panels from current page`);
          
          // Build crossPageContext: panels from previous pages using existing method
          crossPageContext = await geminiService.buildCrossPageContext(currentPageId, storage);
          console.log(`📚 Cross-page context: ${crossPageContext.length} previous pages`);
          
          // SCRIPT ENHANCEMENT: Add the same script enhancement logic from full-page generation
          try {
            const project = await storage.getProject(projectId); // Project already validated above
            const currentPage = await storage.getPage(currentPageId);
            const characters = await storage.getProjectCharacters(projectId);
            
            if (project?.script && currentPage) {
              const structuredScript = JSON.parse(project.script);
              console.log(`🎬 SCRIPT ENHANCEMENT: Found structured script with ${structuredScript.pages?.length || 0} pages`);
              
              // Find the script page matching current page
              let scriptPage = structuredScript.pages?.find((p: any) => p.pageNumber === currentPage.pageNumber);
              
              if (!scriptPage && typeof currentPage.pageNumber === 'number') {
                scriptPage = structuredScript.pages?.[currentPage.pageNumber - 1];
              }
              
              console.log("Found script page:", scriptPage ? {
                pageNumber: scriptPage.pageNumber,
                title: scriptPage.title,
                panelCount: scriptPage.panels?.length || 0
              } : "NOT FOUND");
              
              if (scriptPage?.panels && Array.isArray(scriptPage.panels)) {
                // Find script panel using same logic as full-page generation
                let scriptPanel = scriptPage.panels.find((p: any) => p.panelNumber === selectedPanelNumber);
                
                // Fallback for existing scripts with wrong numbering: use array index
                if (!scriptPanel && scriptPage.panels[selectedPanelNumber - 1]) {
                  scriptPanel = scriptPage.panels[selectedPanelNumber - 1];
                  console.log(`Panel ${selectedPanelNumber}: Using fallback array index [${selectedPanelNumber-1}] for panel labeled as ${scriptPanel.panelNumber}`);
                }
                
                console.log(`Panel ${selectedPanelNumber} script match:`, scriptPanel ? {
                  foundPanelNumber: scriptPanel.panelNumber,
                  sceneDescription: scriptPanel.sceneDescription?.substring(0, 50) + "...",
                  hasDialogue: scriptPanel.dialogue?.length > 0,
                  hasCharacters: scriptPanel.characters?.length > 0
                } : "NOT FOUND");
                
                if (scriptPanel) {
                  // 🌟 BUILD ENHANCED DESCRIPTION using script data (same logic as full-page generation)
                  let richDescription = scriptPanel.sceneDescription || scriptPanel.visualDescription || scriptPanel.action;
                  if (richDescription) {
                    enhancedPrompt = richDescription;
                    
                    // Add specific character descriptions for this panel
                    if (scriptPanel.characters?.length > 0 && characters.length > 0) {
                      const panelCharacters = scriptPanel.characters.map((charName: string) => {
                        const charData = characters.find((c: any) => c.name === charName);
                        if (charData && charData.visualDescriptors) {
                          return `${charName} (APPEARANCE: ${charData.visualDescriptors})`;
                        }
                        return charName;
                      }).join(", ");
                      enhancedPrompt += `. Characters in panel: ${panelCharacters}`;
                    } else if (scriptPanel.characters?.length > 0) {
                      enhancedPrompt += `. Characters: ${scriptPanel.characters.join(", ")}`;
                    }
                    
                    // Add character emotions and dialogue context
                    if (scriptPanel.dialogue?.length > 0) {
                      const emotions = scriptPanel.dialogue
                        .filter((d: any) => d.emotionalState)
                        .map((d: any) => `${d.character} is ${d.emotionalState}`)
                        .join(", ");
                      if (emotions) {
                        enhancedPrompt += `. Character emotions: ${emotions}`;
                      }
                    }
                    
                    // Add camera and shot information
                    if (scriptPanel.cameraAngle) {
                      enhancedPrompt += `. Camera: ${scriptPanel.cameraAngle}`;
                    }
                    if (scriptPanel.shotType) {
                      enhancedPrompt += `. Shot: ${scriptPanel.shotType}`;
                    }
                    if (scriptPanel.mood) {
                      enhancedPrompt += `. Mood: ${scriptPanel.mood}`;
                    }
                    
                    // Add visual notes
                    if (scriptPanel.visualNotes) {
                      enhancedPrompt += `. Visual notes: ${scriptPanel.visualNotes}`;
                    }
                    
                    // Add action details
                    if (scriptPanel.action) {
                      enhancedPrompt += `. Action: ${scriptPanel.action}`;
                    }
                    
                    console.log(`🎨 SCRIPT ENHANCED PROMPT: Panel ${selectedPanelNumber} enhanced from "${prompt.substring(0, 50)}..." to "${enhancedPrompt.substring(0, 100)}..."`);
                  } else {
                    console.log(`Panel ${selectedPanelNumber}: Script panel found but no rich description available`);
                  }
                } else {
                  console.log(`Panel ${selectedPanelNumber}: No script panel found, using original prompt`);
                }
              } else {
                console.log(`No panels found in script page ${currentPage.pageNumber}`);
              }
            } else {
              console.log("No structured script available for enhancement");
            }
          } catch (scriptError) {
            console.error("Error during script enhancement:", scriptError);
            // Continue with original prompt - graceful fallback
          }
          
        } catch (error) {
          console.error("Error building enhanced context:", error);
          // Continue without enhanced context - graceful fallback
        }
      }
      
      // CRITICAL FIX: Merge fresh database characters into projectContext
      // This ensures referenceImageUrl and other character data reaches Gemini
      let enhancedProjectContext = projectContext;
      if (currentPageId && projectId) {
        try {
          const freshCharacters = await storage.getProjectCharacters(projectId);
          enhancedProjectContext = {
            ...projectContext,
            characters: freshCharacters.map(char => ({
              name: char.name,
              role: char.role,
              bio: char.bio,
              visualDescriptors: char.visualDescriptors,
              alwaysTraits: char.alwaysTraits,
              neverTraits: char.neverTraits,
              colorScheme: char.colorScheme,
              referenceImageUrl: char.referenceImageUrl, // This is the critical field!
            }))
          };
          console.log(`🎯 CHARACTER CONTEXT: Updated projectContext with ${freshCharacters.length} fresh characters including referenceImageUrl`);
        } catch (error) {
          console.error("Error fetching fresh characters for Gemini context:", error);
          // Continue with original projectContext
        }
      }
      
      const result = await geminiService.generatePanelImage({
        prompt: enhancedPrompt, // Use enhanced prompt with script data
        panelId,
        projectId, // SECURITY FIX: Pass authenticated projectId from route params instead of deriving from panelId
        projectContext: enhancedProjectContext, // Use enhanced context with fresh character data
        characterContext,
        styleOptions,
        panelContext,
        previousPanelsContext,
        crossPageContext,
      });
      
      console.log("🔍 RESULT FROM GEMINI SERVICE:", { 
        status: result.status, 
        errorCategory: result.errorCategory,
        hasError: !!result.error,
        fullResult: result 
      });
      
      // Check for quota exceeded errors and return HTTP 429
      if (result.errorCategory === 'quota_exceeded') {
        console.log("🚨 RETURNING HTTP 429 FOR QUOTA ERROR");
        return res.status(429).json(result);
      }
      
      res.json(result);
    } catch (error) {
      console.error(`❌ === PANEL GENERATION API ENDPOINT FAILURE ===`);
      console.error(`🕒 Timestamp: ${new Date().toISOString()}`);
      console.error(`🔗 Route: POST /api/projects/:projectId/generate-image`);
      
      // Log detailed request context
      console.error(`📋 === REQUEST DETAILS ===`);
      console.error(`🏗️ Project ID: ${req.params.projectId}`);
      console.error(`👤 User ID: ${resolveUserId(req.user)}`);
      
      if (req.body) {
        console.error(`📝 Panel ID: ${req.body.panelId || 'Unknown'}`);
        console.error(`📄 Page ID: ${req.body.currentPageId || 'None'}`);
        console.error(`🎯 Panel Number: ${req.body.selectedPanelNumber || 'None'}`);
        console.error(`📏 Prompt Length: ${req.body.prompt?.length || 0} characters`);
        console.error(`🎨 Art Style: ${req.body.styleOptions?.artStyle || req.body.projectContext?.artStyle || 'Default'}`);
        console.error(`🎭 Characters Count: ${req.body.projectContext?.characters?.length || 0}`);
        
        if (req.body.projectContext?.characters?.length > 0) {
          console.error(`👥 Character Names: ${req.body.projectContext.characters.map((c: any) => c.name || 'Unnamed').join(', ')}`);
        }
        
        if (req.body.panelContext) {
          console.error(`📐 Panel Dimensions: ${req.body.panelContext.dimensions?.width || 'Unknown'}x${req.body.panelContext.dimensions?.height || 'Unknown'}`);
          console.error(`📊 Aspect Ratio: ${req.body.panelContext.aspectRatio || 'Unknown'}`);
          console.error(`🏷️ Panel Type: ${req.body.panelContext.panelType || 'Unknown'}`);
        }
        
        console.error(`🔄 Previous Context: ${req.body.previousPanelsContext?.length || 0} panels`);
        console.error(`📚 Cross-page Context: ${req.body.crossPageContext?.length || 0} pages`);
      }
      
      // Log detailed error information
      console.error(`🚨 === ERROR ANALYSIS ===`);
      const errorType = error?.constructor?.name || 'UnknownError';
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`🏷️ Error Type: ${errorType}`);
      console.error(`📝 Error Message: ${errorMessage}`);
      
      // Enhanced error categorization for API response
      let httpStatus = 500;
      let userFriendlyMessage = "Failed to generate image";
      let errorCategory = 'unknown_error';
      
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();
        
        if (errorMsg.includes('unauthorized') || errorMsg.includes('access denied')) {
          httpStatus = 403;
          errorCategory = 'authorization_error';
          userFriendlyMessage = 'Access denied. Please check your project permissions.';
        } else if (errorMsg.includes('quota') || errorMsg.includes('limit') || errorMsg.includes('credit')) {
          httpStatus = 429;
          errorCategory = 'quota_exceeded';
          userFriendlyMessage = 'Generation limit reached. Please upgrade your plan or try again later.';
        } else if (errorMsg.includes('timeout') || errorMsg.includes('deadline')) {
          httpStatus = 408;
          errorCategory = 'timeout_error';
          userFriendlyMessage = 'Request timed out. The generation process took too long. Please try again.';
        } else if (errorMsg.includes('character') || errorMsg.includes('validation')) {
          httpStatus = 400;
          errorCategory = 'validation_error';
          userFriendlyMessage = 'Character validation failed. Please check your character setup and try again.';
        } else if (errorMsg.includes('invalid') || errorMsg.includes('malformed') || errorMsg.includes('parse')) {
          httpStatus = 400;
          errorCategory = 'invalid_request';
          userFriendlyMessage = 'Invalid request. Please check your input and try again.';
        } else if (errorMsg.includes('network') || errorMsg.includes('connection') || errorMsg.includes('fetch')) {
          httpStatus = 503;
          errorCategory = 'network_error';
          userFriendlyMessage = 'Network error occurred. Please check your connection and try again.';
        } else if (errorMsg.includes('project') && errorMsg.includes('not found')) {
          httpStatus = 404;
          errorCategory = 'project_not_found';
          userFriendlyMessage = 'Project not found. Please refresh the page and try again.';
        } else {
          userFriendlyMessage = errorMessage;
        }
      }
      
      console.error(`📊 HTTP Status: ${httpStatus}`);
      console.error(`🏷️ Error Category: ${errorCategory}`);
      console.error(`👤 User Message: ${userFriendlyMessage}`);
      
      // Log full error object for debugging
      if (error && typeof error === 'object') {
        console.error(`🔍 === FULL ERROR DETAILS ===`);
        console.error(JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      }
      
      // Log system state for debugging
      console.error(`💻 === SYSTEM STATE ===`);
      console.error(`🧠 Memory Usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
      console.error(`⏱️ Process Uptime: ${Math.round(process.uptime())}s`);
      console.error(`📊 Active Handles: ${(process as any)._getActiveHandles?.().length || 'Unknown'}`);
      
      // Enhanced error response with debugging info
      res.status(httpStatus).json({ 
        message: userFriendlyMessage,
        error: errorCategory,
        timestamp: new Date().toISOString(),
        debugInfo: {
          projectId: req.params.projectId,
          panelId: req.body?.panelId,
          errorType: errorType,
          originalError: errorMessage
        }
      });
    }
  });

  // 🎨 PHASE 1: REFERENCE PORTRAIT GENERATION ROUTES
  // Generate reference portrait for a single character
  app.post('/api/characters/:characterId/generate-reference-portrait',
    isAuthenticated,
    requireCredits({
      operationType: "panel_generation",
      getResourceId: (req: any) => req.params.characterId,
      getMetadata: (req) => createOperationMetadata(req, { 
        characterId: req.params.characterId,
        action: "reference_portrait_generation"
      })
    }),
    async (req: any, res) => {
    try {
      const { characterId } = req.params;
      const { forceRegenerate = false } = req.body;
      const userId = resolveUserId(req.user);

      // Get character data
      const character = await storage.getCharacter(characterId);
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }

      // Get project to verify ownership
      if (character.projectId) {
        const project = await storage.getProject(character.projectId);
        if (!project || project.userId !== userId) {
          return res.status(403).json({ message: "Unauthorized access to project" });
        }
      }

      // Check if character already has reference portrait (unless forcing regeneration)
      if (character.referenceImageUrl && !forceRegenerate) {
        return res.status(200).json({
          status: "completed",
          referenceImageUrl: character.referenceImageUrl,
          characterId: character.id,
          characterName: character.name,
          message: "Character already has reference portrait"
        });
      }

      // Validate character has required data
      if (!character.visualDescriptors || !character.alwaysTraits) {
        return res.status(400).json({
          status: "failed",
          characterId: character.id,
          characterName: character.name,
          error: "Character missing visual descriptors or always traits"
        });
      }

      // Generate reference portrait
      const projectId = character.projectId || req.params.projectId;
      if (!projectId) {
        return res.status(400).json({
          status: "failed",
          characterId: character.id,
          characterName: character.name,
          error: "Character must be associated with a project to generate reference portrait"
        });
      }
      
      const portraitResult = await geminiService.generateReferencePortrait({
        characterId: character.id,
        characterName: character.name,
        visualDescriptors: character.visualDescriptors,
        alwaysTraits: character.alwaysTraits,
        artStyle: character.projectId ? (await storage.getProject(character.projectId))?.artStyle ?? undefined : undefined,
        forceRegenerate,
        projectId: projectId
      });

      // Update character in database if successful
      if (portraitResult.status === "completed" && portraitResult.referenceImageUrl) {
        await storage.updateCharacter(character.id, {
          referenceImageUrl: portraitResult.referenceImageUrl
        });
      }

      // Check for quota exceeded errors and return HTTP 429
      if (portraitResult.error && portraitResult.error.toLowerCase().includes('quota')) {
        return res.status(429).json(portraitResult);
      }

      res.status(200).json(portraitResult);
    } catch (error) {
      console.error("Error generating reference portrait:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate reference portrait";
      res.status(500).json({ 
        status: "failed",
        characterId: req.params.characterId,
        characterName: "Unknown",
        error: errorMessage 
      });
    }
  });

  // Generate reference portraits for all characters in a project missing them
  app.post('/api/projects/:projectId/generate-missing-reference-portraits',
    isAuthenticated,
    requireCredits({
      operationType: "character_generation",
      getResourceId: (req: any) => req.params.projectId,
      getMetadata: (req) => createOperationMetadata(req, { 
        projectId: req.params.projectId,
        action: "bulk_reference_portrait_generation"
      })
    }),
    async (req: any, res) => {
    try {
      const { projectId } = req.params;
      const userId = resolveUserId(req.user);

      // Verify project ownership
      const project = await storage.getProject(projectId);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Generate missing reference portraits
      const bulkResult = await geminiService.generateMissingReferencePortraits(projectId);

      res.status(200).json({
        status: "completed",
        projectId,
        projectTitle: project.title,
        ...bulkResult
      });
    } catch (error) {
      console.error("Error generating missing reference portraits:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate missing reference portraits";
      res.status(500).json({ 
        status: "failed",
        projectId: req.params.projectId,
        error: errorMessage 
      });
    }
  });

  // 🎯 PHASE 3: CROSS-PANEL CHARACTER CONSISTENCY VALIDATION ROUTES
  // Validate character consistency in a generated panel
  app.post('/api/panels/:panelId/validate-character-consistency',
    isAuthenticated,
    async (req: any, res) => {
    try {
      const { panelId } = req.params;
      const { 
        characterId, 
        characterName,
        currentPanelImageUrl,
        referenceImageUrl,
        previousPanelImageUrls = [],
        toleranceLevel = 'moderate' 
      } = req.body;
      const userId = resolveUserId(req.user);

      // Validate required parameters
      if (!characterId || !characterName || !currentPanelImageUrl) {
        return res.status(400).json({
          message: "Missing required parameters: characterId, characterName, and currentPanelImageUrl are required"
        });
      }

      // Get character to verify access
      const character = await storage.getCharacter(characterId);
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }

      // Verify project ownership if character belongs to a project
      if (character.projectId) {
        const project = await storage.getProject(character.projectId);
        if (!project || project.userId !== userId) {
          return res.status(403).json({ message: "Unauthorized access to project" });
        }
      }

      // Perform character consistency validation
      const validationResult = await geminiService.validateCharacterConsistency({
        currentPanelImageUrl,
        characterId,
        characterName,
        referenceImageUrl: referenceImageUrl || character.referenceImageUrl || undefined,
        previousPanelImageUrls,
        toleranceLevel
      });

      res.status(200).json({
        panelId,
        characterId,
        characterName,
        ...validationResult,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error validating character consistency:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to validate character consistency";
      res.status(500).json({ 
        message: errorMessage,
        panelId: req.params.panelId,
        error: errorMessage 
      });
    }
  });

  // Batch validate character consistency across multiple panels
  app.post('/api/projects/:projectId/validate-character-consistency-batch',
    isAuthenticated,
    async (req: any, res) => {
    try {
      const { projectId } = req.params;
      const { 
        validationTasks, // Array of { panelId, characterId, characterName, imageUrl }
        toleranceLevel = 'moderate' 
      } = req.body;
      const userId = resolveUserId(req.user);

      // Verify project ownership
      const project = await storage.getProject(projectId);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ message: "Project not found" });
      }

      if (!validationTasks || !Array.isArray(validationTasks) || validationTasks.length === 0) {
        return res.status(400).json({ message: "validationTasks array is required" });
      }

      const results = [];
      let overallConsistent = true;
      let totalScore = 0;

      // Process each validation task
      for (const task of validationTasks) {
        try {
          const character = await storage.getCharacter(task.characterId);
          if (!character) {
            results.push({
              panelId: task.panelId,
              characterId: task.characterId,
              status: 'error',
              error: 'Character not found'
            });
            continue;
          }

          const validationResult = await geminiService.validateCharacterConsistency({
            currentPanelImageUrl: task.imageUrl,
            characterId: task.characterId,
            characterName: task.characterName,
            referenceImageUrl: character.referenceImageUrl || undefined,
            toleranceLevel
          });

          results.push({
            panelId: task.panelId,
            characterId: task.characterId,
            characterName: task.characterName,
            ...validationResult
          });

          if (!validationResult.isConsistent) {
            overallConsistent = false;
          }
          totalScore += validationResult.consistencyScore;
        } catch (taskError) {
          console.error(`Error validating task for panel ${task.panelId}:`, taskError);
          results.push({
            panelId: task.panelId,
            characterId: task.characterId,
            status: 'error',
            error: taskError instanceof Error ? taskError.message : 'Validation failed'
          });
        }

        // Add delay between validations to respect API limits
        if (results.length < validationTasks.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const averageScore = validationTasks.length > 0 ? totalScore / validationTasks.length : 0;

      res.status(200).json({
        projectId,
        projectTitle: project.title,
        overallConsistent,
        averageConsistencyScore: Math.round(averageScore),
        totalValidated: validationTasks.length,
        results,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error in batch character consistency validation:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to perform batch validation";
      res.status(500).json({ 
        message: errorMessage,
        projectId: req.params.projectId 
      });
    }
  });

  // 🏗️ PHASE 5: MULTI-PAGE CONSISTENCY ARCHITECTURE ROUTES
  // Generate multi-page comic with comprehensive character consistency
  app.post('/api/projects/:projectId/generate-consistent-multipage',
    isAuthenticated,
    requireCredits({
      operationType: "full_page_generation",
      getResourceId: (req: any) => req.params.projectId,
      getMetadata: (req) => createOperationMetadata(req, { 
        projectId: req.params.projectId,
        action: "multipage_consistency_generation",
        pageRange: req.body.pageRange
      })
    }),
    async (req: any, res) => {
    try {
      const { projectId } = req.params;
      const { 
        pageRange = { start: 1, end: 5 },
        enableStrictConsistency = true,
        consistencyCheckpoints = [],
        maxInconsistencyScore = 70
      } = req.body;
      const userId = resolveUserId(req.user);

      // Verify project ownership
      const project = await storage.getProject(projectId);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Validate page range
      if (!pageRange.start || !pageRange.end || pageRange.start > pageRange.end) {
        return res.status(400).json({ message: "Invalid page range" });
      }

      if (pageRange.end - pageRange.start > 50) {
        return res.status(400).json({ message: "Page range too large. Maximum 50 pages per request." });
      }

      console.log(`🏗️ Starting multi-page consistency generation for project ${project.title}: pages ${pageRange.start}-${pageRange.end}`);

      // Execute multi-page consistency generation
      const result = await geminiService.generateConsistentMultiPageComic({
        projectId,
        pageRange,
        enableStrictConsistency,
        consistencyCheckpoints,
        maxInconsistencyScore
      });

      res.status(200).json({
        projectId,
        projectTitle: project.title,
        pageRange,
        ...result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error in multi-page consistency generation:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate consistent multi-page comic";
      res.status(500).json({ 
        message: errorMessage,
        projectId: req.params.projectId 
      });
    }
  });

  // Get character consistency trends and analytics
  app.get('/api/projects/:projectId/character-consistency-analytics',
    isAuthenticated,
    async (req: any, res) => {
    try {
      const { projectId } = req.params;
      const userId = resolveUserId(req.user);

      // Verify project ownership
      const project = await storage.getProject(projectId);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Get character consistency analytics
      const characters = await storage.getProjectCharacters(projectId);
      const pages = await storage.getProjectPages(projectId);
      
      const analytics = {
        projectId,
        projectTitle: project.title,
        totalCharacters: characters.length,
        totalPages: pages.length,
        charactersWithReferencePortraits: characters.filter(c => c.referenceImageUrl).length,
        characterProfiles: characters.map(character => ({
          id: character.id,
          name: character.name,
          hasReferencePortrait: !!character.referenceImageUrl,
          hasVisualDescriptors: !!character.visualDescriptors,
          hasConsistencyRules: !!(character.alwaysTraits || character.neverTraits),
          consistencyReadiness: calculateCharacterConsistencyReadiness(character)
        })),
        recommendations: generateConsistencyRecommendations(characters, pages)
      };

      res.status(200).json(analytics);
    } catch (error) {
      console.error("Error getting character consistency analytics:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to get consistency analytics";
      res.status(500).json({ 
        message: errorMessage,
        projectId: req.params.projectId 
      });
    }
  });

  // Character redressing endpoint
  app.post('/api/redress-character',
    isAuthenticated,
    requireCredits({
      operationType: "panel_generation",
      getResourceId: (req: any) => req.body.panelId,
      getMetadata: (req) => createOperationMetadata(req, { 
        characterId: req.body.characterId,
        outfitType: req.body.outfitType,
        panelId: req.body.panelId 
      })
    }),
    async (req: any, res) => {
    try {
      const { 
        characterId, 
        panelId, 
        projectId, 
        outfitDescription, 
        outfitType, 
        clothingStyle, 
        colorScheme, 
        occasion 
      } = req.body;

      // Get character and project details for context
      const character = await storage.getCharacter(characterId);
      const project = await storage.getProject(projectId);

      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Find the current panel by database ID to edit
      let currentPanelImage: string | undefined;
      let targetPanelId: string | undefined;
      try {
        const projectPages = await storage.getProjectPages(projectId);
        for (const page of projectPages) {
          const pagePanels = await storage.getPagePanels(page.id);
          const targetPanel = pagePanels.find(p => p.id === panelId);
          if (targetPanel) {
            targetPanelId = targetPanel.id;
            currentPanelImage = targetPanel.imageUrl || undefined;
            break;
          }
        }
      } catch (error) {
        console.warn("Could not find current panel image, will generate new image instead:", error);
      }

      // If no panel found by database ID, return error
      if (!targetPanelId) {
        return res.status(404).json({ 
          status: "failed",
          message: "Panel not found with the provided ID" 
        });
      }

      // Verify user ownership
      const userId = resolveUserId(req.user);
      if (project.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized access to project" });
      }

      // Build enhanced character prompt with outfit context
      const characterPrompt = `Character: ${character.name} ${character.role ? `(${character.role})` : ''}
Visual Description: ${character.visualDescriptors || 'Standard appearance'}
Always Traits: ${character.alwaysTraits || 'None specified'}
Never Traits: ${character.neverTraits || 'None specified'}
Color Scheme: ${character.colorScheme || 'Default colors'}

NEW OUTFIT: ${outfitDescription}
Style: ${clothingStyle}
Occasion: ${occasion}
Colors: ${colorScheme !== 'character-default' ? colorScheme : character.colorScheme || 'default colors'}

Redress this character in the specified outfit while maintaining their core visual identity and traits.`;

      // Build project context for consistent world-building
      const projectContext = {
        title: project.title,
        description: project.description || undefined,
        genre: project.genre || undefined,
        artStyle: project.artStyle || 'Comic Book (Classic)'
      };

      // Generate the redressed character image with retry logic
      let result: any;
      let lastError: Error | null = null;
      const maxRetries = 2;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`🎨 Character redressing attempt ${attempt}/${maxRetries} for panel ${panelId}${currentPanelImage ? ' (edit mode)' : ' (generation mode)'}`);
          
          result = await geminiService.generatePanelImage({
            prompt: characterPrompt,
            panelId: panelId,
            projectId, // SECURITY FIX: Pass authenticated projectId from request body instead of deriving from panelId
            sourceImageUrl: currentPanelImage, // Pass current panel image for editing
            projectContext: projectContext,
            characterContext: [{
              name: character.name,
              role: character.role || '',
              visualDescriptors: character.visualDescriptors || ''
            }],
            styleOptions: {
              artStyle: project.artStyle || 'Comic Book (Classic)'
            },
            panelContext: undefined,
          });
          
          // If we get here, the request succeeded
          break;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          console.error(`🚨 Character redressing attempt ${attempt} failed:`, lastError.message);
          
          // Don't retry for client errors or specific server errors
          if (lastError.message.includes('not found') || 
              lastError.message.includes('unauthorized') ||
              lastError.message.includes('invalid') ||
              attempt === maxRetries) {
            break;
          }
          
          // Wait before retrying (exponential backoff)
          if (attempt < maxRetries) {
            const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, etc.
            console.log(`⏳ Retrying in ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      }

      // Check if we have a result after all retries
      if (!result) {
        const errorMessage = lastError?.message || "Failed to redress character after multiple attempts";
        console.error("🚨 All character redressing attempts failed:", errorMessage);
        
        // Return failed status with proper error information
        return res.status(200).json({
          status: "failed",
          imageUrl: "",
          panelId: panelId,
          message: errorMessage,
          characterName: character.name,
          outfitDescription: outfitDescription
        });
      }

      // Update the panel with the new character image if generation succeeded
      if (result.status === "completed" && result.imageUrl) {
        try {
          // CRITICAL FIX: Use targetPanelId (database ID) instead of panelId (panelNumber)
          // Only update imageUrl field to preserve existing panel data (chat bubbles, overlays, etc.)
          await storage.updatePanel(targetPanelId, {
            imageUrl: result.imageUrl,
            isGenerated: true,
            generationStatus: "completed"
          });
          console.log(`✅ Panel ${targetPanelId} updated with new character image: ${result.imageUrl}`);
        } catch (updateError) {
          console.error("⚠️ Failed to update panel with new image:", updateError);
          // Continue - the image was generated successfully even if database update failed
        }
      }
      
      // Return consistent response structure
      res.status(200).json({
        status: result.status || "completed",
        imageUrl: result.imageUrl || "",
        panelId: panelId,
        message: result.status === "completed" ? "Character redressed successfully" : (result.error || "Character redressing failed"),
        characterName: character.name,
        outfitDescription: outfitDescription,
        mode: currentPanelImage ? "edit" : "generation"
      });
    } catch (error) {
      console.error("🚨 Unexpected error in character redressing:", error);
      
      // Determine appropriate error status code
      let statusCode = 500;
      let errorMessage = "Internal server error";
      
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        if (message.includes('not found')) {
          statusCode = 404;
          errorMessage = error.message;
        } else if (message.includes('unauthorized') || message.includes('forbidden')) {
          statusCode = 403;
          errorMessage = error.message;
        } else if (message.includes('invalid') || message.includes('required')) {
          statusCode = 400;
          errorMessage = error.message;
        } else {
          errorMessage = error.message;
        }
      }
      
      res.status(statusCode).json({
        status: "failed",
        imageUrl: "",
        panelId: req.body.panelId || null,
        message: errorMessage,
        characterName: req.body.characterId ? "Unknown" : undefined,
        outfitDescription: req.body.outfitDescription || undefined
      });
    }
  });

  // Background Generation route - SECURE: projectId from authenticated route params
  app.post("/api/projects/:projectId/generate-background", 
    isAuthenticated,
    requireCredits({
      operationType: "background_generation",
      getResourceId: getProjectIdFromParams,
      getMetadata: (req) => createOperationMetadata(req, { 
        projectId: req.params.projectId,
        pageId: req.body.pageId 
      })
    }),
    async (req: any, res) => {
    try {
      // SECURITY FIX: projectId now comes from authenticated route params, not user-controlled request body
      const projectId = req.params.projectId;
      const userId = resolveUserId(req.user);
      
      // Verify user owns the project before any processing
      const project = await storage.getProject(projectId);
      if (!project || project.userId !== userId) {
        return res.status(403).json({ 
          message: "Access denied: Invalid project or insufficient permissions",
          error: "unauthorized_project_access"
        });
      }
      
      const { panelId, pageId, layoutTemplate, panelContext } = req.body;
      const actualPanelId = panelId || 1; // Default to panel 1 for page-level generation

      const projectContext = {
        title: project.title,
        genre: project.genre || undefined,
        description: project.description || undefined,
        artStyle: project.artStyle || undefined,
      };

      // ENHANCED: Fetch script data for contextual backgrounds
      let pageScriptData = undefined;
      if (pageId) {
        try {
          const page = await storage.getPage(pageId);
          if (page) {
            // Get structured script for this project
            const structuredScript = await storage.getProjectStructuredScript(projectId);
            if (structuredScript) {
              // Script pages are already included in the FullStructuredScript
              const matchingScriptPage = structuredScript.pages.find(sp => sp.pageNumber === page.pageNumber);
              
              if (matchingScriptPage) {
                pageScriptData = {
                  setting: matchingScriptPage.setting || undefined,
                  mood: matchingScriptPage.mood || undefined,
                  timeOfDay: matchingScriptPage.timeOfDay || undefined,
                  location: matchingScriptPage.location || undefined,
                  weatherConditions: matchingScriptPage.weatherConditions || undefined,
                  title: matchingScriptPage.title || undefined,
                };
                console.log(`📍 Using script data for page ${page.pageNumber}:`, pageScriptData);
              } else {
                console.log(`⚠️ No script data found for page ${page.pageNumber}`);
              }
            }
          }
        } catch (scriptError) {
          console.log("Could not fetch script data for background context:", scriptError);
          // Continue without script data
        }
      }

      // For page-level generation, enhance context with layout info and proper structure
      const enhancedPanelContext = pageId && layoutTemplate ? {
        ...panelContext,
        fullPage: true,
        layoutTemplate,
        // Use actual page canvas aspect ratio: 8.5/11 ≈ 0.772 for standard comic page
        aspectRatio: 8.5 / 11, // Correct comic page aspect ratio
        panelType: "page-background",
        panelNumber: 1,
        dimensions: {
          width: 850, // Standard comic page proportions
          height: 1100
        }
      } : panelContext;

      const result = await geminiService.generatePanelBackground({
        panelId: actualPanelId,
        projectContext,
        panelContext: enhancedPanelContext,
        pageScriptData,
      });

      // If this is page-level background generation and successful, save to database
      if (pageId && result.status === "completed" && result.imageUrl) {
        try {
          await storage.updatePageBackground(pageId, result.imageUrl);
          console.log(`Page background saved to database for page ${pageId}: ${result.imageUrl}`);
        } catch (dbError) {
          console.error("Failed to save page background to database:", dbError);
          // Don't fail the response since image generation was successful
        }
      }

      // Check for quota exceeded errors and return HTTP 429
      if (result.errorCategory === 'quota_exceeded') {
        return res.status(429).json(result);
      }

      res.json(result);
    } catch (error) {
      console.error("Background generation error:", error);
      res.status(500).json({ message: "Failed to generate background" });
    }
  });

  app.post("/api/generate-full-page", 
    isAuthenticated,
    requireCredits({
      operationType: "full_page_generation",
      getResourceId: (req) => req.body.currentPageId,
      getMetadata: (req) => createOperationMetadata(req, { 
        layoutId: req.body.layoutId 
      })
    }),
    async (req: any, res) => {
    try {
      const { projectContext, pageScript, panelLayout, currentPageId, layoutId } = req.body;
      
      // Ensure we have all required data for database persistence
      if (!currentPageId) {
        return res.status(400).json({ message: "currentPageId is required for panel persistence" });
      }
      
      const results = await geminiService.generateFullPage(
        projectContext.projectId || currentPageId,
        projectContext,
        pageScript,
        panelLayout,
        currentPageId,
        storage,
        layoutId
      );
      
      // Check for quota exceeded errors in results
      if (results && typeof results === 'object') {
        // Handle array of results (multiple panels)
        if (Array.isArray(results)) {
          const quotaError = results.find(r => r.errorCategory === 'quota_exceeded');
          if (quotaError) {
            return res.status(429).json(results);
          }
        }
        // Handle single result object
        else if (results.errorCategory === 'quota_exceeded') {
          return res.status(429).json(results);
        }
      }
      
      res.json(results);
    } catch (error) {
      console.error("Error generating full page:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate full page";
      res.status(500).json({ message: errorMessage });
    }
  });

  app.post("/api/generate-script", 
    isAuthenticated,
    requireCredits({
      operationType: "script_generation",
      getResourceId: getProjectIdFromParams,
      getMetadata: (req) => createOperationMetadata(req)
    }),
    async (req: any, res) => {
    try {
      const scriptRequest = req.body;
      
      const result = await geminiService.generateScript(scriptRequest);
      
      // Check for quota exceeded errors and return HTTP 429
      if (result && typeof result === 'object' && result.error && result.error.toLowerCase().includes('quota')) {
        return res.status(429).json(result);
      }
      
      res.json(result);
    } catch (error) {
      console.error("Error generating script:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate script";
      res.status(500).json({ message: errorMessage });
    }
  });

  // Generate text route for general AI text generation
  app.post("/api/generate-text", 
    isAuthenticated,
    requireCredits({
      operationType: "text_generation",
      getMetadata: (req) => createOperationMetadata(req, { 
        prompt: req.body.prompt?.substring(0, 100) 
      })
    }),
    async (req: any, res) => {
    try {
      const { prompt } = req.body;
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      const text = response.text || "";
      res.json({ text });
    } catch (error) {
      console.error("Error generating text:", error);
      
      // Check if this is a quota error and return HTTP 429
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();
        if (errorMsg.includes('quota') || errorMsg.includes('limit') || errorMsg.includes('resource_exhausted')) {
          return res.status(429).json({ 
            message: "API quota exceeded. Please try again later.",
            error: "quota_exceeded",
            errorCategory: "quota_exceeded"
          });
        }
      }
      
      res.status(500).json({ message: "Failed to generate text" });
    }
  });

  // ========================================
  // PARALLEL PROCESSING ENDPOINTS
  // ========================================

  // Generate multiple panels in parallel - SECURE: projectId from authenticated route params
  app.post("/api/projects/:projectId/parallel/panels", 
    isAuthenticated,
    // SECURITY FIX: projectId now from authenticated route params, not user-controlled request body
    async (req: any, res: any, next: any) => {
      try {
        const userId = resolveUserId(req.user);
        const projectId = req.params.projectId;
        const panelCount = req.body?.panels?.length || 0;
        
        // SECURITY FIX: Verify user owns the project before any processing
        const project = await storage.getProject(projectId);
        if (!project || project.userId !== userId) {
          return res.status(403).json({ 
            message: "Access denied: Invalid project or insufficient permissions",
            error: "unauthorized_project_access"
          });
        }
        
        // CRITICAL: Manual credit check with correct item count calculation
        const creditsRequired = calculateParallelCredits('panel_generation', panelCount);
        const hasCredits = await storage.hasEnoughCredits(userId, creditsRequired);
        
        if (!hasCredits) {
          const currentCredits = await storage.getCurrentMonthCredits(userId);
          const remainingCredits = currentCredits.monthlyLimit - currentCredits.creditsUsed;
          
          return res.status(402).json({
            message: "Insufficient AI credits for parallel panel generation",
            error: "insufficient_credits",
            creditsRequired,
            remainingCredits,
            monthlyLimit: currentCredits.monthlyLimit,
            operationType: 'parallel_panel_generation',
          });
        }
        
        // Deduct credits upfront
        const deductionResult = await storage.deductCredits(
          userId,
          'panel_generation',
          creditsRequired,
          projectId, // SECURITY FIX: Use authenticated projectId from route params
          createOperationMetadata(req, {
            panelCount,
            operationType: 'parallel_panels'
          })
        );
        
        if (!deductionResult.success) {
          return res.status(500).json({
            message: "Failed to deduct credits",
            error: "credit_deduction_failed"
          });
        }
        
        req.creditInfo = {
          operationType: 'panel_generation',
          creditsDeducted: creditsRequired,
          remainingCredits: deductionResult.remainingCredits,
        };
        
        next();
      } catch (error) {
        console.error("Parallel panel credit check failed:", error);
        res.status(500).json({
          message: "Credit system error",
          error: "credit_system_error"
        });
      }
    },
    async (req: any, res) => {
    try {
      const userId = resolveUserId(req.user);
      
      // CRITICAL: Add strict Zod validation for security
      const validationResult = parallelPanelGenerationSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid request data",
          error: "validation_failed",
          details: validationResult.error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message
          }))
        });
      }
      
      const request = validationResult.data;
      
      // SECURITY: Verify project ownership
      const project = await storage.getProject(request.projectId);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ 
          message: "Project not found or access denied",
          error: "project_not_found" 
        });
      }
      
      const sessionId = await parallelGenerationService.generatePanelsInParallel(userId, request);
      res.json({ sessionId, status: 'started', panelCount: request.panels.length });
    } catch (error) {
      console.error("Error starting parallel panel generation:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to start parallel panel generation";
      res.status(500).json({ message: errorMessage });
    }
  });

  // Generate multiple pages in parallel - SECURE: projectId from authenticated route params  
  app.post("/api/projects/:projectId/parallel/pages", 
    isAuthenticated,
    // SECURITY FIX: projectId now from authenticated route params, not user-controlled request body
    async (req: any, res: any, next: any) => {
      try {
        const userId = resolveUserId(req.user);
        const projectId = req.params.projectId;
        const pageCount = req.body?.pages?.length || 0;
        
        // SECURITY FIX: Verify user owns the project before any processing
        const project = await storage.getProject(projectId);
        if (!project || project.userId !== userId) {
          return res.status(403).json({ 
            message: "Access denied: Invalid project or insufficient permissions",
            error: "unauthorized_project_access"
          });
        }
        
        // CRITICAL: Manual credit check with correct item count calculation
        const creditsRequired = calculateParallelCredits('full_page_generation', pageCount);
        const hasCredits = await storage.hasEnoughCredits(userId, creditsRequired);
        
        if (!hasCredits) {
          const currentCredits = await storage.getCurrentMonthCredits(userId);
          const remainingCredits = currentCredits.monthlyLimit - currentCredits.creditsUsed;
          
          return res.status(402).json({
            message: "Insufficient AI credits for parallel page generation",
            error: "insufficient_credits",
            creditsRequired,
            remainingCredits,
            monthlyLimit: currentCredits.monthlyLimit,
            operationType: 'parallel_page_generation',
          });
        }
        
        // Deduct credits upfront
        const deductionResult = await storage.deductCredits(
          userId,
          'full_page_generation',
          creditsRequired,
          projectId, // SECURITY FIX: Use authenticated projectId from route params
          createOperationMetadata(req, {
            pageCount,
            operationType: 'parallel_pages'
          })
        );
        
        if (!deductionResult.success) {
          return res.status(500).json({
            message: "Failed to deduct credits",
            error: "credit_deduction_failed"
          });
        }
        
        req.creditInfo = {
          operationType: 'full_page_generation',
          creditsDeducted: creditsRequired,
          remainingCredits: deductionResult.remainingCredits,
        };
        
        next();
      } catch (error) {
        console.error("Parallel page credit check failed:", error);
        res.status(500).json({
          message: "Credit system error",
          error: "credit_system_error"
        });
      }
    },
    async (req: any, res) => {
    try {
      const userId = resolveUserId(req.user);
      
      // CRITICAL: Add strict Zod validation for security
      const validationResult = parallelPageGenerationSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid request data",
          error: "validation_failed",
          details: validationResult.error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message
          }))
        });
      }
      
      const request = validationResult.data;
      
      // SECURITY: Verify project ownership
      const project = await storage.getProject(request.projectId);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ 
          message: "Project not found or access denied",
          error: "project_not_found" 
        });
      }
      
      const sessionId = await parallelGenerationService.generatePagesInParallel(userId, request);
      res.json({ sessionId, status: 'started', pageCount: request.pages.length });
    } catch (error) {
      console.error("Error starting parallel page generation:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to start parallel page generation";
      res.status(500).json({ message: errorMessage });
    }
  });

  // Generate mixed content in batches - SECURE: projectId from authenticated route params
  app.post("/api/projects/:projectId/parallel/batch", 
    isAuthenticated,
    // SECURITY FIX: projectId now from authenticated route params, not user-controlled request body
    async (req: any, res: any, next: any) => {
      try {
        const userId = resolveUserId(req.user);
        const projectId = req.params.projectId;
        const batchCount = req.body?.batches?.length || 0;
        
        // SECURITY FIX: Verify user owns the project before any processing
        const project = await storage.getProject(projectId);
        if (!project || project.userId !== userId) {
          return res.status(403).json({ 
            message: "Access denied: Invalid project or insufficient permissions",
            error: "unauthorized_project_access"
          });
        }
        
        // CRITICAL: Manual credit check with correct item count calculation
        const creditsRequired = calculateParallelCredits('complete_story_generation', batchCount);
        const hasCredits = await storage.hasEnoughCredits(userId, creditsRequired);
        
        if (!hasCredits) {
          const currentCredits = await storage.getCurrentMonthCredits(userId);
          const remainingCredits = currentCredits.monthlyLimit - currentCredits.creditsUsed;
          
          return res.status(402).json({
            message: "Insufficient AI credits for parallel batch generation",
            error: "insufficient_credits",
            creditsRequired,
            remainingCredits,
            monthlyLimit: currentCredits.monthlyLimit,
            operationType: 'parallel_batch_generation',
          });
        }
        
        // Deduct credits upfront
        const deductionResult = await storage.deductCredits(
          userId,
          'complete_story_generation',
          creditsRequired,
          projectId, // SECURITY FIX: Use authenticated projectId from route params
          createOperationMetadata(req, {
            batchCount,
            operationType: 'parallel_batch'
          })
        );
        
        if (!deductionResult.success) {
          return res.status(500).json({
            message: "Failed to deduct credits",
            error: "credit_deduction_failed"
          });
        }
        
        req.creditInfo = {
          operationType: 'complete_story_generation',
          creditsDeducted: creditsRequired,
          remainingCredits: deductionResult.remainingCredits,
        };
        
        next();
      } catch (error) {
        console.error("Parallel batch credit check failed:", error);
        res.status(500).json({
          message: "Credit system error",
          error: "credit_system_error"
        });
      }
    },
    async (req: any, res) => {
    try {
      const userId = resolveUserId(req.user);
      
      // CRITICAL: Add strict Zod validation for security
      const validationResult = parallelBatchGenerationSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid request data",
          error: "validation_failed",
          details: validationResult.error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message
          }))
        });
      }
      
      const request = validationResult.data;
      
      // SECURITY: Verify project ownership
      const project = await storage.getProject(request.projectId);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ 
          message: "Project not found or access denied",
          error: "project_not_found" 
        });
      }
      
      const sessionId = await parallelGenerationService.generateBatchInParallel(userId, request);
      res.json({ sessionId, status: 'started', batchCount: request.batches.length });
    } catch (error) {
      console.error("Error starting parallel batch generation:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to start parallel batch generation";
      res.status(500).json({ message: errorMessage });
    }
  });

  // Get session status and progress - SECURED WITH OWNERSHIP CHECK
  app.get("/api/parallel/sessions/:sessionId", 
    isAuthenticated,
    async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const userId = resolveUserId(req.user);
      
      const status = parallelGenerationService.getSessionStatus(sessionId);
      
      if (!status) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      // SECURITY: Verify session ownership
      const sessionOwner = parallelGenerationService.getSessionOwner(sessionId);
      if (sessionOwner !== userId) {
        return res.status(403).json({ 
          message: "Access denied to session",
          error: "session_access_denied" 
        });
      }
      
      res.json(status);
    } catch (error) {
      console.error("Error getting session status:", error);
      res.status(500).json({ message: "Failed to get session status" });
    }
  });

  // Cancel a running session - SECURED WITH OWNERSHIP CHECK
  app.post("/api/parallel/sessions/:sessionId/cancel", 
    isAuthenticated,
    async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const userId = resolveUserId(req.user);
      
      // SECURITY: Verify session ownership before allowing cancellation
      const sessionOwner = parallelGenerationService.getSessionOwner(sessionId);
      if (!sessionOwner) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      if (sessionOwner !== userId) {
        return res.status(403).json({ 
          message: "Access denied to session",
          error: "session_access_denied" 
        });
      }
      
      const cancelled = await parallelGenerationService.cancelSession(sessionId);
      
      if (!cancelled) {
        return res.status(404).json({ message: "Session not found or already completed" });
      }
      
      res.json({ success: true, message: "Session cancelled successfully" });
    } catch (error) {
      console.error("Error cancelling session:", error);
      res.status(500).json({ message: "Failed to cancel session" });
    }
  });

  // Get all sessions for the current user
  app.get("/api/parallel/sessions", 
    isAuthenticated,
    async (req: any, res) => {
    try {
      const userId = resolveUserId(req.user);
      const sessions = parallelGenerationService.getUserSessions(userId);
      res.json(sessions);
    } catch (error) {
      console.error("Error getting user sessions:", error);
      res.status(500).json({ message: "Failed to get user sessions" });
    }
  });

  // Server-Sent Events endpoint for real-time progress updates - SECURED
  app.get("/api/parallel/sessions/:sessionId/events", 
    isAuthenticated,
    async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const userId = resolveUserId(req.user);
      
      // CRITICAL SECURITY: Verify session ownership before allowing SSE connection
      const sessionStatus = parallelGenerationService.getSessionStatus(sessionId);
      if (!sessionStatus) {
        return res.status(404).json({ 
          message: "Session not found",
          error: "session_not_found" 
        });
      }
      
      // Verify user owns this session (prevents unauthorized session monitoring)
      const sessionOwner = parallelGenerationService.getSessionOwner(sessionId);
      if (sessionOwner !== userId) {
        return res.status(403).json({ 
          message: "Access denied to session",
          error: "session_access_denied" 
        });
      }
      
      // Set up Server-Sent Events
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // Send initial connection message
      res.write(`data: ${JSON.stringify({ type: 'connected', sessionId })}\n\n`);

      // Set up event listeners for progress updates
      const onProgressUpdate = (updatedSessionId: string, progress: any) => {
        if (updatedSessionId === sessionId) {
          res.write(`data: ${JSON.stringify({ type: 'progress', data: progress })}\n\n`);
        }
      };

      const onTaskCompleted = (updatedSessionId: string, taskId: string, result: any) => {
        if (updatedSessionId === sessionId) {
          res.write(`data: ${JSON.stringify({ type: 'taskCompleted', taskId, result })}\n\n`);
        }
      };

      const onSessionCompleted = (updatedSessionId: string, result: any) => {
        if (updatedSessionId === sessionId) {
          res.write(`data: ${JSON.stringify({ type: 'sessionCompleted', data: result })}\n\n`);
          res.end();
        }
      };

      const onSessionFailed = (updatedSessionId: string, result: any, error: any) => {
        if (updatedSessionId === sessionId) {
          res.write(`data: ${JSON.stringify({ type: 'sessionFailed', data: result, error: error.message })}\n\n`);
          res.end();
        }
      };

      const onSessionCancelled = (updatedSessionId: string, result: any) => {
        if (updatedSessionId === sessionId) {
          res.write(`data: ${JSON.stringify({ type: 'sessionCancelled', data: result })}\n\n`);
          res.end();
        }
      };

      // Register event listeners
      parallelGenerationService.on('progressUpdate', onProgressUpdate);
      parallelGenerationService.on('taskCompleted', onTaskCompleted);
      parallelGenerationService.on('sessionCompleted', onSessionCompleted);
      parallelGenerationService.on('sessionFailed', onSessionFailed);
      parallelGenerationService.on('sessionCancelled', onSessionCancelled);

      // Clean up on client disconnect
      req.on('close', () => {
        parallelGenerationService.removeListener('progressUpdate', onProgressUpdate);
        parallelGenerationService.removeListener('taskCompleted', onTaskCompleted);
        parallelGenerationService.removeListener('sessionCompleted', onSessionCompleted);
        parallelGenerationService.removeListener('sessionFailed', onSessionFailed);
        parallelGenerationService.removeListener('sessionCancelled', onSessionCancelled);
        res.end();
      });

    } catch (error) {
      console.error("Error setting up SSE for session:", error);
      res.status(500).json({ message: "Failed to set up event stream" });
    }
  });

  // ========================================
  // END PARALLEL PROCESSING ENDPOINTS
  // ========================================

  // Generate complete character with AI
  app.post("/api/projects/:projectId/generate-character", 
    isAuthenticated,
    requireCredits({
      operationType: "character_generation",
      getResourceId: getProjectIdFromParams,
      getMetadata: (req) => createOperationMetadata(req, { 
        roleType: req.body.roleType 
      })
    }),
    async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      const userId = resolveUserId(req.user);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ message: "Project not found" });
      }

      const { roleType } = req.body; // Optional role hint like "hero", "villain", "sidekick"
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
      
      // Generate a complete character profile using structured output
      const prompt = `Generate a complete character for the ${project.genre || 'comic'} story "${project.title}".
      ${project.description ? `Story context: ${project.description}` : ''}
      ${roleType ? `Character should be a ${roleType}.` : ''}
      
      Create a well-rounded character that fits this world. Make them interesting and unique.
      
      Respond with a JSON object containing:
      {
        "name": "Character's full name",
        "role": "Their role/position (protagonist, antagonist, mentor, etc.)",
        "bio": "2-3 sentence character biography including personality, background, and motivations",
        "visualDescriptors": "Detailed physical description for an artist including appearance, clothing, and distinctive features"
      }`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              name: { type: "string" },
              role: { type: "string" },
              bio: { type: "string" },
              visualDescriptors: { type: "string" }
            },
            required: ["name", "role", "bio", "visualDescriptors"]
          }
        },
        contents: prompt,
      });

      const characterData = JSON.parse(response.text || "{}");
      
      // Validate the generated data
      if (!characterData.name || !characterData.role || !characterData.bio || !characterData.visualDescriptors) {
        throw new Error("Incomplete character data generated");
      }

      res.json(characterData);
    } catch (error) {
      console.error("Error generating character:", error);
      res.status(500).json({ message: "Failed to generate character" });
    }
  });

  // Structured Script API endpoints
  
  // Get project's structured script
  app.get("/api/projects/:projectId/structured-script", isAuthenticated, async (req: any, res) => {
    try {
      const { projectId } = req.params;
      const script = await storage.getProjectStructuredScript(projectId);
      res.json(script || null);
    } catch (error) {
      console.error("Error fetching structured script:", error);
      res.status(500).json({ message: "Failed to fetch structured script" });
    }
  });

  // Create or update structured script for a project
  app.post("/api/projects/:projectId/structured-script", isAuthenticated, async (req: any, res) => {
    try {
      const { projectId } = req.params;
      const { title, logline } = req.body;
      
      // Check if script already exists
      const existingScript = await storage.getProjectStructuredScript(projectId);
      
      if (existingScript) {
        // Update existing script
        const updatedScript = await storage.updateStructuredScript(existingScript.id, {
          title,
          logline,
        });
        res.json(updatedScript);
      } else {
        // Create new script
        const newScript = await storage.createStructuredScript({
          projectId,
          title,
          logline,
        });
        res.json(newScript);
      }
    } catch (error) {
      console.error("Error creating/updating structured script:", error);
      res.status(500).json({ message: "Failed to create/update structured script" });
    }
  });

  // Create script page
  app.post("/api/structured-scripts/:scriptId/pages", isAuthenticated, async (req: any, res) => {
    try {
      const { scriptId } = req.params;
      const pageData = req.body;
      
      const page = await storage.createScriptPage({
        structuredScriptId: scriptId,
        ...pageData,
      });
      res.json(page);
    } catch (error) {
      console.error("Error creating script page:", error);
      res.status(500).json({ message: "Failed to create script page" });
    }
  });

  // Get script pages
  app.get("/api/structured-scripts/:scriptId/pages", isAuthenticated, async (req: any, res) => {
    try {
      const { scriptId } = req.params;
      const pages = await storage.getScriptPages(scriptId);
      res.json(pages);
    } catch (error) {
      console.error("Error fetching script pages:", error);
      res.status(500).json({ message: "Failed to fetch script pages" });
    }
  });

  // EMERGENCY SCRIPT RECOVERY: Fix corrupted project.script fields
  app.post("/api/projects/:projectId/fix-script", isAuthenticated, async (req: any, res) => {
    try {
      const { projectId } = req.params;
      const userId = resolveUserId(req.user);
      
      console.log(`🚨 SCRIPT RECOVERY: Attempting to fix script for project ${projectId}`);
      
      // Verify user owns the project
      const project = await storage.getProject(projectId);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      console.log(`🚨 SCRIPT RECOVERY: Current script data:`, project.script ? "EXISTS" : "MISSING");
      
      // Check if there's a structured script we can recover from
      const structuredScript = await storage.getProjectStructuredScript(projectId);
      
      if (structuredScript && structuredScript.pages && structuredScript.pages.length > 0) {
        console.log(`🚨 SCRIPT RECOVERY: Found structured script with ${structuredScript.pages.length} pages - recovering...`);
        
        // Restore the script data to project.script field
        const scriptData = JSON.stringify({
          title: structuredScript.title,
          logline: structuredScript.logline,
          pages: structuredScript.pages || []
        });
        
        await storage.updateProject(projectId, { script: scriptData });
        console.log(`🚨 SCRIPT RECOVERY: Successfully restored script to project.script field!`);
        
        res.json({ 
          success: true, 
          message: "Script recovered successfully",
          pages: structuredScript.pages.length 
        });
      } else {
        console.log(`🚨 SCRIPT RECOVERY: No structured script found - user needs to regenerate`);
        res.json({ 
          success: false, 
          message: "No script data found to recover. You'll need to generate a new script.",
          needsRegeneration: true
        });
      }
    } catch (error) {
      console.error("🚨 SCRIPT RECOVERY: Error during script recovery:", error);
      res.status(500).json({ message: "Failed to recover script" });
    }
  });

  // Create script panel
  app.post("/api/script-pages/:pageId/panels", isAuthenticated, async (req: any, res) => {
    try {
      const { pageId } = req.params;
      const panelData = req.body;
      
      const panel = await storage.createScriptPanel({
        scriptPageId: pageId,
        ...panelData,
      });
      res.json(panel);
    } catch (error) {
      console.error("Error creating script panel:", error);
      res.status(500).json({ message: "Failed to create script panel" });
    }
  });

  // Create script dialogue
  app.post("/api/script-panels/:panelId/dialogue", isAuthenticated, async (req: any, res) => {
    try {
      const { panelId } = req.params;
      const dialogueData = req.body;
      
      const dialogue = await storage.createScriptDialogue({
        scriptPanelId: panelId,
        ...dialogueData,
      });
      res.json(dialogue);
    } catch (error) {
      console.error("Error creating script dialogue:", error);
      res.status(500).json({ message: "Failed to create script dialogue" });
    }
  });

  // Generate structured script with rich metadata
  app.post("/api/projects/:projectId/generate-structured-script", 
    isAuthenticated,
    requireCredits({
      operationType: "structured_script_generation",
      getResourceId: getProjectIdFromParams,
      getMetadata: (req) => createOperationMetadata(req, { 
        pageCount: req.body.pageCount,
        tone: req.body.tone 
      })
    }),
    async (req: any, res) => {
    try {
      const { projectId } = req.params;
      const { title, description, genre, characters, settings, pageCount, tone, logline } = req.body;
      
      // Enforce minimum 6 pages for all scripts (server-side validation)
      const MIN_PAGES = 6;
      const validatedPageCount = Math.max(MIN_PAGES, pageCount || MIN_PAGES);
      
      // Import GeminiService
      const { GeminiService } = await import("./gemini");
      const geminiService = new GeminiService();
      
      // Generate structured script with character validation
      const structuredScriptResponse = await geminiService.generateStructuredScript({
        title,
        description,
        genre,
        characters,
        settings,
        pageCount: validatedPageCount,
        tone,
        logline,
      }, projectId);
      
      // Check if structured script already exists for this project
      const existingScript = await storage.getProjectStructuredScript(projectId);
      
      let savedScript;
      if (existingScript) {
        // Clear existing pages/panels/dialogue for this script before adding new ones
        const existingPages = await storage.getScriptPages(existingScript.id);
        for (const page of existingPages) {
          await storage.deleteScriptPage(page.id);
        }
        
        // Update existing script
        savedScript = await storage.updateStructuredScript(existingScript.id, {
          title: structuredScriptResponse.title,
          logline: structuredScriptResponse.logline,
        }) || existingScript;
        
        console.log(`Updated existing structured script ${existingScript.id} with ${structuredScriptResponse.pages.length} pages`);
      } else {
        // Create new structured script
        savedScript = await storage.createStructuredScript({
          projectId,
          title: structuredScriptResponse.title,
          logline: structuredScriptResponse.logline,
        });
        
        console.log(`Created new structured script ${savedScript.id} with ${structuredScriptResponse.pages.length} pages`);
      }
      
      // Save pages with panels and dialogue
      for (const pageData of structuredScriptResponse.pages) {
        const savedPage = await storage.createScriptPage({
          structuredScriptId: savedScript.id,
          pageNumber: Math.floor(Number(pageData.pageNumber)),
          title: pageData.title,
          mood: pageData.overallMood,
          setting: pageData.setting,
        });
        
        // Save panels for this page
        for (const panelData of pageData.panels) {
          const savedPanel = await storage.createScriptPanel({
            scriptPageId: savedPage.id,
            panelNumber: Math.floor(Number(panelData.panelNumber)),
            action: panelData.visualDescription || `Panel ${Math.floor(Number(panelData.panelNumber))} action`,
            sceneDescription: panelData.visualDescription,
            cameraAngle: panelData.cameraAngle,
            shotType: panelData.shotType,
            mood: panelData.mood,
            visualNotes: panelData.visualNotes,
            timing: panelData.timing,
            soundEffects: panelData.soundEffects,
            characters: pageData.characters || [],
            
            // ENHANCED ENVIRONMENTAL DETAILS
            locationSpecifics: (panelData as any).environmentalDetails || (panelData as any).environment?.settingName || null,
            interiorExterior: (panelData as any).environment?.settingName?.toLowerCase().includes('indoor') ? 'interior' : 
                             (panelData as any).environment?.settingName?.toLowerCase().includes('outdoor') ? 'exterior' : null,
            roomType: (panelData as any).environment?.keyObjects?.[0] || null, // Extract from key objects
            architecturalStyle: (panelData as any).visualStyle || null,
            setDressing: (panelData as any).keyProps || (panelData as any).environment?.keyObjects || [],
            props: (panelData as any).keyProps || (panelData as any).environment?.keyObjects || [],
            backgroundElements: (panelData as any).keyProps || (panelData as any).environment?.backgroundCharacters || [],
            atmosphere: (panelData as any).environment?.atmosphere || panelData.mood,
            environmentalSoundscape: (panelData as any).environment?.soundscape || (panelData as any).audioLandscape?.ambientSounds || [],
            
            // ENHANCED LIGHTING CONDITIONS  
            primaryLightSource: (panelData as any).lighting?.lightingPrimary || null,
            timeOfDay: (panelData as any).environment?.timeOfDay || null,
            lightingMood: (panelData as any).lighting?.lightingMood || null,
            lightDirection: (panelData as any).lighting?.lightingSecondary || null,
            shadowIntensity: (panelData as any).lighting?.shadows || null,
            colorTemperature: (panelData as any).lighting?.colorTemperature || null,
            lightingEffects: (panelData as any).visualEffects || [],
            practicalLights: (panelData as any).lighting?.practicalLights || [],
            
            // ENHANCED WEATHER CONDITIONS
            weatherCondition: (panelData as any).weatherConditions || (panelData as any).environment?.weather || null,
            precipitation: (panelData as any).environment?.weather?.includes('rain') ? 'rain' : 
                          (panelData as any).environment?.weather?.includes('snow') ? 'snow' : 'none',
            windCondition: (panelData as any).environment?.weather?.includes('wind') ? 'moderate_wind' : 'still',
            temperature: (panelData as any).environment?.weather?.includes('cold') ? 'cold' : 
                        (panelData as any).environment?.weather?.includes('hot') ? 'hot' : 'mild',
            humidity: 'normal',
            visibility: 'crystal_clear',
            atmosphericEffects: (panelData as any).specialEffects || [],
            seasonalContext: 'spring',
            
            // ENHANCED CAMERA SPECIFICATIONS
            cameraMovement: (panelData as any).cinematography?.movement || (panelData as any).cinematography?.cameraMovement || null,
            frameComposition: (panelData as any).cinematography?.composition || null,
            depthOfField: (panelData as any).cinematography?.depth || (panelData as any).cinematography?.depthOfField || null,
            focusPoint: (panelData as any).cinematography?.focusPoint || (panelData as any).cinematography?.cameraFocusPoint || null,
            perspectiveType: (panelData as any).cinematography?.cameraAngle || null,
            visualStyle: (panelData as any).visualStyle || (panelData as any).artisticNotes || null,
            colorGrading: panelData.mood === 'dark' ? 'cool_tones' : 'warm_tones',
            
            // ENHANCED CHARACTER POSITIONING
            characterPositions: (panelData as any).characterStates ? JSON.stringify((panelData as any).characterStates) : null,
            proxemics: (panelData as any).characterProximity || null,
            spatialRelationships: (panelData as any).characterPositioning ? [(panelData as any).characterPositioning] : [],
            physicalInteractions: (panelData as any).characterInteractions ? [(panelData as any).characterInteractions] : [],
            characterFocus: (panelData as any).characterStates?.length > 1 ? 'group' : 'single_character',
            eyelineDirections: (panelData as any).characterStates?.map((cs: any) => `${cs.characterName}_${cs.facingDirection}`) || [],
            gestureDescriptions: (panelData as any).characterStates?.map((cs: any) => cs.pose || cs.bodyLanguage).filter(Boolean) || [],
            
            // ENHANCED TECHNICAL DIRECTION
            pacing: (panelData as any).pacing || null,
            transitionType: (panelData as any).transitionType || null,
            panelBorders: (panelData as any).panelBorders || 'standard',
            visualEffects: (panelData as any).visualEffects || [],
            specialEffects: (panelData as any).specialEffects || [],
            stylizedElements: (panelData as any).stylizedElements || [],
            
            // ENHANCED AUDIO ELEMENTS
            detailedSoundEffects: (panelData as any).detailedSoundEffects ? JSON.stringify((panelData as any).detailedSoundEffects) : null,
            ambientSounds: (panelData as any).audioLandscape?.ambientSounds || (panelData as any).environment?.soundscape || [],
            musicCues: (panelData as any).audioLandscape?.musicCues || null,
            voiceOverText: (panelData as any).audioLandscape?.voiceOverText || null,
            voiceOverCharacter: (panelData as any).audioLandscape?.voiceOverCharacter || null,
            dialoguePlacement: (panelData as any).audioLandscape?.dialoguePlacement || 'distributed',
            silenceEmphasis: (panelData as any).audioLandscape?.silenceEmphasis || false,
            soundPerspective: (panelData as any).audioLandscape?.soundPerspective || null,
            
            // ENHANCED AI GENERATION METADATA
            generationPrompt: (panelData as any).generationNotes?.generationPrompt || null,
            negativePrompt: (panelData as any).generationNotes?.negativePrompt || null,
            promptWeight: (panelData as any).generationNotes?.promptWeight ? JSON.stringify((panelData as any).generationNotes.promptWeight) : null,
            consistencyNotes: (panelData as any).consistencyNotes?.join('; ') || null,
            referenceImages: (panelData as any).generationNotes?.referenceImages || [],
          });
          
          // Save dialogue for this panel
          for (let i = 0; i < panelData.dialogue.length; i++) {
            const dialogueData = panelData.dialogue[i];
            // CRITICAL FIX: Ensure character is never null - provide fallback for null/undefined
            const characterName = dialogueData.characterName || 'UNKNOWN_CHARACTER';
            await storage.createScriptDialogue({
              scriptPanelId: savedPanel.id,
              character: characterName,
              text: dialogueData.text,
              tone: dialogueData.tone,
              orderIndex: i,
            });
          }
        }
      }
      
      // Return the full structured script with all relations
      const fullScript = await storage.getProjectStructuredScript(projectId);
      res.json(fullScript);
    } catch (error) {
      console.error("Error generating structured script:", error);
      res.status(500).json({ message: "Failed to generate structured script" });
    }
  });

  // ========================================
  // MULTI-STAGE SCRIPT GENERATION ENDPOINTS
  // ========================================

  // Generate story outline (Stage 1)
  app.post("/api/generation/story-outline", 
    isAuthenticated,
    requireCredits({
      operationType: "script_generation",
      getResourceId: (req) => req.body.title || 'story-outline',
      getMetadata: (req) => createOperationMetadata(req, { 
        pageCount: req.body.pageCount,
        charactersCount: req.body.characters?.length 
      })
    }),
    async (req: any, res) => {
    try {
      const { title, description, genre, characters, settings, pageCount, tone, logline, targetAudience, themes, artStyle } = req.body;
      
      // Validate required fields
      if (!title || !description || !characters || !Array.isArray(characters) || characters.length === 0) {
        return res.status(400).json({ 
          message: "Missing required fields: title, description, and characters array are required" 
        });
      }

      const { geminiService } = await import("./gemini");
      
      // Generate story outline
      const storyOutline = await geminiService.generateStoryOutline({
        title,
        description,
        genre,
        characters,
        settings: settings || [],
        pageCount,
        tone,
        logline,
        targetAudience,
        themes,
        artStyle
      });
      
      res.json({
        success: true,
        storyOutline,
        message: `Story outline generated successfully with ${storyOutline.estimatedPageCount} pages`
      });
    } catch (error) {
      console.error("Error generating story outline:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate story outline";
      res.status(500).json({ message: errorMessage });
    }
  });

  // Generate character bible (Stage 2)
  app.post("/api/generation/character-bible", 
    isAuthenticated,
    requireCredits({
      operationType: "character_generation",
      getResourceId: (req) => req.body.storyOutline?.title || 'character-bible',
      getMetadata: (req) => createOperationMetadata(req, { 
        charactersCount: req.body.storyOutline?.characters?.length,
        pageCount: req.body.storyOutline?.estimatedPageCount
      })
    }),
    async (req: any, res) => {
    try {
      const { title, description, genre, characters, settings, pageCount, tone, logline, targetAudience, themes, artStyle, storyOutline } = req.body;
      
      // Validate required fields
      if (!storyOutline) {
        return res.status(400).json({ 
          message: "Story outline is required. Generate story outline first." 
        });
      }

      const { geminiService } = await import("./gemini");
      
      // Generate character bible
      const characterBible = await geminiService.generateCharacterBible({
        title,
        description,
        genre,
        characters,
        settings: settings || [],
        pageCount,
        tone,
        logline,
        targetAudience,
        themes,
        artStyle
      }, storyOutline);
      
      res.json({
        success: true,
        characterBible,
        message: `Character bible generated successfully for ${characterBible.characters.length} characters`
      });
    } catch (error) {
      console.error("Error generating character bible:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate character bible";
      res.status(500).json({ message: errorMessage });
    }
  });

  // Generate chunked script (Stage 3)
  app.post("/api/generation/chunked-script", 
    isAuthenticated,
    requireCredits({
      operationType: "script_generation",
      getResourceId: (req) => req.body.storyOutline?.title || 'chunked-script',
      getMetadata: (req) => createOperationMetadata(req, { 
        chunkNumber: req.body.chunkInfo?.currentChunk,
        totalChunks: req.body.chunkInfo?.totalChunks,
        pagesInChunk: req.body.chunkInfo?.pagesInChunk?.length
      })
    }),
    async (req: any, res) => {
    try {
      const { storyOutline, characterBible, chunkInfo, previousChunkSummary, generationMode } = req.body;
      
      // Validate required fields
      if (!storyOutline || !characterBible || !chunkInfo) {
        return res.status(400).json({ 
          message: "Story outline, character bible, and chunk info are required" 
        });
      }

      const { geminiService } = await import("./gemini");
      
      // Generate chunked script with character validation
      // Note: projectId not available in this endpoint, but character validation will run on the Gemini service level
      const scriptChunk = await geminiService.generateChunkedScript({
        storyOutline,
        characterBible,
        chunkInfo,
        previousChunkSummary,
        generationMode: generationMode || "sequential"
      });
      
      res.json({
        success: true,
        scriptChunk,
        message: `Script chunk ${chunkInfo.currentChunk}/${chunkInfo.totalChunks} generated successfully with ${scriptChunk.pages.length} pages`
      });
    } catch (error) {
      console.error("Error generating chunked script:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate chunked script";
      res.status(500).json({ message: errorMessage });
    }
  });

  // Full multi-stage generation orchestrator
  app.post("/api/generation/multi-stage", 
    isAuthenticated,
    requireCredits({
      operationType: "complete_story_generation",
      getResourceId: (req) => req.body.title || 'multi-stage-generation',
      getMetadata: (req) => createOperationMetadata(req, { 
        pageCount: req.body.pageCount,
        charactersCount: req.body.characters?.length,
        projectId: req.body.projectId
      })
    }),
    async (req: any, res) => {
    try {
      const { title, description, genre, characters, settings, pageCount, tone, logline, targetAudience, themes, artStyle, projectId } = req.body;
      
      // Validate required fields
      if (!title || !description || !characters || !Array.isArray(characters) || characters.length === 0) {
        return res.status(400).json({ 
          message: "Missing required fields: title, description, and characters array are required" 
        });
      }

      const { geminiService } = await import("./gemini");
      
      // Run full multi-stage generation with character validation
      const result = await geminiService.generateMultiStageScript({
        title,
        description,
        genre,
        characters,
        settings: settings || [],
        pageCount,
        tone,
        logline,
        targetAudience,
        themes,
        artStyle
      }, projectId);
      
      // If projectId is provided, save to database
      if (projectId) {
        try {
          // Check if structured script already exists for this project
          const existingScript = await storage.getProjectStructuredScript(projectId);
          
          let savedScript;
          if (existingScript) {
            // Clear existing pages/panels/dialogue for this script before adding new ones
            const existingPages = await storage.getScriptPages(existingScript.id);
            for (const page of existingPages) {
              await storage.deleteScriptPage(page.id);
            }
            
            // Update existing script
            savedScript = await storage.updateStructuredScript(existingScript.id, {
              title: result.storyOutline.title,
              logline: result.storyOutline.logline,
            }) || existingScript;
          } else {
            // Create new structured script
            savedScript = await storage.createStructuredScript({
              projectId,
              title: result.storyOutline.title,
              logline: result.storyOutline.logline,
            });
          }
          
          // Save all script chunks as pages
          for (const chunk of result.scriptChunks) {
            for (const pageData of chunk.pages) {
              const savedPage = await storage.createScriptPage({
                structuredScriptId: savedScript.id,
                pageNumber: pageData.pageNumber,
                title: pageData.title,
                mood: pageData.overallMood,
                setting: pageData.setting,
              });
              
              // Save panels for this page
              for (const panelData of pageData.panels) {
                const savedPanel = await storage.createScriptPanel({
                  scriptPageId: savedPage.id,
                  panelNumber: panelData.panelNumber,
                  action: panelData.visualDescription,
                  sceneDescription: panelData.visualDescription,
                  cameraAngle: panelData.cameraAngle,
                  shotType: panelData.shotType,
                  mood: panelData.mood,
                  visualNotes: panelData.visualNotes || "",
                  timing: panelData.timing || "moment",
                  soundEffects: panelData.soundEffects || [],
                  characters: pageData.characters || [],
                });
                
                // Save dialogue for this panel
                for (let i = 0; i < panelData.dialogue.length; i++) {
                  const dialogueData = panelData.dialogue[i];
                  // CRITICAL FIX: Ensure character is never null - check both field name variants  
                  const characterName = (dialogueData as any).characterName || (dialogueData as any).character || 'UNKNOWN_CHARACTER';
                  await storage.createScriptDialogue({
                    scriptPanelId: savedPanel.id,
                    character: characterName,
                    text: dialogueData.text,
                    tone: dialogueData.tone,
                    orderIndex: i,
                  });
                }
              }
            }
          }
          
          console.log(`Saved multi-stage generated script to database for project ${projectId}`);
        } catch (dbError) {
          console.error("Error saving multi-stage script to database:", dbError);
          // Don't fail the request - return the generated data even if DB save fails
        }
      }
      
      res.json({
        success: true,
        storyOutline: result.storyOutline,
        characterBible: result.characterBible,
        scriptChunks: result.scriptChunks,
        totalPages: result.storyOutline.estimatedPageCount,
        totalChunks: result.scriptChunks.length,
        message: `Multi-stage script generated successfully: ${result.storyOutline.estimatedPageCount} pages across ${result.scriptChunks.length} chunks`
      });
    } catch (error) {
      console.error("Error in multi-stage script generation:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate multi-stage script";
      res.status(500).json({ message: errorMessage });
    }
  });

  // Save structured script data directly (for preserving previewed scripts)
  app.post("/api/projects/:projectId/save-structured-script", isAuthenticated, async (req: any, res) => {
    try {
      const { projectId } = req.params;
      const { title, logline, pages } = req.body;
      
      console.log(`🚨 SAVE-SCRIPT: save-structured-script called for project ${projectId}`);
      console.log(`🚨 SAVE-SCRIPT: Request body:`, { title, logline, pagesCount: pages?.length });
      console.log(`🚨 SAVE-SCRIPT: Full pages data:`, JSON.stringify(pages, null, 2));
      
      // Verify user owns the project
      const project = await storage.getProject(projectId);
      const userId = resolveUserId(req.user);
      console.log(`🐛 Project found:`, project ? "YES" : "NO");
      console.log(`🐛 User ID:`, userId);
      
      if (!project || project.userId !== userId) {
        console.log(`🐛 FAILED: Project not found or wrong user`);
        return res.status(404).json({ message: "Project not found" });
      }

      // Delete existing structured script if one exists
      const existingScript = await storage.getProjectStructuredScript(projectId);
      console.log(`🐛 Existing script:`, existingScript ? "YES" : "NO");
      if (existingScript) {
        console.log(`🐛 Deleting existing script:`, existingScript.id);
        await storage.deleteStructuredScript(existingScript.id);
      }

      // Create new structured script
      console.log(`🐛 Creating new script...`);
      const newScript = await storage.createStructuredScript({
        projectId,
        title: title || project.title,
        logline: logline || "",
        version: 1,
        isActive: true,
      });
      console.log(`🐛 New script created:`, newScript.id);

      // Save all pages, panels, and dialogue
      console.log(`🐛 Processing ${pages?.length || 0} pages...`);
      for (const pageData of pages || []) {
        console.log(`🐛 Creating page ${pageData.pageNumber}:`, pageData.title);
        const savedPage = await storage.createScriptPage({
          structuredScriptId: newScript.id,
          pageNumber: pageData.pageNumber,
          title: pageData.title || "",
          setting: pageData.setting || "",
          mood: pageData.mood || "",
          timeOfDay: pageData.timeOfDay || "",
          location: pageData.location || "",
          weatherConditions: pageData.weatherConditions || "",
        });
        console.log(`🐛 Page saved:`, savedPage.id);

        // Save panels for this page
        console.log(`🐛 Processing ${pageData.panels?.length || 0} panels for page ${pageData.pageNumber}...`);
        for (const panelData of pageData.panels || []) {
          const savedPanel = await storage.createScriptPanel({
            scriptPageId: savedPage.id,
            panelNumber: Math.floor(Number(panelData.panelNumber)),
            sceneDescription: panelData.visualDescription || panelData.sceneDescription || "",
            action: panelData.action || "",
            cameraAngle: panelData.cameraAngle,
            shotType: panelData.shotType,
            mood: panelData.mood,
            visualNotes: panelData.visualNotes,
            timing: panelData.timing,
            soundEffects: panelData.soundEffects || [],
          });

          // Save dialogue for this panel
          if (panelData.dialogue && Array.isArray(panelData.dialogue)) {
            for (let i = 0; i < panelData.dialogue.length; i++) {
              const dialogueData = panelData.dialogue[i];
              // CRITICAL FIX: Ensure character is never null - check both field name variants
              const characterName = dialogueData.characterName || dialogueData.character || 'UNKNOWN_CHARACTER';
              await storage.createScriptDialogue({
                scriptPanelId: savedPanel.id,
                character: characterName,
                text: dialogueData.text,
                tone: dialogueData.tone,
                orderIndex: i,
              });
            }
          }
        }
      }

      // Return the full structured script with all relations
      console.log(`🐛 Getting final script result...`);
      const fullScript = await storage.getProjectStructuredScript(projectId);
      console.log(`🐛 Final script:`, fullScript ? `SUCCESS (${fullScript.pages?.length} pages)` : "FAILED - NULL");
      
      // CRITICAL FIX: Also save the structured script to project.script field for Script View
      if (fullScript) {
        console.log(`🐛 CRITICAL FIX: Saving script to project.script field for Script View...`);
        const scriptData = JSON.stringify({
          title: fullScript.title,
          logline: fullScript.logline,
          pages: fullScript.pages || []
        });
        
        await storage.updateProject(projectId, { script: scriptData });
        console.log(`🐛 CRITICAL FIX: Script saved to project.script field - Script View should now work!`);
      }
      
      res.json(fullScript);
    } catch (error) {
      console.error("🐛 ERROR saving structured script:", error);
      res.status(500).json({ message: "Failed to save structured script" });
    }
  });

  // Generate complete AI story (title, description, characters, script)
  app.post("/api/generate-complete-story", 
    (req, res, next) => {
      console.log("🔥 GENERATE-COMPLETE-STORY: Request received in timeout middleware");
      // Set longer timeout for epic story generation (5 minutes)
      req.setTimeout(300000); // 5 minutes
      res.setTimeout(300000); // 5 minutes
      next();
    },
    (req, res, next) => {
      console.log("🔥 GENERATE-COMPLETE-STORY: About to check authentication");
      next();
    },
    isAuthenticated,
    requireCredits({
      operationType: "complete_story_generation",
      getMetadata: (req) => createOperationMetadata(req, { 
        genres: req.body.genres,
        length: req.body.length 
      })
    }),
    async (req, res) => {
    try {
      const { genres, length, artStyle, tones } = req.body;
      
      // Import GeminiService
      const { GeminiService } = await import("./gemini");
      const geminiService = new GeminiService();
      
      console.log(`🎨 Generating complete story: genres=${genres.join("+")}, length=${length}, style=${artStyle}, tones=${tones.join("+")}`);
      
      // Generate complete story using AI
      const completeStory = await geminiService.generateCompleteStory({
        genres,
        length,
        artStyle,
        tones
      });
      
      // Check for quota exceeded errors and return HTTP 429
      if (completeStory && typeof completeStory === 'object' && completeStory.error && completeStory.error.toLowerCase().includes('quota')) {
        return res.status(429).json({
          error: completeStory.error,
          errorCategory: "quota_exceeded",
          message: "API quota exceeded while generating complete story"
        });
      }
      
      // Include the original user-selected genres for UI display
      const responseData = {
        ...completeStory,
        userSelectedGenres: genres, // Keep original simple genres for UI
        // genre field contains AI-enhanced description for generation
      };
      
      console.log(`✅ Complete story generated: "${completeStory.title}" with ${completeStory.structuredScript?.pages?.length || 0} pages`);
      
      res.json(responseData);
    } catch (error) {
      console.error("🔥 Error generating complete story:", error);
      res.status(500).json({ message: "Failed to generate complete story" });
    }
  });

  // Generate cover art for project
  app.post("/api/projects/:projectId/generate-cover-art", 
    isAuthenticated,
    requireCredits({
      operationType: "cover_art_generation",
      getResourceId: getProjectIdFromParams,
      getMetadata: (req) => createOperationMetadata(req)
    }),
    async (req: any, res) => {
    try {
      const userId = resolveUserId(req.user);
      const projectId = req.params.projectId;
      
      // Verify user owns the project
      const project = await storage.getProject(projectId);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      // Get project characters for context
      const characters = await storage.getProjectCharacters(projectId);
      
      // Prepare project context for cover generation
      const projectContext = {
        title: project.title,
        genre: project.genre || undefined,
        description: project.description || undefined,
        artStyle: project.artStyle || undefined,
        characters: characters.map(char => ({
          name: char.name,
          role: char.role || "",
          bio: char.bio || "",
          visualDescriptors: char.visualDescriptors || undefined,
        })),
        settings: Array.isArray(project.settings) ? project.settings : [],
      };
      
      console.log(`🎨 Generating cover art for project: "${project.title}" (${projectId})`);
      
      // Generate cover art using Gemini
      const result = await geminiService.generateCoverArt({
        projectId,
        projectContext,
      });
      
      // Check for quota exceeded errors and return HTTP 429
      if (result.error && result.error.toLowerCase().includes('quota')) {
        return res.status(429).json({
          success: false,
          status: "failed",
          error: result.error,
          errorCategory: "quota_exceeded"
        });
      }
      
      if (result.status === "completed") {
        // Save cover art URL to project
        const updatedProject = await storage.updateProject(projectId, {
          coverArt: result.imageUrl,
        });
        
        console.log(`✅ Cover art generated and saved for project: "${project.title}"`);
        
        res.json({
          success: true,
          coverArt: result.imageUrl,
          project: updatedProject,
        });
      } else {
        console.error(`❌ Cover art generation failed for project: "${project.title}":`, result.error);
        res.status(500).json({ 
          success: false,
          message: result.error || "Failed to generate cover art" 
        });
      }
    } catch (error) {
      console.error("🔥 Error generating cover art:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to generate cover art" 
      });
    }
  });

  // ========================================
  // Social Features API Routes
  // ========================================

  // Explore routes - Get public projects with stats
  app.get("/api/explore/projects", async (req: any, res) => {
    try {
      const { genre } = req.query;
      const publicProjects = await storage.getPublicProjects(genre);
      res.json(publicProjects);
    } catch (error) {
      console.error("Error fetching public projects:", error);
      res.status(500).json({ message: "Failed to fetch public projects" });
    }
  });

  // Profile routes
  app.get("/api/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = resolveUserId(req.user);
      const profile = await storage.getUserProfile(userId);
      res.json(profile);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ message: "Failed to fetch user profile" });
    }
  });

  app.put("/api/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = resolveUserId(req.user);
      const profileData = insertUserProfileSchema.parse({
        ...req.body,
        userId,
      });
      const profile = await storage.updateUserProfile(userId, profileData);
      res.json(profile);
    } catch (error) {
      console.error("Error updating user profile:", error);
      res.status(400).json({ message: "Failed to update user profile" });
    }
  });

  app.get("/api/profile/projects", isAuthenticated, async (req: any, res) => {
    try {
      const userId = resolveUserId(req.user);
      const projects = await storage.getUserProjectsWithStats(userId);
      res.json(projects);
    } catch (error) {
      console.error("Error fetching user projects with stats:", error);
      res.status(500).json({ message: "Failed to fetch user projects" });
    }
  });

  // Project public status
  app.put("/api/projects/:id/public", isAuthenticated, async (req: any, res) => {
    try {
      const userId = resolveUserId(req.user);
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ message: "Project not found" });
      }

      const { isPublic } = req.body;
      const updatedProject = await storage.updateProject(req.params.id, { isPublic });
      res.json(updatedProject);
    } catch (error) {
      console.error("Error updating project public status:", error);
      res.status(400).json({ message: "Failed to update project public status" });
    }
  });

  // Like/Unlike project
  app.post("/api/projects/:id/like", isAuthenticated, async (req: any, res) => {
    try {
      const userId = resolveUserId(req.user);
      const projectId = req.params.id;
      
      // Check if project exists and is public
      const project = await storage.getProject(projectId);
      if (!project || !project.isPublic) {
        return res.status(404).json({ message: "Project not found or not public" });
      }

      const like = await storage.likeProject(projectId, userId);
      res.json(like);
    } catch (error) {
      console.error("Error liking project:", error);
      res.status(400).json({ message: "Failed to like project" });
    }
  });

  app.post("/api/projects/:id/unlike", isAuthenticated, async (req: any, res) => {
    try {
      const userId = resolveUserId(req.user);
      const projectId = req.params.id;
      
      await storage.unlikeProject(projectId, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error unliking project:", error);
      res.status(400).json({ message: "Failed to unlike project" });
    }
  });

  // Comments
  app.get("/api/projects/:id/comments", async (req: any, res) => {
    try {
      const projectId = req.params.id;
      
      // Check if project exists and is public
      const project = await storage.getProject(projectId);
      if (!project || !project.isPublic) {
        return res.status(404).json({ message: "Project not found or not public" });
      }

      const comments = await storage.getProjectComments(projectId);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching project comments:", error);
      res.status(500).json({ message: "Failed to fetch project comments" });
    }
  });

  app.post("/api/projects/:id/comments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = resolveUserId(req.user);
      const projectId = req.params.id;
      
      // Check if project exists and is public
      const project = await storage.getProject(projectId);
      if (!project || !project.isPublic) {
        return res.status(404).json({ message: "Project not found or not public" });
      }

      const { comment } = req.body;
      if (!comment || !comment.trim()) {
        return res.status(400).json({ message: "Comment cannot be empty" });
      }

      const newComment = await storage.createProjectComment({
        projectId,
        userId,
        comment: comment.trim(),
      });
      res.json(newComment);
    } catch (error) {
      console.error("Error creating project comment:", error);
      res.status(400).json({ message: "Failed to create comment" });
    }
  });

  // ========================================
  // Character Library API Routes
  // ========================================

  // Get user's library characters
  app.get("/api/characters/library", isAuthenticated, async (req: any, res) => {
    try {
      const userId = resolveUserId(req.user);
      const characters = await storage.getUserLibraryCharacters(userId);
      res.json(characters);
    } catch (error) {
      console.error("Error fetching library characters:", error);
      res.status(500).json({ message: "Failed to fetch library characters" });
    }
  });

  // Create library character
  app.post("/api/characters/library", isAuthenticated, async (req: any, res) => {
    try {
      const userId = resolveUserId(req.user);
      
      // Validate character data (without projectId)
      const characterData = {
        name: req.body.name,
        role: req.body.role,
        bio: req.body.bio,
        visualDescriptors: req.body.visualDescriptors,
        alwaysTraits: req.body.alwaysTraits,
        neverTraits: req.body.neverTraits,
        referenceImageUrl: req.body.referenceImageUrl,
        colorScheme: req.body.colorScheme,
      };
      
      // Handle referenceImageUrl with ObjectStorage ACL policy
      if (characterData.referenceImageUrl) {
        const objectStorageService = new ObjectStorageService();
        
        // Apply ACL policy and get normalized path
        const normalizedPath = await objectStorageService.trySetObjectEntityAclPolicy(
          characterData.referenceImageUrl,
          {
            owner: userId,
            visibility: "public", // Character reference images are public for consistency
          },
          {
            variantType: "canonical",
            lifecycleTag: null,
          }
        );
        
        // Update with normalized path
        characterData.referenceImageUrl = normalizedPath;
      }

      const character = await storage.createLibraryCharacter(userId, characterData);
      res.json(character);
    } catch (error) {
      console.error("Error creating library character:", error);
      res.status(400).json({ message: "Failed to create library character" });
    }
  });

  // Update library character
  app.put("/api/characters/library/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = resolveUserId(req.user);
      const characterId = req.params.id;
      
      const updates = {
        name: req.body.name,
        role: req.body.role,
        bio: req.body.bio,
        visualDescriptors: req.body.visualDescriptors,
        alwaysTraits: req.body.alwaysTraits,
        neverTraits: req.body.neverTraits,
        referenceImageUrl: req.body.referenceImageUrl,
        colorScheme: req.body.colorScheme,
      };
      
      // Handle referenceImageUrl with ObjectStorage ACL policy
      if (updates.referenceImageUrl) {
        const objectStorageService = new ObjectStorageService();
        
        // Apply ACL policy and get normalized path
        const normalizedPath = await objectStorageService.trySetObjectEntityAclPolicy(
          updates.referenceImageUrl,
          {
            owner: userId,
            visibility: "public", // Character reference images are public for consistency
          },
          {
            variantType: "canonical",
            lifecycleTag: null,
          }
        );
        
        // Update with normalized path
        updates.referenceImageUrl = normalizedPath;
      }

      const character = await storage.updateLibraryCharacter(characterId, userId, updates);
      if (!character) {
        return res.status(404).json({ message: "Character not found or not owned by user" });
      }
      
      res.json(character);
    } catch (error) {
      console.error("Error updating library character:", error);
      res.status(400).json({ message: "Failed to update library character" });
    }
  });

  // Delete library character
  app.delete("/api/characters/library/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = resolveUserId(req.user);
      const characterId = req.params.id;
      
      const success = await storage.deleteLibraryCharacter(characterId, userId);
      if (!success) {
        return res.status(404).json({ message: "Character not found or not owned by user" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting library character:", error);
      res.status(500).json({ message: "Failed to delete library character" });
    }
  });

  // Copy library character to project
  app.post("/api/characters/library/:id/copy", isAuthenticated, async (req: any, res) => {
    try {
      const userId = resolveUserId(req.user);
      const characterId = req.params.id;
      const { projectId } = req.body;
      
      if (!projectId) {
        return res.status(400).json({ message: "Project ID is required" });
      }

      // Verify user owns the project
      const project = await storage.getProject(projectId);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ message: "Project not found or not owned by user" });
      }

      const projectCharacter = await storage.copyCharacterToProject(characterId, projectId, userId);
      res.json(projectCharacter);
    } catch (error) {
      console.error("Error copying character to project:", error);
      res.status(400).json({ message: "Failed to copy character to project" });
    }
  });

  // ========================================
  // Public Sharing API Routes (No Authentication Required)
  // ========================================

  // Get public project data for sharing
  app.get("/api/public/projects/:id", async (req, res) => {
    try {
      const projectId = req.params.id;
      
      // Get project and check if it's public
      const project = await storage.getProject(projectId);
      if (!project || !project.isPublic) {
        return res.status(404).json({ message: "Project not found or not public" });
      }

      // Get user data for the project creator
      const user = await storage.getUser(project.userId);
      if (!user) {
        return res.status(404).json({ message: "Project creator not found" });
      }

      // Return project data with user info
      res.json({
        ...project,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          profileImageUrl: user.profileImageUrl
        }
      });
    } catch (error) {
      console.error("Error fetching public project:", error);
      res.status(500).json({ message: "Failed to fetch public project" });
    }
  });

  // Get public project pages for sharing
  app.get("/api/public/projects/:id/pages", async (req, res) => {
    try {
      const projectId = req.params.id;
      
      // Check if project exists and is public
      const project = await storage.getProject(projectId);
      if (!project || !project.isPublic) {
        return res.status(404).json({ message: "Project not found or not public" });
      }

      const pages = await storage.getProjectPages(projectId);
      res.json(pages);
    } catch (error) {
      console.error("Error fetching public project pages:", error);
      res.status(500).json({ message: "Failed to fetch public project pages" });
    }
  });

  // Get public project panels for sharing
  app.get("/api/public/projects/:id/panels", async (req, res) => {
    try {
      const projectId = req.params.id;
      
      // Check if project exists and is public
      const project = await storage.getProject(projectId);
      if (!project || !project.isPublic) {
        return res.status(404).json({ message: "Project not found or not public" });
      }

      // Get all pages for the project, then get panels for each page
      const pages = await storage.getProjectPages(projectId);
      const allPanels = [];
      
      for (const page of pages) {
        const pagePanels = await storage.getPagePanels(page.id);
        allPanels.push(...pagePanels);
      }
      
      res.json(allPanels);
    } catch (error) {
      console.error("Error fetching public project panels:", error);
      res.status(500).json({ message: "Failed to fetch public project panels" });
    }
  });

  // Admin token middleware for secure one-time operations
  const adminTokenAuth = (req: any, res: any, next: any) => {
    const token = req.headers['x-admin-token'];
    const adminToken = process.env.ADMIN_TOKEN;
    
    if (!adminToken) {
      return res.status(503).json({ success: false, message: "Admin operations disabled" });
    }
    
    if (!token || token !== adminToken) {
      return res.status(401).json({ success: false, message: "Unauthorized admin operation" });
    }
    
    next();
  };

  // Admin route to grant bonus credits to multiple users
  app.post('/admin/credits/grant-bonus', adminTokenAuth, async (req: any, res) => {
    try {
      const { emails, amount } = req.body;
      
      if (!emails || !Array.isArray(emails) || !amount || amount <= 0) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid emails array or amount" 
        });
      }

      const results = [];
      for (const email of emails) {
        const result = await storage.grantBonusCredits(email, amount);
        results.push({ email, ...result });
        
        // Server-side audit log
        console.log(`🔥 ADMIN AUDIT: Credit grant - Email: ${email}, Amount: ${amount}, Success: ${result.success}, Message: ${result.message}`);
      }
      
      res.json({ success: true, results });
    } catch (error) {
      console.error("Error in admin credit grant:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to grant bonus credits" 
      });
    }
  });

  // Admin route to verify user credits 
  app.get('/admin/credits/verify', adminTokenAuth, async (req: any, res) => {
    try {
      const { email } = req.query;
      
      if (!email) {
        return res.status(400).json({ 
          success: false, 
          message: "Email parameter required" 
        });
      }

      // Use grantBonusCredits with 0 amount to check if user exists and get current state
      const result = await storage.grantBonusCredits(email as string, 0);
      
      if (!result.success) {
        return res.status(404).json({ 
          success: false, 
          message: result.message 
        });
      }

      // Parse the message to extract credit info or return basic info
      res.json({
        success: true,
        email: email as string,
        monthlyLimit: result.newLimit,
        message: result.message,
        verified: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error verifying user credits:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to verify credits" 
      });
    }
  });

  // Script Validation API endpoints
  app.post("/api/projects/:id/validate", 
    isAuthenticated, 
    requireCredits({
      operationType: "script_validation",
      getResourceId: getProjectIdFromParams,
      getMetadata: (req) => createOperationMetadata(req, { 
        validationType: req.body.validationType,
        categories: req.body.validationCategories
      })
    }),
    async (req: any, res) => {
    try {
      const userId = resolveUserId(req.user);
      const projectId = req.params.id;
      
      // Verify project ownership
      const project = await storage.getProject(projectId);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Parse and validate request
      const validationRequest = scriptValidationRequestSchema.parse({
        projectId,
        ...req.body
      });

      console.log(`🔍 Starting script validation for project ${projectId}`);
      
      // Run validation
      const result = await scriptValidationService.validateScript(validationRequest);
      
      res.json(result);
    } catch (error) {
      console.error("Error validating script:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid validation request", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to validate script" });
    }
  });

  app.get("/api/projects/:id/validation-reports", 
    isAuthenticated, 
    async (req: any, res) => {
    try {
      const userId = resolveUserId(req.user);
      const projectId = req.params.id;
      
      // Verify project ownership
      const project = await storage.getProject(projectId);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ message: "Project not found" });
      }

      const reports = await storage.getProjectValidationReports(projectId);
      res.json(reports);
    } catch (error) {
      console.error("Error fetching validation reports:", error);
      res.status(500).json({ message: "Failed to fetch validation reports" });
    }
  });

  app.get("/api/validation-reports/:reportId", 
    isAuthenticated, 
    async (req: any, res) => {
    try {
      const reportId = req.params.reportId;
      const report = await storage.getValidationReport(reportId);
      
      if (!report) {
        return res.status(404).json({ message: "Validation report not found" });
      }

      // Verify project ownership
      const userId = resolveUserId(req.user);
      const project = await storage.getProject(report.projectId);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Get detailed issues for this report
      const issues = await storage.getValidationIssues(reportId);
      const violations = await storage.getCharacterConsistencyViolations(reportId);

      res.json({
        ...report,
        issues,
        characterViolations: violations
      });
    } catch (error) {
      console.error("Error fetching validation report details:", error);
      res.status(500).json({ message: "Failed to fetch validation report" });
    }
  });

  app.get("/api/characters/:id/consistency", 
    isAuthenticated, 
    async (req: any, res) => {
    try {
      const characterId = req.params.id;
      const character = await storage.getCharacter(characterId);
      
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }

      // Verify project ownership if it's a project character
      if (character.projectId) {
        const userId = resolveUserId(req.user);
        const project = await storage.getProject(character.projectId);
        if (!project || project.userId !== userId) {
          return res.status(404).json({ message: "Character not found" });
        }
      }

      // Get character consistency data
      const consistencyData = await storage.validateCharacterConsistency(characterId, character.projectId || 'library');
      const appearanceHistory = await storage.getCharacterAppearanceHistory(characterId, character.projectId || 'library');
      
      res.json({
        character,
        consistencyData,
        appearanceHistory
      });
    } catch (error) {
      console.error("Error fetching character consistency:", error);
      res.status(500).json({ message: "Failed to fetch character consistency data" });
    }
  });

  // Social Media Sharing Route - Server-Side Rendering for Open Graph/Twitter Cards
  // This route must be placed BEFORE Vite setup to ensure it intercepts crawler requests
  app.get('/share/:projectId', async (req: any, res, next) => {
    try {
      const projectId = req.params.projectId;
      const userAgent = req.headers['user-agent'] || '';
      
      // Check if this is a social media crawler or link preview request
      const shouldRenderSSR = isSocialCrawler(userAgent) || isLinkPreviewRequest(req);
      
      console.log(`🔗 Request for /share/${projectId} from: ${userAgent.substring(0, 50)}... shouldRenderSSR: ${shouldRenderSSR}`);
      
      if (shouldRenderSSR) {
        // Get the public project data for crawlers
        const project = await storage.getPublicProject(projectId);
        
        if (!project) {
          console.log(`⚠️ Project ${projectId} not found or not public`);
          // Generate fallback HTML for non-existent or private projects
          const fallbackHtml = generateFallbackHTML(req, 'Project not found or not publicly available');
          res.set('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes
          res.set('Content-Type', 'text/html; charset=utf-8');
          return res.send(fallbackHtml);
        }
        
        console.log(`✅ Found public project: ${project.title} by ${project.user?.firstName || 'Unknown'}`);
        
        // Generate SSR HTML with proper meta tags
        const html = generateSSRHTML(project, req);
        
        // Set appropriate headers for crawlers
        res.set('Cache-Control', 'public, max-age=600'); // Cache for 10 minutes
        res.set('Content-Type', 'text/html; charset=utf-8');
        res.set('X-Robots-Tag', 'index, follow');
        
        return res.send(html);
      }
      
      // For non-crawler requests in development, we need to redirect to the SPA route
      // since Vite's catch-all will interfere. In production, just let it fall through.
      if (process.env.NODE_ENV === 'development') {
        // Redirect to the main app, letting the SPA handle the route client-side
        const redirectUrl = `${req.protocol}://${req.get('host')}/#/share/${projectId}`;
        return res.redirect(302, redirectUrl);
      } else {
        // In production, let it fall through to the static file handler
        return next();
      }
      
    } catch (error) {
      console.error('Error in /share/:projectId route:', error);
      
      // Generate fallback HTML on error
      const fallbackHtml = generateFallbackHTML(req, 'An error occurred while loading the comic');
      res.set('Cache-Control', 'public, max-age=300');
      res.set('Content-Type', 'text/html; charset=utf-8');
      return res.send(fallbackHtml);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
