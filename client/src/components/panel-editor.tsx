import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wand2, RotateCcw, MessageSquare, Cloud, Palette, BookOpen, X, Loader2, User, Shirt } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { comicLayouts } from "@/lib/comic-layouts";
import { generateEnhancedPanelContext, getPanelAspectRatioInfo, calculateOptimalDimensions } from "@/lib/aspect-ratio-utils";
import { EnhancedCharacterCard } from "@/components/enhanced-character-card";
import { RedressModal } from "@/components/redress-modal";
import type { Project, Page, Panel, Character } from "@shared/schema";

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
  const [prompt, setPrompt] = useState("");
  const [dialogueText, setDialogueText] = useState("");
  const [artStyle, setArtStyle] = useState("Comic Book (Classic)");
  const [isGeneratingBackground, setIsGeneratingBackground] = useState(false);
  const [isRedressModalOpen, setIsRedressModalOpen] = useState(false);

  // Fetch existing panels for the current page
  const { data: existingPanels = [], isLoading: panelsLoading } = useQuery<Panel[]>({
    queryKey: ["/api/pages", currentPage?.id, "panels"],
    enabled: !!currentPage?.id,
  });

  // Fetch project characters for context
  const { data: projectCharacters = [], isLoading: charactersLoading } = useQuery<Character[]>({
    queryKey: ["/api/projects", project?.id, "characters"],
    enabled: !!project?.id,
  });

  // Find the current panel data
  const currentPanelData = selectedPanel ? existingPanels.find(p => p.panelNumber === selectedPanel) : null;

  // Auto-populate fields when panel changes or data loads
  useEffect(() => {
    if (selectedPanel && currentPanelData) {
      // Load existing panel data
      setPrompt(currentPanelData.prompt || "");
      
      // Parse speech bubbles if they exist
      if (currentPanelData.speechBubbles && Array.isArray(currentPanelData.speechBubbles)) {
        const bubbles = currentPanelData.speechBubbles as Array<{text: string}>;
        if (bubbles.length > 0) {
          setDialogueText(bubbles[0].text || "");
        }
      }
    } else if (selectedPanel && !currentPanelData && !panelsLoading) {
      // New panel - set smart defaults
      const defaultPrompt = generateDefaultPrompt(selectedPanel, project, currentPage);
      setPrompt(defaultPrompt);
      setDialogueText("");
    }
  }, [selectedPanel, currentPanelData, panelsLoading, project, currentPage]);

  // Generate intelligent default prompt based on context
  const generateDefaultPrompt = (panelNum: number, proj: Project, page?: Page) => {
    const sceneContext = proj.description || "A dramatic scene unfolds";
    const artStyleContext = proj.artStyle || "comic book style";
    const panelPosition = panelNum === 1 ? "opening" : panelNum === 6 ? "closing" : "middle";
    
    return `Panel ${panelNum}: ${sceneContext}. Drawn in ${artStyleContext}. This is the ${panelPosition} panel of the page.`;
  };

  // Auto-save panel data when prompt or dialogue changes
  const autoSavePanelMutation = useMutation({
    mutationFn: async (data: { prompt: string; speechBubbles?: any[] }) => {
      if (!selectedPanel || !currentPage?.id) return;
      
      const speechBubbles = data.speechBubbles || (dialogueText ? [{ text: dialogueText, type: 'speech' }] : []);
      
      if (currentPanelData) {
        // Update existing panel
        return await apiRequest("PUT", `/api/panels/${currentPanelData.id}`, {
          prompt: data.prompt,
          speechBubbles: speechBubbles,
        });
      } else {
        // Create new panel
        return await apiRequest("POST", `/api/pages/${currentPage.id}/panels`, {
          panelNumber: selectedPanel,
          prompt: data.prompt,
          speechBubbles: speechBubbles,
          isGenerated: false,
          generationStatus: "pending"
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages", currentPage?.id, "panels"] });
    },
    onError: (error) => {
      console.error("Auto-save failed:", error);
    },
  });

  // Debounced auto-save effect
  useEffect(() => {
    if (!selectedPanel || panelsLoading) return;
    
    const timeoutId = setTimeout(() => {
      if (prompt.trim()) {
        autoSavePanelMutation.mutate({ 
          prompt, 
          speechBubbles: (currentPanelData?.speechBubbles as any[]) || [] 
        });
      }
    }, 2000); // Auto-save after 2 seconds of inactivity

    return () => clearTimeout(timeoutId);
  }, [prompt, selectedPanel, panelsLoading]);

  // Add speech bubble function
  const addSpeechBubble = (type: 'speech' | 'thought') => {
    if (!dialogueText.trim() || !selectedPanel || !currentPage?.id) return;
    
    const newBubble = { text: dialogueText, type };
    const existingBubbles = currentPanelData?.speechBubbles as Array<{text: string, type: string}> || [];
    const updatedBubbles = [...existingBubbles, newBubble];
    
    autoSavePanelMutation.mutate({ 
      prompt, 
      speechBubbles: updatedBubbles 
    });
    
    setDialogueText(""); // Clear input after adding
    
    toast({
      title: "Speech bubble added",
      description: `${type === 'speech' ? 'Speech' : 'Thought'} bubble has been added to the panel.`,
    });
  };

  const generatePanelMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPanel) throw new Error("No panel selected");
      
      // Get enhanced panel context for size-aware generation
      const layout = comicLayouts.find(l => l.id === currentLayout);
      let panelContext = undefined;
      
      if (layout && selectedPanel <= layout.panels.length) {
        const panel = layout.panels[selectedPanel - 1];
        panelContext = generateEnhancedPanelContext(panel, currentLayout, selectedPanel);
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
      
      // Calculate enhanced panel context with precise dimensions
      const enhancedContext = generateEnhancedPanelContext(panelData, currentLayout, selectedPanel);
      
      const result = await apiRequest("POST", "/api/generate-background", {
        panelId: selectedPanel,
        projectId: project.id,
        panelContext: enhancedContext
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
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Panel Prompt</label>
                {(prompt !== (currentPanelData?.prompt || "")) && (
                  <span className="text-xs text-muted-foreground flex items-center">
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    Auto-saving...
                  </span>
                )}
              </div>
              <Textarea 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="resize-none" 
                rows={3} 
                placeholder={selectedPanel ? "Describe what happens in this panel..." : "Select a panel to start editing"}
                disabled={!selectedPanel}
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
              
              {/* Character Redress Button */}
              {projectCharacters.length > 0 && currentPanelData && (
                <Button 
                  variant="outline"
                  onClick={() => setIsRedressModalOpen(true)}
                  disabled={!selectedPanel}
                  className="w-full bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-900/20 dark:to-indigo-900/20 border-violet-200 dark:border-violet-700 hover:from-violet-100 hover:to-indigo-100 dark:hover:from-violet-800/30 dark:hover:to-indigo-800/30 font-medium text-violet-700 dark:text-violet-300"
                  data-testid="button-redress-panel"
                >
                  <Shirt className="mr-2 h-4 w-4" />
                  👗 Change Character Outfits
                </Button>
              )}
              
              {/* Helpful tip when no panel is selected */}
              {!selectedPanel && (
                <p className="text-xs text-muted-foreground text-center p-2 bg-muted/50 rounded">
                  👆 Select a panel above to start generating
                </p>
              )}
              
              {/* Loading state for panels */}
              {panelsLoading && selectedPanel && (
                <p className="text-xs text-muted-foreground text-center p-2 bg-muted/50 rounded flex items-center justify-center">
                  <Loader2 className="h-3 w-3 animate-spin mr-2" />
                  Loading panel data...
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
              placeholder={selectedPanel ? "Add dialogue..." : "Select a panel first"}
              disabled={!selectedPanel}
              data-testid="input-dialogue"
            />
            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => addSpeechBubble('speech')}
                disabled={!selectedPanel || !dialogueText.trim()}
                data-testid="button-speech-bubble"
              >
                <MessageSquare className="mr-1 h-3 w-3" />
                Speech
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => addSpeechBubble('thought')}
                disabled={!selectedPanel || !dialogueText.trim()}
                data-testid="button-thought-bubble"
              >
                <Cloud className="mr-1 h-3 w-3" />
                Thought
              </Button>
            </div>
            
            {/* Show existing speech bubbles */}
            {Boolean(currentPanelData?.speechBubbles) && Array.isArray(currentPanelData?.speechBubbles) && currentPanelData.speechBubbles.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Current Bubbles:</p>
                {(currentPanelData?.speechBubbles as Array<{text: string, type: string}>).map((bubble, index) => {
                  // Safely extract text and type with fallbacks
                  const bubbleText = typeof bubble?.text === 'string' ? bubble.text : 'Unknown text';
                  const bubbleType = typeof bubble?.type === 'string' ? bubble.type : 'speech';
                  
                  return (
                    <div key={index} className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1">
                      <span>{bubbleText}</span>
                      <span className="text-muted-foreground capitalize">{bubbleType}</span>
                    </div>
                  );
                })}
              </div>
            )}
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
              <div className="flex items-center justify-center p-3 bg-muted/30 rounded-lg border border-dashed border-muted-foreground/30">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground font-medium">🎨 Custom Color Palettes</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Coming soon!</p>
                </div>
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
            {/* Enhanced Character Display - Mobile Optimized */}
            <div className="w-full">
              <h4 className="font-medium mb-3 text-sm sm:text-base flex items-center flex-wrap gap-2">
                <User className="h-4 w-4 sm:h-5 sm:w-5 text-chart-4 flex-shrink-0" />
                <span className="flex-shrink-0">Active Characters</span>
                {projectCharacters.length > 0 && (
                  <span className="text-xs sm:text-sm text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5 flex-shrink-0">
                    {projectCharacters.length}
                  </span>
                )}
              </h4>
              
              {charactersLoading ? (
                <div className="flex items-center justify-center space-x-2 text-muted-foreground p-4 sm:p-6">
                  <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                  <span className="text-sm sm:text-base">Loading characters...</span>
                </div>
              ) : projectCharacters.length > 0 ? (
                <div className="space-y-2 sm:space-y-3 max-h-80 sm:max-h-96 overflow-y-auto overscroll-contain" data-testid="character-list">
                  {projectCharacters.map((character, index) => (
                    <EnhancedCharacterCard
                      key={character.id}
                      character={character}
                      index={index}
                      panelId={currentPanelData?.id}
                      allCharacters={projectCharacters}
                      onOutfitChange={(characterId, newImageUrl) => {
                        // Handle outfit change - refresh panel data
                        queryClient.invalidateQueries({ queryKey: ["/api/pages", currentPage?.id, "panels"] });
                        if (onImageGenerated && selectedPanel) {
                          onImageGenerated(selectedPanel, newImageUrl);
                        }
                        toast({
                          title: "Outfit Changed!",
                          description: "Character's outfit has been successfully updated.",
                        });
                      }}
                    />
                  ))}
                  
                  {/* Show count summary if many characters - Mobile optimized */}
                  {projectCharacters.length > 5 && (
                    <div className="text-center py-2 sm:py-3 border-t border-border/30">
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        Showing all {projectCharacters.length} project characters
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <Card className="border-dashed border-muted-foreground/30 bg-muted/20">
                  <CardContent className="p-3 sm:p-4 text-center">
                    <User className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-sm sm:text-base font-medium text-muted-foreground mb-1">
                      No Characters Yet
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground/70 leading-relaxed">
                      Add characters to your project for better AI context and generation results.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
        </div>
        
        {/* Redress Modal Integration */}
        {currentPanelData && (
          <RedressModal
            open={isRedressModalOpen}
            onOpenChange={setIsRedressModalOpen}
            panelId={currentPanelData.id}
            characters={projectCharacters}
            onSuccess={(newImageUrl) => {
              // Handle successful outfit change
              queryClient.invalidateQueries({ queryKey: ["/api/pages", currentPage?.id, "panels"] });
              if (onImageGenerated && selectedPanel) {
                onImageGenerated(selectedPanel, newImageUrl);
              }
              setIsRedressModalOpen(false);
              toast({
                title: "Outfits Changed Successfully!",
                description: "Character outfits have been updated in the panel.",
              });
            }}
          />
        )}
      </aside>
    </>
  );
}
