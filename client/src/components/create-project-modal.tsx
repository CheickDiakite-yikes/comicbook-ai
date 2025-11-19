import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Plus, Upload, Wand2, Palette, Loader2, ChevronDown, ChevronRight, FileText, Camera, MessageSquare, Users, MapPin, Clock, Volume2, Eye, Sparkles, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { aiService } from "@/lib/ai-service";
import { useBackgroundGeneration } from "@/contexts/BackgroundGenerationContext";
import type { Project } from "@shared/schema";
import AIStoryGenerator from "./ai-story-generator";

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
}

const projectSchema = z.object({
  title: z.string().min(1, "Title is required"),
  genre: z.string().optional(),
  description: z.string().optional(),
  artStyle: z.string().optional(),
  script: z.string().optional(),
});

type ProjectFormData = z.infer<typeof projectSchema>;

const artStyles = [
  { id: "comic-book", name: "Comic Book", icon: "🦸" },
  { id: "manga", name: "Manga", icon: "🏯" },
  { id: "watercolor", name: "Watercolor", icon: "🎨" },
  { id: "sketch", name: "Sketch", icon: "✏️" },
  { id: "realistic", name: "Realistic", icon: "📸" },
  { id: "cartoon", name: "Cartoon", icon: "🎪" },
  { id: "pixar-like", name: "Pixar Like", icon: "🎬" },
  { id: "ghibli-like", name: "Ghibli Like", icon: "🌸" },
  { id: "erotica", name: "Erotica", icon: "🔞" },
];

const genres = [
  "Action",
  "Adventure",
  "Anime",
  "Betrayal",
  "Business",
  "Child Learning",
  "Comedy",
  "Coming to Life",
  "Drama",
  "Erotic",
  "Fantasy",
  "Horror",
  "Mystery",
  "Non-Fiction",
  "Raunchy",
  "Romance",
  "Sci-Fi",
  "Sexy",
  "Shooter",
  "Slice of Life",
  "Spicy",
  "Superhero",
  "Thriller",
  "Who Done It"
];

