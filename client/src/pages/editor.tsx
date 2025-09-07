import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useParams, useLocation } from "wouter";
import Navigation from "@/components/navigation";
import Sidebar from "@/components/sidebar";
import PanelEditor from "@/components/panel-editor";
import LayoutChangeModal from "@/components/layout-change-modal";
import ComicPageLayout from "@/components/comic-page-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Save, Download, ChevronLeft, ChevronRight, Wand2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { aiService } from "@/lib/ai-service";
import { comicLayouts } from "@/lib/comic-layouts";
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
  const [isGeneratingFullPage, setIsGeneratingFullPage] = useState(false);

  const { data: project } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
    enabled: !!projectId,
  });

  const { data: pages = [] } = useQuery<Page[]>({
    queryKey: ["/api/projects", projectId, "pages"],
    enabled: !!projectId,
  });

  const currentPage = pages[currentPageIndex];

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

  const generatePageMutation = useMutation({
    mutationFn: async () => {
      if (!project) throw new Error("No project available");
      
      setIsGeneratingFullPage(true);
      const layout = comicLayouts.find(l => l.id === currentLayout);
      if (!layout) throw new Error("Layout not found");
      
      // Create panel descriptions based on project script or generate them
      const panelDescriptions = [];
      for (let i = 1; i <= layout.panelCount; i++) {
        panelDescriptions.push({
          panelNumber: i,
          description: `Panel ${i}: Scene continues from the story of ${project.title}. ${project.description || 'Continue the narrative flow.'}`,
        });
      }
      
      const result = await aiService.generateFullPage(
        {
          title: project.title,
          genre: project.genre,
          description: project.description,
          artStyle: project.artStyle,
        },
        project.description || "",
        panelDescriptions
      );
      
      // Update local state with generated images
      const imageMap: {[key: number]: string} = {};
      result.forEach((panelResult, index) => {
        if (panelResult.status === "completed" && panelResult.imageUrl) {
          imageMap[index + 1] = panelResult.imageUrl;
        }
      });
      setGeneratedImages(prev => ({ ...prev, ...imageMap }));
      
      return result;
    },
    onSuccess: (result) => {
      const successCount = result.filter(r => r.status === "completed").length;
      toast({
        title: "Page Generated!",
        description: `Successfully generated ${successCount} of ${result.length} panels.`,
      });
      setIsGeneratingFullPage(false);
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
    toast({
      title: "Layout Changed",
      description: "Comic layout has been updated. Generate images to see the new layout.",
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
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="flex h-[calc(100vh-64px)]">
        <Sidebar />
        
        {/* Editor Header */}
        <div className="flex-1 flex flex-col">
          <div className="bg-card border-b border-border px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setLocation("/")}
                data-testid="button-back-dashboard"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold">{project.title}</h1>
                <p className="text-sm text-muted-foreground">
                  Page {currentPageIndex + 1} of {Math.max(pages.length, 1)}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button 
                variant="secondary"
                onClick={() => saveProjectMutation.mutate()}
                disabled={saveProjectMutation.isPending}
                data-testid="button-save"
              >
                <Save className="mr-2 h-4 w-4" />
                Save
              </Button>
              <Button data-testid="button-export">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Page Editor */}
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="max-w-4xl mx-auto">
                {/* Page Canvas */}
                <div className="bg-white rounded-xl shadow-lg p-8 mb-6" style={{ aspectRatio: "8.5/11" }}>
                  {/* Dynamic Comic Page Layout */}
                  <ComicPageLayout 
                    layoutId={currentLayout}
                    generatedImages={generatedImages}
                    selectedPanel={selectedPanel}
                    onPanelClick={setSelectedPanel}
                    onImageUpdate={(panelId, imageUrl) => {
                      setGeneratedImages(prev => ({ ...prev, [panelId]: imageUrl }));
                    }}
                  />
                </div>

                {/* Page Controls */}
                <Card className="border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          disabled={currentPageIndex === 0}
                          onClick={() => setCurrentPageIndex(Math.max(0, currentPageIndex - 1))}
                          data-testid="button-prev-page"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm font-medium">Page {currentPageIndex + 1}</span>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          disabled={currentPageIndex >= pages.length - 1}
                          onClick={() => setCurrentPageIndex(Math.min(pages.length - 1, currentPageIndex + 1))}
                          data-testid="button-next-page"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button 
                          className="bg-chart-1 text-white hover:bg-chart-1/90"
                          onClick={() => generatePageMutation.mutate()}
                          disabled={isGeneratingFullPage}
                          data-testid="button-generate-page"
                        >
                          {isGeneratingFullPage ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Wand2 className="mr-2 h-4 w-4" />
                              Generate Full Page
                            </>
                          )}
                        </Button>
                        <Button 
                          variant="secondary" 
                          onClick={() => setShowLayoutModal(true)}
                          data-testid="button-change-layout"
                        >
                          <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M3 3h18v18H3V3zm16 16V5H5v14h14zM7 7h2v2H7V7zm4 0h2v2h-2V7zm4 0h2v2h-2V7zM7 11h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zM7 15h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2z"/>
                          </svg>
                          Change Layout
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Right Sidebar - Panel Editor */}
            <PanelEditor 
              selectedPanel={selectedPanel} 
              project={project}
              currentPage={currentPage}
              onImageGenerated={(panelId, imageUrl) => {
                setGeneratedImages(prev => ({ ...prev, [panelId]: imageUrl }));
              }}
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
    </div>
  );
}
