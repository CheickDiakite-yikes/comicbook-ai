import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  animationClipSchema,
  animationContinuitySchema,
  animationPromptUpdateSchema,
  animationTemplateSchema,
} from "@shared/animation-schemas";

type AnimationClip = z.infer<typeof animationClipSchema>;
type AnimationContinuityInsight = z.infer<typeof animationContinuitySchema>;
type AnimationPromptUpdate = z.infer<typeof animationPromptUpdateSchema>;
type AnimationTemplate = z.infer<typeof animationTemplateSchema>;

type ClipStatus = {
  progress: number;
  status: "idle" | "queued" | "rendering" | "completed" | "error";
  version?: "A" | "B" | null;
  canonical?: boolean;
  updatedAt?: string;
  errorMessage?: string | null;
};

type PanelAnimationContextValue = {
  clips: AnimationClip[];
  templates: AnimationTemplate[];
  continuity: AnimationContinuityInsight[];
  isLoading: boolean;
  activeClipId: string | null;
  statuses: Record<string, ClipStatus>;
  selectClip: (clipId: string | null) => void;
  updateClipPrompt: (update: AnimationPromptUpdate) => void;
  refreshContinuity: () => void;
  chooseCanonicalVersion: (selection: { clipId: string; version: "A" | "B" }) => void;
};

const PanelAnimationContext = createContext<PanelAnimationContextValue | undefined>(undefined);

const emptyStatus: ClipStatus = {
  progress: 0,
  status: "idle",
  version: null,
  canonical: false,
};

export function usePanelAnimation() {
  const ctx = useContext(PanelAnimationContext);
  if (!ctx) {
    throw new Error("usePanelAnimation must be used within a PanelAnimationProvider");
  }
  return ctx;
}

type PanelAnimationProviderProps = {
  projectId?: string;
  children: ReactNode;
};

const defaultQueryOptions = { staleTime: 10_000, refetchInterval: 30_000 } as const;

