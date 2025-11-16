import { useMemo, useState } from "react";
import { Scene } from "./types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DRAG_DATA_TYPE } from "./PanelLibrary";
import { Clapperboard, Clock, Film, Layers, Plus, Sparkles, Video } from "lucide-react";

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

const TRACKS = [
  { id: "panel", label: "Panel", color: "border-teal-500/50 bg-teal-500/10" },
  { id: "camera", label: "Camera", color: "border-sky-500/50 bg-sky-500/10" },
  { id: "prompt", label: "Prompt", color: "border-amber-500/60 bg-amber-500/10" },
  { id: "fx", label: "FX", color: "border-cyan-500/40 bg-cyan-500/10" },
  { id: "audio", label: "Audio", color: "border-emerald-500/40 bg-emerald-500/10" },
];

export function SceneTimeline({
  scenes,
  selectedSceneId,
  onSelectScene,
  onDropPanel,
  onRemoveClip,
  onAddScene,
  onClearScene,
  onRemoveLastClip,
}: SceneTimelineProps) {
  const [mode, setMode] = useState<"ripple" | "overwrite">("ripple");
  const [snapEnabled, setSnapEnabled] = useState(true);

  const activeScene = useMemo(() => scenes.find(scene => scene.id === selectedSceneId) ?? scenes[0] ?? null, [
    scenes,
    selectedSceneId,
  ]);

  const timelineMarks = useMemo(() => {
    const seconds = activeScene?.durationSeconds ?? 6;
    return Array.from({ length: seconds + 1 }, (_, index) => index);
  }, [activeScene?.durationSeconds]);

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (!activeScene) return;
    event.preventDefault();
    const raw = event.dataTransfer.getData(DRAG_DATA_TYPE) || event.dataTransfer.getData("application/json");
    if (!raw) return;
    try {
      const payload = JSON.parse(raw);
      if (payload?.panelId) {
        onDropPanel(activeScene.id, payload.panelId as string);
      }
    } catch {
      // ignore malformed payloads
    }
  };

  const renderPanelClips = () => {
    if (!activeScene) return null;
    if (activeScene.clips.length === 0) {
      return (
        <div className="flex h-20 items-center justify-center rounded-2xl border border-dashed border-border/60 text-xs text-muted-foreground">
          Drop panels or tap the library to build beats.
        </div>
      );
    }

    const widthPerClip = 100 / activeScene.clips.length;

    return (
      <div className="flex h-24 items-stretch gap-2">
        {activeScene.clips.map(clip => (
          <div
            key={clip.id}
            className="group relative flex flex-1 overflow-hidden rounded-2xl border border-teal-500/40 bg-white/80"
            style={{ width: `${widthPerClip}%` }}
          >
            <div className="h-full w-28 overflow-hidden border-r border-border/60">
              {clip.panel.imageUrl ? (
                <img src={clip.panel.imageUrl} alt="Panel" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <Film className="h-4 w-4" />
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col justify-between p-3 text-xs">
              <div>
                <p className="font-medium text-foreground">Page {clip.panel.pageNumber} · Panel {clip.panel.panelNumber}</p>
                <p className="line-clamp-2 text-[11px] text-muted-foreground">
                  {clip.panel.scriptSnippet || clip.panel.prompt || "No script context available."}
                </p>
              </div>
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
                <span>Trim · Split</span>
                <button
                  type="button"
                  onClick={() => activeScene && onRemoveClip(activeScene.id, clip.id)}
                  className="opacity-50 transition hover:opacity-100"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Clapperboard className="h-4 w-4 text-primary" />
              Timeline
            </CardTitle>
            <p className="text-xs text-muted-foreground">Scrub beats across panel, camera, prompt, FX, and audio tracks.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Button size="sm" className="gap-2" onClick={onAddScene}>
              <Plus className="h-4 w-4" /> New scene
            </Button>
            {activeScene ? (
              <Button size="sm" variant="outline" onClick={() => onClearScene(activeScene.id)}>
                Reset scene
              </Button>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto">
          {scenes.map(scene => (
            <button
              key={scene.id}
              onClick={() => onSelectScene(scene.id)}
              className={`rounded-2xl border px-4 py-2 text-left text-xs transition ${
                scene.id === activeScene?.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/70 hover:border-primary/40"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{scene.title}</span>
                <Badge variant={scene.id === activeScene?.id ? "default" : "secondary"}>{scene.clips.length} beat{scene.clips.length === 1 ? "" : "s"}</Badge>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {scene.durationSeconds}s · {scene.aspectRatio}
              </p>
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/50 px-3 py-1">
            <Clock className="h-3 w-3" /> Mode
            <div className="rounded-full bg-white/80 p-1 shadow-inner">
              <button
                type="button"
                className={`rounded-full px-3 py-1 text-[11px] ${mode === "ripple" ? "bg-primary text-white" : "text-muted-foreground"}`}
                onClick={() => setMode("ripple")}
              >
                Ripple
              </button>
              <button
                type="button"
                className={`rounded-full px-3 py-1 text-[11px] ${mode === "overwrite" ? "bg-primary text-white" : "text-muted-foreground"}`}
                onClick={() => setMode("overwrite")}
              >
                Overwrite
              </button>
            </div>
          </div>
          <button
            type="button"
            className={`rounded-full border px-3 py-1 text-[11px] ${snapEnabled ? "border-primary bg-primary/10 text-primary" : "border-border/60 text-muted-foreground"}`}
            onClick={() => setSnapEnabled(prev => !prev)}
          >
            Snap to beats
          </button>
          {activeScene ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 px-3 py-1 text-[11px] text-muted-foreground">
              <Video className="h-3 w-3" /> {activeScene.durationSeconds}s · {activeScene.aspectRatio}
            </div>
          ) : null}
        </div>

        <div className="rounded-3xl border border-border/60 bg-card/70 p-4" onDragOver={event => event.preventDefault()} onDrop={handleDrop}>
          <div className="mb-4 flex items-center gap-4 text-[11px] uppercase tracking-wide text-muted-foreground">
            <Layers className="h-4 w-4" />
            <div className="relative h-8 flex-1">
              <div className="absolute inset-0 flex items-center">
                {timelineMarks.map(mark => (
                  <div key={mark} className="relative flex-1 text-center">
                    <span>{mark}s</span>
                    <div className="absolute right-0 top-4 h-4 w-px bg-border" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {TRACKS.map(track => (
              <div key={track.id} className="rounded-2xl border border-border/40 bg-muted/30 p-3">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="rounded-full">{track.label}</Badge>
                    {track.id === "panel" && activeScene ? (
                      <span className="text-[11px] text-muted-foreground">{activeScene.clips.length} clips</span>
                    ) : null}
                  </div>
                  {track.id === "panel" && activeScene ? (
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <button type="button" onClick={() => onRemoveLastClip(activeScene.id)}>Undo drop</button>
                      <span>·</span>
                      <button type="button" onClick={() => onClearScene(activeScene.id)}>Clear</button>
                    </div>
                  ) : null}
                </div>
                {track.id === "panel" ? (
                  renderPanelClips()
                ) : (
                  <div className={`flex h-16 items-center justify-between rounded-2xl border ${track.color} px-4 text-xs text-muted-foreground`}>
                    <span>
                      {track.id === "camera"
                        ? "Attach a parallax, dolly, or whip-pan camera clip."
                        : track.id === "prompt"
                          ? "Prompt overrides and consistency locks show here."
                          : track.id === "fx"
                            ? "FX like halftone dust or light leaks land here."
                            : "Drop audio beds or upload custom soundtracks."}
                    </span>
                    <Sparkles className="h-4 w-4 opacity-60" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
