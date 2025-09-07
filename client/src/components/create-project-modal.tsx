import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Plus, Upload, Wand2, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
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
                  <FormLabel>Story Description</FormLabel>
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
                <Button type="button" variant="outline" data-testid="button-generate-script">
                  <Wand2 className="mr-2 h-4 w-4" />
                  Generate with AI
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