export function PanelAnimationProvider({ projectId, children }: PanelAnimationProviderProps) {
  const queryClient = useQueryClient();
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, ClipStatus>>({});

  const clipsQueryKey = useMemo(() => ["panel-animation", projectId, "clips"], [projectId]);
  const continuityQueryKey = useMemo(() => ["panel-animation", projectId, "continuity"], [projectId]);
  const templatesQueryKey = useMemo(() => ["panel-animation", "templates"], []);

  const { data: clips = [], isLoading: clipsLoading } = useQuery({
    ...defaultQueryOptions,
    queryKey: clipsQueryKey,
    enabled: Boolean(projectId),
    queryFn: async () => {
      if (!projectId) return [] as AnimationClip[];
      try {
        const response = await fetch(`/api/projects/${projectId}/animations/clips`);
        if (!response.ok) {
          throw new Error("Failed to fetch animation clips");
        }
        const payload = await response.json();
        const parsed = animationClipSchema.array().safeParse(payload);
        if (!parsed.success) {
          console.warn("Unexpected animation clips response", parsed.error);
          return [] as AnimationClip[];
        }
        return parsed.data;
      } catch (error) {
        console.warn("Animation clips unavailable, falling back to empty list", error);
        return [] as AnimationClip[];
      }
    },
  });

  const { data: continuity = [], isLoading: continuityLoading, refetch: refetchContinuity } = useQuery({
    ...defaultQueryOptions,
    queryKey: continuityQueryKey,
    enabled: Boolean(projectId),
    queryFn: async () => {
      if (!projectId) return [] as AnimationContinuityInsight[];
      try {
        const response = await fetch(`/api/projects/${projectId}/animations/continuity`);
        if (!response.ok) {
          throw new Error("Failed to fetch continuity insights");
        }
        const payload = await response.json();
        const parsed = animationContinuitySchema.array().safeParse(payload);
        if (!parsed.success) {
          console.warn("Unexpected continuity response", parsed.error);
          return [] as AnimationContinuityInsight[];
        }
        return parsed.data;
      } catch (error) {
        console.warn("Continuity insights unavailable", error);
        return [] as AnimationContinuityInsight[];
      }
    },
  });

  const { data: templates = [] } = useQuery({
    ...defaultQueryOptions,
    queryKey: templatesQueryKey,
    queryFn: async () => {
      try {
        const response = await fetch(`/api/animations/templates`);
        if (!response.ok) {
          throw new Error("Failed to fetch animation templates");
        }
        const payload = await response.json();
        const parsed = animationTemplateSchema.array().safeParse(payload);
        if (!parsed.success) {
          console.warn("Unexpected template response", parsed.error);
          return [] as AnimationTemplate[];
        }
        return parsed.data;
      } catch (error) {
        console.warn("Animation templates unavailable", error);
        return [] as AnimationTemplate[];
      }
    },
  });

  const updatePromptMutation = useMutation({
    mutationFn: async (update: AnimationPromptUpdate) => {
      if (!projectId) return update;
      const response = await fetch(`/api/projects/${projectId}/animations/clips/${update.clipId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
      if (!response.ok) {
        throw new Error("Failed to update animation clip");
      }
      return update;
    },
    onMutate: async (update) => {
      await queryClient.cancelQueries({ queryKey: clipsQueryKey });
      const previous = queryClient.getQueryData<AnimationClip[]>(clipsQueryKey) ?? [];
      queryClient.setQueryData<AnimationClip[]>(clipsQueryKey, (old = []) =>
        old.map((clip) =>
          clip.id === update.clipId
            ? {
                ...clip,
                prompt: update.prompt,
                durationSeconds: update.durationSeconds,
                templateId: update.templateId,
              }
            : clip,
        ),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(clipsQueryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: clipsQueryKey });
    },
  });

  const selectClip = useCallback((clipId: string | null) => {
    setActiveClipId(clipId);
  }, []);

  const updateClipPrompt = useCallback(
    (update: AnimationPromptUpdate) => {
      updatePromptMutation.mutate(update);
    },
    [updatePromptMutation],
  );

  const chooseCanonicalMutation = useMutation({
    mutationFn: async (selection: { clipId: string; version: "A" | "B" }) => {
      if (!projectId) return selection;
      const response = await fetch(`/api/projects/${projectId}/animations/clips/${selection.clipId}/version`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selection),
      });
      if (!response.ok) {
        throw new Error("Failed to choose canonical version");
      }
      return selection;
    },
    onMutate: async (selection) => {
      let previous: ClipStatus | undefined;
      setStatuses((prev) => {
        previous = prev[selection.clipId];
        return {
          ...prev,
          [selection.clipId]: {
            ...emptyStatus,
            ...prev[selection.clipId],
            version: selection.version,
            canonical: true,
          },
        };
      });
      return { previous, clipId: selection.clipId };
    },
    onError: (_error, _selection, context) => {
      if (context?.clipId) {
        setStatuses((prev) => ({
          ...prev,
          [context.clipId]: context.previous ?? prev[context.clipId] ?? emptyStatus,
        }));
      }
    },
  });

  const chooseCanonicalVersion = useCallback(
    (selection: { clipId: string; version: "A" | "B" }) => {
      chooseCanonicalMutation.mutate(selection);
    },
    [chooseCanonicalMutation],
  );

  useEffect(() => {
    if (!projectId) return;
    let isMounted = true;
    let interval: ReturnType<typeof setInterval> | null = null;
    let eventSource: EventSource | null = null;

    const applyStatusUpdate = (incoming: ClipStatus & { clipId: string }) => {
      if (!isMounted) return;
      setStatuses((prev) => ({
        ...prev,
        [incoming.clipId]: {
          ...emptyStatus,
          ...prev[incoming.clipId],
          ...incoming,
        },
      }));
    };

    const startPolling = () => {
      if (interval) return;
      interval = setInterval(async () => {
        try {
          const response = await fetch(`/api/projects/${projectId}/animations/progress`);
          if (!response.ok) return;
          const payload: (ClipStatus & { clipId: string })[] = await response.json();
          payload.forEach(applyStatusUpdate);
        } catch (error) {
          console.warn("Animation progress polling failed", error);
        }
      }, 5_000);
    };

    if (typeof window !== "undefined" && "EventSource" in window) {
      try {
        eventSource = new EventSource(`/api/projects/${projectId}/animations/events`);
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data) as ClipStatus & { clipId: string };
            applyStatusUpdate(data);
          } catch (error) {
            console.warn("Unable to parse animation event", error);
          }
        };
        eventSource.onerror = () => {
          eventSource?.close();
          startPolling();
        };
      } catch (error) {
        console.warn("Animation SSE unavailable, using polling", error);
        startPolling();
      }
    } else {
      startPolling();
    }

    return () => {
      isMounted = false;
      if (eventSource) {
        eventSource.close();
      }
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [projectId]);

  useEffect(() => {
    if (!activeClipId && clips.length > 0) {
      setActiveClipId(clips[0].id);
    }
  }, [activeClipId, clips]);

  const value = useMemo<PanelAnimationContextValue>(
    () => ({
      clips,
      templates,
      continuity,
      isLoading: clipsLoading || continuityLoading,
      activeClipId,
      statuses,
      selectClip,
      updateClipPrompt,
      chooseCanonicalVersion,
      refreshContinuity: () => {
        void refetchContinuity();
      },
    }),
    [
      clips,
      templates,
      continuity,
      clipsLoading,
      continuityLoading,
      activeClipId,
      statuses,
      selectClip,
      updateClipPrompt,
      chooseCanonicalVersion,
      refetchContinuity,
    ],
  );

  return <PanelAnimationContext.Provider value={value}>{children}</PanelAnimationContext.Provider>;
}
