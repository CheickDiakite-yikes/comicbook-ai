import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import Navigation from "@/components/navigation";
import Sidebar from "@/components/sidebar";
import PanelEditor from "@/components/panel-editor";
import LayoutChangeModal from "@/components/layout-change-modal";
import ComicPageLayout from "@/components/comic-page-layout";
import StructuredScriptViewer from "@/components/structured-script-viewer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowLeft, Save, Download, ChevronLeft, ChevronRight, Wand2, Loader2, Plus, Edit, Trash2, Cloud, FileText, Layout } from "lucide-react";
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
  const [panelEditorOpen, setPanelEditorOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<"editor" | "script">("editor");
  
  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const { data: project } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
    enabled: !!projectId,
  });

  const { data: pages = [] } = useQuery<Page[]>({
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
              imageMap[panel.panelNumber] = panel.imageUrl;
            }
          });
          
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
        
        if (structuredScript?.pages) {
          const scriptPage = structuredScript.pages.find((p: any) => p.pageNumber === pageToUse.pageNumber);
          if (scriptPage?.panels) {
            const scriptPanel = scriptPage.panels.find((p: any) => p.panelNumber === i);
            if (scriptPanel) {
              // Use rich metadata from structured script
              description = `${scriptPanel.sceneDescription || scriptPanel.visualDescription}. Camera: ${scriptPanel.cameraAngle}. Shot: ${scriptPanel.shotType}. Mood: ${scriptPanel.mood}`;
              if (scriptPanel.characters?.length > 0) {
                description += `. Characters: ${scriptPanel.characters.join(", ")}`;
              }
              if (scriptPanel.visualNotes) {
                description += `. Visual notes: ${scriptPanel.visualNotes}`;
              }
            }
          }
        }
        
        panelsWithContext.push({
          panelNumber: i,
          description: description,
          panelContext: panelContext,
          layoutInfo: panel
        });
      }
      
      const result = await aiService.generateFullPage(
        {
          title: project.title,
          genre: project.genre || undefined,
          description: project.description || undefined,
          artStyle: project.artStyle || undefined,
        },
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
      toast({
        title: "Generation Failed",
        description: "Failed to generate full page. Please try again.",
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

  if (!project) {
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
      />
      
      <div className="flex min-h-[calc(100vh-64px)]">
        <Sidebar 
          isOpen={sidebarOpen} 
          onClose={() => setSidebarOpen(false)} 
        />
        
        {/* Editor Header */}
        <div className="flex-1 flex flex-col w-full lg:w-auto">
          <header className="bg-card border-b border-border px-4 sm:px-6 py-3 sm:py-4" role="banner">
            <div className="flex items-center justify-between">
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
                {isMobile && (
                  <Button 
                    variant="ghost"
                    size="sm"
                    onClick={() => setPanelEditorOpen(true)}
                    className="min-h-[44px] w-[44px] p-2 lg:hidden"
                    aria-label="Open panel editor"
                    data-testid="button-mobile-panel-editor"
                  >
                    <Edit className="h-4 w-4" aria-hidden="true" />
                  </Button>
                )}
                <Button 
                  variant="secondary"
                  size={isMobile ? "sm" : "default"}
                  onClick={() => saveProjectMutation.mutate()}
                  disabled={saveProjectMutation.isPending}
                  className="min-h-[44px]"
                  data-testid="button-save"
                >
                  <Save className="mr-1 sm:mr-2 h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Save</span>
                </Button>
                <Button 
                  size={isMobile ? "sm" : "default"}
                  className="min-h-[44px]"
                  data-testid="button-export"
                >
                  <Download className="mr-1 sm:mr-2 h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Export</span>
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
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "editor" | "script")} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="editor" className="flex items-center gap-2" data-testid="tab-editor">
                      <Layout className="h-4 w-4" />
                      Page Editor
                    </TabsTrigger>
                    <TabsTrigger value="script" className="flex items-center gap-2" data-testid="tab-script">
                      <FileText className="h-4 w-4" />
                      Script View
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
                    <StructuredScriptViewer projectId={projectId!} />
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
    </div>
  );
}
