import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Scene } from "./types";
import { Camera, Grid, Pause, Play, Sparkles, Timer } from "lucide-react";

interface CinematicCanvasProps {
  scene: Scene | null;
  autoPrompt: string;
  isLoadingPanels?: boolean;
}

export function CinematicCanvas({ scene, autoPrompt, isLoadingPanels }: CinematicCanvasProps) {
  const [playhead, setPlayhead] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showSafeArea, setShowSafeArea] = useState(true);
  const [showThirds, setShowThirds] = useState(false);

  useEffect(() => {
    setPlayhead(0);
    setIsPlaying(false);
  }, [scene?.id]);

  const activeClip = scene?.clips?.[0] ?? null;
  const previewImage = activeClip?.panel.imageUrl;
  const duration = scene?.durationSeconds ?? 6;
  const aspectLabel = scene ? scene.aspectRatio : "16:9";
  const promptPreview = useMemo(() => {
    const source = scene?.prompt?.trim().length ? scene.prompt : autoPrompt;
    if (!source) return "Drop panels into the timeline to generate a prompt.";
    if (source.length <= 220) return source;
    return `${source.slice(0, 217)}…`;
  }, [scene?.prompt, autoPrompt]);

  const togglePlayback = () => {
    setIsPlaying(prev => !prev);
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="space-y-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Camera className="h-4 w-4 text-primary" />
          Canvas + Player
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Scrub, toggle guides, and preview how Veo will treat your selected beat. Safe areas and rule-of-thirds overlays keep the framing faithful to the comic page.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-3xl border border-border/80 bg-gradient-to-b from-stone-100 to-stone-200 p-4">
          <div className="relative">
            <AspectRatio ratio={16 / 9} className="overflow-hidden rounded-2xl bg-black/70">
              {previewImage ? (
                <img src={previewImage} alt="Panel preview" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
                  {isLoadingPanels ? (
                    <>
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-dashed border-white/60" />
                      Loading panel preview…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5 text-muted-foreground" />
                      Drop a panel to preview motion
                    </>
                  )}
                </div>
              )}
              {showSafeArea ? (
                <div className="pointer-events-none absolute inset-6 rounded-xl border border-white/50" />
              ) : null}
              {showThirds ? (
                <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                  {Array.from({ length: 9 }).map((_, index) => (
                    <div key={index} className="border border-white/20" />
                  ))}
                </div>
              ) : null}
            </AspectRatio>
            <div className="absolute inset-x-4 bottom-4 flex items-center justify-between rounded-full bg-black/50 px-4 py-2 text-xs text-white">
              <Button size="sm" variant="secondary" className="rounded-full bg-white/20 text-white hover:bg-white/30" onClick={togglePlayback}>
                {isPlaying ? (
                  <>
                    <Pause className="mr-2 h-4 w-4" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Preview
                  </>
                )}
              </Button>
              <span>{scene?.title ?? "No scene selected"}</span>
            </div>
          </div>
          <div className="mt-6 space-y-2">
            <Slider value={[playhead]} max={duration} step={0.1} onValueChange={value => setPlayhead(value[0])} className="cursor-ew-resize" />
            <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
              <span>{playhead.toFixed(1)}s</span>
              <span>{duration}s</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Button size="sm" variant={showSafeArea ? "default" : "outline"} className="rounded-full" onClick={() => setShowSafeArea(!showSafeArea)}>
                Frame guides
              </Button>
              <Button size="sm" variant={showThirds ? "default" : "outline"} className="rounded-full" onClick={() => setShowThirds(!showThirds)}>
                <Grid className="mr-1 h-3 w-3" /> Thirds
              </Button>
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => setPlayhead(0)}>
                Reset playhead
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className="gap-1 rounded-full">
            <Timer className="h-3 w-3" /> {duration}s
          </Badge>
          <Badge variant="secondary" className="rounded-full">Aspect {aspectLabel}</Badge>
          <Badge variant="secondary" className="rounded-full">{scene?.quality === "standard" ? "Fast" : "Cinematic"}</Badge>
        </div>

        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-foreground">Prompt snapshot</div>
          {promptPreview}
        </div>
      </CardContent>
    </Card>
  );
}