export default function CreateProjectModal({ open, onClose }: CreateProjectModalProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedArtStyle, setSelectedArtStyle] = useState<string>("");
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [scriptGenerationStep, setScriptGenerationStep] = useState<string>("");
  const [generatedStructuredScript, setGeneratedStructuredScript] = useState<any>(null);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [isGeneratingCharacterBio, setIsGeneratingCharacterBio] = useState<number | null>(null);
  const [isGeneratingCharacterVisual, setIsGeneratingCharacterVisual] = useState<number | null>(null);
  const [isUploadingReferenceImage, setIsUploadingReferenceImage] = useState<number | null>(null);
  const [showAIStoryGenerator, setShowAIStoryGenerator] = useState(false);
  const [characters, setCharacters] = useState([
    { name: "Captain Thunder", role: "Main Hero", bio: "A powerful superhero with lightning abilities, tall with silver hair and a blue cape. Always confident and protective of civilians.", visualDescriptors: "", referenceImageUrl: "", shouldGeneratePortrait: false }
  ]);
  const [showGenerationCompleteBanner, setShowGenerationCompleteBanner] = useState(false);
  
  // 🎯 ENHANCED: Script tone options with comprehensive choices
  const scriptToneOptions = [
    { value: "action-packed", label: "Action-Packed ⚡", description: "Fast-paced with dynamic sequences" },
    { value: "balanced", label: "Balanced 📖", description: "Well-rounded mix of elements" },
    { value: "dialogue-heavy", label: "Dialogue-Heavy 💬", description: "Character-driven conversations" },
    { value: "cinematic", label: "Cinematic 🎬", description: "Visually striking and dramatic" },
    { value: "character-driven", label: "Character-Driven 👥", description: "Focus on relationships and growth" },
    { value: "mysterious", label: "Mysterious 🔍", description: "Atmospheric with suspense" },
    { value: "comedic", label: "Comedic 😄", description: "Humorous and light-hearted" },
    { value: "dramatic", label: "Dramatic 🎭", description: "Emotional depth and intensity" },
    { value: "romantic", label: "Romantic 💕", description: "Love-focused storytelling" },
    { value: "erotic", label: "Erotic 🔥", description: "Sensual and intimate themes" },
    { value: "dark", label: "Dark 🌑", description: "Gritty and mature themes" },
    { value: "fantasy", label: "Fantasy ✨", description: "Magical and otherworldly" },
    { value: "horror", label: "Horror 👻", description: "Scary and suspenseful" },
    { value: "sci-fi", label: "Sci-Fi 🚀", description: "Futuristic and technological" },
    { value: "slice-of-life", label: "Slice of Life 🌸", description: "Everyday moments and realism" },
    { value: "epic", label: "Epic 🌟", description: "Grand scale and heroic themes" }
  ];
  
  // 🎯 NEW: User control options for amazing script generation
  const [scriptLength, setScriptLength] = useState<string>("12");
  const [selectedScriptTones, setSelectedScriptTones] = useState<string[]>(["balanced"]);
  const [userInstructions, setUserInstructions] = useState<string>("");
  
  const { state: generationState, clearGeneration } = useBackgroundGeneration();

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      title: "",
      genre: "",
      description: "",
      artStyle: "",
      script: "",
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: async (data: ProjectFormData) => {
      // Create the project first
      const projectData = {
        ...data,
        artStyle: selectedArtStyle,
        settings: [{ name: "Metro City", description: "A bustling metropolis with towering skyscrapers and busy streets. The city has a modern feel with glass buildings reflecting sunlight." }],
      };

      // If we have generated story data, include both simple and detailed genres
      if (generationState.status === 'completed' && generationState.generatedResult) {
        const result = generationState.generatedResult as any;
        if (result.userSelectedGenres) {
          (projectData as any).userSelectedGenres = result.userSelectedGenres;
        }
        // Keep the AI-enhanced genre in the genre field
      }

      const project = await apiRequest("POST", "/api/projects", projectData) as Project;
      
      // Then create the characters
      const validCharacters = characters.filter(char => char.name && char.role);
      const createdCharacters = [];
      for (const character of validCharacters) {
        const createdCharacter = await apiRequest("POST", `/api/projects/${project.id}/characters`, {
          name: character.name,
          role: character.role,
          bio: character.bio,
          visualDescriptors: character.visualDescriptors || "",
          referenceImageUrl: character.referenceImageUrl || "",
        });
        createdCharacters.push({ ...createdCharacter, shouldGeneratePortrait: character.shouldGeneratePortrait });
      }

      // Generate reference portraits for characters that were marked for generation
      const charactersToGenerate = createdCharacters.filter(char => char.shouldGeneratePortrait);
      if (charactersToGenerate.length > 0) {
        toast({
          title: "Generating Reference Portraits",
          description: `Creating AI portraits for ${charactersToGenerate.length} character(s)...`,
        });

        // Generate portraits in parallel (don't wait for completion)
        charactersToGenerate.forEach(async (character) => {
          try {
            await apiRequest("POST", `/api/characters/${character.id}/generate-reference-portrait`);
          } catch (error) {
            console.error(`Failed to generate portrait for ${character.name}:`, error);
            // Don't show individual errors to avoid spam, they'll see the results in the editor
          }
        });
      }
      
      // Save structured script if we have a preview, otherwise generate fresh one
      if (generatedStructuredScript) {
        try {
          // Use the existing generated script data that user already approved in preview
          console.log("Saving existing structured script with", generatedStructuredScript.pages?.length, "pages");
          await apiRequest("POST", `/api/projects/${project.id}/save-structured-script`, {
            title: generatedStructuredScript.title || data.title,
            logline: generatedStructuredScript.logline || data.description,
            pages: generatedStructuredScript.pages || []
          });
          console.log("Existing structured script saved successfully");
        } catch (scriptError) {
          console.error("Failed to save existing structured script:", scriptError);
          // Fall back to generating a fresh one if saving the existing one fails
          try {
            const characterData = validCharacters.map(char => ({
              name: char.name,
              role: char.role,
              bio: char.bio,
              visualDescriptors: char.visualDescriptors || ""
            }));
            
            await apiRequest("POST", `/api/projects/${project.id}/generate-structured-script`, {
              title: data.title,
              description: data.description,
              genre: data.genre,
              characters: characterData,
              settings: [{ name: "Metro City", description: "A bustling metropolis with towering skyscrapers and busy streets." }],
              pageCount: 12,
              tone: data.genre,
              logline: data.description
            });
            console.log("Fallback: Fresh structured script generated successfully");
          } catch (fallbackError) {
            console.error("Failed to generate fallback structured script:", fallbackError);
          }
        }
      } else if (data.description) {
        try {
          // Generate fresh script if no preview exists but description is provided
          const characterData = validCharacters.map(char => ({
            name: char.name,
            role: char.role,
            bio: char.bio,
            visualDescriptors: char.visualDescriptors || ""
          }));
          
          await apiRequest("POST", `/api/projects/${project.id}/generate-structured-script`, {
            title: data.title,
            description: data.description,
            genre: data.genre,
            characters: characterData,
            settings: [{ name: "Metro City", description: "A bustling metropolis with towering skyscrapers and busy streets." }],
            pageCount: 12,
            tone: data.genre,
            logline: data.description
          });
          console.log("Fresh structured script generated successfully");
        } catch (scriptError) {
          console.error("Failed to generate fresh structured script:", scriptError);
          // Don't fail the entire project creation if script generation fails
        }
      }
      
      return project;
    },
    onSuccess: (project) => {
      // Invalidate both project list and structured script queries
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "structured-script"] });
      toast({
        title: "Project created",
        description: "Your comic project has been created successfully!",
      });
      onClose();
      setLocation(`/editor/${project.id}`);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create project. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ProjectFormData) => {
    createProjectMutation.mutate(data);
  };

  const addCharacter = () => {
    setCharacters([...characters, { name: "", role: "", bio: "", visualDescriptors: "", referenceImageUrl: "", shouldGeneratePortrait: false }]);
  };

  const updateCharacter = (index: number, field: string, value: string) => {
    const updated = [...characters];
    updated[index] = { ...updated[index], [field]: value };
    setCharacters(updated);
  };

  // Handle reference portrait upload
  const handleReferenceImageUpload = async (index: number, file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File Type",
        description: "Please select an image file.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast({
        title: "File Too Large",
        description: "Please select an image under 10MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingReferenceImage(index);

    try {
      // Get upload URL
      const uploadResponse = await fetch("/api/upload/presigned-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const uploadData = await uploadResponse.json();

      if (!uploadResponse.ok) {
        throw new Error(uploadData.error || "Failed to get upload URL");
      }

      // Upload image to object storage
      const uploadResult = await fetch(uploadData.uploadURL, {
        method: "PUT",
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResult.ok) {
        throw new Error("Failed to upload image");
      }

      // Set ACL policy for the uploaded image
      const imageURL = uploadData.uploadURL.split('?')[0]; // Remove query params
      const aclResponse = await fetch("/api/auth/user/profile-image", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageURL }),
      });

      if (!aclResponse.ok) {
        throw new Error("Failed to set image permissions");
      }

      const aclData = await aclResponse.json();
      
      // Update character with reference image URL
      updateCharacter(index, "referenceImageUrl", aclData.objectPath);

      toast({
        title: "Image Uploaded!",
        description: "Reference portrait uploaded successfully.",
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingReferenceImage(null);
    }
  };

  // State for tracking which character is generating portrait
  const [isGeneratingPortrait, setIsGeneratingPortrait] = useState<number | null>(null);

  // Handle AI reference portrait generation (immediate generation)
  const handleGenerateReferencePortrait = async (index: number) => {
    const character = characters[index];
    const formData = form.getValues();
    
    if (!character.name || (!character.bio && !character.visualDescriptors)) {
      toast({
        title: "Missing Information",
        description: "Please enter character name and either bio or visual descriptors.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingPortrait(index);
    
    try {
      const response = await apiRequest("POST", "/api/pre-project/reference-portrait", {
        characterName: character.name,
        role: character.role,
        bio: character.bio,
        visualDescriptors: character.visualDescriptors,
        artStyle: selectedArtStyle || formData.artStyle || "comic book"
      });

      if (response.status === "completed" && response.referenceImageUrl) {
        const updated = [...characters];
        updated[index] = {
          ...updated[index],
          referenceImageUrl: response.referenceImageUrl,
          shouldGeneratePortrait: false
        };
        setCharacters(updated);

        toast({
          title: "Portrait Generated!",
          description: `Reference portrait for ${character.name} has been created successfully.`,
        });
      } else {
        throw new Error(response.error || "Failed to generate portrait");
      }
    } catch (error) {
      console.error("Failed to generate reference portrait:", error);
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate reference portrait. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPortrait(null);
    }
  };

  // Handle background generation completion
  useEffect(() => {
    if (generationState.status === 'completed' && generationState.generatedResult && open) {
      const storyData = generationState.storyData;
      const completeStory = generationState.generatedResult;
      
      // Auto-populate the form with generated content
      form.setValue("title", completeStory.title);
      form.setValue("genre", completeStory.genre);
      form.setValue("description", completeStory.description);
      setSelectedArtStyle(storyData?.artStyle || "");
      setCharacters((completeStory.characters || []).map((char: any) => ({
        name: char.name || "",
        role: char.role || "",
        bio: char.bio || "",
        visualDescriptors: char.visualDescriptors || "",
        referenceImageUrl: char.referenceImageUrl || "",
        shouldGeneratePortrait: char.shouldGeneratePortrait || false
      })));
      setGeneratedStructuredScript(completeStory.structuredScript);
      
      if (completeStory.structuredScript) {
        const previewText = `# ${completeStory.title} - AI Generated Story!

✅ ${completeStory.structuredScript.pages?.length || 6} pages with detailed metadata
✅ Rich character development and world-building
✅ Genre blend: ${storyData?.genres.join(" + ") || "Mixed"}
✅ ${storyData?.tones.join(" + ") || "Balanced"} tones with ${storyData?.length || "medium"} pacing
✅ Optimized for ${storyData?.artStyle || "comic book"} art style

The complete structured script with full character details has been generated and is ready for your review.`;
        
        form.setValue("script", previewText);
      }
      
      // Show completion banner
      setShowGenerationCompleteBanner(true);
      
      toast({
        title: "🎉 Story Generated Successfully!",
        description: `Your ${storyData?.genres.join(" + ") || "custom"} story with ${storyData?.tones.join(" + ") || "balanced"} tones is ready to create!`,
        duration: 6000,
      });
    }
  }, [generationState.status, generationState.generatedResult, open, form]);
  
  const handleUseGeneratedStory = () => {
    setShowGenerationCompleteBanner(false);
    clearGeneration();
  };
  
  const handleDismissGeneration = () => {
    setShowGenerationCompleteBanner(false);
    clearGeneration();
    // Reset form to defaults
    form.reset();
    setSelectedArtStyle("");
    setCharacters([
      { name: "Captain Thunder", role: "Main Hero", bio: "A powerful superhero with lightning abilities, tall with silver hair and a blue cape. Always confident and protective of civilians.", visualDescriptors: "", referenceImageUrl: "", shouldGeneratePortrait: false }
    ]);
    setGeneratedStructuredScript(null);
  };

  const handleGenerateScript = async () => {
    try {
      setIsGeneratingScript(true);
      setScriptGenerationStep("🔍 Validating your story details...");
      const formValues = form.getValues();
      
      // 🔍 ENHANCED: Comprehensive validation with helpful suggestions
      const validationErrors = [];
      const suggestions = [];
      
      if (!formValues.title?.trim()) {
        validationErrors.push("Comic title is required");
        suggestions.push("💡 Add a catchy title like 'Heroes of Metro City' or 'The Lightning Chronicles'");
      }
      
      if (!formValues.description?.trim()) {
        validationErrors.push("Story description is required");
        suggestions.push("💡 Describe your story's world, main character, or central conflict in 2-3 sentences");
      } else if (formValues.description.trim().length < 20) {
        validationErrors.push("Story description is too brief");
        suggestions.push("💡 Add more detail about your story's setting, characters, or plot for better AI generation");
      }
      
      // Check if we have at least one character with meaningful data
      const validCharacters = characters.filter(char => 
        char.name?.trim() && char.role?.trim()
      );
      
      if (validCharacters.length === 0) {
        validationErrors.push("At least one character is needed");
        suggestions.push("💡 Add a main character with a name and role like 'Hero', 'Villain', or 'Sidekick'");
      } else {
        // Check for character quality
        const charactersWithBios = validCharacters.filter(char => char.bio?.trim());
        if (charactersWithBios.length === 0) {
          suggestions.push("💡 Adding character bios will create richer, more detailed scripts");
        }
      }
      
      // Genre suggestion (optional but helpful)
      if (!formValues.genre) {
        suggestions.push("💡 Selecting a genre will help tailor the script's tone and style");
      }
      
      // Art style suggestion (optional but helpful)  
      if (!selectedArtStyle) {
        suggestions.push("💡 Choosing an art style will optimize visual descriptions in your script");
      }
      
      if (validationErrors.length > 0) {
        const errorMessage = validationErrors.join(", ");
        const suggestionText = suggestions.length > 0 ? "\n\n" + suggestions.join("\n") : "";
        
        toast({
          title: "Almost Ready! 🎯",
          description: errorMessage + suggestionText,
          variant: "destructive",
          duration: 8000,
        });
        return;
      }
      
      // 🎉 Show encouraging message if everything looks good
      if (suggestions.length > 0) {
        toast({
          title: "Looking Great! 📝",
          description: "Your project has all the essentials. " + suggestions.slice(0, 2).join(" "),
          duration: 4000,
        });
      }
      
      setScriptGenerationStep("📚 Preparing character data and project settings...");
      
      // Build character data for structured generation
      const characterData = characters
        .filter(char => char.name && char.role)
        .map(char => ({
          name: char.name,
          role: char.role,
          bio: char.bio,
          visualDescriptors: char.visualDescriptors || ""
        }));
      
      setScriptGenerationStep("🛠️ Setting up temporary workspace for AI generation...");
      
      // 🔒 ENHANCED: Better cleanup scope for temporary projects
      let tempProject: Project | null = null;
      
      try {
        // Create a temporary project to generate structured script
        tempProject = await apiRequest("POST", "/api/projects", {
          title: formValues.title + " (Preview)",
          genre: formValues.genre,
          description: formValues.description,
          artStyle: selectedArtStyle,
          script: "",
          settings: [{ name: "Metro City", description: "A bustling metropolis with towering skyscrapers and busy streets." }],
        }) as Project;
        // 🎯 ENHANCED: Use user-controlled script parameters with robust parsing
        const n = Number(scriptLength);
        const requestedPages = scriptLength === "custom" ? 12 : (Number.isFinite(n) ? n : 12);
        const MIN_PAGES = 6;
        const pageCount = Math.max(MIN_PAGES, requestedPages);
        
        // 🎯 ENHANCED: Build enhanced tone description from multiple selected tones
        const toneMap: Record<string, string> = {
          "action-packed": "Fast-paced with dynamic action sequences and exciting panel-to-panel progression",
          "balanced": "Well-balanced mix of action, dialogue, and character development",
          "dialogue-heavy": "Character-driven with rich dialogue and emotional depth",
          "cinematic": "Visually striking with dramatic camera angles and cinematic storytelling",
          "character-driven": "Focus on character development, relationships, and internal conflicts",
          "mysterious": "Atmospheric with suspense, hidden clues, and gradual revelation",
          "comedic": "Humorous with witty dialogue and entertaining scenarios",
          "dramatic": "Emotionally intense with deep character conflicts",
          "romantic": "Love-focused with intimate character interactions",
          "erotic": "Sensual with mature intimate themes and relationships",
          "dark": "Gritty with mature themes and complex moral issues",
          "fantasy": "Magical with otherworldly elements and mystical storytelling",
          "horror": "Scary with suspenseful and frightening scenarios",
          "sci-fi": "Futuristic with technological and scientific elements",
          "slice-of-life": "Realistic with everyday moments and relatable situations",
          "epic": "Grand scale with heroic themes and sweeping narratives"
        };
        
        // Combine multiple selected tones into rich description
        const selectedToneDescriptions = selectedScriptTones.map(tone => 
          toneMap[tone] || toneMap["balanced"]
        );
        const enhancedTone = selectedToneDescriptions.join(", blended with ");
        
        // Combine genre tone with script tones
        const combinedTone = formValues.genre 
          ? `${formValues.genre} with ${enhancedTone.toLowerCase()}` 
          : enhancedTone;
        
        const toneDisplayText = selectedScriptTones.length > 1 
          ? `${selectedScriptTones.join(" + ")} blend` 
          : selectedScriptTones[0] || "balanced";
        setScriptGenerationStep(`🤖 AI is crafting your ${pageCount}-page ${toneDisplayText} script...`);
        
        // 🔧 ENHANCED: Use consistent apiRequest for all HTTP calls
        const structuredScript = await apiRequest("POST", `/api/projects/${tempProject.id}/generate-structured-script`, {
          title: formValues.title,
          description: formValues.description,
          genre: formValues.genre,
          characters: characterData,
          settings: [{ name: "Metro City", description: "A bustling metropolis with towering skyscrapers and busy streets." }],
          pageCount: pageCount,
          tone: combinedTone,
          logline: formValues.description,
          // 🎯 ENHANCED: User control parameters with multiple tones
          userInstructions: userInstructions.trim() || undefined,
          scriptTones: selectedScriptTones,
          requestedLength: scriptLength
        });
        
        setScriptGenerationStep("✨ Processing your amazing new script...");
        setGeneratedStructuredScript(structuredScript);
        
        setScriptGenerationStep("🎉 Finalizing script preview...");
        
        // Also set a preview text in the form field
        const previewText = `# ${formValues.title} - Structured Script Generated!

✅ ${structuredScript.pages?.length || 5} pages with detailed metadata
✅ Rich panel descriptions with camera angles and shot types
✅ Character dialogue with emotional context
✅ Visual notes optimized for ${selectedArtStyle || 'Comic Book'} style
✅ Scene settings and mood indicators

The full structured script is available for preview below and will be automatically included in your project.`;
        
        form.setValue("script", previewText);
        
        toast({
          title: "Enhanced Script Generated!",
          description: "A structured script with rich metadata has been created for your comic.",
        });
      } finally {
        setScriptGenerationStep("🧹 Cleaning up workspace...");
        // 🔒 BULLETPROOF: Clean up the temporary project with error handling
        if (tempProject?.id) {
          try {
            await apiRequest("DELETE", `/api/projects/${tempProject.id}`);
          } catch (cleanupError) {
            console.warn("Failed to cleanup temporary project:", cleanupError);
            // Don't throw - prioritize user-facing error from main operation
          }
        }
      }
    } catch (error) {
      console.error("Error generating script:", error);
      setScriptGenerationStep("❌ Generation failed");
      
      // 🎯 ENHANCED: Better error messages based on error type
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      let userFriendlyMessage = "Failed to generate structured script. Please try again.";
      let suggestions = [];
      
      if (errorMessage.includes("Failed to fetch") || errorMessage.includes("network")) {
        userFriendlyMessage = "Network connection issue. Please check your internet and try again.";
        suggestions.push("💡 Try again in a few seconds");
      } else if (errorMessage.includes("timeout")) {
        userFriendlyMessage = "Generation took too long. Try a shorter script or simpler requirements.";
        suggestions.push("💡 Try reducing script length or simplifying character details");
      } else if (errorMessage.includes("validation")) {
        userFriendlyMessage = "There was an issue with your story details.";
        suggestions.push("💡 Check that all required fields are filled correctly");
      }
      
      toast({
        title: "Generation Failed 🔄",
        description: userFriendlyMessage + (suggestions.length > 0 ? "\n\n" + suggestions.join("\n") : ""),
        variant: "destructive",
        duration: 8000,
      });
    } finally {
      setIsGeneratingScript(false);
      setScriptGenerationStep("");
    }
  };

  const handleGenerateDescription = async () => {
    const formData = form.getValues();
    if (!formData.title) {
      toast({
        title: "Missing Information",
        description: "Please add a comic title first.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingDescription(true);
    
    try {
      const prompt = `Generate a compelling story description for a ${formData.genre || 'comic'} titled "${formData.title}". Create an engaging synopsis that introduces the world, main conflict, and tone. Keep it concise but exciting. 2-3 sentences.`;
      
      const response = await fetch("/api/generate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json();
      
      form.setValue("description", data.text);
      toast({
        title: "Description Generated!",
        description: "Story description created. Review and edit as needed.",
      });
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: "Unable to generate description. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  const handleGenerateCharacterBio = async (index: number) => {
    const character = characters[index];
    const formData = form.getValues();
    
    if (!character.name || !character.role) {
      toast({
        title: "Missing Information",
        description: "Please enter character name and role first.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingCharacterBio(index);
    
    try {
      const prompt = `Generate a compelling character biography for ${character.name}, a ${character.role} in the ${formData.genre || 'comic'} comic "${formData.title}".

Story Context: ${formData.description || 'A thrilling comic adventure'}
Art Style: ${selectedArtStyle || 'comic-book'} style
Genre: ${formData.genre || 'Adventure'}

Create a biography that fits perfectly within this story world and genre. Include personality traits, background, motivations, and what makes them unique. Consider how they fit into the story context and art style. Keep it engaging and visual for comic storytelling. 2-3 sentences.`;
      
      const response = await fetch("/api/generate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json();
      
      updateCharacter(index, "bio", data.text);
      
      toast({
        title: "Biography Generated!",
        description: "Character biography created successfully.",
      });
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: "Unable to generate biography. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingCharacterBio(null);
    }
  };

  const handleGenerateCharacterVisual = async (index: number) => {
    const character = characters[index];
    const formData = form.getValues();
    
    if (!character.name || !character.bio) {
      toast({
        title: "Missing Information",
        description: "Please enter character name and bio first.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingCharacterVisual(index);
    
    try {
      const prompt = `Generate a detailed visual description for ${character.name}, a ${character.role} in the ${formData.genre || 'comic'} comic "${formData.title}".

Story Context: ${formData.description || 'A thrilling comic adventure'}
Art Style: ${selectedArtStyle || 'comic-book'} style (consider how this affects visual design)
Genre: ${formData.genre || 'Adventure'}
Character Bio: "${character.bio}"

Create a visual description that fits the ${selectedArtStyle || 'comic-book'} art style and ${formData.genre || 'adventure'} genre. Include physical appearance, clothing style, distinctive features, color palette, and visual elements that reflect their personality and role in this specific story world. Focus on details an artist would need to draw them in ${selectedArtStyle || 'comic-book'} style. 2-3 sentences.`;
      
      const response = await fetch("/api/generate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json();
      
      updateCharacter(index, "visualDescriptors", data.text);
      
      toast({
        title: "Visual Description Generated!",
        description: "Character appearance created successfully.",
      });
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: "Unable to generate visual description. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingCharacterVisual(null);
    }
  };

  if (!open) return null;

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center">
      <div className="bg-popover text-popover-foreground rounded-xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-2xl font-serif font-bold">Create New Comic Project</h2>
            <p className="text-sm text-muted-foreground">Set up your story bible and let AI help you create amazing comics</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} data-testid="button-close-modal">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* AI Story Generator Section */}
        <div className="px-6 pt-4 pb-2 bg-gradient-to-r from-primary/5 to-accent/5 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">Need Story Inspiration?</h3>
              <p className="text-sm text-muted-foreground">Let AI create a complete story concept for you in seconds</p>
            </div>
            <Button 
              variant="default"
              size="lg"
              className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-xs sm:text-sm whitespace-nowrap"
              onClick={() => setShowAIStoryGenerator(true)}
              data-testid="button-ai-story-generator"
            >
              <Wand2 className="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              <span className="hidden sm:inline">AI Story Generator</span>
              <span className="sm:hidden">AI Story</span>
            </Button>
          </div>
        </div>

        {/* Generation Complete Banner */}
        {showGenerationCompleteBanner && generationState.generatedResult && (
          <div className="px-6 py-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-b border-green-200 dark:border-green-800">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-green-800 dark:text-green-200">
                    🎉 Story Generated Successfully!
                  </h3>
                  <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    "{generationState.generatedResult.title}"
                  </Badge>
                </div>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Your complete story with {generationState.generatedResult.characters?.length || 0} characters and structured script is ready below. All fields have been automatically filled!
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <Button
                    size="sm"
                    onClick={handleUseGeneratedStory}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Sparkles className="mr-2 h-3 w-3" />
                    Perfect! Use This Story
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDismissGeneration}
                    className="border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-300"
                  >
                    Start Over Instead
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Content */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-6">
            {/* Basic Information */}
            <div className="grid md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Comic Title *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter your comic title..." {...field} data-testid="input-title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="genre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Genre/Theme</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-genre">
                          <SelectValue placeholder="Select a genre" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {genres.map((genre) => (
                          <SelectItem key={genre} value={genre}>{genre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Story Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Story Description</FormLabel>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateDescription}
                      disabled={isGeneratingDescription}
                      data-testid="button-generate-description"
                    >
                      <Wand2 className="mr-1 h-3 w-3" />
                      {isGeneratingDescription ? "Generating..." : "Generate with AI"}
                    </Button>
                  </div>
                  <FormControl>
                    <Textarea 
                      className="resize-none" 
                      rows={3} 
                      placeholder="Briefly describe your comic's story and world..." 
                      {...field}
                      data-testid="textarea-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Art Style */}
            <div>
              <FormLabel className="text-sm font-medium block mb-2">Art Style</FormLabel>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {artStyles.map((style) => (
                  <Card 
                    key={style.id}
                    className={`cursor-pointer transition-colors ${
                      selectedArtStyle === style.id 
                        ? "border-primary bg-accent" 
                        : "border-border hover:border-primary"
                    }`}
                    onClick={() => setSelectedArtStyle(style.id)}
                    data-testid={`art-style-${style.id}`}
                  >
                    <CardContent className="p-3">
                      <div className="aspect-square bg-gradient-to-br from-chart-1/20 to-chart-2/20 rounded mb-2 flex items-center justify-center">
                        <span className="text-2xl">{style.icon}</span>
                      </div>
                      <p className="text-sm font-medium text-center">{style.name}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Characters Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Characters</h3>
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={addCharacter}
                  data-testid="button-add-character"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Character
                </Button>
              </div>
              
              <div className="space-y-4">
                {characters.map((character, index) => (
                  <Card key={index} className="border-border">
                    <CardContent className="p-4">
                      <div className="grid md:grid-cols-3 gap-4">
                        <div>
                          <FormLabel className="text-sm font-medium block mb-2">Character Name</FormLabel>
                          <Input 
                            value={character.name}
                            onChange={(e) => updateCharacter(index, "name", e.target.value)}
                            placeholder="e.g., Captain Thunder"
                            className="text-sm"
                            data-testid={`input-character-name-${index}`}
                          />
                        </div>
                        <div>
                          <FormLabel className="text-sm font-medium block mb-2">Role</FormLabel>
                          <Input 
                            value={character.role}
                            onChange={(e) => updateCharacter(index, "role", e.target.value)}
                            placeholder="e.g., Main Hero"
                            className="text-sm"
                            data-testid={`input-character-role-${index}`}
                          />
                        </div>
                        <div>
                          <FormLabel className="text-sm font-medium block mb-2">Reference Portrait</FormLabel>
                          <div className="space-y-3">
                            {/* Portrait Preview */}
                            <div className="relative">
                              {character.referenceImageUrl ? (
                                <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-border bg-muted">
                                  <img 
                                    src={character.referenceImageUrl} 
                                    alt={`${character.name || 'Character'} reference portrait`}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ) : character.shouldGeneratePortrait ? (
                                <div className="w-16 h-16 rounded-lg border-2 border-primary bg-primary/10 flex items-center justify-center">
                                  <div className="flex flex-col items-center">
                                    <Wand2 className="h-4 w-4 text-primary mb-1" />
                                    <span className="text-xs text-primary font-medium">Scheduled</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="w-16 h-16 rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 flex items-center justify-center">
                                  <Camera className="h-6 w-6 text-muted-foreground/50" />
                                </div>
                              )}
                              
                              {/* Loading overlay */}
                              {(isUploadingReferenceImage === index || isGeneratingPortrait === index) && (
                                <div className="absolute inset-0 bg-background/80 rounded-lg flex items-center justify-center">
                                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                </div>
                              )}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-col gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleGenerateReferencePortrait(index)}
                                disabled={isUploadingReferenceImage === index || isGeneratingPortrait === index}
                                className="h-8 text-xs"
                                data-testid={`button-generate-portrait-${index}`}
                              >
                                {isGeneratingPortrait === index ? (
                                  <>
                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                    Generating...
                                  </>
                                ) : (
                                  <>
                                    <Wand2 className="mr-1 h-3 w-3" />
                                    Generate with AI
                                  </>
                                )}
                              </Button>
                              
                              <div className="relative">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      handleReferenceImageUpload(index, file);
                                    }
                                  }}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                  disabled={isUploadingReferenceImage === index}
                                  data-testid={`input-upload-portrait-${index}`}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={isUploadingReferenceImage === index}
                                  className="h-8 text-xs w-full"
                                  data-testid={`button-upload-portrait-${index}`}
                                >
                                  <Upload className="mr-1 h-3 w-3" />
                                  {isUploadingReferenceImage === index ? "Uploading..." : "Upload Image"}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 grid md:grid-cols-2 gap-4">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <FormLabel className="text-sm font-medium">Biography</FormLabel>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleGenerateCharacterBio(index)}
                              disabled={isGeneratingCharacterBio === index}
                              data-testid={`button-generate-bio-${index}`}
                              className="text-xs"
                            >
                              <Wand2 className="mr-1 h-3 w-3" />
                              {isGeneratingCharacterBio === index ? "Generating..." : "AI Generate"}
                            </Button>
                          </div>
                          <Textarea 
                            value={character.bio}
                            onChange={(e) => updateCharacter(index, "bio", e.target.value)}
                            className="text-sm resize-none" 
                            rows={3} 
                            placeholder="Character background and personality..."
                            data-testid={`textarea-character-bio-${index}`}
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <FormLabel className="text-sm font-medium">Visual Description</FormLabel>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleGenerateCharacterVisual(index)}
                              disabled={isGeneratingCharacterVisual === index}
                              data-testid={`button-generate-visual-${index}`}
                              className="text-xs"
                            >
                              <Wand2 className="mr-1 h-3 w-3" />
                              {isGeneratingCharacterVisual === index ? "Generating..." : "AI Generate"}
                            </Button>
                          </div>
                          <Textarea 
                            value={character.visualDescriptors || ""}
                            onChange={(e) => updateCharacter(index, "visualDescriptors", e.target.value)}
                            className="text-sm resize-none" 
                            rows={3} 
                            placeholder="Hair color, clothing, distinctive features..."
                            data-testid={`textarea-character-visual-${index}`}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Script Section */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Script (Optional)</h3>
              
              {/* 🎯 ENHANCED: User Control Options */}
              <div className="grid md:grid-cols-3 gap-4 mb-6 p-4 bg-muted/50 rounded-lg border">
                <div>
                  <FormLabel className="text-sm font-medium mb-2 block">Script Length</FormLabel>
                  <Select value={scriptLength} onValueChange={setScriptLength}>
                    <SelectTrigger className="h-9" data-testid="select-script-length">
                      <SelectValue placeholder="Choose length" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="6">Short (6 pages)</SelectItem>
                      <SelectItem value="12">Standard (12 pages)</SelectItem>
                      <SelectItem value="20">Extended (20 pages)</SelectItem>
                      <SelectItem value="custom">Custom length...</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">More pages = richer story development</p>
                </div>
                
                <div className="col-span-2">
                  <FormLabel className="text-sm font-medium mb-2 block">
                    Script Tones ({selectedScriptTones.length}/4 selected)
                  </FormLabel>
                  <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                    {scriptToneOptions.map((tone) => {
                      const isSelected = selectedScriptTones.includes(tone.value);
                      const canSelect = selectedScriptTones.length < 4 || isSelected;
                      
                      return (
                        <Button
                          key={tone.value}
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          className={`h-8 text-xs justify-start ${
                            !canSelect ? "opacity-50 cursor-not-allowed" : ""
                          }`}
                          disabled={!canSelect}
                          onClick={() => {
                            if (isSelected) {
                              // Remove tone
                              setSelectedScriptTones(prev => 
                                prev.filter(t => t !== tone.value)
                              );
                            } else if (canSelect) {
                              // Add tone
                              setSelectedScriptTones(prev => 
                                [...prev, tone.value]
                              );
                            }
                          }}
                          data-testid={`button-tone-${tone.value}`}
                        >
                          {tone.label}
                        </Button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Pick up to 4 tones for blended storytelling style
                  </p>
                </div>
                
                <div>
                  <FormLabel className="text-sm font-medium mb-2 block">Special Instructions</FormLabel>
                  <Textarea 
                    value={userInstructions}
                    onChange={(e) => setUserInstructions(e.target.value)}
                    placeholder="e.g., 'Focus on character development', 'Include a plot twist', 'Emphasize humor'..."
                    className="h-9 resize-none text-xs"
                    rows={2}
                    data-testid="textarea-user-instructions"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Guide the AI with your specific needs</p>
                </div>
              </div>
              
              <div className="flex space-x-4 mb-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleGenerateScript}
                  disabled={isGeneratingScript}
                  data-testid="button-generate-script"
                >
                  {isGeneratingScript ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {scriptGenerationStep || "Generating..."}
                    </>
                  ) : (
                    <>
                      <Wand2 className="mr-2 h-4 w-4" />
                      Generate with AI
                    </>
                  )}
                </Button>
              </div>
              
              {/* Structured Script Preview */}
              {generatedStructuredScript && (
                <div className="mb-4">
                  <h4 className="text-md font-medium mb-2 flex items-center">
                    <FileText className="mr-2 h-4 w-4" />
                    Enhanced Script Preview
                  </h4>
                  <Card className="border border-border">
                    <CardContent className="p-4">
                      <ScrollArea className="h-96">
                        <div className="space-y-4">
                          {generatedStructuredScript.pages?.map((page: any, pageIndex: number) => (
                            <Collapsible key={page.id || pageIndex}>
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" className="w-full justify-start p-2 h-auto">
                                  <ChevronRight className="mr-2 h-4 w-4" />
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline">Page {page.pageNumber}</Badge>
                                    <span className="font-medium">{page.title || `Page ${page.pageNumber}`}</span>
                                  </div>
                                </Button>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="pl-6 pt-2">
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <MapPin className="h-3 w-3" />
                                    <span>{page.setting}</span>
                                    {page.overallMood && (
                                      <>
                                        <Separator orientation="vertical" className="h-3" />
                                        <span>Mood: {page.overallMood}</span>
                                      </>
                                    )}
                                  </div>
                                  {page.characters && page.characters.length > 0 && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                      <Users className="h-3 w-3" />
                                      <span>{page.characters.join(", ")}</span>
                                    </div>
                                  )}
                                  {page.narrative && (
                                    <p className="text-sm text-muted-foreground italic">{page.narrative}</p>
                                  )}
                                  
                                  {/* Panels */}
                                  <div className="space-y-2 ml-4">
                                    {page.panels?.map((panel: any, panelIndex: number) => (
                                      <Collapsible key={panel.id || panelIndex}>
                                        <CollapsibleTrigger asChild>
                                          <Button variant="ghost" size="sm" className="w-full justify-start p-1 h-auto">
                                            <ChevronRight className="mr-1 h-3 w-3" />
                                            <Badge variant="secondary" className="mr-2">Panel {panel.panelNumber}</Badge>
                                            <span className="text-xs">{panel.shotType} | {panel.cameraAngle}</span>
                                          </Button>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent className="pl-4 pt-1">
                                          <div className="space-y-1 text-xs">
                                            <div className="flex items-center gap-2">
                                              <Camera className="h-3 w-3" />
                                              <span>{panel.visualDescription}</span>
                                            </div>
                                            {panel.dialogue?.map((dialogue: any, dialogueIndex: number) => (
                                              <div key={dialogueIndex} className="flex items-center gap-2">
                                                <MessageSquare className="h-3 w-3" />
                                                <span><strong>{dialogue.characterName}:</strong> "{dialogue.text}"</span>
                                              </div>
                                            ))}
                                            {panel.soundEffects && (
                                              <div className="flex items-center gap-2">
                                                <Volume2 className="h-3 w-3" />
                                                <span>SFX: {panel.soundEffects}</span>
                                              </div>
                                            )}
                                            {panel.timing && (
                                              <div className="flex items-center gap-2">
                                                <Clock className="h-3 w-3" />
                                                <span>Timing: {panel.timing}</span>
                                              </div>
                                            )}
                                          </div>
                                        </CollapsibleContent>
                                      </Collapsible>
                                    ))}
                                  </div>
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              )}
              
              <FormField
                control={form.control}
                name="script"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea 
                        className="resize-none" 
                        rows={4} 
                        placeholder="Paste your script here, or let AI generate one based on your story description..." 
                        {...field}
                        data-testid="textarea-script"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end space-x-4 pt-6 border-t border-border">
              <Button type="button" variant="ghost" onClick={onClose} data-testid="button-cancel">
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createProjectMutation.isPending}
                data-testid="button-create-project"
              >
                <Wand2 className="mr-2 h-4 w-4" />
                {createProjectMutation.isPending ? "Creating..." : "Create Project"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
      
      {/* AI Story Generator Modal */}
      <AIStoryGenerator
        isOpen={showAIStoryGenerator}
        onClose={() => setShowAIStoryGenerator(false)}
      />
    </div>
  );
}
