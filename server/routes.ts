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
  insertProjectCommentSchema
} from "@shared/schema";
import { geminiService } from "./gemini";
import { z } from "zod";
import { requireCredits, getProjectIdFromParams, getPanelIdFromBody, getPageIdFromRequest, createOperationMetadata } from "./creditMiddleware";
import { redressService } from "./services/RedressService";
import { redressRequestSchema, redressResponseSchema } from "@shared/schema";
import { validateRedressContent, auditContentAccess, requireAgeVerification } from "./ageVerificationMiddleware";
import { createEnterpriseSecurityMiddleware, cleanupSecurityLogs } from "./enterpriseSecurityMiddleware";
import { rateLimitingMiddleware } from "./middleware/RateLimitingMiddleware";
import type { ContentRating } from "@shared/schema";
import { z } from "zod";

// Secure validation schema for age verification
const ageVerificationSchema = z.object({
  birthMonth: z.number().min(1).max(12),
  birthYear: z.number().min(1900).max(new Date().getFullYear()),
});

// Helper function to get user ID from different auth providers
function getUserId(user: any): string {
  if (user.provider === 'google') {
    return user.id;
  }
  // Replit Auth
  return user.claims?.sub;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Start security log cleanup job (run every hour)
  setInterval(cleanupSecurityLogs, 60 * 60 * 1000);
  
  // Wire up secure age verification endpoints
  const { setupSecureAgeVerification } = await import("./routes/secureAgeVerification");
  setupSecureAgeVerification(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req.user);
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
      const userId = getUserId(req.user);
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

  app.put('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req.user);
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
      const userId = getUserId(req.user);
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
      const userId = getUserId(req.user);
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
  app.get("/objects/:objectPath(*)", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
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
      const userId = getUserId(req.user);
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
      const userId = getUserId(req.user);
      const projects = await storage.getUserProjects(userId);
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req.user);
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
      const userId = getUserId(req.user);
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
      const userId = getUserId(req.user);
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
      const userId = getUserId(req.user);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ message: "Project not found" });
      }

      const characterData = insertCharacterSchema.parse({
        ...req.body,
        projectId: req.params.projectId,
      });
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
      const userId = getUserId(req.user);
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
      const userId = getUserId(req.user);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ message: "Project not found" });
      }

      const updates = insertCharacterSchema.partial().parse(req.body);
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
      const userId = getUserId(req.user);
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

  // Page routes
  app.post("/api/projects/:projectId/pages", isAuthenticated, async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      const userId = getUserId(req.user);
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
      const userId = getUserId(req.user);
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
      const userId = getUserId(req.user);
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
      const userId = getUserId(req.user);
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
      const userId = getUserId(req.user);
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
      const userId = getUserId(req.user);
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

  // AI Generation endpoints
  app.post("/api/generate-image", 
    isAuthenticated,
    createEnterpriseSecurityMiddleware({
      operationType: "panel_generation",
      allowedContentRatings: ["General", "Mature", "Adult"], // Allow all ratings with proper verification
      maxRequestsPerHour: 50,
      getResourceId: (req) => req.body.panelId,
      getMetadata: (req) => ({ 
        prompt: req.body.prompt?.substring(0, 100),
        projectId: req.body.projectContext?.id
      })
    }),
    requireCredits({
      operationType: "panel_generation",
      getResourceId: getPanelIdFromBody,
      getMetadata: (req) => createOperationMetadata(req, { 
        prompt: req.body.prompt?.substring(0, 100) 
      })
    }),
    async (req: any, res) => {
    try {
      const { prompt, panelId, projectContext, characterContext, styleOptions, panelContext } = req.body;
      
      const result = await geminiService.generatePanelImage({
        prompt,
        panelId,
        projectContext,
        characterContext,
        styleOptions,
        panelContext,
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error generating image:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate image";
      res.status(500).json({ message: errorMessage });
    }
  });

  // Background Generation route - enhanced for both panel and page-level generation
  app.post("/api/generate-background", 
    isAuthenticated,
    createEnterpriseSecurityMiddleware({
      operationType: "background_generation",
      allowedContentRatings: ["General", "Mature", "Adult"], // Allow all ratings with proper verification
      maxRequestsPerHour: 30,
      getResourceId: (req) => req.body.pageId || req.body.projectId,
      getMetadata: (req) => ({ 
        projectId: req.body.projectId,
        pageId: req.body.pageId,
        layoutTemplate: req.body.layoutTemplate
      })
    }),
    requireCredits({
      operationType: "background_generation",
      getResourceId: getPageIdFromRequest,
      getMetadata: (req) => createOperationMetadata(req, { 
        projectId: req.body.projectId,
        pageId: req.body.pageId 
      })
    }),
    async (req: any, res) => {
    try {
      const { panelId, projectId, pageId, layoutTemplate, panelContext } = req.body;
      
      // Support both panel-level and page-level background generation
      const actualProjectId = projectId || (pageId ? (await storage.getPage(pageId))?.projectId : null);
      const actualPanelId = panelId || 1; // Default to panel 1 for page-level generation
      
      if (!actualProjectId) {
        return res.status(400).json({ message: "Project ID is required (either directly or via page)" });
      }

      const project = await storage.getProject(actualProjectId);
      const userId = getUserId(req.user);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ message: "Project not found" });
      }

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
            const structuredScript = await storage.getProjectStructuredScript(actualProjectId);
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

      res.json(result);
    } catch (error) {
      console.error("Background generation error:", error);
      res.status(500).json({ message: "Failed to generate background" });
    }
  });

  app.post("/api/generate-full-page", 
    isAuthenticated,
    createEnterpriseSecurityMiddleware({
      operationType: "full_page_generation",
      allowedContentRatings: ["General", "Mature", "Adult"], // Allow all ratings with proper verification
      maxRequestsPerHour: 15, // Lower limit for complex generation
      getResourceId: (req) => req.body.currentPageId,
      getMetadata: (req) => ({ 
        layoutId: req.body.layoutId,
        projectContext: req.body.projectContext?.title,
        pageScript: req.body.pageScript?.substring(0, 100)
      })
    }),
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
        projectContext,
        pageScript,
        panelLayout,
        currentPageId,
        storage,
        layoutId
      );
      
      res.json(results);
    } catch (error) {
      console.error("Error generating full page:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate full page";
      res.status(500).json({ message: errorMessage });
    }
  });

  app.post("/api/generate-script", 
    isAuthenticated,
    createEnterpriseSecurityMiddleware({
      operationType: "script_generation",
      allowedContentRatings: ["General", "Mature", "Adult"], // Allow all ratings with proper verification
      maxRequestsPerHour: 20, // Lower limit for script generation
      getResourceId: (req) => req.body.projectId,
      getMetadata: (req) => ({ 
        title: req.body.title,
        genre: req.body.genre,
        description: req.body.description?.substring(0, 100)
      })
    }),
    requireCredits({
      operationType: "script_generation",
      getResourceId: getProjectIdFromParams,
      getMetadata: (req) => createOperationMetadata(req)
    }),
    async (req: any, res) => {
    try {
      const scriptRequest = req.body;
      
      const result = await geminiService.generateScript(scriptRequest);
      
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
    createEnterpriseSecurityMiddleware({
      operationType: "text_generation",
      allowedContentRatings: ["General", "Mature", "Adult"], // Allow all ratings with proper verification
      maxRequestsPerHour: 40,
      getMetadata: (req) => ({ 
        prompt: req.body.prompt?.substring(0, 100)
      })
    }),
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
      res.status(500).json({ message: "Failed to generate text" });
    }
  });

  // Generate complete character with AI - Enterprise Security Protected
  app.post("/api/projects/:projectId/generate-character", 
    isAuthenticated,
    createEnterpriseSecurityMiddleware({
      operationType: "character_generation",
      allowedContentRatings: ["General", "Mature", "Adult"], // Allow all ratings with proper verification
      maxRequestsPerHour: 30,
      getResourceId: (req) => req.params.projectId,
      getMetadata: (req) => ({ 
        roleType: req.body.roleType,
        projectId: req.params.projectId
      })
    }),
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
      const userId = getUserId(req.user);
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

  // Generate structured script with rich metadata - Enterprise Security Protected
  app.post("/api/projects/:projectId/generate-structured-script", 
    isAuthenticated,
    createEnterpriseSecurityMiddleware({
      operationType: "structured_script_generation",
      allowedContentRatings: ["General", "Mature", "Adult"], // Allow all ratings with proper verification
      maxRequestsPerHour: 10, // Very low limit for complex script generation
      getResourceId: (req) => req.params.projectId,
      getMetadata: (req) => ({ 
        pageCount: req.body.pageCount,
        tone: req.body.tone,
        genre: req.body.genre,
        title: req.body.title
      })
    }),
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
      
      // Generate structured script
      const structuredScriptResponse = await geminiService.generateStructuredScript({
        title,
        description,
        genre,
        characters,
        settings,
        pageCount: validatedPageCount,
        tone,
        logline,
      });
      
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
          });
          
          // Save dialogue for this panel
          for (let i = 0; i < panelData.dialogue.length; i++) {
            const dialogueData = panelData.dialogue[i];
            await storage.createScriptDialogue({
              scriptPanelId: savedPanel.id,
              character: dialogueData.characterName,
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

  // Save structured script data directly (for preserving previewed scripts)
  app.post("/api/projects/:projectId/save-structured-script", isAuthenticated, async (req: any, res) => {
    try {
      const { projectId } = req.params;
      const { title, logline, pages } = req.body;
      
      console.log(`🐛 save-structured-script called for project ${projectId}`);
      console.log(`🐛 Request body:`, { title, logline, pagesCount: pages?.length });
      
      // Verify user owns the project
      const project = await storage.getProject(projectId);
      const userId = getUserId(req.user);
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
              await storage.createScriptDialogue({
                scriptPanelId: savedPanel.id,
                character: dialogueData.characterName,
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
      res.json(fullScript);
    } catch (error) {
      console.error("🐛 ERROR saving structured script:", error);
      res.status(500).json({ message: "Failed to save structured script" });
    }
  });

  // Generate complete AI story (title, description, characters, script) - Enterprise Security Protected
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
    createEnterpriseSecurityMiddleware({
      operationType: "complete_story_generation",
      allowedContentRatings: ["General", "Mature", "Adult"], // Allow all ratings with proper verification
      maxRequestsPerHour: 5, // Very low limit for extremely resource-intensive generation
      getMetadata: (req) => ({ 
        genres: req.body.genres?.join(","),
        length: req.body.length,
        artStyle: req.body.artStyle,
        tones: req.body.tones?.join(",")
      })
    }),
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

  // Generate cover art for project - Enterprise Security Protected
  app.post("/api/projects/:projectId/generate-cover-art", 
    isAuthenticated,
    createEnterpriseSecurityMiddleware({
      operationType: "cover_art_generation",
      allowedContentRatings: ["General", "Mature", "Adult"], // Allow all ratings with proper verification
      maxRequestsPerHour: 25,
      getResourceId: (req) => req.params.projectId,
      getMetadata: (req) => ({ 
        projectId: req.params.projectId,
        operationType: "cover_art_generation"
      })
    }),
    requireCredits({
      operationType: "cover_art_generation",
      getResourceId: getProjectIdFromParams,
      getMetadata: (req) => createOperationMetadata(req)
    }),
    async (req: any, res) => {
    try {
      const userId = getUserId(req.user);
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
      const userId = getUserId(req.user);
      const profile = await storage.getUserProfile(userId);
      res.json(profile);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ message: "Failed to fetch user profile" });
    }
  });

  app.put("/api/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req.user);
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
      const userId = getUserId(req.user);
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
      const userId = getUserId(req.user);
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
      const userId = getUserId(req.user);
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
      const userId = getUserId(req.user);
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
      const userId = getUserId(req.user);
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
      const userId = getUserId(req.user);
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
      const userId = getUserId(req.user);
      
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
      const userId = getUserId(req.user);
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
      const userId = getUserId(req.user);
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
      const userId = getUserId(req.user);
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

  // ========================================
  // Age Verification API Routes (Authentication Required)
  // ========================================

  // Get user age verification status
  app.get('/api/auth/user/age-verification', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req.user);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Calculate age if birth data is available
      let age = null;
      if (user.birthMonth && user.birthYear) {
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth() + 1;
        
        age = currentYear - user.birthYear;
        if (currentMonth < user.birthMonth) {
          age--;
        }
      }

      res.json({
        isAgeVerified: user.isAgeVerified || false,
        ageVerifiedAt: user.ageVerifiedAt,
        hasBirthData: !!(user.birthMonth && user.birthYear),
        age,
        canAccessMature: age !== null && age >= 16,
        canAccessAdult: user.isAgeVerified && age !== null && age >= 18
      });
    } catch (error) {
      console.error("Error fetching age verification status:", error);
      res.status(500).json({ message: "Failed to fetch age verification status" });
    }
  });

  // Submit age verification (birth date)
  app.post('/api/auth/user/age-verification', 
    isAuthenticated,
    createEnterpriseSecurityMiddleware({
      operationType: "age_verification",
      allowedContentRatings: ["General"], // Age verification itself is General
      maxRequestsPerHour: 10, // Limit verification attempts
      getMetadata: (req) => ({
        birthYear: req.body.birthYear,
        userAgent: req.get('User-Agent')?.substring(0, 100),
        ipAddress: req.ip
      })
    }),
    async (req: any, res) => {
    try {
      const userId = getUserId(req.user);
      
      // Enterprise-grade validation using zod schema
      const validationResult = ageVerificationSchema.safeParse(req.body);
      if (!validationResult.success) {
        // Audit failed validation attempt
        await storage.logSecurityEvent({
          userId,
          eventType: 'age_verification_validation_failed',
          endpoint: '/api/auth/user/age-verification',
          metadata: {
            validationErrors: validationResult.error.errors,
            submittedData: { birthMonth: req.body.birthMonth, birthYear: req.body.birthYear },
            userAgent: req.get('User-Agent'),
            ipAddress: req.ip
          },
          timestamp: new Date(),
          severity: 'warning'
        });
        
        return res.status(400).json({ 
          message: "Invalid birth date format. Please provide valid month (1-12) and year (1900-current).",
          errors: validationResult.error.errors
        });
      }
      
      const { birthMonth, birthYear } = validationResult.data;

      // Calculate age using enterprise-grade logic
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1;
      
      let age = currentYear - birthYear;
      
      // Prevent unrealistic ages (enterprise security)
      if (age < 0 || age > 150) {
        await storage.logSecurityEvent({
          userId,
          eventType: 'age_verification_suspicious_age',
          endpoint: '/api/auth/user/age-verification',
          metadata: {
            calculatedAge: age,
            birthMonth,
            birthYear,
            userAgent: req.get('User-Agent'),
            ipAddress: req.ip
          },
          timestamp: new Date(),
          severity: 'high'
        });
        
        return res.status(400).json({
          message: "Invalid birth date. Please verify your information."
        });
      }
      if (currentMonth < birthMonth) {
        age--;
      }

      // Get current user state for audit trail
      const currentUser = await storage.getUser(userId);
      const wasAgeVerified = currentUser?.isAgeVerified || false;
      
      // Server-controlled verification flags (cannot be manipulated by client)
      const isNowAgeVerified = age >= 18;
      const updates: any = {
        birthMonth,
        birthYear,
        isAgeVerified: isNowAgeVerified,
        ageVerifiedAt: isNowAgeVerified ? new Date() : null
      };

      await storage.updateUser(userId, updates);
      
      // Enterprise audit logging for all verification changes
      await storage.logSecurityEvent({
        userId,
        eventType: 'age_verification_submitted',
        endpoint: '/api/auth/user/age-verification',
        metadata: {
          age,
          birthMonth,
          birthYear,
          wasAgeVerified,
          isNowAgeVerified,
          verificationStatusChanged: wasAgeVerified !== isNowAgeVerified,
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip,
          accessLevel: age >= 18 ? 'Adult' : age >= 16 ? 'Mature' : 'General'
        },
        timestamp: new Date(),
        severity: 'info'
      });

      res.json({
        success: true,
        age,
        isAgeVerified: age >= 18,
        canAccessMature: age >= 16,
        canAccessAdult: age >= 18,
        message: age >= 18 ? "Age verification successful" : 
                 age >= 16 ? "Age recorded. Mature content access granted." :
                 "Age recorded. Content access limited to general audiences."
      });
    } catch (error) {
      console.error("Error submitting age verification:", error);
      res.status(500).json({ message: "Failed to submit age verification" });
    }
  });

  // Reset age verification (for testing or privacy)
  app.delete('/api/auth/user/age-verification', 
    isAuthenticated,
    createEnterpriseSecurityMiddleware({
      operationType: "age_verification_reset",
      allowedContentRatings: ["General"], // Reset is General operation
      maxRequestsPerHour: 5, // Very strict limit on resets
      getMetadata: (req) => ({
        userAgent: req.get('User-Agent')?.substring(0, 100),
        ipAddress: req.ip
      })
    }),
    async (req: any, res) => {
    try {
      const userId = getUserId(req.user);
      
      // Get current user state for comprehensive audit trail
      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const hadVerificationData = !!(currentUser.birthMonth && currentUser.birthYear);
      const wasAgeVerified = currentUser.isAgeVerified || false;
      
      // Server-controlled reset (client cannot specify what to reset)
      await storage.updateUser(userId, {
        birthMonth: null,
        birthYear: null,
        isAgeVerified: false,
        ageVerifiedAt: null
      });
      
      // Enterprise audit logging for verification resets
      await storage.logSecurityEvent({
        userId,
        eventType: 'age_verification_reset',
        endpoint: '/api/auth/user/age-verification',
        metadata: {
          hadVerificationData,
          wasAgeVerified,
          previousBirthMonth: currentUser.birthMonth,
          previousBirthYear: currentUser.birthYear,
          previousAgeVerifiedAt: currentUser.ageVerifiedAt,
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip
        },
        timestamp: new Date(),
        severity: 'warning' // Resets are potentially suspicious
      });

      res.json({
        success: true,
        message: "Age verification data cleared successfully"
      });
    } catch (error) {
      console.error("Error resetting age verification:", error);
      res.status(500).json({ message: "Failed to reset age verification" });
    }
  });

  // ========================================
  // AI Redress API Routes (Authentication Required)
  // ========================================

  // Create redress job for panel
  app.post("/api/panels/:panelId/redress", 
    isAuthenticated,
    auditContentAccess, // Audit all content access attempts
    validateRedressContent, // Validate content rating and enforce age restrictions
    requireCredits({
      operationType: "redress_apply" as const,
      getResourceId: (req) => req.params.panelId,
      getMetadata: (req) => createOperationMetadata(req, {
        characters: req.body.characters?.length,
        outfit: req.body.outfit?.type,
        isPreview: req.body.preview,
        contentRating: req.contentRating,
        presetCategory: req.presetCategory
      })
    }),
    async (req: any, res) => {
    try {
      const userId = getUserId(req.user);
      const panelId = req.params.panelId;
      
      // Validate request body
      const requestData = redressRequestSchema.parse(req.body);
      
      // Verify panel exists and user owns it
      const panel = await storage.getPanel(panelId);
      if (!panel) {
        return res.status(404).json({ message: "Panel not found" });
      }

      // Get the page to verify project ownership
      const page = await storage.getPage(panel.pageId);
      if (!page) {
        return res.status(404).json({ message: "Page not found" });
      }

      const project = await storage.getProject(page.projectId);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ message: "Project not found or not owned by user" });
      }

      // Verify characters exist and belong to the project or user's library
      for (const charRequest of requestData.characters) {
        const character = await storage.getCharacter(charRequest.characterId);
        if (!character) {
          return res.status(404).json({ 
            message: `Character ${charRequest.characterId} not found` 
          });
        }
        
        // Check if character belongs to this project or is user's library character
        const hasAccess = character.projectId === project.id || 
                         (character.isLibraryCharacter && character.userId === userId);
        
        if (!hasAccess) {
          return res.status(403).json({ 
            message: `Access denied to character ${character.name}` 
          });
        }
      }

      console.log(`🎭 Creating redress job for panel ${panelId} by user ${userId}`);
      console.log(`🎭 Request: ${requestData.characters.length} characters, ${requestData.outfit.type}, preview=${requestData.preview}`);

      // Create the redress job
      const jobResponse = await redressService.createRedressJob(
        userId,
        panelId,
        requestData
      );

      console.log(`🎭 Redress job created: ${jobResponse.jobId} with status ${jobResponse.status}`);

      res.json(jobResponse);
    } catch (error) {
      console.error("🎭 Error creating redress job:", error);
      
      // Handle validation errors specifically
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid request data",
          errors: error.errors
        });
      }
      
      const errorMessage = error instanceof Error ? error.message : "Failed to create redress job";
      res.status(500).json({ message: errorMessage });
    }
  });

  // Get redress job status
  app.get("/api/redress/:jobId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req.user);
      const jobId = req.params.jobId;

      console.log(`🎭 Getting status for redress job ${jobId} by user ${userId}`);

      // Get job status from redress service
      const jobStatus = await redressService.getJobStatus(jobId);
      
      if (!jobStatus) {
        return res.status(404).json({ 
          message: "Redress job not found",
          jobId 
        });
      }

      // Verify user ownership of the job
      const dbJob = await storage.getRedressJob(jobId);
      if (!dbJob || dbJob.userId !== userId) {
        return res.status(403).json({ 
          message: "Access denied - job not owned by user",
          jobId 
        });
      }

      res.json(jobStatus);
    } catch (error) {
      console.error(`🎭 Error getting redress job status:`, error);
      
      const errorMessage = error instanceof Error ? error.message : "Failed to get job status";
      res.status(500).json({ message: errorMessage });
    }
  });

  // Cancel redress job (optional future enhancement)
  app.delete("/api/redress/:jobId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req.user);
      const jobId = req.params.jobId;

      console.log(`🎭 Cancelling redress job ${jobId} by user ${userId}`);

      // TODO: Implement job cancellation in RedressService
      // const cancelled = await redressService.cancelJob(jobId, userId);
      
      res.json({ 
        success: true, 
        message: "Job cancellation requested",
        jobId 
      });
    } catch (error) {
      console.error(`🎭 Error cancelling redress job:`, error);
      
      const errorMessage = error instanceof Error ? error.message : "Failed to cancel job";
      res.status(500).json({ message: errorMessage });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
