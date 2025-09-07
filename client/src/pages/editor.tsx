import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useParams, useLocation } from "wouter";
import Navigation from "@/components/navigation";
import Sidebar from "@/components/sidebar";
import PanelEditor from "@/components/panel-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Save, Download, ChevronLeft, ChevronRight, Wand2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Project, Page, Panel } from "@shared/schema";

export default function Editor() {
  const { projectId } = useParams<{ projectId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPanel, setSelectedPanel] = useState<number | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

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
      // This would integrate with Nano Banana API
      await apiRequest("POST", "/api/generate-image", {
        prompt: "Generate full page layout",
        panelId: "full-page",
        projectContext: project,
      });
    },
    onSuccess: () => {
      toast({
        title: "Page generated",
        description: "AI has generated images for all panels on this page.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/pages", currentPage?.id, "panels"] });
    },
  });

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
                  {/* Comic Page Layout - 6 Panel Grid */}
                  <div className="w-full h-full grid grid-cols-3 grid-rows-3 gap-3">
                    {/* Panel 1 - Large hero panel */}
                    <div 
                      className={`comic-panel col-span-2 row-span-1 bg-gradient-to-br from-chart-1/10 to-chart-2/10 rounded-lg flex items-center justify-center relative ${selectedPanel === 1 ? 'selected' : ''}`}
                      onClick={() => setSelectedPanel(1)}
                      data-testid="panel-1"
                    >
                      <div className="w-full h-full flex items-center justify-center">
                        <p className="text-xs text-muted-foreground">Panel 1 - Click to generate</p>
                      </div>
                    </div>
                    
                    {/* Panel 2 - Character close-up */}
                    <div 
                      className={`comic-panel bg-gradient-to-br from-chart-3/10 to-chart-4/10 rounded-lg flex items-center justify-center relative ${selectedPanel === 2 ? 'selected' : ''}`}
                      onClick={() => setSelectedPanel(2)}
                      data-testid="panel-2"
                    >
                      <div className="w-full h-full flex items-center justify-center">
                        <p className="text-xs text-muted-foreground">Panel 2</p>
                      </div>
                    </div>

                    {/* Panel 3 - Action sequence */}
                    <div 
                      className={`comic-panel bg-gradient-to-br from-chart-5/10 to-destructive/10 rounded-lg flex items-center justify-center relative ${selectedPanel === 3 ? 'selected' : ''}`}
                      onClick={() => setSelectedPanel(3)}
                      data-testid="panel-3"
                    >
                      <div className="w-full h-full flex items-center justify-center">
                        <p className="text-xs text-muted-foreground">Panel 3</p>
                      </div>
                    </div>

                    {/* Panel 4 - Team assembly */}
                    <div 
                      className={`comic-panel col-span-2 bg-gradient-to-br from-chart-2/10 to-chart-4/10 rounded-lg flex items-center justify-center ${selectedPanel === 4 ? 'selected' : ''}`}
                      onClick={() => setSelectedPanel(4)}
                      data-testid="panel-4"
                    >
                      <div className="w-full h-full flex items-center justify-center">
                        <p className="text-xs text-muted-foreground">Panel 4</p>
                      </div>
                    </div>

                    {/* Panel 5 - Dialogue */}
                    <div 
                      className={`comic-panel bg-muted rounded-lg flex items-center justify-center ${selectedPanel === 5 ? 'selected' : ''}`}
                      onClick={() => setSelectedPanel(5)}
                      data-testid="panel-5"
                    >
                      <div className="text-center p-4">
                        <p className="text-xs text-muted-foreground">Panel 5 - Click to generate</p>
                      </div>
                    </div>

                    {/* Panel 6 - Final panel */}
                    <div 
                      className={`comic-panel bg-gradient-to-br from-chart-1/10 to-chart-3/10 rounded-lg flex items-center justify-center ${selectedPanel === 6 ? 'selected' : ''}`}
                      onClick={() => setSelectedPanel(6)}
                      data-testid="panel-6"
                    >
                      <div className="w-full h-full flex items-center justify-center">
                        <p className="text-xs text-muted-foreground">Panel 6</p>
                      </div>
                    </div>
                  </div>
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
                          disabled={generatePageMutation.isPending}
                          data-testid="button-generate-page"
                        >
                          <Wand2 className="mr-2 h-4 w-4" />
                          {generatePageMutation.isPending ? "Generating..." : "Generate Full Page"}
                        </Button>
                        <Button variant="secondary" data-testid="button-change-layout">
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
            />
          </div>
        </div>
      </div>
    </div>
  );
}
