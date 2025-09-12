import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Shirt, Wand2, X, Loader2, Palette, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Character, Project, Panel } from "@shared/schema";

interface CharacterDressRoomProps {
  character: Character;
  project: Project;
  currentPanel?: Panel;
  selectedPanelNumber?: number | null;
  isOpen: boolean;
  onClose: () => void;
  onCharacterRedressed?: (panelId: number, imageUrl: string) => void;
}

export default function CharacterDressRoom({
  character,
  project,
  currentPanel,
  selectedPanelNumber,
  isOpen,
  onClose,
  onCharacterRedressed
}: CharacterDressRoomProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Outfit customization state
  const [outfitType, setOutfitType] = useState<string>("casual");
  const [clothingStyle, setClothingStyle] = useState<string>("modern");
  const [colorScheme, setColorScheme] = useState<string>("character-default");
  const [customDescription, setCustomDescription] = useState<string>("");
  const [occasion, setOccasion] = useState<string>("everyday");
  
  // Predefined outfit options
  const outfitTypes = [
    { value: "casual", label: "Casual Wear", description: "Comfortable everyday clothing" },
    { value: "formal", label: "Formal Wear", description: "Business or elegant attire" },
    { value: "party", label: "Party Outfit", description: "Festive and stylish clothing" },
    { value: "athletic", label: "Athletic Wear", description: "Sportswear and activewear" },
    { value: "vintage", label: "Vintage Style", description: "Classic retro fashion" },
    { value: "fantasy", label: "Fantasy Costume", description: "Imaginative or themed outfits" },
    { value: "lingerie", label: "Intimate Wear", description: "Elegant and sensual attire" },
    { value: "swimwear", label: "Swimwear", description: "Beach and pool attire" },
    { value: "custom", label: "Custom Design", description: "Describe your own vision" }
  ];

  const clothingStyles = [
    { value: "modern", label: "Modern" },
    { value: "classic", label: "Classic" },
    { value: "edgy", label: "Edgy" },
    { value: "romantic", label: "Romantic" },
    { value: "minimalist", label: "Minimalist" },
    { value: "bohemian", label: "Bohemian" },
    { value: "gothic", label: "Gothic" },
    { value: "punk", label: "Punk" },
    { value: "elegant", label: "Elegant" }
  ];

  const colorSchemes = [
    { value: "character-default", label: "Character's Colors" },
    { value: "black-white", label: "Black & White" },
    { value: "earth-tones", label: "Earth Tones" },
    { value: "bright-colors", label: "Bright Colors" },
    { value: "pastels", label: "Pastel Colors" },
    { value: "jewel-tones", label: "Jewel Tones" },
    { value: "monochrome", label: "Monochrome" },
    { value: "rainbow", label: "Rainbow" }
  ];

  const occasions = [
    { value: "everyday", label: "Everyday" },
    { value: "work", label: "Work/Professional" },
    { value: "date", label: "Date Night" },
    { value: "party", label: "Party/Celebration" },
    { value: "wedding", label: "Wedding" },
    { value: "beach", label: "Beach/Vacation" },
    { value: "workout", label: "Workout/Gym" },
    { value: "sleep", label: "Sleep/Lounge" },
    { value: "special", label: "Special Event" }
  ];

  // Character redressing mutation
  const redressCharacterMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPanelNumber) {
        throw new Error("No panel selected for character redressing");
      }

      // Build the outfit description
      const selectedOutfit = outfitTypes.find(o => o.value === outfitType);
      const selectedStyle = clothingStyles.find(s => s.value === clothingStyle);
      const selectedColors = colorSchemes.find(c => c.value === colorScheme);
      const selectedOccasion = occasions.find(o => o.value === occasion);

      let outfitDescription = "";
      
      if (outfitType === "custom" && customDescription.trim()) {
        outfitDescription = customDescription.trim();
      } else {
        outfitDescription = `${selectedOutfit?.label || "casual"} ${selectedStyle?.label || "modern"} outfit`;
        if (selectedOccasion && selectedOccasion.value !== "everyday") {
          outfitDescription += ` for ${selectedOccasion.label.toLowerCase()}`;
        }
        if (selectedColors && selectedColors.value !== "character-default") {
          outfitDescription += ` in ${selectedColors.label.toLowerCase()}`;
        }
      }

      const response = await apiRequest("POST", "/api/redress-character", {
        characterId: character.id,
        panelId: selectedPanelNumber,
        projectId: project.id,
        outfitDescription,
        outfitType,
        clothingStyle,
        colorScheme,
        occasion
      });

      return response;
    },
    onSuccess: (data) => {
      toast({
        title: "Character redressed successfully!",
        description: `${character.name} has been given a new outfit in the panel.`,
      });
      
      // Invalidate relevant queries to refresh the UI
      queryClient.invalidateQueries({ 
        queryKey: ["/api/pages", currentPanel?.pageId, "panels"] 
      });

      // Call the callback if provided
      if (onCharacterRedressed && selectedPanelNumber && data && typeof data === 'object' && 'imageUrl' in data) {
        onCharacterRedressed(selectedPanelNumber, (data as any).imageUrl);
      }

      onClose();
    },
    onError: (error) => {
      console.error("Character redressing failed:", error);
      toast({
        title: "Redressing failed",
        description: error instanceof Error ? error.message : "Failed to redress character. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleRedress = () => {
    if (!selectedPanelNumber) {
      toast({
        title: "No panel selected",
        description: "Please select a panel before redressing the character.",
        variant: "destructive",
      });
      return;
    }
    redressCharacterMutation.mutate();
  };

  const selectedOutfit = outfitTypes.find(o => o.value === outfitType);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shirt className="h-5 w-5 text-chart-1" />
            Dress Room - {character.name}
          </DialogTitle>
          <DialogDescription>
            Customize {character.name}'s outfit for {selectedPanelNumber ? `Panel ${selectedPanelNumber}` : "the selected panel"}. 
            The AI will generate a new image with the character wearing your chosen outfit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Character Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Character Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{character.role || "Character"}</Badge>
                {character.alwaysTraits && (
                  <Badge variant="secondary">Always: {character.alwaysTraits}</Badge>
                )}
              </div>
              {character.visualDescriptors && (
                <p className="text-sm text-muted-foreground">
                  <strong>Visual:</strong> {character.visualDescriptors}
                </p>
              )}
              {character.colorScheme && (
                <p className="text-sm text-muted-foreground">
                  <strong>Color Scheme:</strong> {character.colorScheme}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Outfit Type Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Outfit Type</label>
            <Select value={outfitType} onValueChange={setOutfitType}>
              <SelectTrigger data-testid="select-outfit-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {outfitTypes.map((outfit) => (
                  <SelectItem key={outfit.value} value={outfit.value}>
                    <div>
                      <div className="font-medium">{outfit.label}</div>
                      <div className="text-xs text-muted-foreground">{outfit.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedOutfit && (
              <p className="text-xs text-muted-foreground">{selectedOutfit.description}</p>
            )}
          </div>

          {/* Custom Description for custom outfit type */}
          {outfitType === "custom" && (
            <div className="space-y-3">
              <label className="text-sm font-medium">Custom Outfit Description</label>
              <Textarea
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                placeholder="Describe the outfit you want for this character..."
                className="min-h-[80px]"
                data-testid="textarea-custom-outfit"
              />
            </div>
          )}

          {/* Style and Aesthetic Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <label className="text-sm font-medium">Clothing Style</label>
              <Select value={clothingStyle} onValueChange={setClothingStyle}>
                <SelectTrigger data-testid="select-clothing-style">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {clothingStyles.map((style) => (
                    <SelectItem key={style.value} value={style.value}>
                      {style.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">Occasion</label>
              <Select value={occasion} onValueChange={setOccasion}>
                <SelectTrigger data-testid="select-occasion">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {occasions.map((occ) => (
                    <SelectItem key={occ.value} value={occ.value}>
                      {occ.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Color Scheme */}
          <div className="space-y-3">
            <label className="text-sm font-medium flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Color Scheme
            </label>
            <Select value={colorScheme} onValueChange={setColorScheme}>
              <SelectTrigger data-testid="select-color-scheme">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {colorSchemes.map((scheme) => (
                  <SelectItem key={scheme.value} value={scheme.value}>
                    {scheme.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Preview Summary */}
          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-chart-2" />
                <span className="text-sm font-medium">Outfit Preview</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {character.name} will be dressed in a{" "}
                <span className="font-medium">
                  {outfitType === "custom" && customDescription.trim() 
                    ? customDescription.trim()
                    : `${selectedOutfit?.label?.toLowerCase()} ${clothingStyles.find(s => s.value === clothingStyle)?.label?.toLowerCase()} outfit`
                  }
                </span>
                {occasion !== "everyday" && (
                  <span> for {occasions.find(o => o.value === occasion)?.label?.toLowerCase()}</span>
                )}
                {colorScheme !== "character-default" && (
                  <span> in {colorSchemes.find(c => c.value === colorScheme)?.label?.toLowerCase()}</span>
                )}
                .
              </p>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={onClose}
            data-testid="button-cancel-dress-room"
          >
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button 
            onClick={handleRedress}
            disabled={redressCharacterMutation.isPending || !selectedPanelNumber}
            data-testid="button-redress-character"
          >
            {redressCharacterMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Redressing...
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                Redress Character
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}