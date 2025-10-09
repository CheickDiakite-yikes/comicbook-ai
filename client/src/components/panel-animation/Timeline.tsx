import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Sparkles, Square } from "lucide-react";
import { usePanelAnimation } from "./PanelAnimationContext";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusVariant: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  idle: { label: "Idle", variant: "outline" },
  queued: { label: "Queued", variant: "secondary" },
  rendering: { label: "Rendering", variant: "default" },
  completed: { label: "Ready", variant: "secondary" },
  error: { label: "Error", variant: "destructive" },
};

type KeyboardEvent = React.KeyboardEvent<HTMLButtonElement>;

export function PanelAnimationTimeline() {
  const { clips, activeClipId, selectClip, statuses, updateClipPrompt } = usePanelAnimation();

  const totalDuration = useMemo(() => clips.reduce((acc, clip) => acc + clip.durationSeconds, 0), [clips]);

  const handleDurationChange = (clipId: string) => (value: number[]) => {
    const durationSeconds = Math.min(Math.max(value[0] ?? 0, 1), 8);
    const clip = clips.find((item) => item.id === clipId);
    if (!clip) return;
    updateClipPrompt({
      clipId,
      prompt: clip.prompt,
      durationSeconds,
      templateId: clip.templateId,
    });
  };

  const handleKeyboardDuration = (clipId: string, event: KeyboardEvent) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const clip = clips.find((item) => item.id === clipId);
    if (!clip) return;
    const delta = event.key === "ArrowLeft" ? -0.5 : 0.5;
    const nextValue = Math.min(Math.max(clip.durationSeconds + delta, 1), 8);
    updateClipPrompt({
      clipId,
      prompt: clip.prompt,
      durationSeconds: nextValue,
      templateId: clip.templateId,
    });
  };

  return (
    <section aria-label="Animation timeline" className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Timeline</h2>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" aria-hidden />
          <span>Total duration</span>
          <span className="font-medium text-foreground">{totalDuration.toFixed(1)}s</span>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence initial={false}>
          {clips.map((clip, index) => {
            const status = statuses[clip.id];
            const statusMeta = statusVariant[status?.status ?? "idle"];
            return (
              <motion.article
                key={clip.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.18 }}
                className={cn(
                  "rounded-xl border bg-card p-4 shadow-sm transition focus-within:ring-2 focus-within:ring-primary/60",
                  activeClipId === clip.id ? "ring-2 ring-primary" : "hover:border-primary/40",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Square className="h-4 w-4 text-primary" aria-hidden />
                    <div>
                      <p className="text-sm font-medium text-foreground">Clip {index + 1}</p>
                      <p className="text-xs text-muted-foreground">Template: {clip.templateLabel ?? "Custom"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                    {status?.version ? (
                      <Badge variant={status?.canonical ? "default" : "outline"}>
                        {status.canonical ? "Canonical" : `${status.version} cut`}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{clip.prompt}</p>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Duration</span>
                    <span>{clip.durationSeconds.toFixed(1)}s</span>
                  </div>
                  <Slider
                    value={[clip.durationSeconds]}
                    max={8}
                    min={1}
                    step={0.5}
                    onValueChange={handleDurationChange(clip.id)}
                    aria-label={`Adjust duration for clip ${index + 1}`}
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Keyboard</span>
                    <span>Use ← → to fine-tune</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full justify-center"
                    aria-pressed={activeClipId === clip.id}
                    onClick={() => selectClip(clip.id)}
                    onKeyDown={(event) => handleKeyboardDuration(clip.id, event)}
                  >
                    <Sparkles className="mr-2 h-4 w-4" aria-hidden />
                    Focus clip
                  </Button>
                </div>
              </motion.article>
            );
          })}
        </AnimatePresence>
      </div>
    </section>
  );
}
