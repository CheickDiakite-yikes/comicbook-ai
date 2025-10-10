import { formatDistanceToNow } from "date-fns";
import { RefreshCw, Video, AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useVeo3Jobs } from "@/hooks/useVeo3Jobs";

function resolveStatusBadge(status: string) {
  switch (status) {
    case 'completed':
      return { label: 'Completed', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' };
    case 'failed':
      return { label: 'Failed', className: 'bg-red-500/10 text-red-600 dark:text-red-400' };
    case 'processing':
      return { label: 'Processing', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' };
    case 'submitted':
      return { label: 'Submitted', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' };
    default:
      return { label: status, className: 'bg-muted text-muted-foreground' };
  }
}

export function Veo3JobList() {
  const { toast } = useToast();
  const { data, isLoading, isError, error, refetch, isFetching } = useVeo3Jobs();

  if (isLoading) {
    return (
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle>Recent Veo 3 renders</CardTitle>
          <CardDescription>Tracking the last 10 animation requests you have submitted.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="space-y-3">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-32 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    const message = error instanceof Error ? error.message : 'Unable to load Veo3 jobs.';
    return (
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Unable to load Veo 3 jobs
          </CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => {
              refetch();
              toast({ title: 'Retrying job fetch', description: 'Attempting to reconnect to the animation service.' });
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
          <CardTitle>Recent Veo 3 renders</CardTitle>
          <CardDescription>
            We automatically refresh every few seconds while jobs are running. Completed clips include inline previews.
          </CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={() => refetch()} disabled={isFetching} aria-label="Refresh animation jobs">
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {jobs.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Submit your first Veo 3 render to see live progress, failure recovery tips, and downloadable assets here.
          </div>
        ) : (
          jobs.map(job => {
            const status = resolveStatusBadge(job.status);
            const createdAt = new Date(job.createdAt);
            const updatedAt = new Date(job.updatedAt);
            const operation = (job.settings as Record<string, any> | null)?.operation ?? {};
            const result = operation?.result ?? {};
            const posterUri: string | null = result?.posterUri ?? null;
            const videoUri: string | null = job.resultAssetUri ?? result?.videoUri ?? null;
            const errorMessage: string | undefined = operation?.error ?? undefined;

            return (
              <div key={job.id} className="space-y-3 rounded-xl border border-border/60 bg-card/40 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={status.className}>{status.label}</Badge>
                      <span className="text-xs text-muted-foreground">Model: {job.model ?? 'auto'}</span>
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      {job.prompt.length > 180 ? `${job.prompt.slice(0, 180)}…` : job.prompt}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Requested {formatDistanceToNow(createdAt, { addSuffix: true })} · Updated {formatDistanceToNow(updatedAt, { addSuffix: true })}
                    </p>
                  </div>
                </div>

                {videoUri ? (
                  <div className="overflow-hidden rounded-lg border border-border/70 bg-muted/20">
                    <video
                      key={videoUri}
                      controls
                      poster={posterUri ?? undefined}
                      className="h-auto w-full rounded-lg"
                    >
                      <source src={videoUri} type="video/mp4" />
                      Your browser does not support the video element.
                    </video>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    <Video className="h-4 w-4" />
                    Clip is still rendering. We will attach the MP4 as soon as Veo 3 returns the final frames.
                  </div>
                )}

                {errorMessage ? (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
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
