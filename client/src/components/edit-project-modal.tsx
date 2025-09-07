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
import { X, Palette, BookOpen, Users, Wand2, Upload, Plus, Edit, Trash2 } from "lucide-react";
import type { Project, Character } from "@shared/schema";

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
  const [newCharacter, setNewCharacter] = useState({ name: "", role: "", bio: "", visualDescriptors: "" });
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [showCharacterForm, setShowCharacterForm] = useState(false);
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
    queryFn: async () => {
      const response = await fetch(`/api/projects/${project.id}/characters`);
      return response.json();
    },
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

  // Script generation mutation
  const generateScriptMutation = useMutation({
    mutationFn: async () => {
      const scriptRequest = {
        title: form.getValues("title"),
        genre: form.getValues("genre") || "",
        description: form.getValues("description") || "",
        characters: characters.map(c => ({ name: c.name, role: c.role || "", bio: c.bio || "" })),
        settings: [],
        pageCount: 5,
        tone: "engaging and visual",
      };
      return await aiService.generateScript(scriptRequest);
    },
    onSuccess: (response) => {
      form.setValue("script", response.script);
      setIsGeneratingScript(false);
      toast({ title: "Script generated", description: "AI script has been generated successfully!" });
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
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold">{character.name}</h4>
                            {character.role && (
                              <p className="text-sm text-muted-foreground">{character.role}</p>
                            )}
                            {character.bio && (
                              <p className="text-sm mt-2 line-clamp-2">{character.bio}</p>
                            )}
                          </div>
                          <div className="flex space-x-1 ml-2">
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
                      <div className="flex space-x-2">
                        <label htmlFor="script-upload" className="cursor-pointer">
                          <input
                            id="script-upload"
                            type="file"
                            accept=".txt"
                            onChange={handleFileUpload}
                            className="hidden"
                            data-testid="input-script-upload"
                          />
                          <Button type="button" variant="outline" size="sm">
                            <Upload className="mr-2 h-4 w-4" />
                            Upload Script
                          </Button>
                        </label>
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
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Generate an AI-powered script based on your project details and characters, or upload your own script file.
                    </p>
                  </CardContent>
                </Card>

                {/* Script Content */}
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
                                placeholder="Write your comic script or story outline here..."
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