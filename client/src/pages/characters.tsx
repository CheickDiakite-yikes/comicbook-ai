import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/sidebar";
import { Users, Plus, Edit2, Trash2, Search, UserCircle, ImageIcon } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Character } from "@shared/schema";

export default function Characters() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);

  // Form state for create/edit
  const [characterForm, setCharacterForm] = useState({
    name: "",
    role: "",
    bio: "",
    visualDescriptors: "",
    alwaysTraits: "",
    neverTraits: "",
    referenceImageUrl: "",
    colorScheme: "",
  });

  // Fetch library characters
  const { data: characters = [], isLoading } = useQuery({
    queryKey: ["/api/characters/library"],
  });

  // Create character mutation
  const createCharacterMutation = useMutation({
    mutationFn: async (characterData: typeof characterForm) => {
      return await fetch("/api/characters/library", {
        method: "POST",
        body: JSON.stringify(characterData),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/characters/library"] });
      resetForm();
      setIsCreateDialogOpen(false);
      toast({
        title: "Character created!",
        description: "Your character has been added to your library.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create character. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update character mutation
  const updateCharacterMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof characterForm }) => {
      return await fetch(`/api/characters/library/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/characters/library"] });
      resetForm();
      setEditingCharacter(null);
      toast({
        title: "Character updated!",
        description: "Your character has been successfully updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update character. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete character mutation
  const deleteCharacterMutation = useMutation({
    mutationFn: async (id: string) => {
      return await fetch(`/api/characters/library/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/characters/library"] });
      toast({
        title: "Character deleted!",
        description: "Your character has been removed from your library.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete character. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setCharacterForm({
      name: "",
      role: "",
      bio: "",
      visualDescriptors: "",
      alwaysTraits: "",
      neverTraits: "",
      referenceImageUrl: "",
      colorScheme: "",
    });
  };

  const openEditDialog = (character: Character) => {
    setCharacterForm({
      name: character.name,
      role: character.role || "",
      bio: character.bio || "",
      visualDescriptors: character.visualDescriptors || "",
      alwaysTraits: character.alwaysTraits || "",
      neverTraits: character.neverTraits || "",
      referenceImageUrl: character.referenceImageUrl || "",
      colorScheme: character.colorScheme || "",
    });
    setEditingCharacter(character);
  };

  const handleSubmit = () => {
    if (!characterForm.name.trim()) {
      toast({
        title: "Error",
        description: "Character name is required.",
        variant: "destructive",
      });
      return;
    }

    if (editingCharacter) {
      updateCharacterMutation.mutate({ id: editingCharacter.id, data: characterForm });
    } else {
      createCharacterMutation.mutate(characterForm);
    }
  };

  // Filter characters based on search term
  const filteredCharacters = (characters as Character[]).filter((character: Character) =>
    character.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (character.role && character.role.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (isLoading) {
    return (
      <>
        <Sidebar />
        <main className="flex-1 pl-64">
          <div className="container mx-auto p-8">
            <div className="flex items-center justify-center h-64">
              <div className="text-muted-foreground">Loading characters...</div>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Sidebar />
      <main className="flex-1 pl-64">
        <div className="container mx-auto pt-6 px-8 pb-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
                  <Users className="w-8 h-8 text-white" />
                </div>
                Character Library
              </h1>
              <p className="text-muted-foreground mt-2 text-lg">
                Create and manage your personal character collection
              </p>
            </div>
            
            <div className="flex gap-3">
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={resetForm} data-testid="button-create-character" className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Character
                  </Button>
                </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Character</DialogTitle>
                </DialogHeader>
                <CharacterForm
                  characterForm={characterForm}
                  setCharacterForm={setCharacterForm}
                  onSubmit={handleSubmit}
                  isLoading={createCharacterMutation.isPending}
                  onCancel={() => setIsCreateDialogOpen(false)}
                />
              </DialogContent>
            </Dialog>
            
            <Button variant="outline" onClick={() => window.location.href = '/dashboard'} data-testid="button-import-from-projects">
              Import from Projects
            </Button>
            </div>
          </div>

          {/* Search and Stats */}
          <div className="flex items-center gap-4 mb-8">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search characters..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11 bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800 focus:border-purple-300 focus:ring-purple-200"
                data-testid="input-search-characters"
              />
            </div>
            <Badge variant="secondary" className="text-sm px-4 py-2 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 border-purple-200">
              {filteredCharacters.length} character{filteredCharacters.length !== 1 ? 's' : ''}
            </Badge>
          </div>

          {/* Characters Grid */}
          {filteredCharacters.length === 0 && !searchTerm ? (
            <div className="text-center py-16">
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 rounded-2xl p-12 max-w-2xl mx-auto">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full w-24 h-24 mx-auto opacity-20 animate-pulse"></div>
                  <UserCircle className="w-24 h-24 text-purple-500 mx-auto mb-6 relative" />
                </div>
                
                <h3 className="text-2xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Build Your Character Library
                </h3>
                
                <p className="text-muted-foreground mb-2 text-lg leading-relaxed">
                  Your Character Library is empty, but I noticed you have characters in your comic projects!
                </p>
                
                <p className="text-sm text-muted-foreground mb-8 max-w-lg mx-auto">
                  Characters in your library can be reused across multiple projects, while project characters stay within their specific comics.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button 
                    onClick={() => setIsCreateDialogOpen(true)} 
                    data-testid="button-create-first-character"
                    className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create New Character
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    onClick={() => window.location.href = '/dashboard'}
                    data-testid="button-go-to-projects"
                    className="border-purple-200 hover:bg-purple-50"
                  >
                    <Users className="w-4 h-4 mr-2" />
                    View Project Characters
                  </Button>
                </div>
              </div>
            </div>
          ) : filteredCharacters.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <Search className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No matching characters</h3>
                <p className="text-muted-foreground">
                  Try adjusting your search terms
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCharacters.map((character: Character) => (
                <CharacterCard
                  key={character.id}
                  character={character}
                  onEdit={() => openEditDialog(character)}
                  onDelete={() => deleteCharacterMutation.mutate(character.id)}
                />
              ))}
            </div>
          )}

          {/* Edit Dialog */}
          <Dialog open={!!editingCharacter} onOpenChange={() => setEditingCharacter(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Edit Character</DialogTitle>
              </DialogHeader>
              <CharacterForm
                characterForm={characterForm}
                setCharacterForm={setCharacterForm}
                onSubmit={handleSubmit}
                isLoading={updateCharacterMutation.isPending}
                onCancel={() => setEditingCharacter(null)}
                isEditing
              />
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </>
  );
}

interface CharacterFormProps {
  characterForm: any;
  setCharacterForm: (form: any) => void;
  onSubmit: () => void;
  isLoading: boolean;
  onCancel: () => void;
  isEditing?: boolean;
}

function CharacterForm({ characterForm, setCharacterForm, onSubmit, isLoading, onCancel, isEditing }: CharacterFormProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Character Name</Label>
          <Input
            id="name"
            placeholder="Enter character name"
            value={characterForm.name}
            onChange={(e) => setCharacterForm({ ...characterForm, name: e.target.value })}
            data-testid="input-character-name"
          />
        </div>
        <div>
          <Label htmlFor="role">Role</Label>
          <Input
            id="role"
            placeholder="e.g., Protagonist, Villain, Sidekick"
            value={characterForm.role}
            onChange={(e) => setCharacterForm({ ...characterForm, role: e.target.value })}
            data-testid="input-character-role"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="bio">Biography</Label>
        <Textarea
          id="bio"
          placeholder="Character background, personality, motivations..."
          value={characterForm.bio}
          onChange={(e) => setCharacterForm({ ...characterForm, bio: e.target.value })}
          rows={3}
          data-testid="textarea-character-bio"
        />
      </div>

      <div>
        <Label htmlFor="visualDescriptors">Visual Description</Label>
        <Textarea
          id="visualDescriptors"
          placeholder="Physical appearance, clothing, distinctive features..."
          value={characterForm.visualDescriptors}
          onChange={(e) => setCharacterForm({ ...characterForm, visualDescriptors: e.target.value })}
          rows={3}
          data-testid="textarea-character-visual"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="alwaysTraits">Always Show Traits</Label>
          <Textarea
            id="alwaysTraits"
            placeholder="Traits that should always appear..."
            value={characterForm.alwaysTraits}
            onChange={(e) => setCharacterForm({ ...characterForm, alwaysTraits: e.target.value })}
            rows={2}
            data-testid="textarea-always-traits"
          />
        </div>
        <div>
          <Label htmlFor="neverTraits">Never Show Traits</Label>
          <Textarea
            id="neverTraits"
            placeholder="Traits to avoid..."
            value={characterForm.neverTraits}
            onChange={(e) => setCharacterForm({ ...characterForm, neverTraits: e.target.value })}
            rows={2}
            data-testid="textarea-never-traits"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="referenceImageUrl">Reference Image URL</Label>
          <Input
            id="referenceImageUrl"
            placeholder="https://example.com/image.jpg"
            value={characterForm.referenceImageUrl}
            onChange={(e) => setCharacterForm({ ...characterForm, referenceImageUrl: e.target.value })}
            data-testid="input-reference-image"
          />
        </div>
        <div>
          <Label htmlFor="colorScheme">Color Scheme</Label>
          <Input
            id="colorScheme"
            placeholder="e.g., Blue and silver, Dark red, etc."
            value={characterForm.colorScheme}
            onChange={(e) => setCharacterForm({ ...characterForm, colorScheme: e.target.value })}
            data-testid="input-color-scheme"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onCancel} disabled={isLoading} data-testid="button-cancel">
          Cancel
        </Button>
        <Button onClick={onSubmit} disabled={isLoading} data-testid="button-save-character">
          {isLoading ? "Saving..." : isEditing ? "Update Character" : "Create Character"}
        </Button>
      </div>
    </div>
  );
}

interface CharacterCardProps {
  character: Character;
  onEdit: () => void;
  onDelete: () => void;
}

function CharacterCard({ character, onEdit, onDelete }: CharacterCardProps) {
  return (
    <Card className="group hover:shadow-xl transition-all duration-300 hover:scale-[1.02] border-gray-200 dark:border-gray-800 bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-950/50">
      <CardContent className="p-6">
        {/* Character Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <Avatar className="w-12 h-12">
              <AvatarImage src={character.referenceImageUrl || ""} />
              <AvatarFallback className="bg-chart-4 text-white">
                {character.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-lg">{character.name}</h3>
              {character.role && (
                <Badge variant="secondary" className="mt-1">
                  {character.role}
                </Badge>
              )}
            </div>
          </div>
          
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
            <Button variant="ghost" size="sm" onClick={onEdit} data-testid={`button-edit-${character.id}`}>
              <Edit2 className="w-4 h-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" data-testid={`button-delete-${character.id}`}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Character</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{character.name}"? This action cannot be undone.
                    This will not affect any characters already used in your projects.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Character Details */}
        <div className="space-y-3">
          {character.bio && (
            <div>
              <p className="text-sm text-muted-foreground line-clamp-3">
                {character.bio}
              </p>
            </div>
          )}

          {character.visualDescriptors && (
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Visual</span>
              <p className="text-sm line-clamp-2 mt-1">
                {character.visualDescriptors}
              </p>
            </div>
          )}

          {character.colorScheme && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-3 h-3 rounded-full bg-chart-2"></div>
              {character.colorScheme}
            </div>
          )}
        </div>

        {/* Character Image Preview */}
        {character.referenceImageUrl && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ImageIcon className="w-3 h-3" />
              Reference image available
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}