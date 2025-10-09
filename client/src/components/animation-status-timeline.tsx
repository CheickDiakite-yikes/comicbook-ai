import { useMemo, type ComponentType } from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { AlertCircle, CheckCircle2, Clock, Loader2, RefreshCcw, Video } from "lucide-react";
import type { AnimationJobRecord, AnimationJobStatus } from "@shared/events";
import { useAnimationStatus } from "@/contexts/AnimationStatusContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const statusConfig: Record<AnimationJobStatus, {
  label: string;
  badgeClass: string;
  iconClass: string;
  iconWrapper: string;
  icon: ComponentType<{ className?: string }>;
}> = {
  queued: {
    label: "Queued",
    badgeClass: "bg-muted text-muted-foreground",
    iconClass: "text-muted-foreground",
    iconWrapper: "bg-muted/60",
    icon: Clock,
  },
  rendering: {
    label: "Rendering",
    badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-300",
    iconClass: "text-blue-500 dark:text-blue-300",
    iconWrapper: "bg-blue-500/10",
    icon: Loader2,
  },
  completed: {
    label: "Completed",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    iconClass: "text-emerald-500 dark:text-emerald-300",
    iconWrapper: "bg-emerald-500/10",
    icon: CheckCircle2,
  },
  error: {
    label: "Error",
    badgeClass: "bg-destructive/10 text-destructive",
    iconClass: "text-destructive",
    iconWrapper: "bg-destructive/10",
    icon: AlertCircle,
  },
};

const connectionBadgeConfig = {
  connected: {
    label: "Live",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  },
  connecting: {
    label: "Connecting",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  },
  disconnected: {
    label: "Offline",
    className: "bg-destructive/10 text-destructive",
  },
} as const;

function safeFormatTimestamp(timestamp: string) {
  try {
    return formatDistanceToNow(parseISO(timestamp), { addSuffix: true });
  } catch {
    return "";
  }
}

function clampPercentage(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return undefined;
  }
  return Math.min(100, Math.max(0, value));
}

export function AnimationStatusTimeline() {
  const { jobs, connectionState, retryJob } = useAnimationStatus();

  const connectionBadge = connectionBadgeConfig[connectionState];

  const historyLimit = 4;

  const timelineJobs = useMemo(() => jobs, [jobs]);

  if (!timelineJobs.length) {
    return (
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Animation timeline</h3>
            <p className="text-sm text-muted-foreground">
              Kick off a Veo3 render to see real-time updates here.
            </p>
          </div>
          <Badge className={cn("font-medium", connectionBadge.className)} variant="outline">
            {connectionBadge.label}
          </Badge>
        </div>
        <div className="mt-6 flex flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/40 bg-muted/30 p-10 text-center text-muted-foreground">
          <Video className="mb-4 h-10 w-10" aria-hidden="true" />
          <p className="text-sm">
            No animation renders yet. Trigger an animation from the panel studio to monitor its progress and retry failures instantly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Animation timeline</h3>
          <p className="text-sm text-muted-foreground">Live Veo3 render activity and recovery actions.</p>
        </div>
        <Badge className={cn("font-medium", connectionBadge.className)} variant="outline">
          {connectionBadge.label}
        </Badge>
      </div>
      <ol className="space-y-4">
        {timelineJobs.map((job) => {
          const status = statusConfig[job.status];
          const StatusIcon = status.icon;
          const percentage = clampPercentage(job.progress?.percentage);
          const recentHistory = job.history.slice().reverse().slice(0, historyLimit);

          return (
            <li key={job.jobId} className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className={cn("flex h-9 w-9 items-center justify-center rounded-full", status.iconWrapper)}>
                    <StatusIcon
                      className={cn("h-4 w-4", status.icon === Loader2 ? "animate-spin" : "", status.iconClass)}
                      aria-hidden="true"
                    />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-base font-semibold text-foreground">Panel {job.panelId}</h4>
                      <Badge className={cn("font-medium", status.badgeClass)} variant="outline">
                        {status.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Version {job.versionId}
                      {job.updatedAt ? ` • ${safeFormatTimestamp(job.updatedAt)}` : ""}
                    </p>
                  </div>
                </div>
                {percentage !== undefined && (
                  <span className="text-sm font-medium text-muted-foreground">{Math.round(percentage)}%</span>
                )}
              </div>

              {job.progress?.stage && (
                <p className="mt-3 text-sm text-muted-foreground">{job.progress.stage}</p>
              )}

              {job.progress?.message && job.progress.message !== job.progress.stage && (
                <p className="mt-1 text-sm text-muted-foreground">{job.progress.message}</p>
              )}

              {percentage !== undefined && (
                <div className="mt-3 space-y-2">
                  <Progress value={percentage} className="h-2" />
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {typeof job.progress?.framesRendered === "number" && typeof job.progress?.totalFrames === "number" && (
                      <span>
                        {job.progress.framesRendered}/{job.progress.totalFrames} frames
                      </span>
                    )}
                    {typeof job.progress?.etaSeconds === "number" && (
                      <span>ETA ≈ {Math.max(0, Math.round(job.progress.etaSeconds))}s</span>
                    )}
                  </div>
                </div>
              )}

              {job.status === "error" && (
                <div className="mt-4 flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-destructive">
                    {job.error ?? "The renderer reported an unknown error."}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => retryJob(job.jobId)}
                    className="sm:w-auto"
                  >
                    <RefreshCcw className="mr-2 h-4 w-4" aria-hidden="true" /> Retry
                  </Button>
                </div>
              )}

              {recentHistory.length > 1 && (
                <div className="mt-4 border-t pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent activity</p>
                  <ul className="mt-2 space-y-2">
                    {recentHistory.map((entry) => {
                      const entryStatus = statusConfig[entry.status];
                      return (
                        <li key={`${entry.timestamp}-${entry.status}`} className="flex flex-col gap-1 text-xs text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <span className={cn("h-1.5 w-1.5 rounded-full", entryStatus.iconClass)} aria-hidden="true" />
                            <span className="font-medium text-foreground">{entryStatus.label}</span>
                            <span className="text-muted-foreground/80">{safeFormatTimestamp(entry.timestamp)}</span>
                          </div>
                          {entry.progress?.stage && <p>{entry.progress.stage}</p>}
                          {entry.status === "error" && entry.error && (
                            <p className="text-destructive">{entry.error}</p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
