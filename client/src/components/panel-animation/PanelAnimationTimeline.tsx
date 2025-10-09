import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { usePanelVideoTimeline, type PanelVideoTimelineEntry } from "@/hooks/usePanelVideoTimeline";
import { AlertTriangle, CheckCircle2, ExternalLink, Film, FlagTriangleRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMemo, type JSX } from "react";

const REMEDIATION_URL = "https://docs.comicbook.ai/guides/panel-animation-drift";

interface PanelAnimationTimelineProps {
  panelId?: string | null;
  panelNumber?: number | null;
}

const statusStyles = {
  pending: "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900",
  stable: "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900",
  warning: "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900",
  critical: "bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900",
} as const;

type StatusKey = keyof typeof statusStyles;

type WarningRecord = {
  characterName?: string;
  issue?: string;
  severity?: "info" | "warning" | "critical";
  frameIndices?: number[];
};

type ContinuitySnapshot = {
  frames?: Array<{
    frameIndex: number;
  }>;
};

function resolveStatus(entry: PanelVideoTimelineEntry): {
  key: StatusKey;
  label: string;
  icon: JSX.Element;
} {
  if (!entry.qaResult) {
    return {
      key: "pending",
      label: "Analysis pending",
      icon: <Film className="h-3.5 w-3.5" aria-hidden="true" />,
    };
  }

  const warnings: WarningRecord[] = Array.isArray((entry.qaResult as any)?.driftWarnings)
    ? ((entry.qaResult as any).driftWarnings as WarningRecord[])
    : [];

  const hasCritical = warnings.some(warning => warning.severity === "critical");
  if (hasCritical) {
    return {
      key: "critical",
      label: "Severe drift detected",
      icon: <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />,
    };
  }

  const hasWarning = warnings.some(warning => warning.severity === "warning");
  if (hasWarning) {
    return {
      key: "warning",
      label: "Temporal drift flagged",
      icon: <FlagTriangleRight className="h-3.5 w-3.5" aria-hidden="true" />,
    };
  }

  return {
    key: "stable",
    label: "Stable across frames",
    icon: <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />,
  };
}

function renderWarnings(entry: PanelVideoTimelineEntry) {
  if (!entry.qaResult) {
    return (
      <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Film className="h-4 w-4" aria-hidden="true" />
        <span>Poster frame QA is queued for this version.</span>
      </div>
    );
  }

  const warnings: WarningRecord[] = Array.isArray((entry.qaResult as any)?.driftWarnings)
    ? ((entry.qaResult as any).driftWarnings as WarningRecord[])
    : [];

  if (warnings.length === 0) {
    return (
      <div className="mt-3 flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-300">
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        <span>No frame drift detected. Animation thumbnails are consistent.</span>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      {warnings.map((warning, index) => (
        <div
          key={`${warning.characterName ?? "warning"}-${index}`}
          className={cn(
            "flex items-start gap-2 rounded-md border p-2 text-sm",
            warning.severity === "critical"
              ? "border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
              : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
          )}
        >
          <FlagTriangleRight className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">
              {warning.characterName ? `${warning.characterName}` : "Visual Drift"}
            </p>
            <p>{warning.issue ?? "Unexpected visual change detected."}</p>
            {Array.isArray(warning.frameIndices) && warning.frameIndices.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Frames affected: {warning.frameIndices.join(", ")}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function PanelAnimationTimeline({ panelId, panelNumber }: PanelAnimationTimelineProps) {
  const { data, isLoading, error } = usePanelVideoTimeline(panelId);

  const timeline = data?.timeline ?? [];

  const headingSuffix = useMemo(() => {
    if (!panelNumber) return "";
    return ` – Panel ${panelNumber}`;
  }, [panelNumber]);

  if (!panelId) {
    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle>Panel Animation QA Timeline</CardTitle>
          <CardDescription>Select a panel to review animation QA results.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Choose a panel to inspect poster frames, thumbnails, and QA feedback for animation continuity.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle>Panel Animation QA Timeline{headingSuffix}</CardTitle>
          <CardDescription>Loading video quality analysis…</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle>Panel Animation QA Timeline{headingSuffix}</CardTitle>
          <CardDescription>We couldn’t load the QA timeline right now.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4" aria-hidden="true" />
            <span>Please refresh the page or try again later.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle>Panel Animation QA Timeline{headingSuffix}</CardTitle>
        <CardDescription>
          Poster frame and thumbnail QA for the selected animation version. Scores reflect visual continuity and drift checks.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {timeline.length === 0 ? (
          <div className="rounded-lg border border-dashed border-muted-foreground/40 bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            No animation QA results yet. Generate a panel animation to see drift analysis and quality guidance here.
          </div>
        ) : (
          <div className="space-y-4">
            {timeline.map((entry, index) => {
              const status = resolveStatus(entry);
              const qualityScore = entry.qaResult?.qualityScore ?? 0;
              const snapshot: ContinuitySnapshot | undefined = entry.qaResult?.continuityContextSnapshot as ContinuitySnapshot | undefined;
              const frameCount = Array.isArray(snapshot?.frames) ? snapshot!.frames!.length : undefined;

              return (
                <div key={entry.version.id} className="rounded-lg border border-border bg-card p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Animation Version</p>
                      <p className="text-base font-semibold text-foreground">
                        {entry.version.versionLabel || `Version ${index + 1}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Timeline position: {entry.version.timelineOrder ?? index + 1}
                      </p>
                    </div>
                    <Badge className={cn("flex items-center gap-1 text-xs", statusStyles[status.key])}>
                      {status.icon}
                      <span>{status.label}</span>
                    </Badge>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Quality Score</p>
                      {entry.qaResult ? (
                        <div className="mt-1 flex items-center gap-3">
                          <Progress value={qualityScore} className="h-2 flex-1" />
                          <span className="text-sm font-semibold text-foreground">{qualityScore}%</span>
                        </div>
                      ) : (
                        <p className="mt-1 text-sm text-muted-foreground">Pending analysis…</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Frames Reviewed</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">{frameCount ?? "—"}</p>
                    </div>
                  </div>

                  {renderWarnings(entry)}

                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Need help correcting drift?</span>
                    <a
                      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                      href={REMEDIATION_URL}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Review guidance
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
