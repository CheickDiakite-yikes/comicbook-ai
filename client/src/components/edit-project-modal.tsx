import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { X, Palette, BookOpen, Users } from "lucide-react";
import type { Project } from "@shared/schema";

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

  const onSubmit = (data: ProjectFormData) => {
    updateProjectMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold">Edit Project</DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose} data-testid="button-close-edit-modal">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                          <FormLabel>Description</FormLabel>
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

            {/* Story Content */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center mb-4">
                  <Users className="mr-2 h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Story Content</h3>
                </div>
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
                            className="min-h-[120px]"
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
                            className="min-h-[100px]"
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

            {/* Actions */}
            <div className="flex justify-end space-x-3">
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