import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { aiService } from "@/lib/ai-service";
import { X, Palette, BookOpen, Users, Wand2, Upload, Plus, Edit, Trash2, Camera, Image } from "lucide-react";
import type { Project, Character } from "@shared/schema";
import StructuredScriptViewer from "./structured-script-viewer";

interface EditProjectModalProps {
  open: boolean;
  onClose: () => void;
  project: Project;
}

const projectSchema = z.object({
  title: z.string().min(1, "Title is required"),
  genre: z.string().optional(),
  description: z.string().optional(),
  artStyle: z.string().optional(),
  script: z.string().optional(),
  canonRules: z.string().optional(),
});

const characterSchema = z.object({
  name: z.string().min(1, "Name is required"),
  role: z.string().optional(),
  bio: z.string().optional(),
  visualDescriptors: z.string().optional(),
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

export default function EditProjectModal({ open, onClose, project }: EditProjectModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedArtStyle, setSelectedArtStyle] = useState<string>("");
  const [activeTab, setActiveTab] = useState("basic");
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [isGeneratingCharacterBio, setIsGeneratingCharacterBio] = useState(false);
  const [isGeneratingCharacterVisual, setIsGeneratingCharacterVisual] = useState(false);
  const [isGeneratingFullCharacter, setIsGeneratingFullCharacter] = useState(false);
  const [isGeneratingReferencePortrait, setIsGeneratingReferencePortrait] = useState<string | null>(null);
  const [isUploadingReferenceImage, setIsUploadingReferenceImage] = useState<string | null>(null);
  const [newCharacter, setNewCharacter] = useState({ name: "", role: "", bio: "", visualDescriptors: "" });
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [showCharacterForm, setShowCharacterForm] = useState(false);
  
  // Check if project has a structured script
  const { data: structuredScript } = useQuery({
    queryKey: ["/api/projects", project.id, "structured-script"],
    enabled: open && !!project.id,
    retry: false,
  });
  
  // aiService is imported as a singleton

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      title: "",
      genre: "",
      description: "",
      artStyle: "",
      script: "",
      canonRules: "",
    },
  });

  // Fetch characters for this project
  const { data: characters = [] } = useQuery<Character[]>({
    queryKey: ["/api/projects", project.id, "characters"],
    enabled: open && !!project.id,
  });

  // Initialize form with project data when modal opens
  useEffect(() => {
    if (open && project) {
      form.reset({
        title: project.title || "",
        genre: project.genre || "",
        description: project.description || "",
        artStyle: project.artStyle || "",
        script: project.script || "",
        canonRules: project.canonRules || "",
      });
      setSelectedArtStyle(project.artStyle || "");
      setActiveTab("basic");
    }
  }, [open, project, form]);

  const updateProjectMutation = useMutation({
    mutationFn: async (data: ProjectFormData) => {
      const response = await apiRequest("PUT", `/api/projects/${project.id}`, {
        ...data,
        artStyle: selectedArtStyle,
        updatedAt: new Date(),
      });
      return response.json() as Promise<Project>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id] });
      toast({
        title: "Project updated",
        description: "Your comic project has been updated successfully!",
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update project. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Character management mutations
  const createCharacterMutation = useMutation({
    mutationFn: async (characterData: typeof newCharacter) => {
      const response = await apiRequest("POST", `/api/projects/${project.id}/characters`, characterData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "characters"] });
      setNewCharacter({ name: "", role: "", bio: "", visualDescriptors: "" });
      setShowCharacterForm(false);
      toast({ title: "Character created", description: "New character added successfully!" });
    },
  });

  const updateCharacterMutation = useMutation({
    mutationFn: async ({ id, ...data }: Character) => {
      const response = await apiRequest("PUT", `/api/characters/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "characters"] });
      setEditingCharacter(null);
      toast({ title: "Character updated", description: "Character updated successfully!" });
    },
  });

  const deleteCharacterMutation = useMutation({
    mutationFn: async (characterId: string) => {
      await apiRequest("DELETE", `/api/characters/${characterId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "characters"] });
      toast({ title: "Character deleted", description: "Character removed successfully!" });
    },
  });

  // Reference portrait generation mutation
  const generateReferencePortraitMutation = useMutation({
    mutationFn: async (characterId: string) => {
      const response = await apiRequest("POST", `/api/characters/${characterId}/generate-reference-portrait`);
      return response.json();
    },
    onSuccess: (_, characterId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "characters"] });
      setIsGeneratingReferencePortrait(null);
      toast({ 
        title: "Reference Portrait Generated", 
        description: "AI reference portrait has been generated successfully!" 
      });
    },
    onError: () => {
      setIsGeneratingReferencePortrait(null);
      toast({ 
        title: "Error", 
        description: "Failed to generate reference portrait. Please try again.", 
        variant: "destructive" 
      });
    },
  });

  // Update character with reference image URL mutation
  const updateCharacterReferenceImageMutation = useMutation({
    mutationFn: async ({ characterId, referenceImageUrl }: { characterId: string; referenceImageUrl: string }) => {
      const response = await apiRequest("PUT", `/api/characters/${characterId}`, { referenceImageUrl });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "characters"] });
      setIsUploadingReferenceImage(null);
      toast({ 
        title: "Reference Image Updated", 
        description: "Character reference image has been uploaded successfully!" 
      });
    },
    onError: () => {
      setIsUploadingReferenceImage(null);
      toast({ 
        title: "Error", 
        description: "Failed to update reference image. Please try again.", 
        variant: "destructive" 
      });
    },
  });

  // Structured script generation mutation
  const generateScriptMutation = useMutation({
    mutationFn: async () => {
      // Enforce minimum 6 pages for all scripts
      const MIN_PAGES = 6;
      const DEFAULT_PAGES = 12;
      const pageCount = Math.max(MIN_PAGES, DEFAULT_PAGES);
      
      const scriptRequest = {
        title: form.getValues("title"),
        genre: form.getValues("genre") || "",
        description: form.getValues("description") || "",
        characters: characters.map(c => ({ name: c.name, role: c.role || "", bio: c.bio || "" })),
        settings: [],
        pageCount: pageCount,
        tone: "engaging and visual",
        logline: form.getValues("description") || "A compelling story unfolds...",
      };
      
      const response = await fetch(`/api/projects/${project.id}/generate-structured-script`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(scriptRequest),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate structured script');
      }
      
      return await response.json();
    },
    onSuccess: (response) => {
      // Update both the basic script field and refetch structured script
      const basicScriptText = `# ${response.title}\n\n${response.logline}\n\n${response.pages.map((page: any, pageIndex: number) => 
        `## Page ${pageIndex + 1}: ${page.title}\n${page.panels.map((panel: any, panelIndex: number) => 
          `**Panel ${panelIndex + 1}**: ${panel.sceneDescription}`).join('\n\n')}`).join('\n\n')}`;
      
      form.setValue("script", basicScriptText);
      // Invalidate structured script query to refetch it
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${project.id}/structured-script`] });
      setIsGeneratingScript(false);
      toast({ title: "Script generated", description: "Enhanced script with detailed metadata generated successfully!" });
    },
    onError: () => {
      setIsGeneratingScript(false);
      toast({ title: "Error", description: "Failed to generate script. Please try again.", variant: "destructive" });
    },
  });

  // Project description generation mutation
  const generateDescriptionMutation = useMutation({
    mutationFn: async () => {
      const prompt = `Generate a compelling comic book description for a ${form.getValues("genre") || "comic"} story titled "${form.getValues("title")}". Make it engaging and visual, describing the premise, main conflicts, and what makes this story unique. Keep it to 2-3 sentences.`;
      const response = await fetch("/api/generate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json();
      return data.text;
    },
    onSuccess: (description) => {
      form.setValue("description", description);
      setIsGeneratingDescription(false);
      toast({ title: "Description generated", description: "AI project description created!" });
    },
    onError: () => {
      setIsGeneratingDescription(false);
      toast({ title: "Error", description: "Failed to generate description.", variant: "destructive" });
    },
  });

  // Character bio generation mutation
  const generateCharacterBioMutation = useMutation({
    mutationFn: async (characterData: { name: string; role: string; genre: string; projectTitle: string }) => {
      const prompt = `Generate a compelling character biography for ${characterData.name}, a ${characterData.role} in the ${characterData.genre} comic "${characterData.projectTitle}". Include personality traits, background, motivations, and what makes them unique. Keep it engaging and visual for comic storytelling. 2-3 sentences.`;
      const response = await fetch("/api/generate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json();
      return data.text;
    },
    onSuccess: (bio) => {
      if (editingCharacter) {
        setEditingCharacter({ ...editingCharacter, bio });
      } else {
        setNewCharacter({ ...newCharacter, bio });
      }
      setIsGeneratingCharacterBio(false);
      toast({ title: "Bio generated", description: "Character biography created!" });
    },
    onError: () => {
      setIsGeneratingCharacterBio(false);
      toast({ title: "Error", description: "Failed to generate bio.", variant: "destructive" });
    },
  });

  // Character visual description generation mutation
  const generateCharacterVisualMutation = useMutation({
    mutationFn: async (characterData: { name: string; role: string; bio: string; genre: string }) => {
      const prompt = `Generate a detailed visual description for ${characterData.name}, a ${characterData.role} in a ${characterData.genre} comic. Based on this bio: "${characterData.bio}". Include physical appearance, clothing style, distinctive features, and visual elements that reflect their personality. Focus on details an artist would need. 2-3 sentences.`;
      const response = await fetch("/api/generate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json();
      return data.text;
    },
    onSuccess: (visualDescriptors) => {
      if (editingCharacter) {
        setEditingCharacter({ ...editingCharacter, visualDescriptors });
      } else {
        setNewCharacter({ ...newCharacter, visualDescriptors });
      }
      setIsGeneratingCharacterVisual(false);
      toast({ title: "Visual description generated", description: "Character appearance created!" });
    },
    onError: () => {
      setIsGeneratingCharacterVisual(false);
      toast({ title: "Error", description: "Failed to generate visual description.", variant: "destructive" });
    },
  });

  // Full character generation mutation
  const generateFullCharacterMutation = useMutation({
    mutationFn: async (roleType?: string) => {
      const response = await apiRequest("POST", `/api/projects/${project.id}/generate-character`, {
        roleType: roleType || undefined
      });
      return response.json();
    },
    onSuccess: (characterData) => {
      setNewCharacter({
        name: characterData.name,
        role: characterData.role,
        bio: characterData.bio,
        visualDescriptors: characterData.visualDescriptors
      });
      setIsGeneratingFullCharacter(false);
      toast({ 
        title: "Character Generated!", 
        description: `${characterData.name} has been created. Review and save the character.` 
      });
    },
    onError: () => {
      setIsGeneratingFullCharacter(false);
      toast({ 
        title: "Error", 
        description: "Failed to generate character. Please try again.", 
        variant: "destructive" 
      });
    },
  });

  const onSubmit = (data: ProjectFormData) => {
    updateProjectMutation.mutate(data);
  };

  const handleGenerateScript = () => {
    setIsGeneratingScript(true);
    generateScriptMutation.mutate();
  };

  const handleCreateCharacter = () => {
    createCharacterMutation.mutate(newCharacter);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === "text/plain") {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        form.setValue("script", content);
        toast({ title: "Script uploaded", description: "Script file has been uploaded successfully!" });
      };
      reader.readAsText(file);
    } else {
      toast({ title: "Error", description: "Please upload a valid text file.", variant: "destructive" });
    }
  };

  const handleGenerateDescription = () => {
    setIsGeneratingDescription(true);
    generateDescriptionMutation.mutate();
  };

  const handleGenerateCharacterBio = () => {
    const characterData = editingCharacter || newCharacter;
    if (!characterData.name || !characterData.role) {
      toast({ title: "Error", description: "Please enter character name and role first.", variant: "destructive" });
      return;
    }
    setIsGeneratingCharacterBio(true);
    generateCharacterBioMutation.mutate({
      name: characterData.name,
      role: characterData.role,
      genre: form.getValues("genre") || "comic",
      projectTitle: form.getValues("title") || "Comic Project",
    });
  };

  const handleGenerateCharacterVisual = () => {
    const characterData = editingCharacter || newCharacter;
    if (!characterData.name || !characterData.bio) {
      toast({ title: "Error", description: "Please enter character name and bio first.", variant: "destructive" });
      return;
    }
    setIsGeneratingCharacterVisual(true);
    generateCharacterVisualMutation.mutate({
      name: characterData.name,
      role: characterData.role || "character",
      bio: characterData.bio,
      genre: form.getValues("genre") || "comic",
    });
  };

  const handleGenerateFullCharacter = (roleType?: string) => {
    setIsGeneratingFullCharacter(true);
    generateFullCharacterMutation.mutate(roleType);
  };

  // Handle reference image upload
  const handleReferenceImageUpload = async (characterId: string, file: File) => {
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

    setIsUploadingReferenceImage(characterId);

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
      updateCharacterReferenceImageMutation.mutate({
        characterId,
        referenceImageUrl: aclData.objectPath
      });

    } catch (error) {
      console.error("Upload error:", error);
      setIsUploadingReferenceImage(null);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle AI reference portrait generation
  const handleGenerateReferencePortrait = (characterId: string) => {
    setIsGeneratingReferencePortrait(characterId);
    generateReferencePortraitMutation.mutate(characterId);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold">Edit Project</DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose} data-testid="button-close-edit-modal">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        
        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-muted p-1 rounded-lg">
          <Button
            type="button"
            variant={activeTab === "basic" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("basic")}
            className="flex-1"
            data-testid="tab-basic"
          >
            <BookOpen className="mr-2 h-4 w-4" />
            Basic Info
          </Button>
          <Button
            type="button"
            variant={activeTab === "characters" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("characters")}
            className="flex-1"
            data-testid="tab-characters"
          >
            <Users className="mr-2 h-4 w-4" />
            Characters ({characters.length})
          </Button>
          <Button
            type="button"
            variant={activeTab === "script" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("script")}
            className="flex-1"
            data-testid="tab-script"
          >
            <Wand2 className="mr-2 h-4 w-4" />
            Script & Story
          </Button>
        </div>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {activeTab === "basic" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Basic Info */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center mb-4">
                    <BookOpen className="mr-2 h-5 w-5 text-primary" />
                    <h3 className="font-semibold">Basic Information</h3>
                  </div>
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Project Title</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Enter your comic title..." 
                              {...field} 
                              data-testid="input-title"
                            />
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
                          <FormLabel>Genre</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-genre">
                                <SelectValue placeholder="Select a genre" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {genres.map((genre) => (
                                <SelectItem key={genre} value={genre}>
                                  {genre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between">
                            <FormLabel>Description</FormLabel>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={handleGenerateDescription}
                              disabled={isGeneratingDescription || !form.getValues("title")}
                              data-testid="button-generate-description"
                              className="text-xs"
                            >
                              <Wand2 className="mr-1 h-3 w-3" />
                              {isGeneratingDescription ? "Generating..." : "AI Generate"}
                            </Button>
                          </div>
                          <FormControl>
                            <Textarea 
                              placeholder="Describe your comic's story, characters, and setting..."
                              className="min-h-[100px]"
                              {...field}
                              data-testid="textarea-description"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Art & Style */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center mb-4">
                    <Palette className="mr-2 h-5 w-5 text-primary" />
                    <h3 className="font-semibold">Art & Style</h3>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-3 block">Art Style</label>
                      <div className="grid grid-cols-2 gap-2">
                        {artStyles.map((style) => (
                          <Button
                            key={style.id}
                            type="button"
                            variant={selectedArtStyle === style.id ? "default" : "outline"}
                            className="h-auto p-3 flex flex-col items-center space-y-1"
                            onClick={() => setSelectedArtStyle(style.id)}
                            data-testid={`art-style-${style.id}`}
                          >
                            <span className="text-lg">{style.icon}</span>
                            <span className="text-xs">{style.name}</span>
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              </div>
            )}

            {activeTab === "characters" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Project Characters</h3>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => handleGenerateFullCharacter()}
                      disabled={isGeneratingFullCharacter}
                      data-testid="button-generate-character"
                    >
                      <Wand2 className="mr-2 h-4 w-4" />
                      {isGeneratingFullCharacter ? "Generating..." : "Generate with AI"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCharacterForm(true)}
                      data-testid="button-add-character"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Character
                    </Button>
                  </div>
                </div>

                {/* Generated Character Display */}
                {!showCharacterForm && newCharacter.name && (
                  <Card className="border-dashed border-2 border-primary/20 bg-primary/5">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-primary">✨ AI Generated Character</h4>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setShowCharacterForm(true)}
                            data-testid="button-edit-generated-character"
                          >
                            <Edit className="mr-1 h-3 w-3" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleCreateCharacter}
                            disabled={createCharacterMutation.isPending}
                            data-testid="button-save-generated-character"
                          >
                            <Plus className="mr-1 h-3 w-3" />
                            Add to Project
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium">Name: <span className="font-normal">{newCharacter.name}</span></p>
                          <p className="text-sm font-medium">Role: <span className="font-normal">{newCharacter.role}</span></p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Bio:</p>
                          <p className="text-sm text-muted-foreground mt-1">{newCharacter.bio}</p>
                        </div>
                      </div>
                      {newCharacter.visualDescriptors && (
                        <div className="mt-3">
                          <p className="text-sm font-medium">Visual Description:</p>
                          <p className="text-sm text-muted-foreground mt-1">{newCharacter.visualDescriptors}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Character Form */}
                {showCharacterForm && (
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-semibold mb-3">
                        {editingCharacter ? "Edit Character" : "New Character"}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium mb-2 block">Name</label>
                          <Input
                            value={editingCharacter ? editingCharacter.name : newCharacter.name}
                            onChange={(e) => editingCharacter 
                              ? setEditingCharacter({...editingCharacter, name: e.target.value})
                              : setNewCharacter({...newCharacter, name: e.target.value})
                            }
                            placeholder="Character name"
                            data-testid="input-character-name"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-2 block">Role</label>
                          <Input
                            value={editingCharacter ? editingCharacter.role || "" : newCharacter.role}
                            onChange={(e) => editingCharacter 
                              ? setEditingCharacter({...editingCharacter, role: e.target.value})
                              : setNewCharacter({...newCharacter, role: e.target.value})
                            }
                            placeholder="Hero, Villain, Sidekick..."
                            data-testid="input-character-role"
                          />
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium">Biography</label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={handleGenerateCharacterBio}
                              disabled={isGeneratingCharacterBio}
                              data-testid="button-generate-character-bio"
                              className="text-xs"
                            >
                              <Wand2 className="mr-1 h-3 w-3" />
                              {isGeneratingCharacterBio ? "Generating..." : "AI Generate"}
                            </Button>
                          </div>
                          <Textarea
                            value={editingCharacter ? editingCharacter.bio || "" : newCharacter.bio}
                            onChange={(e) => editingCharacter 
                              ? setEditingCharacter({...editingCharacter, bio: e.target.value})
                              : setNewCharacter({...newCharacter, bio: e.target.value})
                            }
                            placeholder="Character background and personality..."
                            className="min-h-[80px]"
                            data-testid="textarea-character-bio"
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium">Visual Description</label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={handleGenerateCharacterVisual}
                              disabled={isGeneratingCharacterVisual}
                              data-testid="button-generate-character-visual"
                              className="text-xs"
                            >
                              <Wand2 className="mr-1 h-3 w-3" />
                              {isGeneratingCharacterVisual ? "Generating..." : "AI Generate"}
                            </Button>
                          </div>
                          <Textarea
                            value={editingCharacter ? editingCharacter.visualDescriptors || "" : newCharacter.visualDescriptors}
                            onChange={(e) => editingCharacter 
                              ? setEditingCharacter({...editingCharacter, visualDescriptors: e.target.value})
                              : setNewCharacter({...newCharacter, visualDescriptors: e.target.value})
                            }
                            placeholder="Hair color, clothing, distinctive features..."
                            className="min-h-[80px]"
                            data-testid="textarea-character-visual"
                          />
                        </div>
                      </div>

                      {/* Reference Portrait Section */}
                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-3">
                          <label className="text-sm font-medium">Reference Portrait</label>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const characterId = editingCharacter?.id;
                                if (characterId) {
                                  handleGenerateReferencePortrait(characterId);
                                } else {
                                  toast({
                                    title: "Save Character First",
                                    description: "Please save the character before generating a reference portrait.",
                                    variant: "destructive",
                                  });
                                }
                              }}
                              disabled={isGeneratingReferencePortrait === editingCharacter?.id || !editingCharacter?.id}
                              data-testid="button-generate-reference-portrait"
                              className="text-xs"
                            >
                              <Camera className="mr-1 h-3 w-3" />
                              {isGeneratingReferencePortrait === editingCharacter?.id ? "Generating..." : "Generate with AI"}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = 'image/*';
                                input.onchange = (e) => {
                                  const file = (e.target as HTMLInputElement).files?.[0];
                                  const characterId = editingCharacter?.id;
                                  if (file && characterId) {
                                    handleReferenceImageUpload(characterId, file);
                                  } else if (!characterId) {
                                    toast({
                                      title: "Save Character First",
                                      description: "Please save the character before uploading a reference image.",
                                      variant: "destructive",
                                    });
                                  }
                                };
                                input.click();
                              }}
                              disabled={isUploadingReferenceImage === editingCharacter?.id || !editingCharacter?.id}
                              data-testid="button-upload-reference-image"
                              className="text-xs"
                            >
                              <Upload className="mr-1 h-3 w-3" />
                              {isUploadingReferenceImage === editingCharacter?.id ? "Uploading..." : "Upload Image"}
                            </Button>
                          </div>
                        </div>
                        
                        {/* Reference Portrait Display */}
                        {editingCharacter?.referenceImageUrl ? (
                          <div className="border rounded-lg p-3 bg-muted/20">
                            <div className="flex items-center gap-3">
                              <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                                <img
                                  src={editingCharacter.referenceImageUrl}
                                  alt={`${editingCharacter.name} reference`}
                                  className="w-full h-full object-cover"
                                  data-testid="image-reference-portrait"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">Reference Portrait</p>
                                <p className="text-xs text-muted-foreground">
                                  Use this as a visual reference when drawing {editingCharacter.name}
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-4 text-center">
                            <Image className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                            <p className="text-sm text-muted-foreground">
                              No reference portrait yet
                            </p>
                            <p className="text-xs text-muted-foreground/70 mt-1">
                              {editingCharacter?.id ? "Generate with AI or upload an image above" : "Save character first to add reference portrait"}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex space-x-2 mt-4">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShowCharacterForm(false);
                            setEditingCharacter(null);
                            setNewCharacter({ name: "", role: "", bio: "", visualDescriptors: "" });
                          }}
                          data-testid="button-cancel-character"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={editingCharacter 
                            ? () => updateCharacterMutation.mutate(editingCharacter)
                            : handleCreateCharacter
                          }
                          disabled={createCharacterMutation.isPending || updateCharacterMutation.isPending}
                          data-testid="button-save-character"
                        >
                          {editingCharacter ? "Update" : "Create"} Character
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Characters List */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {characters.map((character) => (
                    <Card key={character.id}>
                      <CardContent className="p-4">
                        <div className="flex gap-3">
                          {/* Reference Portrait Thumbnail */}
                          <div className="flex-shrink-0">
                            {character.referenceImageUrl ? (
                              <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted">
                                <img
                                  src={character.referenceImageUrl}
                                  alt={`${character.name} reference`}
                                  className="w-full h-full object-cover"
                                  data-testid={`image-character-reference-${character.id}`}
                                />
                              </div>
                            ) : (
                              <div className="w-16 h-16 rounded-lg bg-muted/30 border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
                                <Image className="h-6 w-6 text-muted-foreground/40" />
                              </div>
                            )}
                          </div>
                          
                          {/* Character Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold truncate">{character.name}</h4>
                                {character.role && (
                                  <p className="text-sm text-muted-foreground">{character.role}</p>
                                )}
                                {character.bio && (
                                  <p className="text-sm mt-2 line-clamp-2">{character.bio}</p>
                                )}
                              </div>
                              
                              {/* Action Buttons */}
                              <div className="flex flex-col space-y-1 ml-2">
                                <div className="flex space-x-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setEditingCharacter(character);
                                      setShowCharacterForm(true);
                                    }}
                                    data-testid={`button-edit-character-${character.id}`}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteCharacterMutation.mutate(character.id)}
                                    disabled={deleteCharacterMutation.isPending}
                                    data-testid={`button-delete-character-${character.id}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                                
                                {/* Reference Portrait Quick Actions */}
                                <div className="flex space-x-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleGenerateReferencePortrait(character.id)}
                                    disabled={isGeneratingReferencePortrait === character.id}
                                    data-testid={`button-generate-portrait-${character.id}`}
                                    className="text-xs px-2"
                                  >
                                    <Camera className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const input = document.createElement('input');
                                      input.type = 'file';
                                      input.accept = 'image/*';
                                      input.onchange = (e) => {
                                        const file = (e.target as HTMLInputElement).files?.[0];
                                        if (file) {
                                          handleReferenceImageUpload(character.id, file);
                                        }
                                      };
                                      input.click();
                                    }}
                                    disabled={isUploadingReferenceImage === character.id}
                                    data-testid={`button-upload-portrait-${character.id}`}
                                    className="text-xs px-2"
                                  >
                                    <Upload className="h-3 w-3" />
                                  </Button>
                                </div>
                                
                                {/* Loading Indicators */}
                                {(isGeneratingReferencePortrait === character.id || isUploadingReferenceImage === character.id) && (
                                  <div className="text-xs text-muted-foreground text-center mt-1">
                                    {isGeneratingReferencePortrait === character.id ? "Generating..." : "Uploading..."}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {characters.length === 0 && !showCharacterForm && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No characters yet. Add some characters to bring your story to life!</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "script" && (
              <div className="space-y-6">
                {/* Script Generation */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <Wand2 className="mr-2 h-5 w-5 text-primary" />
                        <h3 className="font-semibold">AI Script Generation</h3>
                      </div>
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={handleGenerateScript}
                        disabled={isGeneratingScript}
                        data-testid="button-generate-script"
                      >
                        <Wand2 className="mr-2 h-4 w-4" />
                        {isGeneratingScript ? "Generating..." : "Generate Script"}
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Generate an AI-powered script based on your project details and characters, or upload your own script file.
                    </p>
                  </CardContent>
                </Card>

                {/* Enhanced Script Preview */}
                {structuredScript ? (
                  <Card>
                    <CardContent className="p-4">
                      <div className="mb-4">
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                          <BookOpen className="h-5 w-5" />
                          Enhanced Script Preview
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Your AI-generated structured script with detailed metadata for comic creation.
                        </p>
                      </div>
                      <StructuredScriptViewer projectId={project.id} />
                    </CardContent>
                  </Card>
                ) : (
                  /* Fallback to basic script editing if no structured script */
                  <Card>
                    <CardContent className="p-4">
                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="script"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Script</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Write your comic script or story outline here, or generate an AI script above..."
                                  className="min-h-[200px]"
                                  {...field}
                                  data-testid="textarea-script"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="canonRules"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Story Rules & Canon</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Define important rules, character traits, world-building details that should remain consistent..."
                                  className="min-h-[120px]"
                                  {...field}
                                  data-testid="textarea-canon-rules"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel">
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={updateProjectMutation.isPending}
                data-testid="button-update-project"
              >
                {updateProjectMutation.isPending ? "Updating..." : "Update Project"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}