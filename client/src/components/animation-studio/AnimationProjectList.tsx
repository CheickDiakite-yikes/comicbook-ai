import { useMemo } from "react";
import type { Project } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, FolderOpen, Wand2 } from "lucide-react";

interface AnimationProjectListProps {
  projects: Project[];
  selectedProjectId: string | null;
  onSelect: (projectId: string) => void;
  isLoading?: boolean;
}

export function AnimationProjectList({ projects, selectedProjectId, onSelect, isLoading }: AnimationProjectListProps) {
  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [projects]);

  return (
    <Card className="h-full border-border/60">
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Sparkles className="h-4 w-4 text-primary" />
          Story worlds ready to animate
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Choose a comic project to stitch its panels into cinematic beats.
        </p>
      </CardHeader>
      <CardContent className="px-0 pt-0">
        {isLoading ? (
          <div className="space-y-3 px-4 pb-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/30 p-3">
                <Skeleton className="h-12 w-12 rounded-md" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : sortedProjects.length === 0 ? (
          <div className="px-4 pb-6">
            <div className="rounded-xl border border-dashed border-border/60 bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              <Wand2 className="mx-auto mb-3 h-8 w-8 text-primary" />
              Generate a comic project to begin weaving animation clips.
            </div>
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-15rem)]">
            <div className="space-y-2 px-4 pb-6">
              {sortedProjects.map(project => {
                const isSelected = project.id === selectedProjectId;
                return (
                  <button
                    key={project.id}
                    onClick={() => onSelect(project.id)}
                    className={`w-full rounded-lg border px-3 py-3 text-left transition-all ${
                      isSelected
                        ? "border-primary/60 bg-primary/10 shadow-inner"
                        : "border-transparent bg-transparent hover:border-border/60 hover:bg-muted/40"
                    }`}
                    aria-pressed={isSelected}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="font-medium text-sm text-foreground line-clamp-1">{project.title}</div>
                        {project.genre ? (
                          <Badge variant="outline" className="text-[11px] font-normal">
                            {project.genre}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">No genre tagged</span>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {project.coverArt ? (
                          <img
                            src={project.coverArt}
                            alt="Project cover art"
                            className="h-12 w-12 rounded-md object-cover shadow-sm"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-md border border-border/60 bg-background">
                            <FolderOpen className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        {isSelected && (
                          <Badge className="bg-primary text-primary-foreground">Active</Badge>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
      <div className="px-4 pb-4">
        <Button
          onClick={() => selectedProjectId && onSelect(selectedProjectId)}
          variant="secondary"
          className="w-full"
          disabled={!selectedProjectId}
        >
          Resume stitching
        </Button>
      </div>
    </Card>
  );
}
