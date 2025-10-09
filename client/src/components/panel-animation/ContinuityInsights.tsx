import { useMemo } from "react";
import { AlertTriangle, Info, RefreshCw, Sparkles } from "lucide-react";

import { usePanelAnimation } from "./PanelAnimationContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

const severityMeta = {
  info: {
    icon: Info,
    label: "Info",
    badge: "outline" as const,
  },
  warning: {
    icon: AlertTriangle,
    label: "Warning",
    badge: "secondary" as const,
  },
  critical: {
    icon: AlertTriangle,
    label: "Critical",
    badge: "destructive" as const,
  },
};

export function PanelAnimationContinuityInsights() {
  const { continuity, clips, selectClip, refreshContinuity } = usePanelAnimation();

  const continuityByClip = useMemo(() => {
    return continuity.reduce<Record<string, typeof continuity>>((acc, insight) => {
      if (!acc[insight.clipId]) acc[insight.clipId] = [];
      acc[insight.clipId].push(insight);
      return acc;
    }, {});
  }, [continuity]);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden />
            Continuity insights
          </CardTitle>
          <CardDescription>Track visual and narrative consistency across clips.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => refreshContinuity()}>
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {continuity.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed bg-muted/40 p-6 text-center text-sm text-muted-foreground">
            No continuity issues detected for the current renders.
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="space-y-3 pr-2">
              {clips.map((clip, index) => {
                const insights = continuityByClip[clip.id] ?? [];
                if (insights.length === 0) return null;
                return (
                  <section key={clip.id} className="rounded-lg border bg-card/70 p-4 shadow-sm">
                    <header className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Clip {index + 1}</Badge>
                        <p className="text-sm font-medium text-foreground">{clip.prompt.slice(0, 70)}{clip.prompt.length > 70 ? "…" : ""}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => selectClip(clip.id)}
                        className="text-xs"
                      >
                        Jump to clip
                      </Button>
                    </header>
                    <div className="mt-3 space-y-3">
                      {insights.map((insight) => {
                        const meta = severityMeta[insight.severity];
                        const Icon = meta.icon;
                        return (
                          <article
                            key={insight.id}
                            tabIndex={0}
                            className="group rounded-md border bg-background/60 p-3 outline-none transition focus-visible:ring-2 focus-visible:ring-primary/60"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4 text-primary" aria-hidden />
                                <Badge variant={meta.badge}>{meta.label}</Badge>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {insight.createdAt ? new Date(insight.createdAt).toLocaleTimeString() : "Just now"}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-foreground">{insight.message}</p>
                            {insight.suggestion ? (
                              <p className="mt-1 text-xs text-muted-foreground">Suggestion: {insight.suggestion}</p>
                            ) : null}
                            {insight.affectedCharacters && insight.affectedCharacters.length > 0 ? (
                              <p className="mt-2 text-xs text-muted-foreground">
                                Characters: {insight.affectedCharacters.join(", ")}
                              </p>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
