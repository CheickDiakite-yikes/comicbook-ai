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
          {/* Character Header - Mobile First Design */}
          <div className="space-y-3">
            {/* Avatar and Name Row */}
            <div className="flex items-center space-x-3">
              <Avatar className="h-12 w-12 sm:h-14 sm:w-14 border-2 border-muted flex-shrink-0">
                <AvatarImage 
                  src={character.referenceImageUrl || undefined} 
                  alt={character.name}
                  className="object-cover"
                />
                <AvatarFallback className={getAvatarColor(index)}>
                  <User className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-base sm:text-lg leading-tight" data-testid={`text-character-name-${character.id}`}>
                  {safeRenderText(character.name)}
                </h4>
                {character.role && (
                  <p className="text-sm sm:text-base text-muted-foreground capitalize mt-0.5" data-testid={`text-character-role-${character.id}`}>
                    {safeRenderText(character.role)}
                  </p>
                )}
              </div>
              
              {/* Color Scheme Display - Compact */}
              {colors.length > 0 && (
                <div className="flex items-center space-x-1 flex-shrink-0" data-testid={`color-scheme-${character.id}`}>
                  <div className="flex space-x-0.5">
                    {colors.map((color, idx) => (
                      <div
                        key={idx}
                        className="w-4 h-4 sm:w-5 sm:h-5 rounded-full border border-border"
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
            
            {/* Bio Preview - Full Width */}
            {bioPreview.text && (
              <div className="px-1">
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed" data-testid={`text-character-bio-${character.id}`}>
                  {bioPreview.text}
                </p>
              </div>
            )}
          </div>

          {/* Visual Traits - Mobile Friendly */}
          {(alwaysTraits.length > 0 || visualDescriptors.length > 0) && (
            <div className="space-y-3">
              {alwaysTraits.length > 0 && (
                <div className="flex flex-wrap gap-2" data-testid={`traits-always-${character.id}`}>
                  {alwaysTraits.map((trait, idx) => (
                    <Badge 
                      key={idx} 
                      variant="secondary" 
                      className="text-sm px-3 py-1 bg-chart-1/20 text-chart-1 border-chart-1/30 font-medium"
                    >
                      {trait}
                    </Badge>
                  ))}
                </div>
              )}
              
              {visualDescriptors.length > 0 && (
                <div className="flex flex-wrap gap-2" data-testid={`traits-visual-${character.id}`}>
                  {visualDescriptors.map((descriptor, idx) => (
                    <Badge 
                      key={idx} 
                      variant="outline" 
                      className="text-sm px-3 py-1 bg-chart-2/10 text-chart-2 border-chart-2/30 font-medium"
                    >
                      <Eye className="h-3.5 w-3.5 mr-1.5" />
                      {descriptor}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons - Clean Mobile Design */}
          <div className="space-y-4 pt-4 border-t border-border/20">
            {/* Primary Action Button - Full Width Below Content */}
            {panelId && allCharacters.length > 0 ? (
              <Button
                variant="default"
                size="lg"
                onClick={() => setIsRedressModalOpen(true)}
                data-testid={`button-redress-${character.id}`}
                className="w-full h-12 text-sm font-semibold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 border-0 shadow-lg hover:shadow-xl transition-all duration-200 touch-manipulation"
              >
                <Shirt className="h-5 w-5 mr-3" />
                Change Clothes
              </Button>
            ) : (
              <div className="w-full text-center py-4 px-4 text-sm text-muted-foreground bg-gradient-to-r from-muted/30 to-muted/20 rounded-xl border border-dashed border-muted-foreground/30">
                <Shirt className="h-5 w-5 inline mr-3 mb-1" />
                <div>Edit clothes in panel editor</div>
                <div className="text-xs mt-1 opacity-75">Open a panel to access clothing changes</div>
              </div>
            )}
            
            {/* Secondary Action - Show More/Less */}
            {(Boolean(character.bio) || Boolean(character.neverTraits) || Boolean(character.wardrobePresets)) && (
              <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
                <div className="flex justify-center">
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-6 text-xs text-muted-foreground hover:text-foreground bg-muted/20 hover:bg-muted/40 rounded-full transition-all duration-200 touch-manipulation"
                      data-testid={`button-expand-${character.id}`}
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-3.5 w-3.5 mr-2" />
                          Show Less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3.5 w-3.5 mr-2" />
                          Show More
                        </>
                      )}
                    </Button>
                  </CollapsibleTrigger>
                </div>
                
                <CollapsibleContent className="mt-4 space-y-4 animate-in slide-in-from-top-2">
                  {/* Full Bio */}
                  {Boolean(character.bio) && typeof character.bio === 'string' && bioPreview.isTruncated && (
                    <div className="bg-gradient-to-br from-muted/10 to-muted/5 rounded-xl p-4 border border-border/50">
                      <h5 className="text-sm font-semibold text-foreground mb-3 flex items-center">
                        <User className="h-4 w-4 mr-2 text-blue-600" />
                        Full Character Bio
                      </h5>
                      <p className="text-sm text-muted-foreground leading-relaxed" data-testid={`text-full-bio-${character.id}`}>
                        {safeRenderText(character.bio)}
                      </p>
                    </div>
                  )}

                  {/* Never Traits */}
                  {Boolean(character.neverTraits) && (
                    <div className="bg-gradient-to-br from-destructive/5 to-destructive/5 rounded-xl p-4 border border-destructive/20">
                      <h5 className="text-sm font-semibold text-foreground mb-3 flex items-center">
                        <span className="h-4 w-4 mr-2 text-destructive">⚠️</span>
                        Never Traits
                      </h5>
                      <div className="flex flex-wrap gap-2" data-testid={`traits-never-${character.id}`}>
                        {parseTraits(character.neverTraits).map((trait, idx) => (
                          <Badge 
                            key={idx} 
                            variant="outline" 
                            className="text-sm px-3 py-1 bg-destructive/10 text-destructive border-destructive/30 font-medium"
                          >
                            {trait}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Wardrobe Info */}
                  {Boolean(character.wardrobePresets) && (
                    <div className="bg-gradient-to-br from-blue/5 to-blue/5 rounded-xl p-4 border border-blue/20">
                      <h5 className="text-sm font-semibold text-foreground mb-3 flex items-center">
                        <Shirt className="h-4 w-4 mr-2 text-blue-600" />
                        Wardrobe Presets
                      </h5>
                      <div className="text-sm text-muted-foreground font-medium">
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
                    <div className="bg-gradient-to-br from-green/5 to-green/5 rounded-xl p-4 border border-green/20">
                      <h5 className="text-sm font-semibold text-foreground mb-3 flex items-center">
                        <span className="h-4 w-4 mr-2 text-green-600">👕</span>
                        Current Outfit
                      </h5>
                      <div className="text-sm text-muted-foreground font-medium">
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