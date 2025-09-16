import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  ChevronDown, 
  ChevronRight, 
  FileText, 
  Camera, 
  MessageSquare, 
  Users, 
  MapPin, 
  Palette,
  Clock,
  Volume2,
  Eye,
  RefreshCw,
  Home,
  Building,
  TreePine,
  Sun,
  CloudRain,
  Wind,
  Thermometer,
  Droplets,
  CloudFog,
  Play,
  RotateCcw,
  Move,
  Focus,
  UserCheck,
  MousePointer,
  Zap,
  Sparkles,
  Music,
  Mic,
  VolumeX,
  Bot,
  Image,
  Settings,
  Lightbulb,
  Layers,
  Frame,
  Brush,
  Navigation
} from "lucide-react";
import type { FullStructuredScript, Character } from "@shared/schema";

interface StructuredScriptViewerProps {
  projectId: string;
  currentPageNumber?: number;
}

export default function StructuredScriptViewer({ projectId, currentPageNumber }: StructuredScriptViewerProps) {
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());
  const [expandedPanels, setExpandedPanels] = useState<Set<string>>(new Set());
  const [showAllPages, setShowAllPages] = useState(false);
  const queryClient = useQueryClient();

  // Fix: Read from project.script instead of structured_scripts table
  const { data: project } = useQuery<{script?: string}>({
    queryKey: ["/api/projects", projectId],
    retry: false,
  });
  
  // Parse the script from project.script field (same source as Preview)
  const structuredScript = (() => {
    if (!project?.script) return null;
    try {
      return JSON.parse(project.script);
    } catch (error) {
      console.error("Failed to parse project script:", error);
      return null;
    }
  })();
  const isLoading = !project;

  const { data: characters = [] } = useQuery<Character[]>({
    queryKey: ["/api/projects", projectId, "characters"],
    retry: false,
  });

  const handleRefreshScript = () => {
    queryClient.invalidateQueries({ 
      queryKey: ["/api/projects", projectId] 
    });
  };

  const handleFixScript = async () => {
    try {
      console.log("🚨 Attempting to fix corrupted script data...");
      const response = await fetch(`/api/projects/${projectId}/fix-script`, {
        method: 'POST',
        credentials: 'include'
      });
      
      const result = await response.json();
      console.log("🚨 Fix script result:", result);
      
      if (result.success) {
        console.log(`✅ Script recovered! Found ${result.pages} pages`);
        // Refresh the data
        queryClient.invalidateQueries({ 
          queryKey: ["/api/projects", projectId] 
        });
      } else {
        console.log("❌ No script data found to recover");
      }
    } catch (error) {
      console.error("🚨 Error fixing script:", error);
    }
  };

  // Auto-expand current page when in focused mode
  useEffect(() => {
    if (structuredScript && currentPageNumber && !showAllPages) {
      const currentPage = structuredScript.pages?.find(p => p.pageNumber === currentPageNumber);
      if (currentPage) {
        setExpandedPages(new Set([currentPage.id]));
      }
    }
  }, [structuredScript, currentPageNumber, showAllPages]);

  const togglePage = (pageId: string) => {
    const newExpanded = new Set(expandedPages);
    if (newExpanded.has(pageId)) {
      newExpanded.delete(pageId);
    } else {
      newExpanded.add(pageId);
    }
    setExpandedPages(newExpanded);
  };

  const togglePanel = (panelId: string) => {
    const newExpanded = new Set(expandedPanels);
    if (newExpanded.has(panelId)) {
      newExpanded.delete(panelId);
    } else {
      newExpanded.add(panelId);
    }
    setExpandedPanels(newExpanded);
  };

  // Function to detect characters mentioned in panel content
  const detectCharactersInPanel = (panel: any): Character[] => {
    if (!characters || characters.length === 0) return [];
    
    const panelContent = [
      panel.sceneDescription || '',
      panel.action || '',
      panel.visualNotes || '',
      ...(panel.dialogue?.map((d: any) => d.text || '') || []),
      ...(panel.characters || [])
    ].join(' ').toLowerCase();
    
    const detectedCharacters: Character[] = [];
    
    for (const character of characters) {
      const characterName = character.name.toLowerCase();
      const nameParts = characterName.split(' ');
      
      // Check for full name or any part of the name
      const isInContent = nameParts.some(part => 
        part.length > 2 && panelContent.includes(part)
      ) || panelContent.includes(characterName);
      
      if (isInContent && !detectedCharacters.find(c => c.id === character.id)) {
        detectedCharacters.push(character);
      }
    }
    
    return detectedCharacters;
  };

  // Component to render characters in panel
  const CharactersInPanelContent = ({ panel }: { panel: any }) => {
    const detectedCharacters = detectCharactersInPanel(panel);
    
    if (detectedCharacters.length === 0) {
      return (
        <div className="text-sm text-muted-foreground italic p-3">
          No characters detected in this panel.
        </div>
      );
    }
    
    return (
      <div className="space-y-4">
        {detectedCharacters.map((character) => (
          <div key={character.id} className="bg-muted/10 rounded-lg p-3 border">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-4 w-4 text-primary" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h6 className="font-medium text-sm" data-testid={`character-name-${character.id}`}>
                    {character.name}
                  </h6>
                  {character.role && (
                    <Badge variant="secondary" className="text-xs">
                      {character.role}
                    </Badge>
                  )}
                </div>
                
                {character.visualDescriptors && (
                  <div className="mb-2">
                    <span className="text-xs font-medium text-muted-foreground block mb-1">Appearance:</span>
                    <p className="text-sm text-muted-foreground break-words" data-testid={`character-appearance-${character.id}`}>
                      {character.visualDescriptors}
                    </p>
                  </div>
                )}
                
                {character.bio && (
                  <div className="mb-2">
                    <span className="text-xs font-medium text-muted-foreground block mb-1">Bio:</span>
                    <p className="text-sm text-muted-foreground break-words" data-testid={`character-bio-${character.id}`}>
                      {character.bio}
                    </p>
                  </div>
                )}
                
                <div className="flex flex-wrap gap-1 mt-2">
                  {character.alwaysTraits && (
                    <Badge variant="outline" className="text-xs">
                      Always: {character.alwaysTraits}
                    </Badge>
                  )}
                  {character.colorScheme && (
                    <Badge variant="outline" className="text-xs">
                      <Palette className="h-3 w-3 mr-1" />
                      {character.colorScheme}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded"></div>
              <div className="h-4 bg-muted rounded w-5/6"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!structuredScript) {
    return (
      <Card className="w-full">
        <CardContent className="p-6 text-center">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Structured Script</h3>
          <p className="text-muted-foreground mb-4">
            This project doesn't have a structured script yet. Generate one to see the detailed breakdown here.
          </p>
          <div className="flex gap-2 mt-2">
            <Button 
              onClick={handleRefreshScript} 
              variant="outline" 
              size="sm"
              data-testid="button-refresh-script"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Script Data
            </Button>
            <Button 
              onClick={handleFixScript} 
              variant="default" 
              size="sm"
              data-testid="button-fix-script"
            >
              🚨 Fix Script
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full space-y-6" data-testid="structured-script-viewer">
      {/* Script Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {structuredScript.title}
          </CardTitle>
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="secondary" data-testid="badge-total-pages">
              {structuredScript.pages?.length || 0} Pages
            </Badge>
            <Badge variant="outline" data-testid="badge-version">
              Version {structuredScript.version}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground italic" data-testid="text-logline">
            "{structuredScript.logline}"
          </p>
        </CardContent>
      </Card>

      {/* Pages */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {currentPageNumber && !showAllPages
              ? `Page ${currentPageNumber} Script`
              : "Script Breakdown"
            }
          </h2>
          {structuredScript.pages && structuredScript.pages.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAllPages(!showAllPages)}
              className="text-xs"
              data-testid="button-toggle-pages-view"
            >
              {showAllPages 
                ? (currentPageNumber ? "Focus on Current Page" : "View One Page")
                : "View All Pages"
              }
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-[600px] w-full border rounded-md p-2 sm:p-4">
          <div className="space-y-4 min-w-0">
            {structuredScript.pages?.filter(page => {
              // If not showing all pages, show either current page or first page
              if (!showAllPages) {
                if (currentPageNumber) {
                  return page.pageNumber === currentPageNumber;
                } else {
                  // If no current page specified, show first page only
                  return page.pageNumber === 1;
                }
              }
              // Otherwise show all pages
              return true;
            }).map((page) => (
              <Card key={page.id} className={`overflow-hidden min-w-0 ${
                currentPageNumber && page.pageNumber === currentPageNumber ? 'border-primary border-2' : ''
              }`}>
                {currentPageNumber && page.pageNumber === currentPageNumber && (
                  <div className="bg-primary/5 px-2 sm:px-4 py-2 border-b">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="default" className="flex-shrink-0">Current Page</Badge>
                      <span className="text-sm font-medium truncate">Page {page.pageNumber}: {page.title}</span>
                    </div>
                  </div>
                )}
                <Collapsible 
                  open={expandedPages.has(page.id)} 
                  onOpenChange={() => togglePage(page.id)}
                >
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors px-2 sm:px-6">
                      <div className="flex items-start justify-between gap-2 min-w-0">
                        <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
                          <div className="flex-shrink-0 mt-0.5">
                            {expandedPages.has(page.id) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <CardTitle className="text-base sm:text-lg text-left break-words">
                              Page {page.pageNumber}: {page.title}
                            </CardTitle>
                            <div className="flex flex-wrap gap-1 sm:gap-2 mt-2">
                              <Badge variant="outline" className="text-xs flex-shrink-0">
                                <MapPin className="h-3 w-3 mr-1" />
                                <span className="truncate max-w-[120px] sm:max-w-none">{page.setting}</span>
                              </Badge>
                              {page.mood && (
                                <Badge variant="outline" className="text-xs flex-shrink-0">
                                  <Palette className="h-3 w-3 mr-1" />
                                  <span className="truncate max-w-[80px] sm:max-w-none">{page.mood}</span>
                                </Badge>
                              )}
                              <Badge variant="secondary" className="text-xs flex-shrink-0">
                                {page.panels?.length || 0} Panels
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <CardContent className="pt-0 px-2 sm:px-6">
                      {/* Page Summary */}
                      <div className="bg-muted/30 rounded-lg p-3 sm:p-4 mb-4">
                        <h4 className="font-medium mb-2 flex items-center gap-2 text-sm sm:text-base">
                          <Users className="h-4 w-4 flex-shrink-0" />
                          Characters & Setting
                        </h4>
                        <div className="space-y-2">
                          <div>
                            <span className="text-sm font-medium">Setting:</span>
                            <p className="text-sm text-muted-foreground mt-1 break-words">
                              {page.setting}
                            </p>
                          </div>
                          {(page.timeOfDay || page.location || page.weatherConditions) && (
                            <div className="flex flex-wrap gap-1 sm:gap-2">
                              {page.timeOfDay && (
                                <Badge variant="outline" className="text-xs flex-shrink-0">
                                  <Clock className="h-3 w-3 mr-1" />
                                  <span className="truncate max-w-[100px] sm:max-w-none">{page.timeOfDay}</span>
                                </Badge>
                              )}
                              {page.location && (
                                <Badge variant="outline" className="text-xs flex-shrink-0">
                                  <MapPin className="h-3 w-3 mr-1" />
                                  <span className="truncate max-w-[100px] sm:max-w-none">{page.location}</span>
                                </Badge>
                              )}
                              {page.weatherConditions && (
                                <Badge variant="outline" className="text-xs flex-shrink-0">
                                  <span className="truncate max-w-[100px] sm:max-w-none">{page.weatherConditions}</span>
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Panels */}
                      <div className="space-y-3">
                        <h4 className="font-medium">Panels</h4>
                        {page.panels?.map((panel) => (
                          <Card key={panel.id} className="border-l-4 border-l-primary/30 min-w-0">
                            <Collapsible 
                              open={expandedPanels.has(panel.id)} 
                              onOpenChange={() => togglePanel(panel.id)}
                            >
                              <CollapsibleTrigger asChild>
                                <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors pb-3 px-2 sm:px-6">
                                  <div className="flex flex-col gap-2 min-w-0">
                                    <div className="flex items-center justify-between gap-2 min-w-0">
                                      <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <div className="flex-shrink-0">
                                          {expandedPanels.has(panel.id) ? (
                                            <ChevronDown className="h-3 w-3" />
                                          ) : (
                                            <ChevronRight className="h-3 w-3" />
                                          )}
                                        </div>
                                        <CardTitle className="text-sm sm:text-base">
                                          Panel {panel.panelNumber}
                                        </CardTitle>
                                      </div>
                                      <div className="flex flex-wrap gap-1 flex-shrink-0">
                                        {panel.cameraAngle && (
                                          <Badge variant="outline" className="text-xs">
                                            <Camera className="h-3 w-3 mr-1" />
                                            <span className="hidden sm:inline">{panel.cameraAngle}</span>
                                            <span className="sm:hidden">{panel.cameraAngle.slice(0, 6)}</span>
                                          </Badge>
                                        )}
                                        {panel.shotType && (
                                          <Badge variant="outline" className="text-xs">
                                            <Eye className="h-3 w-3 mr-1" />
                                            <span className="hidden sm:inline">{panel.shotType}</span>
                                            <span className="sm:hidden">{panel.shotType.slice(0, 6)}</span>
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                    <p className="text-sm text-muted-foreground text-left break-words">
                                      {panel.sceneDescription}
                                    </p>
                                  </div>
                                </CardHeader>
                              </CollapsibleTrigger>
                              
                              <CollapsibleContent>
                                <CardContent className="pt-0 px-2 sm:px-6">
                                  <div className="space-y-6">
                                    {/* Core Information */}
                                    <div className="bg-muted/20 rounded-lg p-3 sm:p-4">
                                      <h5 className="text-sm font-medium mb-3 flex items-center gap-2">
                                        <FileText className="h-4 w-4" />
                                        Core Information
                                      </h5>
                                      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                                        <div>
                                          <span className="text-xs font-medium text-muted-foreground">Action:</span>
                                          <p className="text-sm mt-1 break-words">{panel.action}</p>
                                        </div>
                                        {panel.visualNotes && (
                                          <div>
                                            <span className="text-xs font-medium text-muted-foreground">Visual Notes:</span>
                                            <p className="text-sm mt-1 break-words">{panel.visualNotes}</p>
                                          </div>
                                        )}
                                        {panel.mood && (
                                          <div>
                                            <span className="text-xs font-medium text-muted-foreground">Mood:</span>
                                            <p className="text-sm mt-1">{panel.mood}</p>
                                          </div>
                                        )}
                                        {panel.characters && panel.characters.length > 0 && (
                                          <div className="sm:col-span-2">
                                            <span className="text-xs font-medium text-muted-foreground">Characters:</span>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                              {panel.characters.map((char, idx) => (
                                                <Badge key={idx} variant="outline" className="text-xs">
                                                  <Users className="h-3 w-3 mr-1" />
                                                  {char}
                                                </Badge>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Characters in Panel */}
                                    <Collapsible>
                                      <CollapsibleTrigger asChild>
                                        <div className="bg-purple-50 dark:bg-purple-950/20 rounded-lg p-3 sm:p-4 cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-950/30 transition-colors">
                                          <h5 className="text-sm font-medium flex items-center gap-2" data-testid="section-characters-in-panel">
                                            <Users className="h-4 w-4" />
                                            Characters in Panel
                                            <ChevronRight className="h-3 w-3 ml-auto" />
                                          </h5>
                                        </div>
                                      </CollapsibleTrigger>
                                      <CollapsibleContent>
                                        <div className="mt-2">
                                          <CharactersInPanelContent panel={panel} />
                                        </div>
                                      </CollapsibleContent>
                                    </Collapsible>

                                    {/* Environmental Details */}
                                    {(panel.locationSpecifics || panel.interiorExterior || panel.roomType || panel.architecturalStyle || 
                                      panel.setDressing?.length || panel.props?.length || panel.backgroundElements?.length || 
                                      panel.atmosphere || panel.environmentalSoundscape?.length) && (
                                      <Collapsible>
                                        <CollapsibleTrigger asChild>
                                          <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-3 sm:p-4 cursor-pointer hover:bg-green-100 dark:hover:bg-green-950/30 transition-colors">
                                            <h5 className="text-sm font-medium flex items-center gap-2" data-testid="section-environmental-details">
                                              <Home className="h-4 w-4" />
                                              Environmental Details
                                              <ChevronRight className="h-3 w-3 ml-auto" />
                                            </h5>
                                          </div>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent>
                                          <div className="mt-2 grid gap-3 grid-cols-1 sm:grid-cols-2 text-sm">
                                            {panel.locationSpecifics && (
                                              <div>
                                                <span className="text-xs font-medium text-muted-foreground">Location Specifics:</span>
                                                <p className="text-sm mt-1 break-words">{panel.locationSpecifics}</p>
                                              </div>
                                            )}
                                            {panel.interiorExterior && (
                                              <div>
                                                <span className="text-xs font-medium text-muted-foreground">Interior/Exterior:</span>
                                                <Badge variant="outline" className="text-xs mt-1 block w-fit">
                                                  <Building className="h-3 w-3 mr-1" />
                                                  {panel.interiorExterior}
                                                </Badge>
                                              </div>
                                            )}
                                            {panel.roomType && (
                                              <div>
                                                <span className="text-xs font-medium text-muted-foreground">Room Type:</span>
                                                <p className="text-sm mt-1">{panel.roomType}</p>
                                              </div>
                                            )}
                                            {panel.architecturalStyle && (
                                              <div>
                                                <span className="text-xs font-medium text-muted-foreground">Architectural Style:</span>
                                                <p className="text-sm mt-1">{panel.architecturalStyle}</p>
                                              </div>
                                            )}
                                            {panel.atmosphere && (
                                              <div>
                                                <span className="text-xs font-medium text-muted-foreground">Atmosphere:</span>
                                                <Badge variant="secondary" className="text-xs mt-1 block w-fit">
                                                  <Palette className="h-3 w-3 mr-1" />
                                                  {panel.atmosphere}
                                                </Badge>
                                              </div>
                                            )}
                                            {panel.setDressing && panel.setDressing.length > 0 && (
                                              <div className="sm:col-span-2">
                                                <span className="text-xs font-medium text-muted-foreground">Set Dressing:</span>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                  {panel.setDressing.map((item, idx) => (
                                                    <Badge key={idx} variant="outline" className="text-xs">{item}</Badge>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                            {panel.props && panel.props.length > 0 && (
                                              <div className="sm:col-span-2">
                                                <span className="text-xs font-medium text-muted-foreground">Props:</span>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                  {panel.props.map((prop, idx) => (
                                                    <Badge key={idx} variant="outline" className="text-xs">{prop}</Badge>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                            {panel.backgroundElements && panel.backgroundElements.length > 0 && (
                                              <div className="sm:col-span-2">
                                                <span className="text-xs font-medium text-muted-foreground">Background Elements:</span>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                  {panel.backgroundElements.map((element, idx) => (
                                                    <Badge key={idx} variant="outline" className="text-xs">{element}</Badge>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                            {panel.environmentalSoundscape && panel.environmentalSoundscape.length > 0 && (
                                              <div className="sm:col-span-2">
                                                <span className="text-xs font-medium text-muted-foreground">Environmental Soundscape:</span>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                  {panel.environmentalSoundscape.map((sound, idx) => (
                                                    <Badge key={idx} variant="outline" className="text-xs">
                                                      <Volume2 className="h-3 w-3 mr-1" />
                                                      {sound}
                                                    </Badge>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </CollapsibleContent>
                                      </Collapsible>
                                    )}

                                    {/* Lighting Conditions */}
                                    {(panel.primaryLightSource || panel.timeOfDay || panel.lightingMood || panel.lightDirection || 
                                      panel.shadowIntensity || panel.colorTemperature || panel.lightingEffects?.length || panel.practicalLights?.length) && (
                                      <Collapsible>
                                        <CollapsibleTrigger asChild>
                                          <div className="bg-yellow-50 dark:bg-yellow-950/20 rounded-lg p-3 sm:p-4 cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-950/30 transition-colors">
                                            <h5 className="text-sm font-medium flex items-center gap-2" data-testid="section-lighting-conditions">
                                              <Lightbulb className="h-4 w-4" />
                                              Lighting Conditions
                                              <ChevronRight className="h-3 w-3 ml-auto" />
                                            </h5>
                                          </div>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent>
                                          <div className="mt-2 grid gap-3 grid-cols-1 sm:grid-cols-2 text-sm">
                                            {panel.primaryLightSource && (
                                              <div>
                                                <span className="text-xs font-medium text-muted-foreground">Primary Light Source:</span>
                                                <Badge variant="secondary" className="text-xs mt-1 block w-fit">
                                                  <Sun className="h-3 w-3 mr-1" />
                                                  {panel.primaryLightSource}
                                                </Badge>
                                              </div>
                                            )}
                                            {panel.timeOfDay && (
                                              <div>
                                                <span className="text-xs font-medium text-muted-foreground">Time of Day:</span>
                                                <Badge variant="outline" className="text-xs mt-1 block w-fit">
                                                  <Clock className="h-3 w-3 mr-1" />
                                                  {panel.timeOfDay}
                                                </Badge>
                                              </div>
                                            )}
                                            {panel.lightingMood && (
                                              <div>
                                                <span className="text-xs font-medium text-muted-foreground">Lighting Mood:</span>
                                                <p className="text-sm mt-1">{panel.lightingMood}</p>
                                              </div>
                                            )}
                                            {panel.lightDirection && (
                                              <div>
                                                <span className="text-xs font-medium text-muted-foreground">Light Direction:</span>
                                                <p className="text-sm mt-1">{panel.lightDirection}</p>
                                              </div>
                                            )}
                                            {panel.shadowIntensity && (
                                              <div>
                                                <span className="text-xs font-medium text-muted-foreground">Shadow Intensity:</span>
                                                <p className="text-sm mt-1">{panel.shadowIntensity}</p>
                                              </div>
                                            )}
                                            {panel.colorTemperature && (
                                              <div>
                                                <span className="text-xs font-medium text-muted-foreground">Color Temperature:</span>
                                                <p className="text-sm mt-1">{panel.colorTemperature}</p>
                                              </div>
                                            )}
                                            {panel.lightingEffects && panel.lightingEffects.length > 0 && (
                                              <div className="sm:col-span-2">
                                                <span className="text-xs font-medium text-muted-foreground">Lighting Effects:</span>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                  {panel.lightingEffects.map((effect, idx) => (
                                                    <Badge key={idx} variant="outline" className="text-xs">
                                                      <Sparkles className="h-3 w-3 mr-1" />
                                                      {effect}
                                                    </Badge>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                            {panel.practicalLights && panel.practicalLights.length > 0 && (
                                              <div className="sm:col-span-2">
                                                <span className="text-xs font-medium text-muted-foreground">Practical Lights:</span>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                  {panel.practicalLights.map((light, idx) => (
                                                    <Badge key={idx} variant="outline" className="text-xs">
                                                      <Lightbulb className="h-3 w-3 mr-1" />
                                                      {light}
                                                    </Badge>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </CollapsibleContent>
                                      </Collapsible>
                                    )}

                                    {/* Weather & Atmospheric Conditions */}
                                    {(panel.weatherCondition || panel.precipitation || panel.windCondition || panel.temperature || 
                                      panel.humidity || panel.visibility || panel.atmosphericEffects?.length || panel.seasonalContext) && (
                                      <Collapsible>
                                        <CollapsibleTrigger asChild>
                                          <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3 sm:p-4 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-950/30 transition-colors">
                                            <h5 className="text-sm font-medium flex items-center gap-2" data-testid="section-weather-atmospheric">
                                              <CloudRain className="h-4 w-4" />
                                              Weather & Atmospheric Conditions
                                              <ChevronRight className="h-3 w-3 ml-auto" />
                                            </h5>
                                          </div>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent>
                                          <div className="mt-2 grid gap-3 grid-cols-1 sm:grid-cols-2 text-sm">
                                            {panel.weatherCondition && (
                                              <div>
                                                <span className="text-xs font-medium text-muted-foreground">Weather:</span>
                                                <Badge variant="secondary" className="text-xs mt-1 block w-fit">
                                                  <CloudRain className="h-3 w-3 mr-1" />
                                                  {panel.weatherCondition}
                                                </Badge>
                                              </div>
                                            )}
                                            {panel.precipitation && (
                                              <div>
                                                <span className="text-xs font-medium text-muted-foreground">Precipitation:</span>
                                                <Badge variant="outline" className="text-xs mt-1 block w-fit">
                                                  <Droplets className="h-3 w-3 mr-1" />
                                                  {panel.precipitation}
                                                </Badge>
                                              </div>
                                            )}
                                            {panel.windCondition && (
                                              <div>
                                                <span className="text-xs font-medium text-muted-foreground">Wind:</span>
                                                <Badge variant="outline" className="text-xs mt-1 block w-fit">
                                                  <Wind className="h-3 w-3 mr-1" />
                                                  {panel.windCondition}
                                                </Badge>
                                              </div>
                                            )}
                                            {panel.temperature && (
                                              <div>
                                                <span className="text-xs font-medium text-muted-foreground">Temperature:</span>
                                                <Badge variant="outline" className="text-xs mt-1 block w-fit">
                                                  <Thermometer className="h-3 w-3 mr-1" />
                                                  {panel.temperature}
                                                </Badge>
                                              </div>
                                            )}
                                            {panel.humidity && (
                                              <div>
                                                <span className="text-xs font-medium text-muted-foreground">Humidity:</span>
                                                <p className="text-sm mt-1">{panel.humidity}</p>
                                              </div>
                                            )}
                                            {panel.visibility && (
                                              <div>
                                                <span className="text-xs font-medium text-muted-foreground">Visibility:</span>
                                                <Badge variant="outline" className="text-xs mt-1 block w-fit">
                                                  <Eye className="h-3 w-3 mr-1" />
                                                  {panel.visibility}
                                                </Badge>
                                              </div>
                                            )}
                                            {panel.seasonalContext && (
                                              <div>
                                                <span className="text-xs font-medium text-muted-foreground">Season:</span>
                                                <Badge variant="secondary" className="text-xs mt-1 block w-fit">
                                                  <TreePine className="h-3 w-3 mr-1" />
                                                  {panel.seasonalContext}
                                                </Badge>
                                              </div>
                                            )}
                                            {panel.atmosphericEffects && panel.atmosphericEffects.length > 0 && (
                                              <div className="sm:col-span-2">
                                                <span className="text-xs font-medium text-muted-foreground">Atmospheric Effects:</span>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                  {panel.atmosphericEffects.map((effect, idx) => (
                                                    <Badge key={idx} variant="outline" className="text-xs">
                                                      <CloudFog className="h-3 w-3 mr-1" />
                                                      {effect}
                                                    </Badge>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </CollapsibleContent>
                                      </Collapsible>
                                    )}

                                    {/* Advanced Cinematography */}
                                    {(panel.cameraAngle || panel.shotType || panel.cameraMovement || panel.frameComposition || 
                                      panel.depthOfField || panel.focusPoint || panel.perspectiveType || panel.visualStyle || panel.colorGrading) && (
                                      <Collapsible>
                                        <CollapsibleTrigger asChild>
                                          <div className="bg-purple-50 dark:bg-purple-950/20 rounded-lg p-3 sm:p-4 cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-950/30 transition-colors">
                                            <h5 className="text-sm font-medium flex items-center gap-2" data-testid="section-cinematography">
                                              <Camera className="h-4 w-4" />
                                              Advanced Cinematography
                                              <ChevronRight className="h-3 w-3 ml-auto" />
                                            </h5>
                                          </div>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent>
                                          <div className="mt-2 grid gap-3 grid-cols-1 sm:grid-cols-2 text-sm">
                                            {panel.cameraAngle && (
                                              <div>
                                                <span className="text-xs font-medium text-muted-foreground">Camera Angle:</span>
                                                <Badge variant="secondary" className="text-xs mt-1 block w-fit">
                                                  <Camera className="h-3 w-3 mr-1" />
                                                  {panel.cameraAngle}
                                                </Badge>
                                              </div>
                                            )}
                                            {panel.shotType && (
                                              <div>
                                                <span className="text-xs font-medium text-muted-foreground">Shot Type:</span>
                                                <Badge variant="secondary" className="text-xs mt-1 block w-fit">
                                                  <Eye className="h-3 w-3 mr-1" />
                                                  {panel.shotType}
                                                </Badge>
                                              </div>
                                            )}
                                            {panel.cameraMovement && (
                                              <div>
                                                <span className="text-xs font-medium text-muted-foreground">Camera Movement:</span>
                                                <Badge variant="outline" className="text-xs mt-1 block w-fit">
                                                  <Move className="h-3 w-3 mr-1" />
                                                  {panel.cameraMovement}
                                                </Badge>
                                              </div>
                                            )}
                                            {panel.frameComposition && (
                                              <div>
                                                <span className="text-xs font-medium text-muted-foreground">Frame Composition:</span>
                                                <Badge variant="outline" className="text-xs mt-1 block w-fit">
                                                  <Frame className="h-3 w-3 mr-1" />
                                                  {panel.frameComposition}
                                                </Badge>
                                              </div>
                                            )}
                                            {panel.depthOfField && (
                                              <div>
                                                <span className="text-xs font-medium text-muted-foreground">Depth of Field:</span>
                                                <Badge variant="outline" className="text-xs mt-1 block w-fit">
                                                  <Focus className="h-3 w-3 mr-1" />
                                                  {panel.depthOfField}
                                                </Badge>
                                              </div>
                                            )}
                                            {panel.focusPoint && (
                                              <div>
                                                <span className="text-xs font-medium text-muted-foreground">Focus Point:</span>
                                                <p className="text-sm mt-1">{panel.focusPoint}</p>
                                              </div>
                                            )}
                                            {panel.perspectiveType && (
                                              <div>
                                                <span className="text-xs font-medium text-muted-foreground">Perspective Type:</span>
                                                <p className="text-sm mt-1">{panel.perspectiveType}</p>
                                              </div>
                                            )}
                                            {panel.visualStyle && (
                                              <div>
                                                <span className="text-xs font-medium text-muted-foreground">Visual Style:</span>
                                                <Badge variant="secondary" className="text-xs mt-1 block w-fit">
                                                  <Brush className="h-3 w-3 mr-1" />
                                                  {panel.visualStyle}
                                                </Badge>
                                              </div>
                                            )}
                                            {panel.colorGrading && (
                                              <div>
                                                <span className="text-xs font-medium text-muted-foreground">Color Grading:</span>
                                                <Badge variant="outline" className="text-xs mt-1 block w-fit">
                                                  <Palette className="h-3 w-3 mr-1" />
                                                  {panel.colorGrading}
                                                </Badge>
                                              </div>
                                            )}
                                          </div>
                                        </CollapsibleContent>
                                      </Collapsible>
                                    )}

                                    {/* Character Positioning & Interactions */}
                                    {(panel.characterPositions || panel.proxemics || panel.spatialRelationships?.length || 
                                      panel.physicalInteractions?.length || panel.characterFocus || panel.eyelineDirections?.length || 
                                      panel.gestureDescriptions?.length) && (
                                      <Collapsible>
                                        <CollapsibleTrigger asChild>
                                          <div className="bg-orange-50 dark:bg-orange-950/20 rounded-lg p-3 sm:p-4 cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-950/30 transition-colors">
                                            <h5 className="text-sm font-medium flex items-center gap-2" data-testid="section-character-positioning">
                                              <UserCheck className="h-4 w-4" />
                                              Character Positioning & Interactions
                                              <ChevronRight className="h-3 w-3 ml-auto" />
                                            </h5>
                                          </div>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent>
                                          <div className="mt-2 grid gap-3 grid-cols-1 sm:grid-cols-2 text-sm">
                                            {panel.proxemics && (
                                              <div>
                                                <span className="text-xs font-medium text-muted-foreground">Proxemics:</span>
                                                <Badge variant="secondary" className="text-xs mt-1 block w-fit">
                                                  <Users className="h-3 w-3 mr-1" />
                                                  {panel.proxemics}
                                                </Badge>
                                              </div>
                                            )}
                                            {panel.characterFocus && (
                                              <div>
                                                <span className="text-xs font-medium text-muted-foreground">Character Focus:</span>
                                                <Badge variant="outline" className="text-xs mt-1 block w-fit">
                                                  <Focus className="h-3 w-3 mr-1" />
                                                  {panel.characterFocus}
                                                </Badge>
                                              </div>
                                            )}
                                            {panel.characterPositions && (
                                              <div className="sm:col-span-2">
                                                <span className="text-xs font-medium text-muted-foreground">Character Positions:</span>
                                                <div className="text-sm mt-1 p-2 bg-muted/50 rounded text-xs">
                                                  <pre className="whitespace-pre-wrap font-mono">
                                                    {String(panel.characterPositions || '')}
                                                  </pre>
                                                </div>
                                              </div>
                                            )}
                                            {panel.spatialRelationships && panel.spatialRelationships.length > 0 && (
                                              <div className="sm:col-span-2">
                                                <span className="text-xs font-medium text-muted-foreground">Spatial Relationships:</span>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                  {panel.spatialRelationships.map((rel, idx) => (
                                                    <Badge key={idx} variant="outline" className="text-xs">
                                                      <Navigation className="h-3 w-3 mr-1" />
                                                      {rel}
                                                    </Badge>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                            {panel.physicalInteractions && panel.physicalInteractions.length > 0 && (
                                              <div className="sm:col-span-2">
                                                <span className="text-xs font-medium text-muted-foreground">Physical Interactions:</span>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                  {panel.physicalInteractions.map((interaction, idx) => (
                                                    <Badge key={idx} variant="outline" className="text-xs">
                                                      <MousePointer className="h-3 w-3 mr-1" />
                                                      {interaction}
                                                    </Badge>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                            {panel.eyelineDirections && panel.eyelineDirections.length > 0 && (
                                              <div className="sm:col-span-2">
                                                <span className="text-xs font-medium text-muted-foreground">Eyeline Directions:</span>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                  {panel.eyelineDirections.map((eyeline, idx) => (
                                                    <Badge key={idx} variant="outline" className="text-xs">
                                                      <Eye className="h-3 w-3 mr-1" />
                                                      {eyeline}
                                                    </Badge>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                            {panel.gestureDescriptions && panel.gestureDescriptions.length > 0 && (
                                              <div className="sm:col-span-2">
                                                <span className="text-xs font-medium text-muted-foreground">Gesture Descriptions:</span>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                  {panel.gestureDescriptions.map((gesture, idx) => (
                                                    <Badge key={idx} variant="outline" className="text-xs">{gesture}</Badge>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </CollapsibleContent>
                                      </Collapsible>
                                    )}

                                    {/* Technical Direction */}
                                    {(panel.pacing || panel.timing || panel.transitionType || panel.panelBorders || 
                                      panel.visualEffects?.length || panel.specialEffects?.length || panel.stylizedElements?.length) && (
                                      <Collapsible>
                                        <CollapsibleTrigger asChild>
                                          <div className="bg-gray-50 dark:bg-gray-950/20 rounded-lg p-3 sm:p-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-950/30 transition-colors">
                                            <h5 className="text-sm font-medium flex items-center gap-2" data-testid="section-technical-direction">
                                              <Settings className="h-4 w-4" />
                                              Technical Direction
                                              <ChevronRight className="h-3 w-3 ml-auto" />
                                            </h5>
                                          </div>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent>
                                          <div className="mt-2 grid gap-3 grid-cols-1 sm:grid-cols-2 text-sm">
                                            {panel.pacing && (
                                              <div>
                                                <span className="text-xs font-medium text-muted-foreground">Pacing:</span>
                                                <Badge variant="secondary" className="text-xs mt-1 block w-fit">
                                                  <Play className="h-3 w-3 mr-1" />
                                                  {panel.pacing}
                                                </Badge>
                                              </div>
                                            )}
                                            {panel.timing && (
                                              <div>
                                                <span className="text-xs font-medium text-muted-foreground">Timing:</span>
                                                <Badge variant="secondary" className="text-xs mt-1 block w-fit">
                                                  <Clock className="h-3 w-3 mr-1" />
                                                  {panel.timing}
                                                </Badge>
                                              </div>
                                            )}
                                            {panel.transitionType && (
                                              <div>
                                                <span className="text-xs font-medium text-muted-foreground">Transition Type:</span>
                                                <Badge variant="outline" className="text-xs mt-1 block w-fit">
                                                  <RotateCcw className="h-3 w-3 mr-1" />
                                                  {panel.transitionType}
                                                </Badge>
                                              </div>
                                            )}
                                            {panel.panelBorders && (
                                              <div>
                                                <span className="text-xs font-medium text-muted-foreground">Panel Borders:</span>
                                                <Badge variant="outline" className="text-xs mt-1 block w-fit">
                                                  <Frame className="h-3 w-3 mr-1" />
                                                  {panel.panelBorders}
                                                </Badge>
                                              </div>
                                            )}
                                            {panel.visualEffects && panel.visualEffects.length > 0 && (
                                              <div className="sm:col-span-2">
                                                <span className="text-xs font-medium text-muted-foreground">Visual Effects:</span>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                  {panel.visualEffects.map((effect, idx) => (
                                                    <Badge key={idx} variant="outline" className="text-xs">
                                                      <Zap className="h-3 w-3 mr-1" />
                                                      {effect}
                                                    </Badge>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                            {panel.specialEffects && panel.specialEffects.length > 0 && (
                                              <div className="sm:col-span-2">
                                                <span className="text-xs font-medium text-muted-foreground">Special Effects:</span>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                  {panel.specialEffects.map((effect, idx) => (
                                                    <Badge key={idx} variant="outline" className="text-xs">
                                                      <Sparkles className="h-3 w-3 mr-1" />
                                                      {effect}
                                                    </Badge>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                            {panel.stylizedElements && panel.stylizedElements.length > 0 && (
                                              <div className="sm:col-span-2">
                                                <span className="text-xs font-medium text-muted-foreground">Stylized Elements:</span>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                  {panel.stylizedElements.map((element, idx) => (
                                                    <Badge key={idx} variant="outline" className="text-xs">
                                                      <Layers className="h-3 w-3 mr-1" />
                                                      {element}
                                                    </Badge>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </CollapsibleContent>
                                      </Collapsible>
                                    )}

                                    {/* Enhanced Audio & Sound Design */}
                                    {(panel.soundEffects?.length || panel.detailedSoundEffects || panel.ambientSounds?.length || 
                                      panel.musicCues || panel.voiceOverText || panel.voiceOverCharacter || panel.dialoguePlacement || 
                                      panel.silenceEmphasis || panel.soundPerspective) && (
                                      <Collapsible>
                                        <CollapsibleTrigger asChild>
                                          <div className="bg-indigo-50 dark:bg-indigo-950/20 rounded-lg p-3 sm:p-4 cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-950/30 transition-colors">
                                            <h5 className="text-sm font-medium flex items-center gap-2" data-testid="section-audio-sound">
                                              <Volume2 className="h-4 w-4" />
                                              Enhanced Audio & Sound Design
                                              <ChevronRight className="h-3 w-3 ml-auto" />
                                            </h5>
                                          </div>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent>
                                          <div className="mt-2 grid gap-3 grid-cols-1 sm:grid-cols-2 text-sm">
                                            {panel.soundEffects && panel.soundEffects.length > 0 && (
                                              <div className="sm:col-span-2">
                                                <span className="text-xs font-medium text-muted-foreground">Sound Effects:</span>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                  {panel.soundEffects.map((sfx, idx) => (
                                                    <Badge key={idx} variant="secondary" className="text-xs">
                                                      <Volume2 className="h-3 w-3 mr-1" />
                                                      {sfx}
                                                    </Badge>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                            {panel.ambientSounds && panel.ambientSounds.length > 0 && (
                                              <div className="sm:col-span-2">
                                                <span className="text-xs font-medium text-muted-foreground">Ambient Sounds:</span>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                  {panel.ambientSounds.map((sound, idx) => (
                                                    <Badge key={idx} variant="outline" className="text-xs">
                                                      <Volume2 className="h-3 w-3 mr-1" />
                                                      {sound}
                                                    </Badge>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                            {panel.musicCues && (
                                              <div>
                                                <span className="text-xs font-medium text-muted-foreground">Music Cues:</span>
                                                <Badge variant="secondary" className="text-xs mt-1 block w-fit">
                                                  <Music className="h-3 w-3 mr-1" />
                                                  {panel.musicCues}
                                                </Badge>
                                              </div>
                                            )}
                                            {panel.soundPerspective && (
                                              <div>
                                                <span className="text-xs font-medium text-muted-foreground">Sound Perspective:</span>
                                                <p className="text-sm mt-1">{panel.soundPerspective}</p>
                                              </div>
                                            )}
                                            {panel.dialoguePlacement && (
                                              <div>
                                                <span className="text-xs font-medium text-muted-foreground">Dialogue Placement:</span>
                                                <p className="text-sm mt-1">{panel.dialoguePlacement}</p>
                                              </div>
                                            )}
                                            {panel.silenceEmphasis && (
                                              <div>
                                                <span className="text-xs font-medium text-muted-foreground">Silence Emphasis:</span>
                                                <Badge variant="outline" className="text-xs mt-1 block w-fit">
                                                  <VolumeX className="h-3 w-3 mr-1" />
                                                  Emphasized
                                                </Badge>
                                              </div>
                                            )}
                                            {panel.voiceOverText && (
                                              <div className="sm:col-span-2">
                                                <span className="text-xs font-medium text-muted-foreground">Voice Over:</span>
                                                <div className="mt-1 p-2 bg-muted/50 rounded">
                                                  {panel.voiceOverCharacter && (
                                                    <div className="flex items-center gap-2 mb-1">
                                                      <Badge variant="outline" className="text-xs">
                                                        <Mic className="h-3 w-3 mr-1" />
                                                        {panel.voiceOverCharacter}
                                                      </Badge>
                                                    </div>
                                                  )}
                                                  <p className="text-sm italic">"{panel.voiceOverText}"</p>
                                                </div>
                                              </div>
                                            )}
                                            {panel.detailedSoundEffects && (
                                              <div className="sm:col-span-2">
                                                <span className="text-xs font-medium text-muted-foreground">Detailed Sound Effects:</span>
                                                <div className="text-sm mt-1 p-2 bg-muted/50 rounded text-xs">
                                                  <pre className="whitespace-pre-wrap font-mono">
                                                    {String(panel.detailedSoundEffects || '')}
                                                  </pre>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </CollapsibleContent>
                                      </Collapsible>
                                    )}

                                    {/* AI Generation Metadata */}
                                    {(panel.generationPrompt || panel.negativePrompt || panel.promptWeight || 
                                      panel.consistencyNotes || panel.referenceImages?.length) && (
                                      <Collapsible>
                                        <CollapsibleTrigger asChild>
                                          <div className="bg-slate-50 dark:bg-slate-950/20 rounded-lg p-3 sm:p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-950/30 transition-colors">
                                            <h5 className="text-sm font-medium flex items-center gap-2" data-testid="section-ai-metadata">
                                              <Bot className="h-4 w-4" />
                                              AI Generation Metadata
                                              <ChevronRight className="h-3 w-3 ml-auto" />
                                            </h5>
                                          </div>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent>
                                          <div className="mt-2 space-y-3 text-sm">
                                            {panel.generationPrompt && (
                                              <div>
                                                <span className="text-xs font-medium text-muted-foreground">Generation Prompt:</span>
                                                <div className="text-sm mt-1 p-2 bg-muted/50 rounded">
                                                  <p className="whitespace-pre-wrap">{panel.generationPrompt}</p>
                                                </div>
                                              </div>
                                            )}
                                            {panel.negativePrompt && (
                                              <div>
                                                <span className="text-xs font-medium text-muted-foreground">Negative Prompt:</span>
                                                <div className="text-sm mt-1 p-2 bg-red-50 dark:bg-red-950/30 rounded">
                                                  <p className="whitespace-pre-wrap">{panel.negativePrompt}</p>
                                                </div>
                                              </div>
                                            )}
                                            {panel.consistencyNotes && (
                                              <div>
                                                <span className="text-xs font-medium text-muted-foreground">Consistency Notes:</span>
                                                <p className="text-sm mt-1 break-words">{panel.consistencyNotes}</p>
                                              </div>
                                            )}
                                            {panel.promptWeight && (
                                              <div>
                                                <span className="text-xs font-medium text-muted-foreground">Prompt Weights:</span>
                                                <div className="text-sm mt-1 p-2 bg-muted/50 rounded text-xs">
                                                  <pre className="whitespace-pre-wrap font-mono">
                                                    {String(panel.promptWeight || '')}
                                                  </pre>
                                                </div>
                                              </div>
                                            )}
                                            {panel.referenceImages && panel.referenceImages.length > 0 && (
                                              <div>
                                                <span className="text-xs font-medium text-muted-foreground">Reference Images:</span>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                  {panel.referenceImages.map((image, idx) => (
                                                    <Badge key={idx} variant="outline" className="text-xs">
                                                      <Image className="h-3 w-3 mr-1" />
                                                      {image}
                                                    </Badge>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </CollapsibleContent>
                                      </Collapsible>
                                    )}

                                    {/* Dialogue Section */}
                                    {panel.dialogue && panel.dialogue.length > 0 && (
                                      <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-3 sm:p-4">
                                        <h5 className="text-sm font-medium mb-3 flex items-center gap-2" data-testid="section-dialogue">
                                          <MessageSquare className="h-4 w-4" />
                                          Dialogue
                                        </h5>
                                        <div className="space-y-2">
                                          {panel.dialogue.map((dialogue, idx) => (
                                            <div key={idx} className="bg-white dark:bg-gray-800 rounded p-3 border">
                                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                                                <span className="text-sm font-medium break-words">
                                                  {dialogue.character}
                                                </span>
                                                <div className="flex flex-wrap gap-1">
                                                  {dialogue.tone && (
                                                    <Badge variant="outline" className="text-xs">
                                                      {dialogue.tone}
                                                    </Badge>
                                                  )}
                                                  {dialogue.bubbleType && (
                                                    <Badge variant="outline" className="text-xs">
                                                      {dialogue.bubbleType}
                                                    </Badge>
                                                  )}
                                                  {dialogue.emotionalState && (
                                                    <Badge variant="outline" className="text-xs">
                                                      {dialogue.emotionalState}
                                                    </Badge>
                                                  )}
                                                </div>
                                              </div>
                                              <p className="text-sm break-words">"{dialogue.text}"</p>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </CardContent>
                              </CollapsibleContent>
                            </Collapsible>
                          </Card>
                        ))}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}