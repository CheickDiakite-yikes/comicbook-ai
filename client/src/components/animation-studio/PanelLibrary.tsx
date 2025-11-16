import { memo, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PanelAsset, Scene } from "./types";
import { ImageOff, PlusCircle, Search, Filter, Sparkles } from "lucide-react";

const DRAG_DATA_TYPE = "application/x-kumayiri-panel";

interface PanelLibraryProps {
  panels: PanelAsset[];
  pages?: { id: string; pageNumber: number; scriptSnippet: string | null }[];
  scenes?: Scene[];
  selectedSceneId?: string | null;
  onSelectScene?: (sceneId: string) => void;
  isLoading?: boolean;
  onQuickAdd?: (panelId: string) => void;
  activeSceneName?: string;
}

const FILTER_PRESETS = ["Characters", "Locations", "Props", "Action", "Quiet"];

export const PanelLibrary = memo(function PanelLibrary({
  panels,
  isLoading,
  onQuickAdd,
  activeSceneName,
  pages = [],
  scenes = [],
  selectedSceneId,
  onSelectScene,
}: PanelLibraryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  const toggleFilter = (filter: string) => {
    setActiveFilters(prev => (prev.includes(filter) ? prev.filter(item => item !== filter) : [...prev, filter]));
  };

  const sortedPanels = useMemo(() => {
    return [...panels].sort((a, b) => {
      if (a.pageNumber === b.pageNumber) {
        return a.panelNumber - b.panelNumber;
      }
      return a.pageNumber - b.pageNumber;
    });
  }, [panels]);

  const filteredPanels = useMemo(() => {
    if (!searchQuery && activeFilters.length === 0) return sortedPanels;
    return sortedPanels.filter(panel => {
      const matchesSearch = searchQuery
        ? [panel.prompt, panel.scriptSnippet, `Page ${panel.pageNumber}`, `Panel ${panel.panelNumber}`]
            .filter(Boolean)
            .some(entry => entry!.toLowerCase().includes(searchQuery.toLowerCase()))
        : true;
      if (!matchesSearch) return false;
      if (activeFilters.length === 0) return true;
      // Placeholder filter behavior: treat script snippets as searchable tags
      return activeFilters.some(filter =>
        (panel.scriptSnippet ?? panel.prompt ?? "").toLowerCase().includes(filter.toLowerCase()),
      );
    });
  }, [sortedPanels, searchQuery, activeFilters]);

  const emptyState = (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/60 bg-muted/30 p-8 text-center text-sm text-muted-foreground">
      <ImageOff className="h-10 w-10 text-muted-foreground" />
      No panels yet. Generate comic pages to unlock motion stitches.
    </div>
  );

  return (
    <Card className="border-border/60">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold">Asset browser</CardTitle>
            <p className="text-xs text-muted-foreground">Drag panels, review pages, or jump between scenes.</p>
          </div>
          <Badge variant="outline" className="gap-1">
            <Sparkles className="h-3 w-3" /> {panels.length} panels
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search panels, characters, or beats"
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              className="pl-9"
            />
          </div>
          <Button type="button" variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" /> Filters
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {FILTER_PRESETS.map(filter => (
            <Button
              key={filter}
              type="button"
              variant={activeFilters.includes(filter) ? "default" : "secondary"}
              size="sm"
              className="rounded-full"
              onClick={() => toggleFilter(filter)}
            >
              {filter}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-0 pt-0">
        <Tabs defaultValue="panels" className="w-full">
          <TabsList className="ml-4 w-[calc(100%-2rem)] justify-start overflow-auto">
            <TabsTrigger value="panels">Panels</TabsTrigger>
            <TabsTrigger value="pages">Pages</TabsTrigger>
            <TabsTrigger value="scenes">Scenes</TabsTrigger>
            <TabsTrigger value="search">Prompts</TabsTrigger>
          </TabsList>
          <TabsContent value="panels" className="px-4">
            {isLoading ? (
              <div className="space-y-4 pb-6">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-24 w-full rounded-xl" />
                ))}
              </div>
            ) : filteredPanels.length === 0 ? (
              <div className="pb-6">{emptyState}</div>
            ) : (
              <ScrollArea className="h-[420px]">
                <div className="grid gap-3 pb-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredPanels.map(panel => (
                    <div
                      key={`${panel.pageId}-${panel.panelNumber}-${panel.id}`}
                      className="group relative overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                      draggable
                      onDragStart={event => {
                        event.dataTransfer.setData(DRAG_DATA_TYPE, JSON.stringify({ panelId: panel.id }));
                        event.dataTransfer.effectAllowed = "copy";
                      }}
                    >
                      <div className="relative h-36 w-full overflow-hidden bg-muted">
                        {panel.imageUrl ? (
                          <img src={panel.imageUrl} alt={`Page ${panel.pageNumber} panel ${panel.panelNumber}`} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <ImageOff className="h-6 w-6" />
                          </div>
                        )}
                        <div className="absolute left-2 top-2 rounded-full bg-background/80 px-2 py-1 text-xs font-medium">
                          Page {panel.pageNumber} · Panel {panel.panelNumber}
                        </div>
                      </div>
                      <div className="space-y-2 p-3 text-xs">
                        <p className="line-clamp-3 text-muted-foreground">
                          {panel.scriptSnippet || panel.prompt || "No script context captured for this panel."}
                        </p>
                        {onQuickAdd ? (
                          <Button type="button" size="sm" variant="outline" className="w-full gap-2 text-xs" onClick={() => onQuickAdd(panel.id)}>
                            <PlusCircle className="h-4 w-4" /> Drop into {activeSceneName ?? "scene"}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
          <TabsContent value="pages" className="px-4">
            {pages.length === 0 ? (
              <div className="pb-6 text-sm text-muted-foreground">No pages synced for this project yet.</div>
            ) : (
              <ScrollArea className="h-[420px] pb-4">
                <div className="space-y-3">
                  {pages.map(page => (
                    <div key={page.id} className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <div className="flex items-center justify-between text-sm font-medium">
                        <span>Page {page.pageNumber}</span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground line-clamp-3">
                        {page.scriptSnippet ?? "No script snippet stored."}
                      </p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
          <TabsContent value="scenes" className="px-4">
            {scenes.length === 0 ? (
              <div className="pb-6 text-sm text-muted-foreground">No scenes yet. Create a scene from the timeline to begin.</div>
            ) : (
              <div className="space-y-3 pb-4">
                {scenes.map(scene => (
                  <button
                    key={scene.id}
                    onClick={() => onSelectScene?.(scene.id)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition ${
                      scene.id === selectedSceneId
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/60 hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs uppercase tracking-wide">
                      <span>{scene.title}</span>
                      <span>{scene.clips.length} beat{scene.clips.length === 1 ? "" : "s"}</span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                      {scene.prompt.trim() ? scene.prompt : "Using auto prompt"}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="search" className="px-4">
            <div className="space-y-3 pb-4 text-xs text-muted-foreground">
              <p>
                Prompt inheritance lets you carry locks from the scene to each clip. Use the Prompt tab in the inspector to refine tokens, then save a favorite stack here soon.
              </p>
              <div className="rounded-2xl border border-dashed border-border/60 p-4">
                <p className="font-medium text-foreground">Coming soon</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Saved prompt chips, reusable camera moves, and search across prior renders will live here.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
});

export { DRAG_DATA_TYPE };
