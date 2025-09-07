import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  Eye
} from "lucide-react";
import type { FullStructuredScript } from "@shared/schema";

interface StructuredScriptViewerProps {
  projectId: string;
  currentPageNumber?: number;
}

export default function StructuredScriptViewer({ projectId, currentPageNumber }: StructuredScriptViewerProps) {
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());
  const [expandedPanels, setExpandedPanels] = useState<Set<string>>(new Set());

  const { data: structuredScript, isLoading } = useQuery<FullStructuredScript | null>({
    queryKey: ["/api/projects", projectId, "structured-script"],
    retry: false,
  });

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
        <h2 className="text-xl font-semibold">Script Breakdown</h2>
        
        <ScrollArea className="h-[600px] w-full border rounded-md p-4">
          <div className="space-y-4">
            {structuredScript.pages?.filter(page => 
              currentPageNumber ? page.pageNumber === currentPageNumber : true
            ).map((page) => (
              <Card key={page.id} className={`overflow-hidden ${
                currentPageNumber && page.pageNumber === currentPageNumber ? 'border-primary border-2' : ''
              }`}>
                {currentPageNumber && page.pageNumber === currentPageNumber && (
                  <div className="bg-primary/5 px-4 py-2 border-b">
                    <div className="flex items-center gap-2">
                      <Badge variant="default">Current Page</Badge>
                      <span className="text-sm font-medium">Page {page.pageNumber}: {page.title}</span>
                    </div>
                  </div>
                )}
                <Collapsible 
                  open={expandedPages.has(page.id)} 
                  onOpenChange={() => togglePage(page.id)}
                >
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {expandedPages.has(page.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <div>
                            <CardTitle className="text-lg">
                              Page {page.pageNumber}: {page.title}
                            </CardTitle>
                            <div className="flex flex-wrap gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">
                                <MapPin className="h-3 w-3 mr-1" />
                                {page.setting}
                              </Badge>
                              {page.mood && (
                                <Badge variant="outline" className="text-xs">
                                  <Palette className="h-3 w-3 mr-1" />
                                  {page.mood}
                                </Badge>
                              )}
                              <Badge variant="secondary" className="text-xs">
                                {page.panels?.length || 0} Panels
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      {/* Page Summary */}
                      <div className="bg-muted/30 rounded-lg p-4 mb-4">
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Characters & Setting
                        </h4>
                        <div className="space-y-2">
                          <div>
                            <span className="text-sm font-medium">Setting:</span>
                            <p className="text-sm text-muted-foreground mt-1">
                              {page.setting}
                            </p>
                          </div>
                          {(page.timeOfDay || page.location || page.weatherConditions) && (
                            <div className="flex flex-wrap gap-2">
                              {page.timeOfDay && (
                                <Badge variant="outline" className="text-xs">
                                  <Clock className="h-3 w-3 mr-1" />
                                  {page.timeOfDay}
                                </Badge>
                              )}
                              {page.location && (
                                <Badge variant="outline" className="text-xs">
                                  <MapPin className="h-3 w-3 mr-1" />
                                  {page.location}
                                </Badge>
                              )}
                              {page.weatherConditions && (
                                <Badge variant="outline" className="text-xs">
                                  {page.weatherConditions}
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
                          <Card key={panel.id} className="border-l-4 border-l-primary/30">
                            <Collapsible 
                              open={expandedPanels.has(panel.id)} 
                              onOpenChange={() => togglePanel(panel.id)}
                            >
                              <CollapsibleTrigger asChild>
                                <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors pb-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      {expandedPanels.has(panel.id) ? (
                                        <ChevronDown className="h-3 w-3" />
                                      ) : (
                                        <ChevronRight className="h-3 w-3" />
                                      )}
                                      <CardTitle className="text-base">
                                        Panel {panel.panelNumber}
                                      </CardTitle>
                                      <div className="flex gap-1">
                                        <Badge variant="outline" className="text-xs">
                                          <Camera className="h-3 w-3 mr-1" />
                                          {panel.cameraAngle}
                                        </Badge>
                                        <Badge variant="outline" className="text-xs">
                                          <Eye className="h-3 w-3 mr-1" />
                                          {panel.shotType}
                                        </Badge>
                                      </div>
                                    </div>
                                  </div>
                                  <p className="text-sm text-muted-foreground text-left">
                                    {panel.sceneDescription}
                                  </p>
                                </CardHeader>
                              </CollapsibleTrigger>
                              
                              <CollapsibleContent>
                                <CardContent className="pt-0">
                                  <div className="grid gap-4 md:grid-cols-2">
                                    {/* Technical Details */}
                                    <div className="space-y-3">
                                      <div>
                                        <h5 className="text-sm font-medium mb-2 flex items-center gap-1">
                                          <Camera className="h-3 w-3" />
                                          Technical Direction
                                        </h5>
                                        <div className="space-y-1 text-sm">
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">Mood:</span>
                                            <span>{panel.mood}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">Timing:</span>
                                            <span>{panel.timing}</span>
                                          </div>
                                        </div>
                                      </div>

                                      <div>
                                        <h5 className="text-sm font-medium mb-1">Action:</h5>
                                        <p className="text-sm text-muted-foreground">
                                          {panel.action}
                                        </p>
                                      </div>

                                      {panel.visualNotes && (
                                        <div>
                                          <h5 className="text-sm font-medium mb-1">Visual Notes:</h5>
                                          <p className="text-sm text-muted-foreground">
                                            {panel.visualNotes}
                                          </p>
                                        </div>
                                      )}

                                      {panel.soundEffects && panel.soundEffects.length > 0 && (
                                        <div>
                                          <h5 className="text-sm font-medium mb-1 flex items-center gap-1">
                                            <Volume2 className="h-3 w-3" />
                                            Sound Effects:
                                          </h5>
                                          <div className="flex flex-wrap gap-1">
                                            {panel.soundEffects.map((sfx, idx) => (
                                              <Badge key={idx} variant="secondary" className="text-xs">
                                                {sfx}
                                              </Badge>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    {/* Character Emotions & Dialogue */}
                                    <div className="space-y-3">
                                      {panel.characters && panel.characters.length > 0 && (
                                        <div>
                                          <h5 className="text-sm font-medium mb-2 flex items-center gap-1">
                                            <Users className="h-3 w-3" />
                                            Characters Present
                                          </h5>
                                          <div className="flex flex-wrap gap-1">
                                            {panel.characters.map((character: string, idx: number) => (
                                              <Badge key={idx} variant="outline" className="text-xs">
                                                {character}
                                              </Badge>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {panel.dialogue && panel.dialogue.length > 0 && (
                                        <div>
                                          <h5 className="text-sm font-medium mb-2 flex items-center gap-1">
                                            <MessageSquare className="h-3 w-3" />
                                            Dialogue
                                          </h5>
                                          <div className="space-y-2">
                                            {panel.dialogue.map((dialogue, idx) => (
                                              <div key={idx} className="bg-muted/50 rounded p-2">
                                                <div className="flex items-center justify-between mb-1">
                                                  <span className="text-sm font-medium">
                                                    {dialogue.character}
                                                  </span>
                                                  <div className="flex gap-1">
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
                                                <p className="text-sm">"{dialogue.text}"</p>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
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