import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import Navigation from "@/components/navigation";
import { AnimationProjectList } from "@/components/animation-studio/AnimationProjectList";
import { PanelLibrary } from "@/components/animation-studio/PanelLibrary";
import { SceneTimeline } from "@/components/animation-studio/SceneTimeline";
import { SceneComposer } from "@/components/animation-studio/SceneComposer";
import { RenderQueuePanel } from "@/components/animation-studio/RenderQueuePanel";
import type { Project, Page } from "@shared/schema";
import { Scene, SceneClip, PanelAsset, PromptTokenSelection } from "@/components/animation-studio/types";
import { CinematicCanvas } from "@/components/animation-studio/CinematicCanvas";
import { apiRequest } from "@/lib/queryClient";
import { DEFAULT_VEO_SAFETY_SETTINGS } from "@shared/veo";
import { useToast } from "@/hooks/use-toast";
import { useMetaTags } from "@/hooks/useMetaTags";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Loader2, Sparkles, BookOpen, FolderOpen, Coins, AlertTriangle, ArrowRight } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Link } from "wouter";

const BASE_PROMPT_TOKENS: PromptTokenSelection = {
  shot: null,
  cameraMove: null,
  mood: null,
  lighting: null,
  style: null,
  consistencyLocks: [],
};

function createPromptTokens(): PromptTokenSelection {
  return { ...BASE_PROMPT_TOKENS, consistencyLocks: [] };
}

