import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Wand2, RotateCcw, MessageSquare, Cloud, Palette, BookOpen, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { comicLayouts } from "@/lib/comic-layouts";
import { generateEnhancedPanelContext, getPanelAspectRatioInfo, calculateOptimalDimensions } from "@/lib/aspect-ratio-utils";
import CharacterDressRoom from "@/components/character-dress-room";
import { aiService } from "@/lib/ai-service";
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
  const [selectedCharacterForDressing, setSelectedCharacterForDressing] = useState<Character | null>(null);
  const [showAllCharacters, setShowAllCharacters] = useState(false);
  const [isLoadingScriptContent, setIsLoadingScriptContent] = useState(false);
  const [isPromptFromScript, setIsPromptFromScript] = useState(false);
  const [hasUserEditedPrompt, setHasUserEditedPrompt] = useState(false);
  const [currentSceneContext, setCurrentSceneContext] = useState<string>("");
  const [isLoadingSceneContext, setIsLoadingSceneContext] = useState(false);

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

  // Fetch script characters for suggestions
  const { data: scriptCharacters = [], isLoading: scriptCharactersLoading } = useQuery<Array<{ name: string; count: number; pageNumbers: number[] }>>({
    queryKey: ["/api/projects", project?.id, "script-characters"],
    enabled: !!project?.id,
  });

  // Find the current panel data
  const currentPanelData = selectedPanel ? existingPanels.find(p => p.panelNumber === selectedPanel) : null;

  // Auto-populate fields when panel changes or data loads
  useEffect(() => {
    if (selectedPanel && currentPanelData) {
      // Check if existing panel has generic/empty content that should be replaced with script content
      if (isGenericOrEmptyPrompt(currentPanelData.prompt)) {
        // Auto-populate with script content instead of showing generic content
        console.log(`📜 Existing panel ${selectedPanel} has generic content, populating with script content`);
        populatePromptFromScript(selectedPanel);
      } else {
        // Keep user's custom content as-is
        console.log(`📝 Existing panel ${selectedPanel} has custom content, preserving it`);
        setPrompt(currentPanelData.prompt || "");
        setIsPromptFromScript(false);
        setHasUserEditedPrompt(true); // User has custom content
      }
      
      // Parse speech bubbles if they exist
      if (currentPanelData.speechBubbles && Array.isArray(currentPanelData.speechBubbles)) {
        const bubbles = currentPanelData.speechBubbles as Array<{text: string}>;
        if (bubbles.length > 0) {
          setDialogueText(bubbles[0].text || "");
        }
      } else {
        setDialogueText("");
      }
    } else if (selectedPanel && !currentPanelData && !panelsLoading) {
      // New panel - populate with script content
      console.log(`📄 New panel ${selectedPanel}, populating with script content`);
      populatePromptFromScript(selectedPanel);
      setDialogueText("");
    }
  }, [selectedPanel, currentPanelData, panelsLoading, project, currentPage]);

  // Load current scene context when page or panel changes
  useEffect(() => {
    const loadSceneContext = async () => {
      if (!project?.id || !currentPage || !selectedPanel) {
        setCurrentSceneContext("");
        return;
      }
      
      setIsLoadingSceneContext(true);
      
      try {
        console.log(`🎬 Loading scene context for page ${currentPage.pageNumber}, panel ${selectedPanel}`);
        
        // Get script context for current panel/page
        const scriptContext = await getPanelScriptContext(selectedPanel);
        
        if (scriptContext) {
          // Build scene context from script data
          let sceneInfo = "";
          
          // Get page-level context first
          const structuredScript = await apiRequest("GET", `/api/projects/${project.id}/structured-script`);
          const scriptPage = structuredScript?.pages?.find((p: any) => p.pageNumber === currentPage.pageNumber);
          
          if (scriptPage) {
            if (scriptPage.setting) {
              sceneInfo += `📍 Location: ${scriptPage.setting}\n`;
            }
            if (scriptPage.overallMood) {
              sceneInfo += `🎭 Mood: ${scriptPage.overallMood}\n`;
            }
            if (scriptPage.characters?.length > 0) {
              sceneInfo += `👥 Characters: ${scriptPage.characters.join(", ")}\n`;
            }
            if (scriptPage.narrative) {
              sceneInfo += `📚 Scene: ${scriptPage.narrative.slice(0, 150)}${scriptPage.narrative.length > 150 ? "..." : ""}`;
            }
          }
          
          // Add panel-specific context
          if (scriptContext.sceneDescription || scriptContext.visualDescription) {
            sceneInfo += `\n\n🎯 Panel ${selectedPanel}: ${scriptContext.sceneDescription || scriptContext.visualDescription}`;
          }
          
          // Add dialogue context if available
          if (scriptContext.dialogue?.length > 0) {
            const dialogueText = scriptContext.dialogue.map((d: any) => 
              d.character ? `${d.character}: "${d.text}"` : d.text
            ).join(", ");
            sceneInfo += `\n💬 Dialogue: ${dialogueText}`;
          }
          
          // ✨ ENHANCEMENT: Apply character appearance details to the scene context text
          const enhancedSceneInfo = projectCharacters.length > 0 
            ? enhanceTextWithCharacterDetails(sceneInfo, projectCharacters)
            : sceneInfo;
          
          setCurrentSceneContext(enhancedSceneInfo || "Scene context loading...");
          console.log(`✅ Loaded scene context:`, enhancedSceneInfo);
        } else {
          // Fallback to page-level information
          let fallbackContext = `📖 Page ${currentPage.pageNumber} of ${project.title || "Untitled Comic"}\n\n${project.description || "No scene description available. Add a script or project description for better context."}`;
          
          // ✨ ENHANCEMENT: Also apply character enhancement to fallback context
          if (projectCharacters.length > 0) {
            fallbackContext = enhanceTextWithCharacterDetails(fallbackContext, projectCharacters);
          }
          
          setCurrentSceneContext(fallbackContext);
          console.log(`⚠️ No script context found, using fallback`);
        }
      } catch (error) {
        console.error("❌ Failed to load scene context:", error);
        let errorContext = `📖 Page ${currentPage.pageNumber} of ${project.title || "Untitled Comic"}\n\n${project.description || "Unable to load scene context. Please check your project script."}`;
        
        // ✨ ENHANCEMENT: Also apply character enhancement to error context
        if (projectCharacters.length > 0) {
          errorContext = enhanceTextWithCharacterDetails(errorContext, projectCharacters);
        }
        
        setCurrentSceneContext(errorContext);
      } finally {
        setIsLoadingSceneContext(false);
      }
    };
    
    loadSceneContext();
  }, [project?.id, currentPage?.pageNumber, currentPage?.id, selectedPanel]);

  // Populate prompt with script content for the selected panel
  const populatePromptFromScript = async (panelNumber: number) => {
    if (!panelNumber || !project?.id || !currentPage) return;
    
    setIsLoadingScriptContent(true);
    setHasUserEditedPrompt(false);
    
    try {
      // Get script context for this panel
      const scriptContext = await getPanelScriptContext(panelNumber);
      
      if (scriptContext) {
        // Build enhanced description from script content
        const scriptBasedPrompt = buildEnhancedDescription(scriptContext, panelNumber);
        setPrompt(scriptBasedPrompt);
        setIsPromptFromScript(true);
        
        // Auto-populate dialogue if it exists in script
        if (scriptContext.dialogue && Array.isArray(scriptContext.dialogue) && scriptContext.dialogue.length > 0) {
          // Get first dialogue line for this panel
          const firstDialogue = scriptContext.dialogue[0];
          if (firstDialogue && firstDialogue.text) {
            setDialogueText(firstDialogue.text);
          }
        }
        
        console.log(`📜 Auto-populated panel ${panelNumber} with script content`);
      } else {
        // Fallback to generic prompt if no script content
        const fallbackPrompt = generateDefaultPrompt(panelNumber, project, currentPage);
        setPrompt(fallbackPrompt);
        setIsPromptFromScript(false);
        console.log(`📜 No script content found for panel ${panelNumber}, using fallback`);
      }
    } catch (error) {
      console.error("Failed to load script content:", error);
      // Fallback on error
      const fallbackPrompt = generateDefaultPrompt(panelNumber, project, currentPage);
      setPrompt(fallbackPrompt);
      setIsPromptFromScript(false);
    } finally {
      setIsLoadingScriptContent(false);
    }
  };

  // Generate intelligent default prompt based on context
  const generateDefaultPrompt = (panelNum: number, proj: Project, page?: Page) => {
    const sceneContext = proj.description || "A dramatic scene unfolds";
    const artStyleContext = proj.artStyle || "comic book style";
    const panelPosition = panelNum === 1 ? "opening" : panelNum === 6 ? "closing" : "middle";
    
    let basePrompt = `Panel ${panelNum}: ${sceneContext}. Drawn in ${artStyleContext}. This is the ${panelPosition} panel of the page.`;
    
    // ✨ NEW: Also enhance default prompts with character details if they mention character names
    if (projectCharacters.length > 0) {
      basePrompt = enhanceTextWithCharacterDetails(basePrompt, projectCharacters);
    }
    
    return basePrompt;
  };

  // Helper function to detect generic or empty prompts that should be replaced with script content
  const isGenericOrEmptyPrompt = (prompt: string | null | undefined): boolean => {
    if (!prompt || prompt.trim() === "") return true;
    
    // Check for generic patterns that indicate auto-generated content
    const genericPatterns = [
      /^Panel \d+: .+\. Drawn in .+ style\. This is the .+ panel of the page\.$/,
      /^Scene \d+ of .+$/,
      /^Panel \d+: A dramatic scene unfolds/,
      // Check if it starts with project title/description (common generic pattern)
      project?.title && new RegExp(`^Panel \\d+: ${project.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
      project?.description && new RegExp(`^Panel \\d+: ${project.description.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
    ].filter(Boolean);
    
    // Check if prompt matches any generic pattern
    return genericPatterns.some(pattern => pattern && pattern.test(prompt.trim()));
  };

  // Helper function to extract script context for individual panel generation
  const getPanelScriptContext = async (panelNumber: number) => {
    if (!project?.id || !currentPage) return null;
    
    try {
      // Get structured script data
      const structuredScript = await apiRequest("GET", `/api/projects/${project.id}/structured-script`);
      
      if (!structuredScript?.pages || !Array.isArray(structuredScript.pages)) {
        return null;
      }
      
      // Find the script page that matches the current page
      let scriptPage = structuredScript.pages.find((p: any) => p.pageNumber === currentPage.pageNumber);
      
      // Fallback matching strategies
      if (!scriptPage) {
        scriptPage = structuredScript.pages.find((p: any) => 
          String(p.pageNumber) === String(currentPage.pageNumber)
        );
      }
      
      if (!scriptPage && typeof currentPage.pageNumber === 'number') {
        scriptPage = structuredScript.pages[currentPage.pageNumber - 1];
      }
      
      if (!scriptPage?.panels || !Array.isArray(scriptPage.panels)) {
        return null;
      }
      
      // Find the panel in the script
      let scriptPanel = scriptPage.panels.find((p: any) => p.panelNumber === panelNumber);
      
      // Fallback for array index-based matching
      if (!scriptPanel && scriptPage.panels[panelNumber - 1]) {
        scriptPanel = scriptPage.panels[panelNumber - 1];
      }
      
      return scriptPanel;
    } catch (error) {
      console.log("No structured script available for context:", error);
      return null;
    }
  };

  // Helper function to get previous panels context for visual continuity
  const getPreviousPanelsContext = (panelNumber: number, maxPrevious: number = 3) => {
    if (!existingPanels || existingPanels.length === 0) return [];
    
    return existingPanels
      .filter(panel => panel.panelNumber < panelNumber && panel.imageUrl)
      .sort((a, b) => b.panelNumber - a.panelNumber) // Most recent first
      .slice(0, maxPrevious) // Limit to avoid prompt bloat
      .reverse() // Restore chronological order
      .map(panel => ({
        panelNumber: panel.panelNumber,
        prompt: panel.prompt || `Panel ${panel.panelNumber}`,
        imageUrl: panel.imageUrl
      }));
  };

  // Helper function to enhance text with character appearance details embedded directly into the text
  const enhanceTextWithCharacterDetails = (text: string, availableCharacters: any[] = projectCharacters) => {
    if (!text || !availableCharacters.length) return text;
    
    let enhancedText = text;
    
    // For each character in the project, look for their name in the text and embed appearance details
    availableCharacters.forEach((char: any) => {
      if (!char.name || !char.visualDescriptors) return;
      
      // Create regex to find character name mentions (case insensitive, word boundaries)
      const nameRegex = new RegExp(`\\b(${char.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'gi');
      
      // Build compact appearance description
      const appearanceDetails = [];
      
      // Add visual descriptors (physical appearance)
      if (char.visualDescriptors && char.visualDescriptors.trim()) {
        appearanceDetails.push(char.visualDescriptors.trim());
      }
      
      // Add clothing/outfit information from alwaysTraits if it contains clothing info
      if (char.alwaysTraits && char.alwaysTraits.trim()) {
        const clothingTerms = ['wearing', 'outfit', 'clothing', 'shirt', 'pants', 'dress', 'jacket', 'boots', 'shoes', 'hat', 'uniform', 'costume'];
        const alwaysTraitsLower = char.alwaysTraits.toLowerCase();
        if (clothingTerms.some(term => alwaysTraitsLower.includes(term))) {
          appearanceDetails.push(char.alwaysTraits.trim());
        }
      }
      
      // If we have appearance details, create the enhanced format
      if (appearanceDetails.length > 0) {
        const combinedDetails = appearanceDetails.join('; ');
        
        // Replace character name with enhanced format: "Character Name [details]"
        enhancedText = enhancedText.replace(nameRegex, (match) => {
          // Check if this character name is already enhanced (has brackets after it)
          const nameIndex = enhancedText.indexOf(match);
          const afterName = enhancedText.slice(nameIndex + match.length, nameIndex + match.length + 50);
          if (afterName.trim().startsWith('[')) {
            return match; // Already enhanced, don't modify
          }
          
          return `${match} [${combinedDetails}]`;
        });
      }
    });
    
    return enhancedText;
  };

  // Helper function to build enhanced description from script context
  const buildEnhancedDescription = (scriptPanel: any, panelNumber: number) => {
    if (!scriptPanel) {
      return prompt || `Scene ${panelNumber} of ${project.title}`;
    }
    
    // Start with the main scene description
    let description = scriptPanel.sceneDescription || scriptPanel.visualDescription || scriptPanel.action || prompt;
    
    // ✨ NEW: Enhance the core description text with embedded character details
    if (projectCharacters.length > 0) {
      description = enhanceTextWithCharacterDetails(description, projectCharacters);
    }

    // ✨ ENHANCED: Add full dialogue with character emotions and speech text
    if (scriptPanel.dialogue?.length > 0) {
      description += `\n\nDialogue:`;
      scriptPanel.dialogue.forEach((d: any) => {
        if (d.character && d.text) {
          const emotionPart = d.emotionalState || d.emotion ? ` (${d.emotionalState || d.emotion})` : '';
          // Enhance character names in dialogue too
          const enhancedCharacterName = enhanceTextWithCharacterDetails(d.character, projectCharacters);
          description += `\n- ${enhancedCharacterName}${emotionPart}: "${d.text}"`;
        }
      });
    }

    // ✨ ENHANCED: Add sound effects
    if (scriptPanel.soundEffects?.length > 0) {
      const soundEffectsText = scriptPanel.soundEffects.map((effect: string) => 
        effect.startsWith('*') && effect.endsWith('*') ? effect : `*${effect}*`
      ).join(', ');
      description += `\n\nSound Effects: ${soundEffectsText}`;
    }

    // ✨ ENHANCED: Add action details when present (with character enhancement)
    if (scriptPanel.action && scriptPanel.action.trim() !== '') {
      const enhancedAction = enhanceTextWithCharacterDetails(scriptPanel.action, projectCharacters);
      description += `\n\nAction: ${enhancedAction}`;
    }

    // ✨ ENHANCED: Add timing information when present
    if (scriptPanel.timing && scriptPanel.timing.trim() !== '') {
      description += `\n\nTiming: ${scriptPanel.timing}`;
    }

    // ✨ ENHANCED: Add visual notes as a dedicated section (with character enhancement)
    if (scriptPanel.visualNotes && scriptPanel.visualNotes.trim() !== '') {
      const enhancedVisualNotes = enhanceTextWithCharacterDetails(scriptPanel.visualNotes, projectCharacters);
      description += `\n\nVisual Notes: ${enhancedVisualNotes}`;
    }

    // Add technical direction (camera, shot, mood)
    const technicalDirection = [];
    if (scriptPanel.cameraAngle) {
      technicalDirection.push(`Camera: ${scriptPanel.cameraAngle}`);
    }
    if (scriptPanel.shotType) {
      technicalDirection.push(`Shot: ${scriptPanel.shotType}`);
    }
    if (scriptPanel.mood) {
      technicalDirection.push(`Mood: ${scriptPanel.mood}`);
    }
    
    if (technicalDirection.length > 0) {
      description += `\n\nTechnical Direction: ${technicalDirection.join('. ')}`;
    }
    
    return description;
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

  // Handle prompt changes and track user edits
  const handlePromptChange = (value: string) => {
    setPrompt(value);
    // Only mark as user edited if content is different from script-generated content
    if (isPromptFromScript && !hasUserEditedPrompt) {
      setHasUserEditedPrompt(true);
      setIsPromptFromScript(false); // No longer showing pure script content
    }
  };

  // Reset prompt to script content
  const resetToScriptContent = async () => {
    if (selectedPanel) {
      await populatePromptFromScript(selectedPanel);
      toast({
        title: "Prompt reset",
        description: "Prompt has been reset to script content.",
      });
    }
  };

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
      
      // Build enhanced project context with full character details (same as full-page generation)
      const enhancedProjectContext = {
        title: project.title,
        genre: project.genre || undefined,
        description: project.description || undefined,
        artStyle: project.artStyle || undefined,
        characters: projectCharacters.map((char: any) => ({
          name: char.name,
          role: char.role,
          bio: char.bio,
          visualDescriptors: char.visualDescriptors || "",
          alwaysTraits: char.alwaysTraits || "",
          neverTraits: char.neverTraits || "",
          colorScheme: char.colorScheme || "",
          referenceImageUrl: char.referenceImageUrl || undefined
        })),
        // Add style consistency instructions for character consistency
        styleConsistencyRules: `CRITICAL: Maintain EXACT character appearances throughout all panels. Characters MUST have consistent facial features, hair color, hair style, body type, and clothing style across all panels.`
      };

      // Get script context for this specific panel
      const scriptContext = await getPanelScriptContext(selectedPanel);
      
      // Build enhanced description using script context
      const enhancedPrompt = buildEnhancedDescription(scriptContext, selectedPanel);
      
      // Get previous panels context for visual continuity
      const previousPanelsContext = getPreviousPanelsContext(selectedPanel);
      
      // Ensure panel exists in database and get its ID
      let panelId = currentPanelData?.id;
      if (!panelId) {
        // Create panel record if it doesn't exist
        const newPanel = await apiRequest("POST", `/api/pages/${currentPage!.id}/panels`, {
          panelNumber: selectedPanel,
          prompt: enhancedPrompt,
          speechBubbles: dialogueText ? [{ text: dialogueText, type: 'speech' }] : [],
          isGenerated: false,
          generationStatus: "pending"
        });
        panelId = newPanel.id;
      }

      // Use AIService.generatePanelImage for proper context building
      const response = await aiService.generatePanelImage({
        prompt: enhancedPrompt,
        panelId: panelId!,
        projectContext: enhancedProjectContext,
        characterContext: (projectCharacters || []).map(char => ({
          name: char.name || '',
          visualDescriptors: char.visualDescriptors || '',
          role: char.role || ''
        })),
        styleOptions: {
          artStyle: artStyle,
        },
        panelContext,
        previousPanelsContext: previousPanelsContext.map(panel => ({
          ...panel,
          imageUrl: panel.imageUrl || undefined
        }))
      }, project.id);
      
      return response;
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
    onError: (error: any) => {
      console.error("=== PANEL GENERATION FAILURE - FRONTEND ===\n");
      console.error("🕐 Timestamp:", new Date().toISOString());
      console.error("📋 Panel:", selectedPanel);
      console.error("🎬 Project:", project?.title || 'Unknown');
      console.error("📄 Page:", currentPage?.pageNumber || 'Unknown');
      console.error("🚨 Error Object:", error);
      
      // Enhanced error message based on backend error categorization
      let userMessage = "Failed to generate panel. Please try again.";
      let title = "Generation failed";
      let helpText = "";
      
      if (error?.response?.data) {
        const errorData = error.response.data;
        console.error("🔍 Server Error Details:", errorData);
        
        // Use backend error categorization for better user messages
        switch (errorData.error) {
          case 'quota_exceeded':
            title = "Generation Limit Reached";
            userMessage = "You've reached your generation limit. Please upgrade your plan or try again later.";
            helpText = "💡 Tip: Consider upgrading to Core plan for unlimited generations.";
            break;
          case 'timeout_error':
            title = "Request Timed Out";
            userMessage = "The generation process took too long. Please try again with a simpler prompt.";
            helpText = "💡 Tip: Try shorter, more focused prompts for faster generation.";
            break;
          case 'validation_error':
            title = "Character Validation Failed";
            userMessage = "There's an issue with your character setup. Please check your character definitions.";
            helpText = "💡 Tip: Ensure all characters in your prompt are properly created in the Characters section.";
            break;
          case 'authorization_error':
            title = "Access Denied";
            userMessage = "You don't have permission to edit this project.";
            helpText = "💡 Tip: Make sure you're the owner of this project.";
            break;
          case 'network_error':
            title = "Connection Error";
            userMessage = "Network connection failed. Please check your internet and try again.";
            helpText = "💡 Tip: Ensure you have a stable internet connection.";
            break;
          case 'project_not_found':
            title = "Project Error";
            userMessage = "Project not found. Please refresh the page and try again.";
            helpText = "💡 Tip: Try refreshing the page or navigating back to your projects list.";
            break;
          default:
            if (errorData.message) {
              userMessage = errorData.message;
            }
            if (errorData.error && errorData.error !== 'unknown_error') {
              helpText = `💡 Error code: ${errorData.error}`;
            }
        }
      } else if (error?.message) {
        console.error("🔍 Client Error Message:", error.message);
        userMessage = error.message;
      }
      
      // Log helpful debugging info
      console.error("📊 Generation Context:");
      console.error("  Prompt length:", prompt.length, "characters");
      console.error("  Project characters:", project?.id ? '✅ Available' : '❌ Missing');
      console.error("  Current page:", currentPage ? '✅ Present' : '❌ Missing');
      console.error("  Art style:", artStyle ? '✅ Present' : '❌ Missing');
      
      toast({
        title,
        description: helpText ? `${userMessage}\n\n${helpText}` : userMessage,
        variant: "destructive",
        duration: 8000, // Longer duration for helpful error messages
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
      
      // Get script context for environmental details
      const scriptContext = await getPanelScriptContext(selectedPanel);
      
      // Build enhanced environmental prompt from script context
      let environmentalPrompt = `Background environment for ${project.title}, panel ${selectedPanel}`;
      
      if (scriptContext) {
        // Use scene setting/location from script
        if (scriptContext.setting || scriptContext.location) {
          environmentalPrompt = `${scriptContext.setting || scriptContext.location} background scene`;
        }
        
        // Add time of day and lighting context
        if (scriptContext.timeOfDay) {
          environmentalPrompt += ` during ${scriptContext.timeOfDay}`;
        }
        
        // Add weather/environmental conditions
        if (scriptContext.weather) {
          environmentalPrompt += `, ${scriptContext.weather} weather`;
        }
        
        // Add mood/atmosphere to background
        if (scriptContext.mood) {
          environmentalPrompt += `, ${scriptContext.mood} atmosphere`;
        }
        
        // Add visual notes that pertain to environment
        if (scriptContext.visualNotes && scriptContext.visualNotes.toLowerCase().includes('background')) {
          environmentalPrompt += `. ${scriptContext.visualNotes}`;
        }
      } else {
        // Fallback using project context for environment
        if (project.description) {
          environmentalPrompt += `. Setting: ${project.description}`;
        }
      }
      
      // Add art style consistency
      if (project.artStyle) {
        environmentalPrompt += `. Art style: ${project.artStyle}`;
      }
      
      console.log('🎨 Background generation prompt:', environmentalPrompt);
      
      // SECURITY FIX: Use secure project-based route with authenticated projectId
      const result = await apiRequest("POST", `/api/projects/${project.id}/generate-background`, {
        panelId: selectedPanel,
        panelContext: enhancedContext,
        environmentalPrompt: environmentalPrompt, // Include enhanced environmental context
        scriptContext: scriptContext // Pass script context for server-side processing
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
      
      // Get enhanced panel context for consistent regeneration
      const layout = comicLayouts.find(l => l.id === currentLayout);
      let panelContext = undefined;
      
      if (layout && selectedPanel <= layout.panels.length) {
        const panel = layout.panels[selectedPanel - 1];
        panelContext = generateEnhancedPanelContext(panel, currentLayout, selectedPanel);
      }
      
      // Build full enhanced project context (same as generatePanelMutation)
      const enhancedProjectContext = {
        title: project.title,
        genre: project.genre || undefined,
        description: project.description || undefined,
        artStyle: project.artStyle || undefined,
        characters: projectCharacters.map((char: any) => ({
          name: char.name,
          role: char.role,
          bio: char.bio,
          visualDescriptors: char.visualDescriptors || "",
          alwaysTraits: char.alwaysTraits || "",
          neverTraits: char.neverTraits || "",
          colorScheme: char.colorScheme || "",
          referenceImageUrl: char.referenceImageUrl || undefined
        })),
        styleConsistencyRules: `CRITICAL: Maintain EXACT character appearances throughout all panels. Characters MUST have consistent facial features, hair color, hair style, body type, and clothing style across all panels.`
      };
      
      // Get script context for this specific panel
      const scriptContext = await getPanelScriptContext(selectedPanel);
      
      // Build enhanced description using script context
      const enhancedPrompt = buildEnhancedDescription(scriptContext, selectedPanel);
      
      // Get previous panels context for visual continuity
      const previousPanelsContext = getPreviousPanelsContext(selectedPanel);
      
      // Get panel ID (should exist for regeneration)
      const panelId = currentPanelData?.id || String(selectedPanel);
      
      // Use AIService.generatePanelImage with edit mode (sourceImageUrl) for proper context building
      const response = await aiService.generatePanelImage({
        prompt: enhancedPrompt + " (regeneration for enhanced consistency)",
        panelId: panelId,
        sourceImageUrl: currentPanelData?.imageUrl || undefined, // Enable edit mode if image exists
        projectContext: enhancedProjectContext,
        characterContext: (projectCharacters || []).map(char => ({
          name: char.name || '',
          visualDescriptors: char.visualDescriptors || '',
          role: char.role || ''
        })),
        styleOptions: {
          artStyle: artStyle,
        },
        panelContext,
        previousPanelsContext: previousPanelsContext.map(panel => ({
          ...panel,
          imageUrl: panel.imageUrl || undefined
        }))
      }, project.id);
      
      return response;
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
    onError: (error: any) => {
      console.error("=== PANEL REGENERATION FAILURE - FRONTEND ===\n");
      console.error("🕐 Timestamp:", new Date().toISOString());
      console.error("📋 Panel:", selectedPanel);
      console.error("🎬 Project:", project?.title || 'Unknown');
      console.error("📄 Page:", currentPage?.pageNumber || 'Unknown');
      console.error("🚨 Error Object:", error);
      
      // Enhanced error message for regeneration failures
      let userMessage = "Failed to regenerate panel. Please try again.";
      let title = "Regeneration failed";
      let helpText = "";
      
      if (error?.response?.data) {
        const errorData = error.response.data;
        console.error("🔍 Server Error Details:", errorData);
        
        // Use same categorization as generation errors
        switch (errorData.error) {
          case 'quota_exceeded':
            title = "Generation Limit Reached";
            userMessage = "You've reached your regeneration limit. Please upgrade your plan or try again later.";
            helpText = "💡 Tip: Each regeneration counts toward your usage limit.";
            break;
          case 'timeout_error':
            title = "Regeneration Timed Out";
            userMessage = "The regeneration process took too long. Please try again.";
            helpText = "💡 Tip: Try regenerating with different style options.";
            break;
          case 'validation_error':
            title = "Character Validation Failed";
            userMessage = "There's an issue with your character setup for regeneration.";
            helpText = "💡 Tip: Ensure all characters are properly configured before regenerating.";
            break;
          default:
            if (errorData.message) {
              userMessage = errorData.message;
            }
        }
      } else if (error?.message) {
        userMessage = error.message;
      }
      
      // Log regeneration context
      console.error("📊 Regeneration Context:");
      console.error("  Original image URL:", currentPanelData?.imageUrl ? '✅ Present' : '❌ Missing');
      console.error("  Regeneration attempt:", 'User-initiated');
      
      toast({
        title,
        description: helpText ? `${userMessage}\n\n${helpText}` : userMessage,
        variant: "destructive",
        duration: 8000,
      });
    },
  });

  // Create characters from script suggestions mutation
  const createCharactersFromScriptMutation = useMutation({
    mutationFn: async (names: string[]) => {
      if (!project?.id) throw new Error("No project selected");
      
      const response = await apiRequest("POST", `/api/projects/${project.id}/characters/from-script`, {
        names: names
      });
      
      return response;
    },
    onSuccess: (result: any) => {
      toast({
        title: "Characters created",
        description: result.message || `Successfully created ${result.created} character(s)`,
      });
      
      // Invalidate both characters and script characters queries
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project?.id, "characters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project?.id, "script-characters"] });
    },
    onError: (error: any) => {
      console.error("=== CHARACTER CREATION FROM SCRIPT FAILURE - FRONTEND ===\n");
      console.error("🕐 Timestamp:", new Date().toISOString());
      console.error("🎬 Project:", project?.title || 'Unknown');
      console.error("🚨 Error Object:", error);
      
      let userMessage = "There was an error creating characters from the script.";
      let title = "Failed to create characters";
      let helpText = "";
      
      if (error?.response?.data) {
        const errorData = error.response.data;
        console.error("🔍 Server Error Details:", errorData);
        
        if (errorData.message) {
          userMessage = errorData.message;
        }
        
        // Add specific help for character creation errors
        if (errorData.error === 'validation_error') {
          helpText = "💡 Tip: Check that your script contains valid character names and descriptions.";
        } else if (errorData.error === 'quota_exceeded') {
          title = "Character Creation Limit Reached";
          userMessage = "You've reached your character creation limit.";
          helpText = "💡 Tip: Consider upgrading your plan for unlimited character creation.";
        }
      }
      
      // Log script context for debugging
      console.error("📊 Script Context:");
      console.error("  Script available:", project?.script ? '✅ Present' : '❌ Missing');
      console.error("  Characters suggested:", scriptCharacters.length);
      
      toast({
        title,
        description: helpText ? `${userMessage}\n\n${helpText}` : userMessage,
        variant: "destructive",
        duration: 8000,
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
                <label className="text-sm font-medium flex items-center">
                  Panel Prompt
                  {isLoadingScriptContent && (
                    <Loader2 className="h-3 w-3 animate-spin ml-2 text-muted-foreground" />
                  )}
                  {isPromptFromScript && !hasUserEditedPrompt && (
                    <span className="ml-2 text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-medium">
                      📜 From Script
                    </span>
                  )}
                  {hasUserEditedPrompt && (
                    <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">
                      ✏️ Edited
                    </span>
                  )}
                </label>
                <div className="flex items-center space-x-2">
                  {hasUserEditedPrompt && selectedPanel && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={resetToScriptContent}
                      className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                      data-testid="button-reset-to-script"
                    >
                      Reset to Script
                    </Button>
                  )}
                  {(prompt !== (currentPanelData?.prompt || "")) && !isLoadingScriptContent && (
                    <span className="text-xs text-muted-foreground flex items-center">
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      Auto-saving...
                    </span>
                  )}
                </div>
              </div>
              <Textarea 
                value={prompt}
                onChange={(e) => handlePromptChange(e.target.value)}
                className={`resize-none ${isPromptFromScript && !hasUserEditedPrompt ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-900/10' : ''} ${isLoadingScriptContent ? 'opacity-50' : ''}`}
                rows={4} 
                placeholder={selectedPanel 
                  ? isLoadingScriptContent 
                    ? "Loading script content..." 
                    : "Describe what happens in this panel..."
                  : "Select a panel to start editing"
                }
                disabled={!selectedPanel || isLoadingScriptContent}
                data-testid="textarea-panel-prompt"
              />
              {isPromptFromScript && !hasUserEditedPrompt && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center">
                  <BookOpen className="h-3 w-3 mr-1" />
                  This content was automatically loaded from your script. Feel free to edit it as needed.
                </p>
              )}
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
            {currentPanelData?.speechBubbles && Array.isArray(currentPanelData.speechBubbles) && currentPanelData.speechBubbles.length > 0 ? (
              <div className="mt-2 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Current Bubbles:</p>
                {(currentPanelData.speechBubbles as Array<{text: string, type: string}>).map((bubble, index) => (
                  <div key={index} className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1">
                    <span>{bubble.text}</span>
                    <span className="text-muted-foreground capitalize">{bubble.type || 'speech'}</span>
                  </div>
                ))}
              </div>
            ) : null}
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
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium">Current Scene</p>
                  {isLoadingSceneContext && (
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  )}
                </div>
                {isLoadingSceneContext ? (
                  <div className="text-muted-foreground text-xs">
                    Loading scene context...
                  </div>
                ) : (
                  <div className="text-muted-foreground text-xs whitespace-pre-line">
                    {currentSceneContext || project.description || "No scene information available. Select a panel and add a script for detailed context."}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-3">
                <p className="font-medium mb-1">Active Characters</p>
                {charactersLoading ? (
                  <div className="flex items-center space-x-2 text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="text-xs">Loading characters...</span>
                  </div>
                ) : projectCharacters.length > 0 ? (
                  <div className="space-y-2">
                    {projectCharacters.slice(0, 3).map((character, index) => (
                      <div key={character.id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 flex-1">
                          <span 
                            className={`inline-block w-3 h-3 rounded-full ${
                              index === 0 ? 'bg-chart-1' : index === 1 ? 'bg-chart-2' : 'bg-chart-3'
                            }`}
                          />
                          <span className="text-sm">{character.name}</span>
                          {character.role && (
                            <span className="text-xs text-muted-foreground">({character.role})</span>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-xs"
                          onClick={() => setSelectedCharacterForDressing(character)}
                          data-testid={`button-dress-room-${character.id}`}
                        >
                          Dress Room
                        </Button>
                      </div>
                    ))}
                    {projectCharacters.length > 3 && (
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-muted-foreground">
                          +{projectCharacters.length - 3} more characters
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs"
                          onClick={() => setShowAllCharacters(true)}
                          data-testid="button-show-all-characters"
                        >
                          View All
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No characters defined yet. Add characters to your project for better context.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Script Characters Suggestions */}
            {scriptCharacters.length > 0 && (
              <Card className="border-border border-orange-200 dark:border-orange-800">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-orange-700 dark:text-orange-300">Script Characters</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-xs border-orange-200 text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-300 dark:hover:bg-orange-950"
                      onClick={() => {
                        const allNames = scriptCharacters.map(char => char.name);
                        createCharactersFromScriptMutation.mutate(allNames);
                      }}
                      disabled={createCharactersFromScriptMutation.isPending}
                      data-testid="button-add-all-script-characters"
                    >
                      {createCharactersFromScriptMutation.isPending ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          Adding...
                        </>
                      ) : (
                        'Add All'
                      )}
                    </Button>
                  </div>
                  
                  <p className="text-xs text-orange-600 dark:text-orange-400 mb-3">
                    Characters found in script but not yet added to project:
                  </p>
                  
                  <div className="space-y-2">
                    {scriptCharacters.slice(0, 3).map((char, index) => (
                      <div key={index} className="flex items-center justify-between bg-orange-50 dark:bg-orange-950/30 p-2 rounded text-xs border border-orange-100 dark:border-orange-900">
                        <div className="flex-1">
                          <span className="font-medium text-orange-800 dark:text-orange-200">{char.name}</span>
                          <div className="text-orange-600 dark:text-orange-400 text-[10px] mt-0.5">
                            {char.count} mention{char.count !== 1 ? 's' : ''} 
                            {char.pageNumbers.length > 0 && (
                              <span> on page{char.pageNumbers.length !== 1 ? 's' : ''} {char.pageNumbers.join(', ')}</span>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-5 px-2 text-[10px] ml-2 border-orange-200 text-orange-700 hover:bg-orange-100 dark:border-orange-800 dark:text-orange-300 dark:hover:bg-orange-900"
                          onClick={() => createCharactersFromScriptMutation.mutate([char.name])}
                          disabled={createCharactersFromScriptMutation.isPending}
                          data-testid={`button-add-script-character-${char.name.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          Add
                        </Button>
                      </div>
                    ))}
                    
                    {scriptCharacters.length > 3 && (
                      <div className="text-xs text-orange-600 dark:text-orange-400 text-center py-1">
                        +{scriptCharacters.length - 3} more character{scriptCharacters.length - 3 !== 1 ? 's' : ''} in script
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
        </div>
      </aside>

      {/* Show All Characters Modal */}
      <Dialog open={showAllCharacters} onOpenChange={(open) => !open && setShowAllCharacters(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-chart-4" />
              All Characters
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {projectCharacters.length > 0 ? (
              projectCharacters.map((character, index) => (
                <div key={character.id} className="flex items-center justify-between p-2 border rounded-lg">
                  <div className="flex items-center space-x-2 flex-1">
                    <span 
                      className={`inline-block w-3 h-3 rounded-full ${
                        index % 3 === 0 ? 'bg-chart-1' : index % 3 === 1 ? 'bg-chart-2' : 'bg-chart-3'
                      }`}
                    />
                    <div>
                      <span className="text-sm font-medium">{character.name}</span>
                      {character.role && (
                        <div className="text-xs text-muted-foreground">({character.role})</div>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-3 text-xs"
                    onClick={() => {
                      setSelectedCharacterForDressing(character);
                      setShowAllCharacters(false);
                    }}
                    data-testid={`button-dress-room-all-${character.id}`}
                  >
                    Dress Room
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No characters defined yet. Add characters to your project for better context.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Character Dress Room Modal */}
      {selectedCharacterForDressing && (
        <CharacterDressRoom
          character={selectedCharacterForDressing}
          project={project}
          currentPanel={currentPanelData || undefined}
          selectedPanelNumber={selectedPanel}
          selectedPanelId={currentPanelData?.id || null}
          isOpen={!!selectedCharacterForDressing}
          onClose={() => setSelectedCharacterForDressing(null)}
          onCharacterRedressed={(panelNumber, newImageUrl) => {
          // Invalidate panel queries to refresh the panel editor data
          queryClient.invalidateQueries({ queryKey: ["/api/pages", currentPage?.id, "panels"] });
          
          // Call the original callback
          if (onImageGenerated) {
            onImageGenerated(panelNumber, newImageUrl);
          }
        }}
        />
      )}
    </>
  );
}
