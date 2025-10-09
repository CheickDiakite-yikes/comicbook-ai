import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import type { AnimationJobRecord } from "@shared/events";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useAnimationStatusStream } from "@/hooks/useAnimationStatusStream";

export type AnimationConnectionState = "connecting" | "connected" | "disconnected";

interface AnimationStatusContextValue {
  jobs: AnimationJobRecord[];
  connectionState: AnimationConnectionState;
  retryJob: (jobId: string) => Promise<void>;
}

const AnimationStatusContext = createContext<AnimationStatusContextValue | undefined>(undefined);

export function AnimationStatusProvider({ children }: { children: ReactNode }) {
  const [jobsMap, setJobsMap] = useState<Record<string, AnimationJobRecord>>({});
  const jobsRef = useRef<Record<string, AnimationJobRecord>>({});
  const { toast } = useToast();

  const retryJob = useCallback(
    async (jobId: string) => {
      try {
        const response = await fetch(`/api/animation-jobs/${jobId}/retry`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ metadata: { trigger: "retry" } }),
        });

        if (!response.ok) {
          const message = (await response.text()) || "Unable to retry animation job.";
          throw new Error(message);
        }
      } catch (error) {
        const description = error instanceof Error ? error.message : "An unexpected error occurred while retrying the animation.";
        toast({
          variant: "destructive",
          title: "Retry failed",
          description,
        });
      }
    },
    [toast],
  );

  const handleStatus = useCallback(
    (job: AnimationJobRecord) => {
      const existing = jobsRef.current[job.jobId];
      const hasChanged =
        !existing || existing.updatedAt !== job.updatedAt || existing.status !== job.status;

      setJobsMap((prev) => {
        const next = { ...prev, [job.jobId]: job };
        jobsRef.current = next;
        return next;
      });

      if (!hasChanged) {
        return;
      }

      if (job.status === "error") {
        toast({
          variant: "destructive",
          title: "Animation failed",
          description: job.error ?? "The animation renderer reported an error.",
          action: (
            <ToastAction altText="Retry animation" onClick={() => retryJob(job.jobId)}>
              Retry
            </ToastAction>
          ),
        });
      }
    },
    [retryJob, toast],
  );

  const handleSnapshot = useCallback((snapshot: AnimationJobRecord[]) => {
    const map: Record<string, AnimationJobRecord> = {};
    for (const job of snapshot) {
      map[job.jobId] = job;
    }
    jobsRef.current = map;
    setJobsMap(map);
  }, []);

  const { connectionState } = useAnimationStatusStream({
    onStatus: handleStatus,
    onSnapshot: handleSnapshot,
  });

  const jobs = useMemo(() => {
    return Object.values(jobsMap).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [jobsMap]);

  const value = useMemo<AnimationStatusContextValue>(
    () => ({
      jobs,
      connectionState,
      retryJob,
    }),
    [jobs, connectionState, retryJob],
  );

  return (
    <AnimationStatusContext.Provider value={value}>{children}</AnimationStatusContext.Provider>
  );
}

export function useAnimationStatus() {
  const context = useContext(AnimationStatusContext);
  if (!context) {
    throw new Error("useAnimationStatus must be used within an AnimationStatusProvider");
  }
  return context;
}
