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
  insertCharacterFromScriptSchema
} from "@shared/schema";
import { geminiService } from "./gemini";
import { z } from "zod";
import { requireCredits, getProjectIdFromParams, getPanelIdFromBody, getPageIdFromRequest, createOperationMetadata } from "./creditMiddleware";
import { isSocialCrawler, isLinkPreviewRequest } from "./utils/socialCrawlers";
import { generateSSRHTML, generateFallbackHTML } from "./utils/htmlGenerator";

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

  // Script Characters Routes - Extract characters from script and suggest unmatched ones
  app.get("/api/projects/:projectId/script-characters", isAuthenticated, async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      const userId = getUserId(req.user);
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
      const userId = getUserId(req.user);
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
    requireCredits({
      operationType: "panel_generation",
      getResourceId: getPanelIdFromBody,
      getMetadata: (req) => createOperationMetadata(req, { 
        prompt: req.body.prompt?.substring(0, 100) 
      })
    }),
    async (req: any, res) => {
    try {
      const { 
        prompt, 
        panelId, 
        projectContext, 
        characterContext, 
        styleOptions, 
        panelContext,
        // New optional fields for enhanced context
        projectId,
        currentPageId,
        selectedPanelNumber
      } = req.body;
      
      // Build enhanced context if IDs are provided
      let previousPanelsContext: Array<{panelNumber: number; prompt: string; imageUrl?: string}> = [];
      let crossPageContext: Array<{pageNumber: number; panels: Array<{panelNumber: number; prompt: string; imageUrl?: string}>}> = [];
      let enhancedPrompt = prompt; // Default to original prompt
      
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
            const project = await storage.getProject(projectId);
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
      
      const result = await geminiService.generatePanelImage({
        prompt: enhancedPrompt, // Use enhanced prompt with script data
        panelId,
        projectContext,
        characterContext,
        styleOptions,
        panelContext,
        previousPanelsContext,
        crossPageContext,
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error generating image:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate image";
      res.status(500).json({ message: errorMessage });
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
      const userId = getUserId(req.user);
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

  // Background Generation route - enhanced for both panel and page-level generation
  app.post("/api/generate-background", 
    isAuthenticated,
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
