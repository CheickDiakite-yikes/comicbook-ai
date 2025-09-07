import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Plus, Upload, Wand2, Palette, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { aiService } from "@/lib/ai-service";
import type { Project } from "@shared/schema";

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
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [isGeneratingCharacter, setIsGeneratingCharacter] = useState(false);
  const [characters, setCharacters] = useState([
    { name: "Captain Thunder", role: "Main Hero", bio: "A powerful superhero with lightning abilities, tall with silver hair and a blue cape. Always confident and protective of civilians." }
  ]);

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
      const response = await apiRequest("POST", "/api/projects", {
        ...data,
        artStyle: selectedArtStyle,
        settings: [{ name: "Metro City", description: "A bustling metropolis with towering skyscrapers and busy streets. The city has a modern feel with glass buildings reflecting sunlight." }],
      });
      return response.json() as Promise<Project>;
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
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
    setCharacters([...characters, { name: "", role: "", bio: "" }]);
  };

  const updateCharacter = (index: number, field: string, value: string) => {
    const updated = [...characters];
    updated[index] = { ...updated[index], [field]: value };
    setCharacters(updated);
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

      const scriptResult = await aiService.generateScript({
        title: formValues.title,
        genre: formValues.genre || "Adventure",
        description: formValues.description,
        characters: characters.filter(char => char.name && char.role),
        settings: [{ name: "Metro City", description: "A bustling metropolis with towering skyscrapers and busy streets." }],
        pageCount: 5,
        tone: formValues.genre || "Adventure",
      });

      // Update the script field with the generated content
      form.setValue("script", scriptResult.script);
      
      toast({
        title: "Script Generated!",
        description: "A story script has been generated for your comic project.",
      });
    } catch (error) {
      console.error("Error generating script:", error);
      toast({
        title: "Generation Failed",
        description: "Failed to generate script. Please try again.",
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

  const handleGenerateCharacter = async () => {
    const formData = form.getValues();
    if (!formData.title) {
      toast({
        title: "Missing Information",
        description: "Please add a comic title first.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingCharacter(true);
    
    try {
      const prompt = `Generate a complete character for the ${formData.genre || 'comic'} story "${formData.title}".
      ${formData.description ? `Story context: ${formData.description}` : ''}
      
      Create a well-rounded character that fits this world. Make them interesting and unique.
      Respond with JSON: {"name": "Character name", "role": "Their role", "bio": "2-3 sentence bio with personality and background"}`;
      
      const response = await fetch("/api/generate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json();
      
      try {
        const characterData = JSON.parse(data.text);
        setCharacters(prev => [...prev, {
          name: characterData.name || "Generated Character",
          role: characterData.role || "Character",
          bio: characterData.bio || "A mysterious character with an unknown past.",
        }]);
        
        toast({
          title: "Character Generated!",
          description: `${characterData.name || 'New character'} has been added to your cast.`,
        });
      } catch (parseError) {
        // Fallback if JSON parsing fails
        setCharacters(prev => [...prev, {
          name: "Generated Character",
          role: "Supporting Character", 
          bio: data.text || "A mysterious character with an unknown past.",
        }]);
        
        toast({
          title: "Character Generated!",
          description: "New character has been added to your cast.",
        });
      }
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: "Unable to generate character. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingCharacter(false);
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
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="secondary"
                    size="sm"
                    onClick={handleGenerateCharacter}
                    disabled={isGeneratingCharacter}
                    data-testid="button-generate-character"
                  >
                    <Wand2 className="mr-2 h-4 w-4" />
                    {isGeneratingCharacter ? "Generating..." : "Generate with AI"}
                  </Button>
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
                      <div className="mt-4">
                        <FormLabel className="text-sm font-medium block mb-2">Character Bio</FormLabel>
                        <Textarea 
                          value={character.bio}
                          onChange={(e) => updateCharacter(index, "bio", e.target.value)}
                          className="text-sm resize-none" 
                          rows={2} 
                          placeholder="Brief character description, personality, and key visual traits..."
                          data-testid={`textarea-character-bio-${index}`}
                        />
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
    </div>
  );
}
