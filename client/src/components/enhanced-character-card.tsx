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
      className="border-border bg-card/50 hover:bg-card/80 transition-colors duration-200 w-full"
      data-testid={`character-card-${character.id}`}
    >
      <CardContent className="p-3 sm:p-4">
        <div className="space-y-3 sm:space-y-4">
          {/* Character Header - Mobile Optimized */}
          <div className="flex items-start space-x-3 sm:space-x-4">
            <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border-2 border-muted flex-shrink-0">
              <AvatarImage 
                src={character.referenceImageUrl || undefined} 
                alt={character.name}
                className="object-cover"
              />
              <AvatarFallback className={getAvatarColor(index)}>
                <User className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm sm:text-base truncate" data-testid={`text-character-name-${character.id}`}>
                    {safeRenderText(character.name)}
                  </h4>
                  {character.role && (
                    <p className="text-xs sm:text-sm text-muted-foreground capitalize truncate" data-testid={`text-character-role-${character.id}`}>
                      {safeRenderText(character.role)}
                    </p>
                  )}
                </div>
                
                {/* Color Scheme Display - Mobile Optimized */}
                {colors.length > 0 && (
                  <div className="flex items-center space-x-1 flex-shrink-0" data-testid={`color-scheme-${character.id}`}>
                    <Palette className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                    <div className="flex space-x-0.5 sm:space-x-1">
                      {colors.map((color, idx) => (
                        <div
                          key={idx}
                          className="w-3 h-3 sm:w-4 sm:h-4 rounded-full border border-border"
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
              
              {/* Bio Preview - Mobile Optimized */}
              {bioPreview.text && (
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed line-clamp-2" data-testid={`text-character-bio-${character.id}`}>
                  {bioPreview.text}
                </p>
              )}
            </div>
          </div>

          {/* Visual Traits - Mobile Optimized */}
          {(alwaysTraits.length > 0 || visualDescriptors.length > 0) && (
            <div className="space-y-2">
              {alwaysTraits.length > 0 && (
                <div className="flex flex-wrap gap-1 sm:gap-1.5" data-testid={`traits-always-${character.id}`}>
                  {alwaysTraits.map((trait, idx) => (
                    <Badge 
                      key={idx} 
                      variant="secondary" 
                      className="text-xs sm:text-sm px-2 py-0.5 sm:px-2.5 sm:py-1 bg-chart-1/20 text-chart-1 border-chart-1/30 leading-tight"
                    >
                      {trait}
                    </Badge>
                  ))}
                </div>
              )}
              
              {visualDescriptors.length > 0 && (
                <div className="flex flex-wrap gap-1 sm:gap-1.5" data-testid={`traits-visual-${character.id}`}>
                  {visualDescriptors.map((descriptor, idx) => (
                    <Badge 
                      key={idx} 
                      variant="outline" 
                      className="text-xs sm:text-sm px-2 py-0.5 sm:px-2.5 sm:py-1 bg-chart-2/10 text-chart-2 border-chart-2/30 leading-tight"
                    >
                      <Eye className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                      {descriptor}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons - Mobile Optimized */}
          <div className="flex items-center justify-between pt-2 gap-2">
            {/* Redress Button - Only show if panelId is provided */}
            {panelId && allCharacters.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsRedressModalOpen(true)}
                data-testid={`button-redress-${character.id}`}
                className="h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3 touch-manipulation"
              >
                <Shirt className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />
                <span className="hidden xs:inline">Change </span>Clothes
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
                    className="h-8 sm:h-9 text-xs sm:text-sm text-muted-foreground hover:text-foreground px-2 sm:px-3 touch-manipulation"
                    data-testid={`button-expand-${character.id}`}
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                        Less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                        More
                      </>
                    )}
                  </Button>
                </CollapsibleTrigger>
                
                <CollapsibleContent className="space-y-3 pt-3 border-t border-border/50 animate-in slide-in-from-top-1">
                  {/* Full Bio */}
                  {Boolean(character.bio) && typeof character.bio === 'string' && bioPreview.isTruncated && (
                    <div>
                      <h5 className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 flex items-center">
                        <User className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                        Character Bio
                      </h5>
                      <p className="text-xs sm:text-sm text-foreground leading-relaxed" data-testid={`text-full-bio-${character.id}`}>
                        {safeRenderText(character.bio)}
                      </p>
                    </div>
                  )}

                  {/* Never Traits */}
                  {Boolean(character.neverTraits) && (
                    <div>
                      <h5 className="text-xs sm:text-sm font-medium text-muted-foreground mb-2">Never Traits</h5>
                      <div className="flex flex-wrap gap-1 sm:gap-1.5" data-testid={`traits-never-${character.id}`}>
                        {parseTraits(character.neverTraits).map((trait, idx) => (
                          <Badge 
                            key={idx} 
                            variant="outline" 
                            className="text-xs sm:text-sm px-2 py-0.5 sm:px-2.5 sm:py-1 bg-destructive/10 text-destructive border-destructive/30"
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
                      <h5 className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 flex items-center">
                        <Shirt className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                        Wardrobe Presets
                      </h5>
                      <div className="text-xs sm:text-sm text-muted-foreground bg-muted/30 rounded p-2 sm:p-3">
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
                      <h5 className="text-xs sm:text-sm font-medium text-muted-foreground mb-2">Current Outfit</h5>
                      <div className="text-xs sm:text-sm text-foreground bg-muted/30 rounded p-2 sm:p-3">
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