import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wand2, RotateCcw, MessageSquare, Cloud, Palette, BookOpen, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { calculatePanelAspectRatio, determinePanelType } from "@/lib/ai-service";
import { comicLayouts } from "@/lib/comic-layouts";
import type { Project, Page } from "@shared/schema";

interface PanelEditorProps {
  selectedPanel: number | null;
  project: Project;
  currentPage?: Page;
  currentLayout: string;
  onImageGenerated?: (panelId: number, imageUrl: string) => void;
  onBackgroundGenerated?: (panelId: number, backgroundUrl: string) => void;
  generatedBackground?: string;
  isOpen?: boolean;
  onClose?: () => void;
  isMobile?: boolean;
}

export default function PanelEditor({ 
  selectedPanel, 
  project, 
  currentPage, 
  currentLayout, 
  onImageGenerated, 
  onBackgroundGenerated,
  generatedBackground,
  isOpen = true, 
  onClose, 
  isMobile = false 
}: PanelEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState("A superhero flies over a bustling city at sunset, cape flowing in the wind...");
  const [dialogueText, setDialogueText] = useState("");
  const [artStyle, setArtStyle] = useState("Comic Book (Classic)");
  const [isGeneratingBackground, setIsGeneratingBackground] = useState(false);

  const generatePanelMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPanel) throw new Error("No panel selected");
      
      // Get panel context for size-aware generation
      const layout = comicLayouts.find(l => l.id === currentLayout);
      let panelContext = undefined;
      
      if (layout && selectedPanel <= layout.panels.length) {
        const panel = layout.panels[selectedPanel - 1];
        const aspectRatio = calculatePanelAspectRatio(panel.width, panel.height);
        const panelType = determinePanelType(aspectRatio);
        
        panelContext = {
          layoutTemplate: currentLayout,
          panelNumber: selectedPanel,
          aspectRatio,
          dimensions: {
            width: panel.width,
            height: panel.height
          },
          panelType
        };
      }
      
      const response = await apiRequest("POST", "/api/generate-image", {
        prompt,
        panelId: selectedPanel,
        projectContext: {
          title: project.title,
          genre: project.genre,
          description: project.description,
          artStyle: project.artStyle,
        },
        characterContext: [], // Would be populated from project characters
        styleOptions: {
          artStyle: artStyle,
        },
        panelContext,
      });
      
      return response as any;
    },
    onSuccess: async (result: any) => {
      if (result.status === "completed" && result.imageUrl && selectedPanel && currentPage) {
        // Save image to database
        try {
          // First check if panel exists, if not create it
          const panelsResponse = await fetch(`/api/pages/${currentPage.id}/panels`);
          const panels = await panelsResponse.json();
          const existingPanel = panels.find((p: any) => p.panelNumber === selectedPanel);
          
          if (existingPanel) {
            // Update existing panel
            await apiRequest("PUT", `/api/panels/${existingPanel.id}`, {
              imageUrl: result.imageUrl,
              prompt: prompt,
              isGenerated: true,
              generationStatus: "completed"
            });
            console.log("Panel updated successfully:", existingPanel.id);
          } else {
            // Create new panel
            const newPanel = await apiRequest("POST", `/api/pages/${currentPage.id}/panels`, {
              panelNumber: selectedPanel,
              imageUrl: result.imageUrl,
              prompt: prompt,
              isGenerated: true,
              generationStatus: "completed"
            });
            console.log("New panel created successfully:", newPanel);
          }
          
          // Update client state
          if (onImageGenerated) {
            onImageGenerated(selectedPanel, result.imageUrl);
          }
          
          console.log("Panel saved to database successfully");
        } catch (error) {
          console.error("Failed to save panel to database:", error);
          toast({
            title: "Warning",
            description: "Image generated but failed to save to database.",
            variant: "destructive",
          });
        }
      }
      
      toast({
        title: "Panel generated",
        description: "AI has generated an image for the selected panel.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/pages", currentPage?.id, "panels"] });
    },
    onError: (error) => {
      console.error("Panel generation failed:", error);
      toast({
        title: "Generation failed",
        description: "Failed to generate panel. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Background generation mutation
  const generateBackgroundMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPanel || !project?.id) throw new Error("No panel or project selected");
      
      setIsGeneratingBackground(true);
      
      const layout = comicLayouts.find(l => l.id === currentLayout);
      if (!layout) throw new Error("Layout not found");
      
      const panelData = layout.panels[selectedPanel - 1];
      if (!panelData) throw new Error("Panel data not found");
      
      // Calculate panel context
      const aspectRatio = panelData.width / panelData.height;
      let panelType = "square";
      if (aspectRatio > 1.5) panelType = "wide-cinematic";
      else if (aspectRatio < 0.7) panelType = "tall-vertical";
      
      const result = await apiRequest("POST", "/api/generate-background", {
        panelId: selectedPanel,
        projectId: project.id,
        panelContext: {
          aspectRatio,
          panelType
        }
      });
      
      return result;
    },
    onSuccess: (result: any) => {
      if (result.status === "completed" && result.imageUrl && onBackgroundGenerated) {
        onBackgroundGenerated(selectedPanel!, result.imageUrl);
        toast({
          title: "Background Generated!",
          description: "Panel background has been created successfully.",
        });
      } else {
        throw new Error(result.error || "Failed to generate background");
      }
      setIsGeneratingBackground(false);
    },
    onError: (error) => {
      console.error("Background generation failed:", error);
      toast({
        title: "Background Generation Failed",
        description: "Failed to generate background. Please try again.",
        variant: "destructive",
      });
      setIsGeneratingBackground(false);
    },
  });

  const regeneratePanelMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPanel) throw new Error("No panel selected");
      
      const response = await apiRequest("POST", "/api/generate-image", {
        prompt: prompt + " (regeneration)",
        panelId: selectedPanel,
        projectContext: {
          title: project.title,
          genre: project.genre,
          description: project.description,
          artStyle: project.artStyle,
        },
        characterContext: [],
        styleOptions: {
          artStyle: artStyle,
        },
      });
      
      return response.json();
    },
    onSuccess: async (result) => {
      if (result.status === "completed" && result.imageUrl && selectedPanel && currentPage) {
        // Save regenerated image to database
        try {
          const panelsResponse = await fetch(`/api/pages/${currentPage.id}/panels`);
          const panels = await panelsResponse.json();
          const existingPanel = panels.find((p: any) => p.panelNumber === selectedPanel);
          
          if (existingPanel) {
            // Update existing panel
            await apiRequest("PUT", `/api/panels/${existingPanel.id}`, {
              imageUrl: result.imageUrl,
              prompt: prompt + " (regeneration)",
              isGenerated: true,
              generationStatus: "completed"
            });
            console.log("Panel regenerated and updated successfully:", existingPanel.id);
          } else {
            // Create new panel
            const newPanel = await apiRequest("POST", `/api/pages/${currentPage.id}/panels`, {
              panelNumber: selectedPanel,
              imageUrl: result.imageUrl,
              prompt: prompt + " (regeneration)",
              isGenerated: true,
              generationStatus: "completed"
            });
            console.log("New regenerated panel created successfully:", newPanel);
          }
          
          // Update client state
          if (onImageGenerated) {
            onImageGenerated(selectedPanel, result.imageUrl);
          }
          
          console.log("Regenerated panel saved to database successfully");
        } catch (error) {
          console.error("Failed to save regenerated panel to database:", error);
          toast({
            title: "Warning",
            description: "Panel regenerated but failed to save to database.",
            variant: "destructive",
          });
        }
      }
      
      toast({
        title: "Panel regenerated",
        description: "AI has created a new version of the panel.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/pages", currentPage?.id, "panels"] });
    },
    onError: (error) => {
      console.error("Panel regeneration failed:", error);
      toast({
        title: "Regeneration failed",
        description: "Failed to regenerate panel. Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <>
      {/* Mobile Overlay */}
      {isMobile && isOpen && onClose && (
        <div 
          className="panel-editor-overlay open lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      
      {/* Panel Editor */}
      <aside 
        className={`
          bg-card border-l border-border overflow-y-auto
          ${isMobile ? `mobile-panel-editor ${isOpen ? 'open' : ''}` : 'w-80 p-4'}
          ${!isOpen && isMobile ? 'hidden lg:block' : ''}
        `}
        role="complementary"
        aria-label="Panel editing tools"
      >
        <div className={`space-y-6 ${isMobile ? 'p-4 space-y-4' : ''}`}>
          {/* Mobile Header */}
          {isMobile && onClose && (
            <div className="flex justify-between items-center pb-4 border-b border-border lg:hidden">
              <h2 className="font-semibold text-lg">Panel Editor</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="min-h-[44px] w-[44px] p-2"
                aria-label="Close panel editor"
                data-testid="button-close-panel-editor"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </Button>
            </div>
          )}
        {/* Panel Editor */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center">
            <svg className="mr-2 h-5 w-5 text-chart-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 3h18v18H3V3zm16 16V5H5v14h14z"/>
            </svg>
            Panel Editor
            {selectedPanel && (
              <span className="ml-2 text-sm text-muted-foreground">
                (Panel {selectedPanel})
              </span>
            )}
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium block mb-2">Panel Prompt</label>
              <Textarea 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="resize-none" 
                rows={3} 
                placeholder="Describe what happens in this panel..."
                data-testid="textarea-panel-prompt"
              />
            </div>
            <div className="space-y-2">
              {/* Primary Actions Row */}
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  onClick={() => generatePanelMutation.mutate()}
                  disabled={!selectedPanel || generatePanelMutation.isPending || !prompt.trim()}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  data-testid="button-generate-panel"
                >
                  <Wand2 className="mr-1 h-4 w-4" />
                  {generatePanelMutation.isPending ? "Generating..." : "Generate"}
                </Button>
                <Button 
                  variant="secondary"
                  onClick={() => regeneratePanelMutation.mutate()}
                  disabled={!selectedPanel || regeneratePanelMutation.isPending}
                  data-testid="button-regenerate-panel"
                >
                  <RotateCcw className="mr-1 h-4 w-4" />
                  {regeneratePanelMutation.isPending ? "Regenerating..." : "Regenerate"}
                </Button>
              </div>
              
              {/* Background Generation - Full Width for Emphasis */}
              <Button 
                variant="outline"
                onClick={() => generateBackgroundMutation.mutate()}
                disabled={!selectedPanel || isGeneratingBackground || !!generatedBackground}
                className="w-full bg-gradient-to-r from-emerald-50 to-cyan-50 dark:from-emerald-900/20 dark:to-cyan-900/20 border-emerald-200 dark:border-emerald-700 hover:from-emerald-100 hover:to-cyan-100 dark:hover:from-emerald-800/30 dark:hover:to-cyan-800/30 font-medium text-emerald-700 dark:text-emerald-300"
                data-testid="button-generate-background"
              >
                <Cloud className="mr-2 h-4 w-4" />
                {isGeneratingBackground ? "🎨 Creating Background..." : generatedBackground ? "🌟 Background Ready!" : "🎨 Generate Background"}
              </Button>
              
              {/* Helpful tip when no panel is selected */}
              {!selectedPanel && (
                <p className="text-xs text-muted-foreground text-center p-2 bg-muted/50 rounded">
                  👆 Select a panel above to start generating
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Speech Bubbles */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center">
            <MessageSquare className="mr-2 h-5 w-5 text-chart-2" />
            Speech Bubbles
          </h3>
          <div className="space-y-2">
            <Input 
              value={dialogueText}
              onChange={(e) => setDialogueText(e.target.value)}
              placeholder="Add dialogue..." 
              data-testid="input-dialogue"
            />
            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant="outline" 
                size="sm"
                data-testid="button-speech-bubble"
              >
                <MessageSquare className="mr-1 h-3 w-3" />
                Speech
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                data-testid="button-thought-bubble"
              >
                <Cloud className="mr-1 h-3 w-3" />
                Thought
              </Button>
            </div>
          </div>
        </div>

        {/* Style Controls */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center">
            <Palette className="mr-2 h-5 w-5 text-chart-3" />
            Style Controls
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium block mb-2">Art Style</label>
              <Select value={artStyle} onValueChange={setArtStyle}>
                <SelectTrigger data-testid="select-art-style">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Comic Book (Classic)">Comic Book (Classic)</SelectItem>
                  <SelectItem value="Manga">Manga</SelectItem>
                  <SelectItem value="Watercolor">Watercolor</SelectItem>
                  <SelectItem value="Sketch">Sketch</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-2">Color Palette</label>
              <div className="flex space-x-2">
                <div className="w-8 h-8 bg-chart-1 rounded-full cursor-pointer border-2 border-white shadow-sm" data-testid="color-1"></div>
                <div className="w-8 h-8 bg-chart-2 rounded-full cursor-pointer border-2 border-white shadow-sm" data-testid="color-2"></div>
                <div className="w-8 h-8 bg-chart-3 rounded-full cursor-pointer border-2 border-white shadow-sm" data-testid="color-3"></div>
                <div className="w-8 h-8 bg-chart-4 rounded-full cursor-pointer border-2 border-white shadow-sm" data-testid="color-4"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Story Context */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center">
            <BookOpen className="mr-2 h-5 w-5 text-chart-4" />
            Story Context
          </h3>
          <div className="space-y-2 text-sm">
            <Card className="border-border">
              <CardContent className="p-3">
                <p className="font-medium mb-1">Current Scene</p>
                <p className="text-muted-foreground">
                  {project.description || "The story is just beginning. Define your scene by adding a description to your project."}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-3">
                <p className="font-medium mb-1">Active Characters</p>
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="inline-block w-3 h-3 bg-chart-1 rounded-full"></span>
                    <span>Main Character</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="inline-block w-3 h-3 bg-chart-2 rounded-full"></span>
                    <span>Supporting Character</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        </div>
      </aside>
    </>
  );
}
