import { useEffect, useMemo, useState } from "react";
import { Film, RefreshCw, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

import { usePanelAnimation } from "./PanelAnimationContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";

const versions: Array<{ value: "A" | "B"; label: string }> = [
  { value: "A", label: "Version A" },
  { value: "B", label: "Version B" },
];

export function PanelAnimationClipPreview() {
  const { clips, activeClipId, statuses, chooseCanonicalVersion, refreshContinuity } = usePanelAnimation();
  const activeClip = useMemo(() => clips.find((clip) => clip.id === activeClipId) ?? null, [clips, activeClipId]);
  const status = activeClip ? statuses[activeClip.id] : undefined;
  const [previewVersion, setPreviewVersion] = useState<"A" | "B">("A");

  useEffect(() => {
    if (!status?.version) return;
    setPreviewVersion(status.version);
  }, [status?.version]);

  useEffect(() => {
    setPreviewVersion("A");
  }, [activeClipId]);

  if (!activeClip) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Film className="h-4 w-4 text-muted-foreground" aria-hidden />
            Clip preview
          </CardTitle>
          <CardDescription>Select a clip to view render status.</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const previewUrl = previewVersion === "A" ? activeClip.previewUrl : activeClip.alternatePreviewUrl;
  const isRenderable = Boolean(previewUrl);
  const progress = status?.progress ?? 0;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Film className="h-4 w-4 text-primary" aria-hidden />
            Clip preview
          </CardTitle>
          <CardDescription>
            Compare animation variants and mark a canonical take for downstream continuity tools.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <ToggleGroup
            type="single"
            value={previewVersion}
            onValueChange={(value) => {
              if (value === "A" || value === "B") {
                setPreviewVersion(value);
              }
            }}
            aria-label="Select preview version"
          >
            {versions.map((version) => (
              <ToggleGroupItem key={version.value} value={version.value} size="sm" aria-label={version.label}>
                {version.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshContinuity()}
            className="hidden sm:inline-flex"
          >
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-xl border bg-muted">
          {isRenderable ? (
            <motion.video
              key={`${activeClip.id}-${previewVersion}-${previewUrl}`}
              layout
              initial={{ opacity: 0.4 }}
              animate={{ opacity: 1 }}
              controls
              className="h-full w-full object-cover"
            >
              <source src={previewUrl ?? undefined} />
              Your browser does not support preview playback.
            </motion.video>
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
              <Film className="h-10 w-10" aria-hidden />
              <p>No {previewVersion} preview yet. Rendering updates will appear here.</p>
            </div>
          )}
          {status?.canonical && status.version === previewVersion ? (
            <Badge className="absolute right-3 top-3 flex items-center gap-1 bg-primary text-primary-foreground">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              Canonical
            </Badge>
          ) : null}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs uppercase text-muted-foreground">
            <span>Status</span>
            <span className="font-medium text-foreground">{status?.status ?? "Idle"}</span>
          </div>
          <Progress value={progress} aria-label="Render progress" />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>Progress updates stream every few seconds.</span>
            <span>
              {status?.updatedAt ? new Date(status.updatedAt).toLocaleTimeString() : "Awaiting render"}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            Canonical clips drive shot continuity and export defaults.
          </div>
          <Button
            size="sm"
            disabled={!isRenderable}
            onClick={() => chooseCanonicalVersion({ clipId: activeClip.id, version: previewVersion })}
          >
            <ShieldCheck className="mr-2 h-4 w-4" aria-hidden />
            Set {previewVersion}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
