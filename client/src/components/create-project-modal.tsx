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
];

const genres = [
  "Superhero",
  "Fantasy", 
  "Sci-Fi",
  "Horror",
  "Romance",
  "Adventure",
  "Comedy",
  "Drama",
  "Mystery"
];

export default function CreateProjectModal({ open, onClose }: CreateProjectModalProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedArtStyle, setSelectedArtStyle] = useState<string>("");
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [generatedStructuredScript, setGeneratedStructuredScript] = useState<any>(null);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [isGeneratingCharacterBio, setIsGeneratingCharacterBio] = useState<number | null>(null);
  const [isGeneratingCharacterVisual, setIsGeneratingCharacterVisual] = useState<number | null>(null);
  const [showAIStoryGenerator, setShowAIStoryGenerator] = useState(false);
  const [characters, setCharacters] = useState([
    { name: "Captain Thunder", role: "Main Hero", bio: "A powerful superhero with lightning abilities, tall with silver hair and a blue cape. Always confident and protective of civilians.", visualDescriptors: "" }
  ]);
  const [showGenerationCompleteBanner, setShowGenerationCompleteBanner] = useState(false);
  
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

      const projectResponse = await apiRequest("POST", "/api/projects", projectData);
      const project = await projectResponse.json() as Project;
      
      // Then create the characters
      const validCharacters = characters.filter(char => char.name && char.role);
      for (const character of validCharacters) {
        await apiRequest("POST", `/api/projects/${project.id}/characters`, {
          name: character.name,
          role: character.role,
          bio: character.bio,
          visualDescriptors: character.visualDescriptors || "",
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
    setCharacters([...characters, { name: "", role: "", bio: "", visualDescriptors: "" }]);
  };

  const updateCharacter = (index: number, field: string, value: string) => {
    const updated = [...characters];
    updated[index] = { ...updated[index], [field]: value };
    setCharacters(updated);
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
      setCharacters(completeStory.characters || []);
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
      { name: "Captain Thunder", role: "Main Hero", bio: "A powerful superhero with lightning abilities, tall with silver hair and a blue cape. Always confident and protective of civilians.", visualDescriptors: "" }
    ]);
    setGeneratedStructuredScript(null);
  };

  const handleGenerateScript = async () => {
    try {
      setIsGeneratingScript(true);
      const formValues = form.getValues();
      
      if (!formValues.title || !formValues.description) {
        toast({
          title: "Missing Information",
          description: "Please fill in title and description before generating a script.",
          variant: "destructive",
        });
        return;
      }

      // Build character data for structured generation
      const characterData = characters
        .filter(char => char.name && char.role)
        .map(char => ({
          name: char.name,
          role: char.role,
          bio: char.bio,
          visualDescriptors: char.visualDescriptors || ""
        }));
      
      // Create a temporary project to generate structured script
      const tempProjectResponse = await apiRequest("POST", "/api/projects", {
        title: formValues.title + " (Preview)",
        genre: formValues.genre,
        description: formValues.description,
        artStyle: selectedArtStyle,
        script: "",
        settings: [{ name: "Metro City", description: "A bustling metropolis with towering skyscrapers and busy streets." }],
      });
      const tempProject = await tempProjectResponse.json() as Project;
      
      try {
        // Generate structured script (minimum 6 pages for all scripts)
        const MIN_PAGES = 6;
        const DEFAULT_PAGES = 12;
        const pageCount = Math.max(MIN_PAGES, DEFAULT_PAGES);
        
        const structuredResponse = await fetch(`/api/projects/${tempProject.id}/generate-structured-script`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formValues.title,
            description: formValues.description,
            genre: formValues.genre,
            characters: characterData,
            settings: [{ name: "Metro City", description: "A bustling metropolis with towering skyscrapers and busy streets." }],
            pageCount: pageCount,
            tone: formValues.genre,
            logline: formValues.description
          }),
        });
        
        if (!structuredResponse.ok) {
          throw new Error("Failed to generate structured script");
        }
        
        const structuredScript = await structuredResponse.json();
        setGeneratedStructuredScript(structuredScript);
        
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
        // Clean up the temporary project
        await apiRequest("DELETE", `/api/projects/${tempProject.id}`);
      }
    } catch (error) {
      console.error("Error generating script:", error);
      toast({
        title: "Generation Failed",
        description: "Failed to generate structured script. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingScript(false);
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
              className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
              onClick={() => setShowAIStoryGenerator(true)}
              data-testid="button-ai-story-generator"
            >
              <Wand2 className="mr-2 h-5 w-5" />
              AI Story Generator
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
                          <FormLabel className="text-sm font-medium block mb-2">Visual Style</FormLabel>
                          <div className="w-12 h-12 bg-chart-1 rounded-full"></div>
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
              <div className="flex space-x-4 mb-4">
                <Button type="button" variant="outline" data-testid="button-upload-script">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Script
                </Button>
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
                      Generating...
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
