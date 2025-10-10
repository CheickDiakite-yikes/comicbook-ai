import { Scene } from "./types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DRAG_DATA_TYPE } from "./PanelLibrary";
import { Film, Scissors, Trash2, Plus } from "lucide-react";

interface SceneTimelineProps {
  scenes: Scene[];
  selectedSceneId: string | null;
  onSelectScene: (sceneId: string) => void;
  onDropPanel: (sceneId: string, panelId: string) => void;
  onRemoveClip: (sceneId: string, clipId: string) => void;
  onAddScene: () => void;
  onClearScene: (sceneId: string) => void;
  onRemoveLastClip: (sceneId: string) => void;
}

export function SceneTimeline({ scenes, selectedSceneId, onSelectScene, onDropPanel, onRemoveClip, onAddScene, onClearScene, onRemoveLastClip }: SceneTimelineProps) {
  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base font-semibold">Scene timeline</CardTitle>
          <p className="text-xs text-muted-foreground">
            Stitch frames into cinematic beats. Drop panels to craft motion for each moment.
          </p>
        </div>
        <Button size="sm" className="gap-2" onClick={onAddScene}>
          <Plus className="h-4 w-4" />
          Add scene
        </Button>
      </CardHeader>
      <CardContent>
        {scenes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
            No scenes yet. Start by adding a scene and dropping panels in.
          </div>
        ) : (
          <ScrollArea className="h-[340px]">
            <div className="flex min-h-[260px] gap-4 pb-4">
              {scenes.map(scene => {
                const isActive = scene.id === selectedSceneId;
                return (
                  <div
                    key={scene.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectScene(scene.id)}
                    onKeyDown={event => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectScene(scene.id);
                      }
                    }}
                    className={`flex w-72 flex-col rounded-2xl border bg-card transition ${
                      isActive
                        ? "border-primary shadow-lg shadow-primary/20"
                        : "border-border/70 hover:border-primary/60 hover:shadow"
                    }`}
                    onDragOver={event => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "copy";
                    }}
                    onDrop={event => {
                      event.preventDefault();
                      const raw = event.dataTransfer.getData(DRAG_DATA_TYPE) || event.dataTransfer.getData("application/json");
                      if (!raw) return;
                      try {
                        const payload = JSON.parse(raw);
                        if (payload?.panelId) {
                          onDropPanel(scene.id, payload.panelId as string);
                        }
                      } catch {
                        // ignore malformed payloads
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-2 p-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={isActive ? "default" : "secondary"} className="gap-1">
                            <Film className="h-3 w-3" />
                            {scene.title}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {scene.clips.length === 0
                            ? "Drop panels to begin crafting motion"
                            : `${scene.clips.length} ${scene.clips.length === 1 ? "frame" : "frames"} stitched`}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={event => {
                            event.stopPropagation();
                            onClearScene(scene.id);
                          }}
                          title="Clear scene"
                        >
                          <Scissors className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={event => {
                            event.stopPropagation();
                            onRemoveLastClip(scene.id);
                          }}
                          title="Remove last clip"
                          disabled={scene.clips.length === 0}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex-1 space-y-2 px-4 pb-4">
                      {scene.clips.length === 0 ? (
                        <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/40 text-xs text-muted-foreground">
                          Drop panels here
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {scene.clips.map(clip => (
                            <div
                              key={clip.id}
                              className="group flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 p-3"
                            >
                              <div className="relative h-16 w-16 overflow-hidden rounded-lg bg-background">
                                {clip.panel.imageUrl ? (
                                  <img src={clip.panel.imageUrl} alt="Panel" className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                                    <Film className="h-4 w-4" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 space-y-1">
                                <div className="text-xs font-medium text-foreground">
                                  Page {clip.panel.pageNumber} · Panel {clip.panel.panelNumber}
                                </div>
                                <p className="line-clamp-2 text-xs text-muted-foreground">
                                  {clip.panel.scriptSnippet || clip.panel.prompt || "No script context available."}
                                </p>
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 opacity-0 transition group-hover:opacity-100"
                                onClick={event => {
                                  event.stopPropagation();
                                  onRemoveClip(scene.id, clip.id);
                                }}
                                title="Remove frame"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
