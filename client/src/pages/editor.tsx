import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import Navigation from "@/components/navigation";
import Sidebar from "@/components/sidebar";
import PanelEditor from "@/components/panel-editor";
import LayoutChangeModal from "@/components/layout-change-modal";
import ComicPageLayout from "@/components/comic-page-layout";
import StructuredScriptViewer from "@/components/structured-script-viewer";
import { ComicReader } from "@/components/comic-reader";
import { ShareDialog } from "@/components/share-dialog";
import { exportComicAsPDF, exportCurrentPage } from "@/lib/comic-export";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowLeft, Save, Download, ChevronLeft, ChevronRight, Wand2, Loader2, Plus, Edit, Trash2, Cloud, FileText, Layout, Play, Zap, Share, Globe, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { aiService } from "@/lib/ai-service";
import { comicLayouts } from "@/lib/comic-layouts";
import { getPageAspectRatio, PAGE_ASPECT_RATIOS, calculateOptimalDimensions, getOptimalImageCSS, generateEnhancedPanelContext } from "@/lib/aspect-ratio-utils";
import type { Project, Page, Panel } from "@shared/schema";

export default function Editor() {
  const { projectId } = useParams<{ projectId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPanel, setSelectedPanel] = useState<number | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [currentLayout, setCurrentLayout] = useState("classic-grid");
  const [showLayoutModal, setShowLayoutModal] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<{[key: number]: string}>({});
  const [generatedBackgrounds, setGeneratedBackgrounds] = useState<{[key: number]: string}>({});
  const [pageBackground, setPageBackground] = useState<string | null>(null);
  const [isGeneratingFullPage, setIsGeneratingFullPage] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [panelEditorOpen, setPanelEditorOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  const toggleSidebarCollapse = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<"editor" | "script" | "animate">("editor");
  const [showComicReader, setShowComicReader] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  
  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const { data: project, isLoading: isProjectLoading } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
    enabled: !!projectId,
  });

  const { data: pages = [], isLoading: isPagesLoading } = useQuery<Page[]>({
    queryKey: ["/api/projects", projectId, "pages"],
    enabled: !!projectId,
  });

  const currentPage = pages[currentPageIndex] || null;

  // Load existing panel data and page background when page changes
  useEffect(() => {
    if (currentPage?.id) {
      // CRITICAL FIX: Restore the saved layout template from database
      if (currentPage.layoutTemplate) {
        console.log(`🔄 LAYOUT RESTORE: Page ${currentPage.id} loading layout: "${currentPage.layoutTemplate}"`);
        setCurrentLayout(currentPage.layoutTemplate);
      } else {
        console.log(`⚠️ LAYOUT MISSING: Page ${currentPage.id} has no layoutTemplate, using default`);
        setCurrentLayout("classic-grid");
      }
      
      const loadPanelData = async () => {
        try {
          const response = await fetch(`/api/pages/${currentPage.id}/panels`);
          const panelsData = await response.json();
          const imageMap: {[key: number]: string} = {};
          const backgroundMap: {[key: number]: string} = {};
          
          panelsData.forEach((panel: any) => {
            if (panel.imageUrl) {
              console.log(`🖼️ Loading panel ${panel.panelNumber} image: ${panel.imageUrl}`);
              imageMap[panel.panelNumber] = panel.imageUrl;
            }
          });
          
          console.log(`🎨 Setting generatedImages state:`, imageMap);
          setGeneratedImages(imageMap);
          setGeneratedBackgrounds(backgroundMap);
          
          // Load page background if it exists
          if (currentPage.backgroundImageUrl) {
            setPageBackground(currentPage.backgroundImageUrl);
          } else {
            setPageBackground(null);
          }
        } catch (error) {
          console.error("Failed to load panel data:", error);
        }
      };
      
      loadPanelData();
    } else {
      // Clear images when no page is selected
      setGeneratedImages({});
      setGeneratedBackgrounds({});
      setPageBackground(null);
      // Reset to default layout when no page
      setCurrentLayout("classic-grid");
    }
  }, [currentPage?.id]);
  
  // Close sidebar/panel editor on mobile when screen size changes
  useEffect(() => {
    if (!isMobile) {
      setSidebarOpen(false);
      setPanelEditorOpen(false);
    }
  }, [isMobile]);

  const { data: panels = [] } = useQuery<Panel[]>({
    queryKey: ["/api/pages", currentPage?.id, "panels"],
    enabled: !!currentPage?.id,
  });

  const saveProjectMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", `/api/projects/${projectId}`, { updatedAt: new Date() });
    },
    onSuccess: () => {
      toast({
        title: "Project saved",
        description: "Your comic project has been saved successfully.",
      });
    },
  });

  const createPageMutation = useMutation({
    mutationFn: async (): Promise<Page> => {
      if (!project) throw new Error("No project available");
      
      const newPageNumber = pages.length + 1;
      const newPage = await apiRequest("POST", `/api/projects/${projectId}/pages`, {
        projectId: projectId!,
        pageNumber: newPageNumber,
        layoutTemplate: currentLayout,
        panels: null,
        scriptSnippet: null,
      });
      return newPage as unknown as Page;
    },
    onSuccess: async (newPage: Page) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "pages"] });
      
      // Navigate to the newly created page (which will be the last page)
      // Since we just added a page, the new index will be current pages.length
      const newPageIndex = pages.length; // This will be correct after invalidation
      setCurrentPageIndex(newPageIndex);
      
      toast({
        title: "New page created",
        description: `Page ${newPage.pageNumber} has been added to your comic.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create new page. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deletePageMutation = useMutation({
    mutationFn: async () => {
      if (!currentPage?.id) throw new Error("No page to delete");
      
      // Delete the page (this will also delete associated panels)
      await apiRequest("DELETE", `/api/pages/${currentPage.id}`);
      
      return currentPage.id;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "pages"] });
      
      // Navigate to previous page or first page
      const newPageIndex = currentPageIndex > 0 ? currentPageIndex - 1 : 0;
      setCurrentPageIndex(newPageIndex);
      
      // Clear local state
      setGeneratedImages({});
      setGeneratedBackgrounds({});
      setPageBackground(null);
      setSelectedPanel(null);
      
      toast({
        title: "Page deleted",
        description: "Page and all its content have been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete page. Please try again.",
        variant: "destructive",
      });
    },
  });

  const generateBackgroundForPageMutation = useMutation({
    mutationFn: async () => {
      if (!project?.id || !currentPage?.id) throw new Error("No project or page selected");
      
      const layout = comicLayouts.find(l => l.id === currentLayout);
      if (!layout) throw new Error("Layout not found");
      
      // Calculate precise page canvas aspect ratio and dimensions
      const pageAspectRatio = getPageAspectRatio(isMobile);
      const optimalDimensions = calculateOptimalDimensions(pageAspectRatio, 1200000); // Higher resolution for page backgrounds
      
      const response = await apiRequest("POST", "/api/generate-background", {
        projectId: project.id,
        pageId: currentPage.id,
        layoutTemplate: currentLayout,
        panelContext: {
          fullPage: true,
          panelCount: layout.panelCount,
          aspectRatio: pageAspectRatio,
          dimensions: optimalDimensions,
          panelType: "page-background"
        }
      });
      
      const result = await response.json();
      return result;
    },
    onSuccess: (result: any) => {
      if (result.status === "completed" && result.imageUrl) {
        // Set the page background for the canvas
        setPageBackground(result.imageUrl);
        
        toast({
          title: "Page Background Generated!",
          description: "Beautiful story-themed background created for this page.",
        });
      } else {
        throw new Error(result.error || `Failed to generate page background - Status: ${result.status}, URL: ${result.imageUrl}`);
      }
    },
    onError: (error) => {
      toast({
        title: "Background Generation Failed",
        description: error?.message || "Failed to generate page background. Please try again.",
        variant: "destructive",
      });
    },
  });

  const generatePageMutation = useMutation({
    mutationFn: async () => {
      if (!project) throw new Error("No project available");
      
      setIsGeneratingFullPage(true);
      const layout = comicLayouts.find(l => l.id === currentLayout);
      if (!layout) throw new Error("Layout not found");
      
      // Ensure we have a page to work with - with robust error handling
      let pageToUse = currentPage;
      if (!pageToUse) {
        console.log("No current page found, creating new page...");
        try {
          // Create a new page automatically if none exists
          const newPageNumber = pages.length + 1;
          const newPageResponse = await apiRequest("POST", `/api/projects/${projectId}/pages`, {
            projectId: projectId!,
            pageNumber: newPageNumber,
            layoutTemplate: currentLayout,
            panels: null,
            scriptSnippet: null,
          });
          
          pageToUse = await newPageResponse.json() as Page;
          console.log("New page created:", pageToUse.id);
          
          // Update the pages data and wait for it to complete
          await queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "pages"] });
          
          // Wait a moment for the query to refresh
          await new Promise(resolve => setTimeout(resolve, 500));
          
          setCurrentPageIndex(pages.length);
        } catch (error) {
          console.error("Failed to create page:", error);
          throw new Error("Failed to create page for generation");
        }
      }
      
      if (!pageToUse?.id) {
        throw new Error("No valid page available for generation");
      }
      
      console.log("Using page for generation:", pageToUse.id, "Page number:", pageToUse.pageNumber);
      
      // Fetch detailed character information for consistency
      const charactersResponse = await fetch(`/api/projects/${project.id}/characters`);
      const characters = await charactersResponse.json();
      
      // Get structured script data for this project - with retry logic
      let structuredScript = null;
      try {
        console.log("Fetching structured script...");
        const response = await apiRequest("GET", `/api/projects/${projectId}/structured-script`);
        structuredScript = await response.json();
        console.log("Structured script loaded with", structuredScript?.pages?.length || 0, "pages");
      } catch (error) {
        console.log("No structured script found, using fallback descriptions:", error);
      }
      
      // Build panel data with enhanced context from structured script
      const panelsWithContext = [];
      for (let i = 1; i <= layout.panelCount; i++) {
        const panel = layout.panels[i - 1];
        const panelContext = generateEnhancedPanelContext(
          panel,
          layout.id,
          i,
          850, // page width
          1100 // page height
        );
        
        // Use structured script data if available, otherwise fallback
        let description = `Scene ${i} of ${project.title}`;
        
        if (structuredScript?.pages && Array.isArray(structuredScript.pages)) {
          // DEBUG: Log the page numbers to see what's available
          console.log("Available script pages:", structuredScript.pages.map((p: any) => ({
            pageNumber: p.pageNumber, 
            title: p.title,
            type: typeof p.pageNumber
          })));
          console.log("Looking for page:", pageToUse.pageNumber, "type:", typeof pageToUse.pageNumber);
          
          // Try multiple matching strategies to find the script page
          let scriptPage = structuredScript.pages.find((p: any) => p.pageNumber === pageToUse.pageNumber);
          
          // If not found, try string/number conversion
          if (!scriptPage) {
            scriptPage = structuredScript.pages.find((p: any) => 
              String(p.pageNumber) === String(pageToUse.pageNumber)
            );
          }
          
          // If still not found, try array index-based matching (0-indexed vs 1-indexed)
          if (!scriptPage && typeof pageToUse.pageNumber === 'number') {
            scriptPage = structuredScript.pages[pageToUse.pageNumber - 1];
          }
          
          console.log("Found script page:", scriptPage ? {
            pageNumber: scriptPage.pageNumber,
            title: scriptPage.title,
            panelCount: scriptPage.panels?.length || 0
          } : "NOT FOUND");
          
          if (scriptPage?.panels && Array.isArray(scriptPage.panels)) {
            // With fixed sequential numbering, try both strategies to handle old and new scripts
            let scriptPanel = scriptPage.panels.find((p: any) => p.panelNumber === i);
            
            // Fallback for existing scripts with wrong numbering: use array index
            if (!scriptPanel && scriptPage.panels[i - 1]) {
              scriptPanel = scriptPage.panels[i - 1];
              console.log(`Panel ${i}: Using fallback array index [${i-1}] for panel labeled as ${scriptPanel.panelNumber}`);
            }
            
            console.log(`Panel ${i} match:`, scriptPanel ? {
              foundPanelNumber: scriptPanel.panelNumber,
              sceneDescription: scriptPanel.sceneDescription?.substring(0, 50) + "...",
              hasDialogue: scriptPanel.dialogue?.length > 0,
              hasCharacters: scriptPanel.characters?.length > 0
            } : "NOT FOUND");
            if (scriptPanel) {
              // Use rich metadata from structured script with enhanced character continuity
              let richDescription = scriptPanel.sceneDescription || scriptPanel.visualDescription || scriptPanel.action;
              if (richDescription) {
                description = richDescription;
                
                // Add specific character descriptions for this panel
                if (scriptPanel.characters?.length > 0 && characters.length > 0) {
                  const panelCharacters = scriptPanel.characters.map((charName: string) => {
                    const charData = characters.find((c: any) => c.name === charName);
                    if (charData && charData.visualDescriptors) {
                      return `${charName} (APPEARANCE: ${charData.visualDescriptors})`;
                    }
                    return charName;
                  }).join(", ");
                  description += `. Characters in panel: ${panelCharacters}`;
                } else if (scriptPanel.characters?.length > 0) {
                  description += `. Characters: ${scriptPanel.characters.join(", ")}`;
                }
                
                // Add character emotions and dialogue context
                if (scriptPanel.dialogue?.length > 0) {
                  const emotions = scriptPanel.dialogue
                    .filter((d: any) => d.emotionalState)
                    .map((d: any) => `${d.character} is ${d.emotionalState}`)
                    .join(", ");
                  if (emotions) {
                    description += `. Character emotions: ${emotions}`;
                  }
                }
                
                // Add camera and shot information
                if (scriptPanel.cameraAngle) {
                  description += `. Camera: ${scriptPanel.cameraAngle}`;
                }
                if (scriptPanel.shotType) {
                  description += `. Shot: ${scriptPanel.shotType}`;
                }
                if (scriptPanel.mood) {
                  description += `. Mood: ${scriptPanel.mood}`;
                }
                
                // Add visual notes
                if (scriptPanel.visualNotes) {
                  description += `. Visual notes: ${scriptPanel.visualNotes}`;
                }
                
                // Add action details
                if (scriptPanel.action) {
                  description += `. Action: ${scriptPanel.action}`;
                }
                
                console.log(`Panel ${i} enhanced description:`, description);
              }
            } else {
              console.log(`No script panel found for panel ${i} on page ${pageToUse.pageNumber}`);
            }
          } else {
            console.log(`No panels found in script page ${pageToUse.pageNumber}`);
          }
        } else {
          console.log("No structured script pages available");
        }
        
        panelsWithContext.push({
          panelNumber: i,
          description: description,
          panelContext: panelContext,
          layoutInfo: panel
        });
      }
      
      // Build enhanced project context with full character details
      const enhancedProjectContext = {
        title: project.title,
        genre: project.genre || undefined,
        description: project.description || undefined,
        artStyle: project.artStyle || undefined,
        characters: characters.map((char: any) => ({
          name: char.name,
          role: char.role,
          bio: char.bio,
          visualDescriptors: char.visualDescriptors || "",
          alwaysTraits: char.alwaysTraits || "",
          neverTraits: char.neverTraits || "",
          colorScheme: char.colorScheme || ""
        })),
        // Add style consistency instructions
        styleConsistencyRules: `CRITICAL: Maintain EXACT character appearances throughout all panels. Characters MUST have consistent facial features, hair color, hair style, body type, and clothing style across all panels.`
      };
      
      const result = await aiService.generateFullPage(
        enhancedProjectContext,
        pageToUse?.scriptSnippet || project.description || "",
        panelsWithContext,
        pageToUse.id,
        currentLayout
      );
      
      // Update local state with generated images - with safer error handling
      const imageMap: {[key: number]: string} = {};
      
      if (Array.isArray(result)) {
        result.forEach((panelResult, index) => {
          try {
            if (panelResult && 
                typeof panelResult === 'object' && 
                panelResult.status === "completed" && 
                panelResult.imageUrl) {
              imageMap[index + 1] = panelResult.imageUrl;
            }
          } catch (err) {
            console.warn(`Error processing panel ${index + 1}:`, err, panelResult);
          }
        });
      } else {
        console.warn("Unexpected result format:", result);
      }
      
      setGeneratedImages(prev => ({ ...prev, ...imageMap }));
      
      return result;
    },
    onSuccess: (result) => {
      try {
        const successCount = Array.isArray(result) ? 
          result.filter(r => r && r.status === "completed").length : 0;
        toast({
          title: "Page Generated!",
          description: `Successfully generated ${successCount} of ${Array.isArray(result) ? result.length : 0} panels.`,
        });
        setIsGeneratingFullPage(false);
        
        // Invalidate panels query to refresh the UI with new images
        queryClient.invalidateQueries({
          queryKey: ["/api/pages", currentPage?.id, "panels"]
        });
      } catch (err) {
        console.error("Error in onSuccess handler:", err);
        setIsGeneratingFullPage(false);
      }
    },
    onError: (error) => {
      console.error("Full page generation failed:", error);
      
      // Provide more detailed error information
      let errorMessage = "Failed to generate the page. Please try again.";
      if (error?.message) {
        if (error.message.includes("currentPageId")) {
          errorMessage = "Page setup failed. Please refresh and try again.";
        } else if (error.message.includes("Layout not found")) {
          errorMessage = "Invalid layout selected. Please change layout and try again.";
        } else if (error.message.includes("No project available")) {
          errorMessage = "Project not found. Please refresh the page.";
        } else if (error.message.includes("No valid page")) {
          errorMessage = "Page creation failed. Please try again.";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Generation Failed",
        description: errorMessage,
        variant: "destructive",
      });
      setIsGeneratingFullPage(false);
    },
  });
  
  const handleLayoutChange = (layoutId: string) => {
    setCurrentLayout(layoutId);
    setGeneratedImages({}); // Clear existing images when layout changes
    setShowLayoutModal(false);
    
    // CRITICAL FIX: Save the layout change to database immediately
    if (currentPage?.id) {
      apiRequest("PUT", `/api/pages/${currentPage.id}`, {
        layoutTemplate: layoutId,
        updatedAt: new Date()
      }).then(() => {
        // Invalidate page queries to refresh data
        queryClient.invalidateQueries({
          queryKey: ["/api/projects", projectId, "pages"]
        });
      }).catch((error) => {
        console.error("Failed to save layout:", error);
        toast({
          title: "Save Failed",
          description: "Failed to save layout change. Please try again.",
          variant: "destructive",
        });
      });
    }
    
    toast({
      title: "Layout Changed",
      description: "Comic layout has been updated and saved.",
    });
  };

  // Export handler
  const handleExportComic = async () => {
    if (!project || !pages || pages.length === 0) {
      toast({
        title: "Nothing to export",
        description: "Please create some pages before exporting.",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    try {
      // Collect all panel data for all pages
      const allPanelsPromises = pages.map(page => 
        fetch(`/api/pages/${page.id}/panels`).then(res => res.json())
      );
      const allPanelsArrays = await Promise.all(allPanelsPromises);
      const allPanels = allPanelsArrays.flat();

      // Build complete data maps for export with ALL pages
      const generatedImagesMap: {[pageId: string]: {[panelNumber: number]: string}} = {};
      const generatedBackgroundsMap: {[pageId: string]: {[panelNumber: number]: string}} = {};
      const pageBackgroundsMap: {[pageId: string]: string} = {};

      // Process each page's data from the database
      pages.forEach(page => {
        const pagePanels = allPanels.filter(panel => panel.pageId === page.id);
        
        // Build image map from actual panel data (not just current page state)
        const pageImages: {[panelNumber: number]: string} = {};
        const pageBackgrounds: {[panelNumber: number]: string} = {};
        
        pagePanels.forEach(panel => {
          if (panel.imageUrl) {
            pageImages[panel.panelNumber] = panel.imageUrl;
          }
          // Note: Panel backgrounds would be stored in panel data if supported
        });

        generatedImagesMap[page.id] = pageImages;
        generatedBackgroundsMap[page.id] = pageBackgrounds;
        
        // Add page background if available
        if (page.backgroundImageUrl) {
          pageBackgroundsMap[page.id] = page.backgroundImageUrl;
        }
      });

      // Also include current page's in-memory data if not saved yet
      if (currentPage) {
        // Merge current page state with database data
        generatedImagesMap[currentPage.id] = {
          ...generatedImagesMap[currentPage.id],
          ...generatedImages
        };
        generatedBackgroundsMap[currentPage.id] = {
          ...generatedBackgroundsMap[currentPage.id],
          ...generatedBackgrounds
        };
        if (pageBackground) {
          pageBackgroundsMap[currentPage.id] = pageBackground;
        }
      }

      // Export as PDF with complete data
      await exportComicAsPDF(
        pages.map(page => ({
          id: page.id,
          pageNumber: page.pageNumber,
          title: page.scriptSnippet || `Page ${page.pageNumber}`,
          layoutTemplate: page.layoutTemplate,
          backgroundImageUrl: page.backgroundImageUrl || undefined,
        })),
        allPanels.map(panel => ({
          id: panel.id,
          pageId: panel.pageId,
          panelNumber: panel.panelNumber,
          imageUrl: panel.imageUrl || '',
          action: panel.prompt || `Panel ${panel.panelNumber}`,
        })),
        generatedImagesMap,
        generatedBackgroundsMap,
        pageBackgroundsMap,
        project.title
      );

      toast({
        title: "Export successful!",
        description: `Your comic "${project.title}" has been exported as PDF with ${pages.length} pages.`,
      });
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: "Export failed",
        description: "There was an error exporting your comic. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Show loading state while project data is being fetched
  if (isProjectLoading || !projectId) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation onToggleSidebar={() => {}} showMobileToggle={true} />
        <div className="flex min-h-[calc(100vh-64px)]">
          <div className="flex-1 flex flex-col">
            {/* Cool Comic Editor Loading Skeleton */}
            <div className="bg-card border-b border-border px-4 sm:px-6 py-3 sm:py-4">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-muted rounded-lg animate-pulse" />
                <div className="space-y-2">
                  <div className="h-6 bg-muted rounded w-32 animate-pulse" />
                  <div className="h-4 bg-muted rounded w-24 animate-pulse" />
                </div>
                <div className="ml-auto flex space-x-2">
                  <div className="w-20 h-8 bg-muted rounded animate-pulse" />
                  <div className="w-20 h-8 bg-muted rounded animate-pulse" />
                </div>
              </div>
            </div>
            <div className="flex-1 p-6">
              <div className="max-w-4xl mx-auto">
                {/* Comic Page Loading Skeleton */}
                <div className="bg-white rounded-xl shadow-lg border-4 border-gray-200 aspect-[3/4] relative overflow-hidden">
                  <div className="absolute inset-4 grid grid-cols-2 gap-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div
                        key={i}
                        className={`bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg border-2 border-dashed border-gray-300 relative overflow-hidden
                          ${i === 1 ? 'col-span-2' : ''}
                          ${i === 6 ? 'col-span-2' : ''}
                        `}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full animate-[shimmer_2s_infinite] transform" />
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center space-y-2 opacity-60">
                            <div className="w-8 h-8 bg-gray-300 rounded-full mx-auto animate-pulse" />
                            <div className="h-2 bg-gray-300 rounded w-16 animate-pulse" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Comic Book Style Loading Text */}
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="bg-white/90 rounded-lg p-3 border border-gray-200">
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 bg-blue-400 rounded-full animate-bounce" />
                        <div className="w-4 h-4 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}} />
                        <div className="w-4 h-4 bg-pink-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}} />
                        <span className="text-sm font-medium text-gray-600 ml-2">Loading your comic studio...</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state only if loading is complete and no project found
  if (!project && !isProjectLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-2">Project not found</h1>
          <Button onClick={() => setLocation("/")} data-testid="button-back-home">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" style={{ paddingTop: 'var(--safe-top)' }}>
      <Navigation 
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} 
        showMobileToggle={true}
        showDesktopToggle={false}
        sidebarOpen={!sidebarCollapsed}
      />
      
      <div className="flex min-h-[calc(100vh-64px)]">
        <Sidebar 
          isOpen={sidebarOpen} 
          onClose={() => setSidebarOpen(false)}
          allPagesData={[]}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebarCollapse}
        />
        
        {/* Editor Header */}
        <div className={`flex-1 flex flex-col w-full lg:w-auto transition-all duration-300 ${sidebarCollapsed ? 'md:pl-20' : 'md:pl-64'}`}>
          <header className="bg-card border-b border-border px-4 sm:px-6 py-3 sm:py-4" role="banner">
            {/* Mobile Layout: Two Rows */}
            <div className="block sm:hidden">
              {/* Top Row: Back Button + Title */}
              <div className="flex items-center space-x-2 mb-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setLocation("/")}
                  className="min-h-[36px] w-[36px] p-2 flex-shrink-0"
                  aria-label="Back to dashboard"
                  data-testid="button-back-dashboard"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                </Button>
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg font-semibold truncate leading-tight">{project?.title || 'Comic Editor'}</h1>
                  <p className="text-xs text-muted-foreground leading-tight">
                    Page {currentPageIndex + 1} of {Math.max(pages.length, 1)}
                  </p>
                </div>
              </div>
              
              {/* Bottom Row: Action Buttons */}
              <div className="flex items-center justify-between space-x-1">
                <div className="flex items-center space-x-1">
                  <Button 
                    variant="ghost"
                    size="sm"
                    onClick={() => setPanelEditorOpen(true)}
                    className="min-h-[36px] w-[36px] p-2"
                    aria-label="Open panel editor"
                    data-testid="button-mobile-panel-editor"
                  >
                    <Edit className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button 
                    variant="secondary"
                    size="sm"
                    onClick={() => saveProjectMutation.mutate()}
                    disabled={saveProjectMutation.isPending}
                    className="min-h-[36px] px-3"
                    data-testid="button-save"
                  >
                    <Save className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button 
                    size="sm"
                    className="min-h-[36px] px-3"
                    onClick={handleExportComic}
                    disabled={isExporting}
                    data-testid="button-export"
                  >
                    {isExporting ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Download className="h-4 w-4" aria-hidden="true" />
                    )}
                  </Button>
                </div>
                
                <div className="flex items-center space-x-1">
                  {/* Public/Private Toggle - Compact */}
                  <div className="flex items-center space-x-1">
                    {project?.isPublic ? (
                      <Globe className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    )}
                    <Switch
                      id="project-public-toggle"
                      checked={project?.isPublic || false}
                      onCheckedChange={(checked) => {
                        if (project) {
                          // Update project visibility
                          apiRequest("PUT", "/api/projects/" + project.id, {
                            ...project,
                            isPublic: checked
                          }).then(() => {
                            queryClient.invalidateQueries({ queryKey: [`/api/projects/${project.id}`] });
                            toast({
                              title: checked ? "Project is now public" : "Project is now private",
                              description: checked ? "Others can now discover and view your comic" : "Your comic is now private"
                            });
                          });
                        }
                      }}
                      disabled={false}
                      className="scale-75"
                      data-testid="switch-project-public"
                    />
                  </div>

                  {/* Share Button */}
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => setShowShareDialog(true)}
                    className="min-h-[36px] px-3"
                    data-testid="button-share"
                  >
                    <Share className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Desktop Layout: Single Row */}
            <div className="hidden sm:flex items-center justify-between">
              <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setLocation("/")}
                  className="min-h-[44px] w-[44px] p-2"
                  aria-label="Back to dashboard"
                  data-testid="button-back-dashboard"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                </Button>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl font-semibold truncate">{project?.title || 'Comic Editor'}</h1>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Page {currentPageIndex + 1} of {Math.max(pages.length, 1)}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
                <Button 
                  variant="secondary"
                  size="default"
                  onClick={() => saveProjectMutation.mutate()}
                  disabled={saveProjectMutation.isPending}
                  className="min-h-[44px]"
                  data-testid="button-save"
                >
                  <Save className="mr-2 h-4 w-4" aria-hidden="true" />
                  <span>Save</span>
                </Button>
                <Button 
                  size="default"
                  className="min-h-[44px]"
                  onClick={handleExportComic}
                  disabled={isExporting}
                  data-testid="button-export"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                      <span>Exporting...</span>
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                      <span>Export</span>
                    </>
                  )}
                </Button>
                
                {/* Public/Private Toggle */}
                <div className="flex items-center space-x-2 pl-2 border-l border-border">
                  <Label htmlFor="project-public-toggle" className="sr-only">
                    Make project public
                  </Label>
                  <div className="flex items-center space-x-1">
                    {project?.isPublic ? (
                      <Globe className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    )}
                    <Switch
                      id="project-public-toggle"
                      checked={project?.isPublic || false}
                      onCheckedChange={(checked) => {
                        if (project) {
                          // Update project visibility
                          apiRequest("PUT", "/api/projects/" + project.id, {
                            ...project,
                            isPublic: checked
                          }).then(() => {
                            queryClient.invalidateQueries({ queryKey: [`/api/projects/${project.id}`] });
                            toast({
                              title: checked ? "Project is now public" : "Project is now private",
                              description: checked ? "Others can now discover and view your comic" : "Your comic is now private"
                            });
                          });
                        }
                      }}
                      disabled={false}
                      className="scale-100"
                      data-testid="switch-project-public"
                    />
                  </div>
                  <span className="hidden lg:inline text-xs text-muted-foreground">
                    {project?.isPublic ? 'Public' : 'Private'}
                  </span>
                </div>

                {/* Share Button */}
                <Button 
                  variant="outline"
                  size="default"
                  onClick={() => setShowShareDialog(true)}
                  className="min-h-[44px]"
                  data-testid="button-share"
                >
                  <Share className="mr-2 h-4 w-4" aria-hidden="true" />
                  <span>Share</span>
                </Button>
              </div>
            </div>
          </header>

          <div className="flex flex-1 overflow-hidden">
            {/* Main Editor Area */}
            <main 
              className="flex-1 p-4 sm:p-6 overflow-y-auto" 
              style={{ paddingBottom: 'calc(1rem + var(--safe-bottom))' }}
              role="main"
              aria-label="Comic page editor"
            >
              <div className="max-w-4xl mx-auto">
                {/* Tab Navigation */}
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "editor" | "script" | "animate")} className="w-full">
                  <TabsList className="grid w-full grid-cols-3 mb-6">
                    <TabsTrigger value="editor" className="flex items-center gap-2" data-testid="tab-editor">
                      <Layout className="h-4 w-4" />
                      Page Editor
                    </TabsTrigger>
                    <TabsTrigger value="script" className="flex items-center gap-2" data-testid="tab-script">
                      <FileText className="h-4 w-4" />
                      Script View
                    </TabsTrigger>
                    <TabsTrigger value="animate" className="flex items-center gap-2" data-testid="tab-animate">
                      <Zap className="h-4 w-4" />
                      Animate
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="editor" className="space-y-4 sm:space-y-6">
                    {/* Page Canvas */}
                    <section className="mb-4 sm:mb-6" aria-labelledby="canvas-heading">
                      <h2 id="canvas-heading" className="sr-only">Comic Page Canvas</h2>
                      <div 
                        className="bg-white rounded-xl shadow-lg p-4 sm:p-8 w-full" 
                        style={{ 
                          aspectRatio: isMobile ? "0.85" : "8.5/11",
                          minHeight: isMobile ? "85vh" : "auto",
                          backgroundImage: pageBackground ? `url(${pageBackground})` : undefined,
                          ...getOptimalImageCSS(getPageAspectRatio(isMobile))
                        }}
                      >
                        <ComicPageLayout 
                          layoutId={currentLayout}
                          generatedImages={generatedImages}
                          generatedBackgrounds={generatedBackgrounds}
                          selectedPanel={selectedPanel}
                          onPanelClick={(panelId) => {
                            setSelectedPanel(panelId);
                            if (isMobile) {
                              setPanelEditorOpen(true);
                            }
                          }}
                          onImageUpdate={(panelId, imageUrl) => {
                            setGeneratedImages(prev => ({ ...prev, [panelId]: imageUrl }));
                          }}
                          onBackgroundUpdate={(panelId, backgroundUrl) => {
                            setGeneratedBackgrounds(prev => ({ ...prev, [panelId]: backgroundUrl }));
                          }}
                        />
                      </div>
                    </section>
                  </TabsContent>

                  <TabsContent value="script" className="space-y-4">
                    <StructuredScriptViewer 
                      projectId={projectId!} 
                      currentPageNumber={currentPageIndex + 1}
                    />
                  </TabsContent>

                  <TabsContent value="animate" className="space-y-4">
                    <div className="flex items-center justify-center min-h-[400px]">
                      <div className="text-center max-w-md mx-auto p-8">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 flex items-center justify-center">
                          <Zap className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">Panel Animation Studio</h3>
                        <p className="text-muted-foreground mb-4">
                          Bring your comic panels to life with smooth transitions, character movement, and dynamic effects.
                        </p>
                        <div className="inline-flex items-center px-3 py-1.5 rounded-full bg-muted text-sm text-muted-foreground">
                          <Zap className="h-3 w-3 mr-1" />
                          Coming Soon!
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                {/* Page Controls - Only show in editor tab */}
                {activeTab === "editor" && (
                  <section aria-labelledby="page-controls-heading">
                    <h2 id="page-controls-heading" className="sr-only">Page Controls</h2>
                    <Card className="border-border">
                      <CardContent className="p-3 sm:p-4">
                        <div className={`${isMobile ? 'space-y-3' : 'flex items-center justify-between'}`}>
                          {/* Page Navigation */}
                          <div className="flex items-center justify-center space-x-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              disabled={currentPageIndex === 0}
                              onClick={() => setCurrentPageIndex(Math.max(0, currentPageIndex - 1))}
                              className="min-h-[44px] w-[44px] p-2"
                              aria-label="Previous page"
                              data-testid="button-prev-page"
                            >
                              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                            </Button>
                            <span className="text-sm font-medium px-2">Page {currentPageIndex + 1}</span>
                            {currentPageIndex >= pages.length - 1 ? (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => createPageMutation.mutate()}
                                disabled={createPageMutation.isPending}
                                className="min-h-[44px] w-[44px] p-2"
                                aria-label="Add new page"
                                data-testid="button-new-page"
                              >
                                {createPageMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                ) : (
                                  <Plus className="h-4 w-4" aria-hidden="true" />
                                )}
                              </Button>
                            ) : (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setCurrentPageIndex(Math.min(pages.length - 1, currentPageIndex + 1))}
                                className="min-h-[44px] w-[44px] p-2"
                                aria-label="Next page"
                                data-testid="button-next-page"
                              >
                                <ChevronRight className="h-4 w-4" aria-hidden="true" />
                              </Button>
                            )}
                            {/* Play/Read Button */}
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setShowComicReader(true)}
                              className="min-h-[44px] w-[44px] p-2 ml-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                              aria-label="Read comic"
                              data-testid="button-read-comic"
                              title="Read comic in full-screen mode"
                            >
                              <Play className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          </div>
                        
                        {/* Action Buttons - Improved Responsive Layout */}
                        <div className="space-y-3">
                          {/* Primary Actions Row */}
                          <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
                            <Button 
                              className="bg-chart-1 text-white hover:bg-chart-1/90 min-h-[44px] flex-shrink-0"
                              onClick={() => generatePageMutation.mutate()}
                              disabled={isGeneratingFullPage}
                              data-testid="button-generate-page"
                            >
                              {isGeneratingFullPage ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                                  <span className="whitespace-nowrap">Generating...</span>
                                </>
                              ) : (
                                <>
                                  <Wand2 className="mr-2 h-4 w-4" aria-hidden="true" />
                                  <span className="whitespace-nowrap">Generate Full Page</span>
                                </>
                              )}
                            </Button>
                            <Button 
                              variant="secondary" 
                              onClick={() => setShowLayoutModal(true)}
                              className="min-h-[44px] flex-shrink-0"
                              data-testid="button-change-layout"
                            >
                              <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M3 3h18v18H3V3zm16 16V5H5v14h14zM7 7h2v2H7V7zm4 0h2v2h-2V7zm4 0h2v2h-2V7zM7 11h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zM7 15h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2z"/>
                              </svg>
                              <span className="whitespace-nowrap">Change Layout</span>
                            </Button>
                          </div>
                          
                          {/* Secondary Actions Row */}
                          <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
                            <Button 
                              variant="outline"
                              onClick={() => generateBackgroundForPageMutation.mutate()}
                              disabled={generateBackgroundForPageMutation.isPending}
                              className="min-h-[44px] bg-gradient-to-r from-emerald-50 to-cyan-50 dark:from-emerald-900/20 dark:to-cyan-900/20 border-emerald-200 dark:border-emerald-700 hover:from-emerald-100 hover:to-cyan-100 dark:hover:from-emerald-800/30 dark:hover:to-cyan-800/30 font-medium text-emerald-700 dark:text-emerald-300 flex-shrink-0"
                              data-testid="button-generate-page-background"
                            >
                              <Cloud className="mr-2 h-4 w-4" aria-hidden="true" />
                              {generateBackgroundForPageMutation.isPending ? (
                                <span className="whitespace-nowrap">Creating Background...</span>
                              ) : (
                                <span className="whitespace-nowrap">🎨 Generate Background</span>
                              )}
                            </Button>
                            {pages && pages.length > 1 && (
                              <Button 
                                variant="destructive"
                                onClick={() => setShowDeleteConfirm(true)}
                                className="min-h-[44px] flex-shrink-0"
                                data-testid="button-delete-page"
                              >
                                <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                                <span className="whitespace-nowrap">Delete Page</span>
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </section>
                )}
              </div>
            </main>

            {/* Panel Editor - Desktop Right Sidebar / Mobile Bottom Sheet */}
            <PanelEditor 
              selectedPanel={selectedPanel} 
              project={project || {} as any}
              currentPage={currentPage}
              currentLayout={currentLayout}
              onImageGenerated={(panelId, imageUrl) => {
                setGeneratedImages(prev => ({ ...prev, [panelId]: imageUrl }));
              }}
              onBackgroundGenerated={(panelId, backgroundUrl) => {
                setGeneratedBackgrounds(prev => ({ ...prev, [panelId]: backgroundUrl }));
              }}
              generatedBackground={selectedPanel ? generatedBackgrounds[selectedPanel] : undefined}
              isOpen={isMobile ? panelEditorOpen : true}
              onClose={isMobile ? () => setPanelEditorOpen(false) : undefined}
              isMobile={isMobile}
            />
          </div>
        </div>
      </div>
      
      {/* Layout Change Modal */}
      <LayoutChangeModal 
        open={showLayoutModal}
        onClose={() => setShowLayoutModal(false)}
        currentLayout={currentLayout}
        onLayoutChange={handleLayoutChange}
      />

      {/* Delete Page Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete This Page?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete Page {(currentPage?.pageNumber || currentPageIndex + 1)} and all its content including generated panels and artwork. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deletePageMutation.mutate();
                setShowDeleteConfirm(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="confirm-delete-page"
            >
              Delete Page
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Comic Reader Modal */}
      {showComicReader && (
        <ComicReader
          pages={pages.map(page => ({
            id: page.id,
            pageNumber: page.pageNumber,
            title: page.scriptSnippet || `Page ${page.pageNumber}`,
            layoutTemplate: page.layoutTemplate,
            backgroundImageUrl: page.backgroundImageUrl || undefined,
          }))}
          panels={panels.map(panel => ({
            id: panel.id,
            pageId: panel.pageId,
            panelNumber: panel.panelNumber,
            imageUrl: panel.imageUrl || '',
            action: panel.prompt || `Panel ${panel.panelNumber}`,
          }))}
          currentPageIndex={currentPageIndex}
          onPageChange={setCurrentPageIndex}
          onClose={() => setShowComicReader(false)}
          projectTitle={project?.title}
        />
      )}

      {/* Share Dialog */}
      <ShareDialog 
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        project={project || null}
      />
    </div>
  );
}
