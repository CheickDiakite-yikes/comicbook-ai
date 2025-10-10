import { formatDistanceToNow } from "date-fns";
import { useVeo3Jobs } from "@/hooks/useVeo3Jobs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Video, AlertTriangle, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function resolveStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return { label: "Completed", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" };
    case "failed":
      return { label: "Needs attention", className: "bg-red-500/15 text-red-600 dark:text-red-300" };
    case "processing":
      return { label: "Processing", className: "bg-amber-500/15 text-amber-600 dark:text-amber-300" };
    case "submitted":
      return { label: "Submitted", className: "bg-blue-500/15 text-blue-600 dark:text-blue-300" };
    default:
      return { label: status, className: "bg-muted text-muted-foreground" };
  }
}

export function RenderQueuePanel() {
  const { data, isLoading, isError, error, refetch, isFetching } = useVeo3Jobs();
  const { toast } = useToast();

  if (isLoading) {
    return (
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            Render queue
          </CardTitle>
          <p className="text-xs text-muted-foreground">Tracking your latest Veo 3 stitches.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="space-y-3">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-32 w-full rounded-xl" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    const message = error instanceof Error ? error.message : "Unable to load animation jobs.";
    return (
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Render queue unavailable
          </CardTitle>
          <p className="text-xs text-muted-foreground">{message}</p>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => {
              refetch();
              toast({
                title: "Refreshing render queue",
                description: "Trying to reconnect to the animation service.",
              });
            }}
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const jobs = data?.jobs ?? [];

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            Render queue
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            We refresh every few seconds while clips are rendering. Completed scenes include inline playback.
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => refetch()} disabled={isFetching} aria-label="Refresh render queue">
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {jobs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            Drop panels into a scene and render with Veo 3 to see clips appear here.
          </div>
        ) : (
          jobs.map(job => {
            const status = resolveStatusBadge(job.status);
            const createdAt = new Date(job.createdAt);
            const updatedAt = new Date(job.updatedAt);
            const result = (job.settings as Record<string, any> | null)?.operation ?? {};
            const outcome = result?.result ?? {};
            const posterUri: string | null = outcome?.posterUri ?? null;
            // Use proxy endpoint to stream video from Google with authentication
            const hasVideo = Boolean(job.resultAssetUri ?? outcome?.videoUri);
            const videoUri: string | null = hasVideo ? `/api/animations/jobs/${job.id}/video` : null;
            const errorMessage: string | undefined = result?.error ?? undefined;

            return (
              <div key={job.id} className="space-y-3 rounded-2xl border border-border/60 bg-card/60 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <Badge className={status.className}>{status.label}</Badge>
                    <p className="text-sm font-medium text-foreground">
                      {job.prompt.length > 180 ? `${job.prompt.slice(0, 180)}…` : job.prompt}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Requested {formatDistanceToNow(createdAt, { addSuffix: true })} · Updated {formatDistanceToNow(updatedAt, { addSuffix: true })}
                    </p>
                  </div>
                </div>

                {videoUri ? (
                  <div className="overflow-hidden rounded-xl border border-border/60 bg-background">
                    <video key={videoUri} controls poster={posterUri ?? undefined} className="h-auto w-full rounded-xl">
                      <source src={videoUri} type="video/mp4" />
                      Your browser does not support the video element.
                    </video>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-xl border border-dashed border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
                    <Video className="h-4 w-4" />
                    Clip is still rendering. We’ll attach the MP4 once Veo 3 returns the final frames.
                  </div>
                )}

                {errorMessage ? (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                    {errorMessage}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
