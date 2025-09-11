import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Palette, User, Shirt, Eye } from "lucide-react";
import { RedressModal } from "@/components/redress-modal";
import type { Character } from "@shared/schema";

interface EnhancedCharacterCardProps {
  character: Character;
  index: number;
  panelId?: string;
  allCharacters?: Character[];
  onOutfitChange?: (characterId: string, newOutfit: string) => void;
}

export function EnhancedCharacterCard({ 
  character, 
  index, 
  panelId,
  allCharacters = [],
  onOutfitChange 
}: EnhancedCharacterCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRedressModalOpen, setIsRedressModalOpen] = useState(false);

  // Generate avatar background colors based on index
  const getAvatarColor = (idx: number) => {
    const colors = [
      'bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5',
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500', 'bg-orange-500'
    ];
    return colors[idx % colors.length];
  };

  // Helper function to safely render text fields
  const safeRenderText = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    return '';
  };

  // Parse traits into displayable format
  const parseTraits = (traits: string | null | undefined | unknown): string[] => {
    if (!traits || typeof traits !== 'string') return [];
    return traits.split(',').map(trait => trait.trim()).filter(Boolean).slice(0, 3);
  };

  const alwaysTraits = parseTraits(character.alwaysTraits);
  const visualDescriptors = parseTraits(character.visualDescriptors);

  // Parse color scheme into color array
  const parseColorScheme = (colorScheme: string | null | undefined | unknown): string[] => {
    if (!colorScheme || typeof colorScheme !== 'string') return [];
    // Handle common color scheme formats: "red, blue, green" or "#ff0000, #0000ff, #00ff00"
    return colorScheme.split(',').map(color => color.trim()).filter(Boolean).slice(0, 4);
  };

  const colors = parseColorScheme(character.colorScheme);

  // Truncate bio for preview
  const truncateBio = (bio: string | null | undefined, maxLength: number = 80): { text: string; isTruncated: boolean } => {
    if (!bio) return { text: '', isTruncated: false };
    if (bio.length <= maxLength) return { text: bio, isTruncated: false };
    
    // Find the last complete sentence within the limit
    const truncated = bio.substring(0, maxLength);
    const lastSentence = truncated.lastIndexOf('.');
    const cutoff = lastSentence > maxLength * 0.5 ? lastSentence + 1 : maxLength;
    
    return {
      text: bio.substring(0, cutoff) + '...',
      isTruncated: true
    };
  };

  const bioPreview = truncateBio(character.bio);

  return (
    <Card 
      className="border-border bg-card/50 hover:bg-card/80 transition-colors duration-200"
      data-testid={`character-card-${character.id}`}
    >
      <CardContent className="p-3">
        <div className="space-y-3">
          {/* Character Header */}
          <div className="flex items-start space-x-3">
            <Avatar className="h-12 w-12 border-2 border-muted">
              <AvatarImage 
                src={character.referenceImageUrl || undefined} 
                alt={character.name}
                className="object-cover"
              />
              <AvatarFallback className={getAvatarColor(index)}>
                <User className="h-6 w-6 text-white" />
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-sm truncate" data-testid={`text-character-name-${character.id}`}>
                    {safeRenderText(character.name)}
                  </h4>
                  {character.role && (
                    <p className="text-xs text-muted-foreground capitalize" data-testid={`text-character-role-${character.id}`}>
                      {safeRenderText(character.role)}
                    </p>
                  )}
                </div>
                
                {/* Color Scheme Display */}
                {colors.length > 0 && (
                  <div className="flex items-center space-x-1" data-testid={`color-scheme-${character.id}`}>
                    <Palette className="h-3 w-3 text-muted-foreground" />
                    <div className="flex space-x-1">
                      {colors.map((color, idx) => (
                        <div
                          key={idx}
                          className="w-3 h-3 rounded-full border border-border"
                          style={{ 
                            backgroundColor: color.startsWith('#') ? color : 
                                           color.toLowerCase().replace(' ', '') 
                          }}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Bio Preview */}
              {bioPreview.text && (
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed" data-testid={`text-character-bio-${character.id}`}>
                  {bioPreview.text}
                </p>
              )}
            </div>
          </div>

          {/* Visual Traits */}
          {(alwaysTraits.length > 0 || visualDescriptors.length > 0) && (
            <div className="space-y-2">
              {alwaysTraits.length > 0 && (
                <div className="flex flex-wrap gap-1" data-testid={`traits-always-${character.id}`}>
                  {alwaysTraits.map((trait, idx) => (
                    <Badge 
                      key={idx} 
                      variant="secondary" 
                      className="text-xs px-2 py-0.5 bg-chart-1/20 text-chart-1 border-chart-1/30"
                    >
                      {trait}
                    </Badge>
                  ))}
                </div>
              )}
              
              {visualDescriptors.length > 0 && (
                <div className="flex flex-wrap gap-1" data-testid={`traits-visual-${character.id}`}>
                  {visualDescriptors.map((descriptor, idx) => (
                    <Badge 
                      key={idx} 
                      variant="outline" 
                      className="text-xs px-2 py-0.5 bg-chart-2/10 text-chart-2 border-chart-2/30"
                    >
                      <Eye className="h-2.5 w-2.5 mr-1" />
                      {descriptor}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-1">
            {/* Redress Button - Only show if panelId is provided */}
            {panelId && allCharacters.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsRedressModalOpen(true)}
                data-testid={`button-redress-${character.id}`}
              >
                <Shirt className="h-3 w-3 mr-1" />
                Change Clothes
              </Button>
            )}
            
            {/* Spacer when redress button is not shown */}
            <div className="flex-1"></div>

            {/* Expand/Collapse Details */}
            {(Boolean(character.bio) || Boolean(character.neverTraits) || Boolean(character.wardrobePresets)) && (
              <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    data-testid={`button-expand-${character.id}`}
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="h-3 w-3 mr-1" />
                        Show Less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3 mr-1" />
                        Show More
                      </>
                    )}
                  </Button>
                </CollapsibleTrigger>
                
                <CollapsibleContent className="space-y-3 pt-3 border-t border-border/50">
                  {/* Full Bio */}
                  {Boolean(character.bio) && typeof character.bio === 'string' && bioPreview.isTruncated && (
                    <div>
                      <h5 className="text-xs font-medium text-muted-foreground mb-1 flex items-center">
                        <User className="h-3 w-3 mr-1" />
                        Character Bio
                      </h5>
                      <p className="text-xs text-foreground leading-relaxed" data-testid={`text-full-bio-${character.id}`}>
                        {safeRenderText(character.bio)}
                      </p>
                    </div>
                  )}

                  {/* Never Traits */}
                  {Boolean(character.neverTraits) && (
                    <div>
                      <h5 className="text-xs font-medium text-muted-foreground mb-1">Never Traits</h5>
                      <div className="flex flex-wrap gap-1" data-testid={`traits-never-${character.id}`}>
                        {parseTraits(character.neverTraits).map((trait, idx) => (
                          <Badge 
                            key={idx} 
                            variant="outline" 
                            className="text-xs px-2 py-0.5 bg-destructive/10 text-destructive border-destructive/30"
                          >
                            {trait}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Wardrobe Info */}
                  {Boolean(character.wardrobePresets) && (
                    <div>
                      <h5 className="text-xs font-medium text-muted-foreground mb-1 flex items-center">
                        <Shirt className="h-3 w-3 mr-1" />
                        Wardrobe Presets
                      </h5>
                      <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2">
                        {(() => {
                          if (Array.isArray(character.wardrobePresets)) {
                            return `${character.wardrobePresets.length} outfit${character.wardrobePresets.length !== 1 ? 's' : ''} available`;
                          } else if (character.wardrobePresets && typeof character.wardrobePresets === 'object') {
                            return "Custom wardrobe configured";
                          } else {
                            return "No wardrobe data";
                          }
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Current Outfit */}
                  {Boolean(character.currentOutfit) && (
                    <div>
                      <h5 className="text-xs font-medium text-muted-foreground mb-1">Current Outfit</h5>
                      <div className="text-xs text-foreground bg-muted/30 rounded p-2">
                        {(() => {
                          if (typeof character.currentOutfit === 'string') {
                            return character.currentOutfit;
                          } else if (character.currentOutfit && typeof character.currentOutfit === 'object') {
                            try {
                              return JSON.stringify(character.currentOutfit, null, 2);
                            } catch {
                              return "Invalid outfit data";
                            }
                          } else {
                            return "No current outfit set";
                          }
                        })()}
                      </div>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </div>
      </CardContent>
      
      {/* Redress Modal - Only render if panelId is provided */}
      {panelId && (
        <RedressModal
          open={isRedressModalOpen}
          onOpenChange={setIsRedressModalOpen}
          panelId={panelId}
          characters={allCharacters}
          onSuccess={(newImageUrl) => {
            if (onOutfitChange) {
              onOutfitChange(character.id, newImageUrl);
            }
            setIsRedressModalOpen(false);
          }}
        />
      )}
    </Card>
  );
}