function createScene(index: number): Scene {
  return {
    id: `scene-${index}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: `Scene ${index}`,
    clips: [],
    prompt: "",
    promptWasEdited: false,
    promptTokens: createPromptTokens(),
    promptFreeform: "",
    promptVersionHistory: [],
    promptVariants: { A: "", B: null },
    activePromptVariant: "A",
    durationSeconds: 6,
    aspectRatio: "16:9",
    quality: "quality",
    soundtrackMood: "none",
    includeAudioBed: false,
    model: "veo-3.0-generate-001",
    isSubmitting: false,
    lastSubmittedAt: undefined,
  };
}

function createClipId(panelId: string) {
  return `${panelId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function generateScenePrompt(projectTitle: string | undefined, clips: SceneClip[]): string {
  if (clips.length === 0) return "";

  const header = projectTitle ? `${projectTitle} animated sequence:` : "Animated sequence for this comic story:";
  const beats = clips.map((clip, index) => {
    const context = clip.panel.scriptSnippet || clip.panel.prompt || `Use the original art from page ${clip.panel.pageNumber}, panel ${clip.panel.panelNumber}.`;
    return `Beat ${index + 1}: ${context}`;
  });

  const footer = "Maintain character fidelity, panel composition, and color palette while introducing cinematic camera motion.";

  return [header, ...beats, footer].join("\n");
}

function derivePromptFromStory(scene: Scene, clips: SceneClip[], projectTitle?: string) {
  if (scene.promptWasEdited) {
    return {
      prompt: scene.prompt,
      promptFreeform: scene.promptFreeform,
      promptVariants: scene.promptVariants,
    };
  }

  const regenerated = generateScenePrompt(projectTitle, clips);
  return {
    prompt: regenerated,
    promptFreeform: regenerated,
    promptVariants: {
      ...scene.promptVariants,
      [scene.activePromptVariant]: regenerated,
    },
  };
}

async function submitSceneToVeo(prompt: string, scene: Scene, projectId: string) {
  const payload = {
    projectId,
    prompt,
    model: scene.model,
    safetySettings: DEFAULT_VEO_SAFETY_SETTINGS,
    generationConfig: {
      durationSeconds: scene.durationSeconds,
      aspectRatio: scene.aspectRatio,
      quality: scene.quality,
      soundtrackMood: scene.soundtrackMood,
      audioBed: scene.includeAudioBed ? "subtle" : "none",
    },
    mediaFormats: ["video/mp4"],
    responseMimeType: "application/json",
  } satisfies Record<string, unknown>;

  const response = await fetch("/api/animations/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Unable to submit Veo animation job");
  }

  return await response.json();
}

interface CreditsCardProps {
  isLoading: boolean;
  remainingCredits: number | typeof Infinity;
  monthlyLimit?: number | null;
  videosCanMake: number | typeof Infinity;
  isLowOnCredits: boolean;
  className?: string;
}

function CreditsCard({ isLoading, remainingCredits, monthlyLimit, videosCanMake, isLowOnCredits, className }: CreditsCardProps) {
  return (
    <Card className={`border-border/60 ${className ?? ""}`} data-testid="card-credits">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Coins className={`h-4 w-4 ${isLowOnCredits ? "text-orange-500" : "text-primary"}`} />
          AI Credits
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading credits…
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold" data-testid="text-remaining-credits">
                {remainingCredits === Infinity ? "∞" : remainingCredits}
              </span>
              {remainingCredits !== Infinity && monthlyLimit ? (
                <span className="text-xs text-muted-foreground">/ {monthlyLimit}</span>
              ) : null}
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              {videosCanMake === Infinity ? (
                <p>Create unlimited videos this cycle.</p>
              ) : (
                <p>
                  Can make <strong>{videosCanMake}</strong> video{videosCanMake === 1 ? "" : "s"} (80 credits each)
                </p>
              )}
              {isLowOnCredits ? (
                <div className="flex items-center gap-1.5 rounded-md bg-orange-500/10 px-2 py-1 text-orange-600 dark:text-orange-500">
                  <AlertTriangle className="h-3 w-3" /> Low on credits
                </div>
              ) : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function AnimationStudioPage() {
  const [location, setLocation] = useLocation();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([createScene(1)]);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: creditsData, isLoading: isCreditsLoading } = useQuery<{
    isAdmin: boolean;
    monthlyLimit: number | null;
    remainingCredits: number | string;
    creditsPercentage: number;
  }>({
    queryKey: ["/api/credits"],
    refetchInterval: 30000,
  });

  const { data: projects = [], isLoading: isProjectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const selectedProject = useMemo(() => projects.find(project => project.id === selectedProjectId) ?? null, [projects, selectedProjectId]);

  const { data: pages = [], isLoading: isPagesLoading } = useQuery<Page[]>({
    queryKey: ["animation", "pages", selectedProjectId],
    enabled: Boolean(selectedProjectId),
    queryFn: async () => {
      if (!selectedProjectId) return [] as Page[];
      return await apiRequest("GET", `/api/projects/${selectedProjectId}/pages`);
    },
  });

  const pageDescriptors = useMemo(
    () =>
      pages.map(page => ({
        id: page.id,
        pageNumber: page.pageNumber,
        scriptSnippet: page.scriptSnippet ?? null,
      })),
    [pages],
  );

  const { data: panelLibrary = [], isLoading: isPanelLibraryLoading } = useQuery<PanelAsset[]>({
    queryKey: ["animation", "panel-library", selectedProjectId, pageDescriptors.map(page => page.id).join(",")],
    enabled: Boolean(selectedProjectId && pageDescriptors.length > 0),
    queryFn: async () => {
      if (!selectedProjectId || pageDescriptors.length === 0) return [] as PanelAsset[];

      const results = await Promise.all(
        pageDescriptors.map(async page => {
          const panels = await apiRequest("GET", `/api/pages/${page.id}/panels`);
          return (panels as any[]).map(panel => ({
            id: panel.id as string,
            pageId: page.id,
            pageNumber: page.pageNumber,
            panelNumber: panel.panelNumber as number,
            imageUrl: panel.imageUrl ?? null,
            prompt: panel.prompt ?? null,
            scriptSnippet: panel.scriptSnippet ?? page.scriptSnippet ?? null,
          } satisfies PanelAsset));
        }),
      );

      return results.flat().sort((a, b) => {
        if (a.pageNumber === b.pageNumber) {
          return a.panelNumber - b.panelNumber;
        }
        return a.pageNumber - b.pageNumber;
      });
    },
  });

  const panelMap = useMemo(() => {
    return new Map(panelLibrary.map(panel => [panel.id, panel]));
  }, [panelLibrary]);

  const activeScene = useMemo(() => scenes.find(scene => scene.id === selectedSceneId) ?? scenes[0] ?? null, [scenes, selectedSceneId]);
  const activeSceneAutoPrompt = useMemo(() => generateScenePrompt(selectedProject?.title, activeScene?.clips ?? []), [selectedProject?.title, activeScene?.clips]);

  const remainingCredits = useMemo(() => {
    if (!creditsData) return 0;
    if (creditsData.isAdmin || creditsData.remainingCredits === "Unlimited") return Infinity;
    return typeof creditsData.remainingCredits === 'number' ? creditsData.remainingCredits : 0;
  }, [creditsData]);

  const videosCanMake = useMemo(() => {
    if (remainingCredits === Infinity) return Infinity;
    return Math.floor(remainingCredits / 80);
  }, [remainingCredits]);

  const isLowOnCredits = useMemo(() => {
    return remainingCredits !== Infinity && remainingCredits < 80;
  }, [remainingCredits]);

  useMetaTags({
    title: "Animation Studio | Kumayiri",
    description: "Drag comic panels into cinematic scenes and render Veo 3 motion clips in our animation studio.",
    keywords: "comic animation, Veo 3, AI video, storyboard to video, Kumayiri animation",
    ogTitle: "Animate your comics with Veo 3 | Kumayiri",
    ogDescription: "Drag, stitch, and render your comic panels into animated sequences with our Veo 3 studio.",
    canonicalUrl: `${window.location.origin}/animation`,
  });

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const projectIdParam = searchParams.get("projectId");
    if (projectIdParam && projectIdParam !== selectedProjectId) {
      setSelectedProjectId(projectIdParam);
    }
  }, [location]);

  useEffect(() => {
    if (projects.length === 0) return;
    const currentParam = new URLSearchParams(window.location.search).get("projectId");
    const hasSelected = selectedProjectId && projects.some(project => project.id === selectedProjectId);

    if (!hasSelected) {
      const fallback = projects[0];
      if (!fallback) return;
      setSelectedProjectId(fallback.id);
      if (currentParam !== fallback.id) {
        setLocation(`/animation?projectId=${fallback.id}`);
      }
      return;
    }

    if (selectedProjectId && currentParam !== selectedProjectId) {
      setLocation(`/animation?projectId=${selectedProjectId}`);
    }
  }, [projects, selectedProjectId, setLocation]);

  useEffect(() => {
    if (!selectedProjectId) return;
    const firstScene = createScene(1);
    setScenes([firstScene]);
    setSelectedSceneId(firstScene.id);
  }, [selectedProjectId]);

  useEffect(() => {
    if (scenes.length > 0 && !selectedSceneId) {
      setSelectedSceneId(scenes[0].id);
    }
  }, [scenes, selectedSceneId]);

  const handleSelectProject = useCallback(
    (projectId: string) => {
      setSelectedProjectId(projectId);
      setLocation(`/animation?projectId=${projectId}`);
      setMobileSheetOpen(false);
    },
    [setLocation],
  );

  const handleUpdateScene = useCallback(
    (sceneId: string, updates: Partial<Scene>) => {
      setScenes(prevScenes =>
        prevScenes.map(scene => {
          if (scene.id !== sceneId) return scene;
          const merged: Scene = { ...scene, ...updates };
          const clipsChanged = updates.clips !== undefined;

          if (updates.prompt !== undefined && updates.prompt !== scene.prompt) {
            const previousPrompt = scene.prompt.trim().length ? scene.prompt : null;
            if (previousPrompt) {
              merged.promptVersionHistory = [previousPrompt, ...scene.promptVersionHistory].slice(0, 10);
            }
            const variantKey = updates.activePromptVariant ?? scene.activePromptVariant;
            merged.promptVariants = {
              ...scene.promptVariants,
              [variantKey]: updates.prompt,
            };
          }

          if (clipsChanged && !merged.promptWasEdited) {
            const regenerated = generateScenePrompt(selectedProject?.title, merged.clips);
            merged.prompt = regenerated;
            merged.promptFreeform = regenerated;
            merged.promptVariants = {
              ...merged.promptVariants,
              [merged.activePromptVariant]: regenerated,
            };
          }

          return merged;
        }),
      );
    },
    [selectedProject?.title],
  );

  const handleAttachPanel = useCallback(
    (sceneId: string, panelId: string) => {
      const panel = panelMap.get(panelId);
      if (!panel) {
        toast({
          title: "Panel unavailable",
          description: "We could not find that panel in the current project.",
          variant: "destructive",
        });
        return;
      }

      setScenes(prevScenes =>
        prevScenes.map(scene => {
          if (scene.id !== sceneId) return scene;
          const clip: SceneClip = { id: createClipId(panelId), panel };
          const clips = [...scene.clips, clip];
          const promptState = derivePromptFromStory(scene, clips, selectedProject?.title);
          return { ...scene, clips, ...promptState };
        }),
      );
      setSelectedSceneId(sceneId);
    },
    [panelMap, selectedProject?.title, toast],
  );

  const handleQuickAddPanel = useCallback(
    (panelId: string) => {
      const targetSceneId = selectedSceneId ?? scenes[0]?.id;
      if (!targetSceneId) {
        toast({
          title: "Create a scene first",
          description: "Add a scene to the timeline before dropping panels.",
        });
        return;
      }
      handleAttachPanel(targetSceneId, panelId);
    },
    [handleAttachPanel, scenes, selectedSceneId, toast],
  );

  const handleRemoveClip = useCallback(
    (sceneId: string, clipId: string) => {
      setScenes(prevScenes =>
        prevScenes.map(scene => {
          if (scene.id !== sceneId) return scene;
          const clips = scene.clips.filter(clip => clip.id !== clipId);
          const promptState = derivePromptFromStory(scene, clips, selectedProject?.title);
          return { ...scene, clips, ...promptState };
        }),
      );
    },
    [selectedProject?.title],
  );

  const handleRemoveLastClip = useCallback(
    (sceneId: string) => {
      setScenes(prevScenes =>
        prevScenes.map(scene => {
          if (scene.id !== sceneId) return scene;
          if (scene.clips.length === 0) return scene;
          const clips = scene.clips.slice(0, -1);
          const promptState = derivePromptFromStory(scene, clips, selectedProject?.title);
          return { ...scene, clips, ...promptState };
        }),
      );
    },
    [selectedProject?.title],
  );

  const handleClearScene = useCallback((sceneId: string) => {
    setScenes(prevScenes =>
      prevScenes.map(scene => {
        if (scene.id !== sceneId) return scene;
        const shouldPreservePrompt = scene.promptWasEdited;
        return {
          ...scene,
          clips: [],
          prompt: shouldPreservePrompt ? scene.prompt : "",
          promptFreeform: shouldPreservePrompt ? scene.promptFreeform : "",
          promptVariants: shouldPreservePrompt
            ? scene.promptVariants
            : { ...scene.promptVariants, [scene.activePromptVariant]: "" },
          promptTokens: shouldPreservePrompt ? scene.promptTokens : createPromptTokens(),
        };
      }),
    );
  }, []);

  const handleAddScene = useCallback(() => {
    setScenes(prevScenes => {
      const nextIndex = prevScenes.length + 1;
      const nextScene = createScene(nextIndex);
      setSelectedSceneId(nextScene.id);
      return [...prevScenes, nextScene];
    });
  }, []);

  const handleRenderScene = useCallback(
    async (sceneId: string) => {
      const scene = scenes.find(entry => entry.id === sceneId);
      if (!scene) return;
      
      if (!selectedProjectId) {
        toast({
          title: "Select a project first",
          description: "Choose a project from the sidebar before rendering animations.",
          variant: "destructive",
        });
        return;
      }
      
      if (scene.clips.length === 0) {
        toast({
          title: "Add frames first",
          description: "Drop at least one panel into the scene before rendering.",
          variant: "destructive",
        });
        return;
      }

      if (remainingCredits !== Infinity && remainingCredits < 80) {
        setUpgradeDialogOpen(true);
        return;
      }

      const autoPrompt = generateScenePrompt(selectedProject?.title, scene.clips);
      const finalPrompt = scene.prompt.trim().length > 0 ? scene.prompt : autoPrompt;

      if (!finalPrompt) {
        toast({
          title: "Prompt required",
          description: "Provide a motion prompt or use the story context before rendering.",
          variant: "destructive",
        });
        return;
      }

      setScenes(prevScenes =>
        prevScenes.map(entry => (entry.id === sceneId ? { ...entry, isSubmitting: true } : entry)),
      );

      try {
        await submitSceneToVeo(finalPrompt, scene, selectedProjectId);
        toast({
          title: "Scene sent to Veo",
          description: "We’re stitching your frames into motion. Check the render queue for updates.",
        });
        queryClient.invalidateQueries({ queryKey: ["veo3", "jobs"] });
        queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
        setScenes(prevScenes =>
          prevScenes.map(entry => {
            if (entry.id !== sceneId) return entry;
            const shouldSyncPrompt = !entry.promptWasEdited;
            return {
              ...entry,
              isSubmitting: false,
              lastSubmittedAt: new Date().toISOString(),
              prompt: shouldSyncPrompt ? autoPrompt : entry.prompt,
              promptFreeform: shouldSyncPrompt ? autoPrompt : entry.promptFreeform,
              promptVariants: shouldSyncPrompt
                ? { ...entry.promptVariants, [entry.activePromptVariant]: autoPrompt }
                : entry.promptVariants,
            };
          }),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to submit animation job.";
        if (message.includes("402") || message.toLowerCase().includes("insufficient credits")) {
          setUpgradeDialogOpen(true);
          queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
        } else {
          toast({
            title: "Veo render failed",
            description: message,
            variant: "destructive",
          });
        }
        setScenes(prevScenes =>
          prevScenes.map(entry => (entry.id === sceneId ? { ...entry, isSubmitting: false } : entry)),
        );
      }
    },
    [queryClient, scenes, selectedProject?.title, selectedProjectId, toast, remainingCredits],
  );

  const handleRenderAllScenes = useCallback(
    async () => {
      if (!selectedProjectId) {
        toast({
          title: "Select a project first",
          description: "Choose a project from the sidebar before rendering animations.",
          variant: "destructive",
        });
        return;
      }

      const scenesWithPanels = scenes.filter(scene => scene.clips.length > 0);
      
      if (scenesWithPanels.length === 0) {
        toast({
          title: "No scenes ready",
          description: "Add panels to at least one scene before rendering.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Rendering all scenes",
        description: `Submitting ${scenesWithPanels.length} scene${scenesWithPanels.length > 1 ? 's' : ''} to Veo 3...`,
      });

      for (const scene of scenesWithPanels) {
        await handleRenderScene(scene.id);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    },
    [scenes, selectedProjectId, toast, handleRenderScene],
  );

  const projectHasPages = pages.length > 0;
  const creditsCardProps = {
    isLoading: isCreditsLoading,
    remainingCredits,
    monthlyLimit: creditsData?.monthlyLimit ?? null,
    videosCanMake,
    isLowOnCredits,
  };
  const hasRenderableScenes = scenes.some(scene => scene.clips.length > 0);
  const canRenderSelectedScene = Boolean(activeScene && activeScene.clips.length > 0);

  return (
    <div className="min-h-screen bg-muted/10" style={{ paddingTop: "var(--safe-top)" }}>
      <Navigation />
      <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 pb-16 pt-4 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-border/60 bg-card/90 p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1.5">
              <Badge variant="outline" className="w-fit gap-1 uppercase tracking-wide">
                <Sparkles className="h-3 w-3" /> Animation Studio
              </Badge>
              <h1 className="text-2xl font-serif font-bold">Turn panels into motion</h1>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Drag panels into beats, dial in prompts, and send Veo clips that respect Kumayiri’s handcrafted DNA.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <Loader2 className={`h-4 w-4 ${isPanelLibraryLoading || isPagesLoading ? "animate-spin" : ""}`} />
              <span>{selectedProject ? `Working in ${selectedProject.title}` : "Select a project to begin"}</span>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
            <div className="flex rounded-full border border-border/60 bg-background/70 p-1 text-sm font-medium">
              {(["Page", "Animation", "Script"] as const).map(label => (
                <button
                  key={label}
                  type="button"
                  className={`rounded-full px-4 py-1 text-[11px] ${label === "Animation" ? "bg-primary text-white" : "text-muted-foreground"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
                <SheetTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-2 lg:hidden">
                    <FolderOpen className="h-4 w-4" />
                    {selectedProject ? selectedProject.title : "Select project"}
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[85vw] sm:w-[400px] p-0">
                  <SheetHeader className="p-6 pb-4">
                    <SheetTitle>Select Project</SheetTitle>
                  </SheetHeader>
                  <div className="px-6 pb-6">
                    <AnimationProjectList
                      projects={projects}
                      selectedProjectId={selectedProjectId}
                      onSelect={handleSelectProject}
                      isLoading={isProjectsLoading}
                    />
                  </div>
                </SheetContent>
              </Sheet>
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                disabled={!canRenderSelectedScene}
                onClick={() => activeScene && handleRenderScene(activeScene.id)}
              >
                <Film className="h-4 w-4" /> Render selection
              </Button>
              <Button size="sm" className="gap-2" disabled={!hasRenderableScenes} onClick={handleRenderAllScenes}>
                <Sparkles className="h-4 w-4" /> Render all
              </Button>
            </div>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <CreditsCard {...creditsCardProps} />
            <AnimationProjectList
              projects={projects}
              selectedProjectId={selectedProjectId}
              onSelect={handleSelectProject}
              isLoading={isProjectsLoading}
            />
            {selectedProject && (
              <Card className="border-border/60">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <BookOpen className="h-4 w-4 text-primary" />
                    Story overview
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Reference the script while crafting motion cues.</p>
                </CardHeader>
                <CardContent>
                  {selectedProject.script ? (
                    <ScrollArea className="h-40">
                      <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                        {selectedProject.script}
                      </p>
                    </ScrollArea>
                  ) : (
                    <p className="text-xs text-muted-foreground">This project does not have a stored script yet.</p>
                  )}
                </CardContent>
              </Card>
            )}
            <PanelLibrary
              panels={panelLibrary}
              pages={pageDescriptors}
              scenes={scenes}
              selectedSceneId={activeScene?.id ?? null}
              onSelectScene={setSelectedSceneId}
              isLoading={isPanelLibraryLoading}
              onQuickAdd={projectHasPages ? handleQuickAddPanel : undefined}
              activeSceneName={activeScene?.title}
            />
          </div>

          <div className="space-y-6">
            <CinematicCanvas scene={activeScene ?? null} autoPrompt={activeSceneAutoPrompt} isLoadingPanels={isPanelLibraryLoading} />
          </div>

          <div className="space-y-6">
            <SceneComposer
              scene={activeScene}
              autoPrompt={activeSceneAutoPrompt}
              onUpdate={handleUpdateScene}
              onGenerate={handleRenderScene}
              onGenerateAll={handleRenderAllScenes}
              scenes={scenes}
            />
            <RenderQueuePanel projectId={selectedProjectId ?? undefined} />
          </div>
        </div>

        <SceneTimeline
          scenes={scenes}
          selectedSceneId={activeScene?.id ?? null}
          onSelectScene={setSelectedSceneId}
          onDropPanel={handleAttachPanel}
          onRemoveClip={handleRemoveClip}
          onAddScene={handleAddScene}
          onClearScene={handleClearScene}
          onRemoveLastClip={handleRemoveLastClip}
        />

        {!projectHasPages && !isPagesLoading && selectedProject && (
          <Card className="border-dashed border-border/60 bg-muted/20">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Generate comic pages for “{selectedProject.title}” to unlock animation stitching.
            </CardContent>
          </Card>
        )}

        <AlertDialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
          <AlertDialogContent data-testid="dialog-upgrade">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Insufficient Credits
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <p>
                  You need <strong>80 credits</strong> to render a video animation. You currently have{' '}
                  <strong>{remainingCredits === Infinity ? "unlimited" : remainingCredits} credits</strong> remaining.
                </p>
                <p className="text-sm">
                  Upgrade to the <strong>Pro plan</strong> for more credits and unlock advanced features, or check back soon for our pay-per-video option.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-upgrade">Cancel</AlertDialogCancel>
              <Link href="/profile">
                <AlertDialogAction className="gap-2" data-testid="button-upgrade">
                  Upgrade to Pro
                  <ArrowRight className="h-4 w-4" />
                </AlertDialogAction>
              </Link>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}
