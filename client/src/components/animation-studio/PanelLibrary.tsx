import { memo, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PanelAsset } from "./types";
import { ImageOff, PlusCircle, BookOpen } from "lucide-react";
import type { Project } from "@shared/schema";

const DRAG_DATA_TYPE = "application/x-kumayiri-panel";

interface PanelLibraryProps {
  panels: PanelAsset[];
  isLoading?: boolean;
  onQuickAdd?: (panelId: string) => void;
  activeSceneName?: string;
  projects?: Project[];
  selectedProjectId?: string | null;
  onProjectSelect?: (projectId: string) => void;
}

export const PanelLibrary = memo(function PanelLibrary({ 
  panels, 
  isLoading, 
  onQuickAdd, 
  activeSceneName, 
  projects = [], 
  selectedProjectId, 
  onProjectSelect 
}: PanelLibraryProps) {
  const totalPanels = panels.length;
  const sortedPanels = useMemo(() => {
    return [...panels].sort((a, b) => {
      if (a.pageNumber === b.pageNumber) {
        return a.panelNumber - b.panelNumber;
      }
      return a.pageNumber - b.pageNumber;
    });
  }, [panels]);

  const showProjectSelector = projects.length > 1 && Boolean(onProjectSelect);
  const selectedProject = projects.find(p => p.id === selectedProjectId);

  return (
    <Card className="border-border/60">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 flex-1 min-w-0">
            <CardTitle className="text-base font-semibold">Panel library</CardTitle>
            <p className="text-xs text-muted-foreground">
              Drag panels into your scene timeline or tap to drop them into {activeSceneName ?? "the current scene"}.
            </p>
          </div>
        </div>
        {showProjectSelector && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Browse panels from</label>
            <Select value={selectedProjectId ?? undefined} onValueChange={onProjectSelect}>
              <SelectTrigger className="w-full" data-testid="select-panel-library-project">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <SelectValue placeholder="Select a project to browse" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {projects.map(project => (
                  <SelectItem key={project.id} value={project.id} data-testid={`select-item-project-${project.id}`}>
                    {project.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedProject && (
              <p className="text-xs text-muted-foreground">
                Browsing panels from <span className="font-medium text-foreground">{selectedProject.title}</span>
              </p>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="px-0 pt-0">
        {isLoading ? (
          <div className="space-y-4 px-4 pb-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : totalPanels === 0 ? (
          <div className="px-4 pb-6">
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/60 bg-muted/30 p-8 text-center text-sm text-muted-foreground">
              <ImageOff className="h-10 w-10 text-muted-foreground" />
              No panels yet. Generate comic pages to unlock motion stitches.
            </div>
          </div>
        ) : (
          <ScrollArea className="h-[420px]">
            <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2 xl:grid-cols-3">
              {sortedPanels.map(panel => (
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
                  <div className="space-y-2 p-3">
                    <p className="line-clamp-3 text-xs text-muted-foreground">
                      {panel.scriptSnippet || panel.prompt || "No script context captured for this panel."}
                    </p>
                    {onQuickAdd ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-full gap-2 text-xs"
                        onClick={() => onQuickAdd(panel.id)}
                      >
                        <PlusCircle className="h-4 w-4" />
                        Drop into scene
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
});

export { DRAG_DATA_TYPE };
