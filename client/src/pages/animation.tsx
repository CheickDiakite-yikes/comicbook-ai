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
import { Scene, SceneClip, PanelAsset } from "@/components/animation-studio/types";
import { apiRequest } from "@/lib/queryClient";
import { DEFAULT_VEO_SAFETY_SETTINGS } from "@shared/veo";
import { useToast } from "@/hooks/use-toast";
import { useMetaTags } from "@/hooks/useMetaTags";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Loader2, Sparkles, BookOpen, FolderOpen } from "lucide-react";

function createScene(index: number): Scene {
  return {
    id: `scene-${index}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: `Scene ${index}`,
    clips: [],
    prompt: "",
    promptWasEdited: false,
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

export default function AnimationStudioPage() {
  const [location, setLocation] = useLocation();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([createScene(1)]);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
          if (!merged.promptWasEdited) {
            merged.prompt = generateScenePrompt(selectedProject?.title, merged.clips);
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
          const prompt = scene.promptWasEdited ? scene.prompt : generateScenePrompt(selectedProject?.title, clips);
          return { ...scene, clips, prompt };
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
          const prompt = scene.promptWasEdited ? scene.prompt : generateScenePrompt(selectedProject?.title, clips);
          return { ...scene, clips, prompt };
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
          const prompt = scene.promptWasEdited ? scene.prompt : generateScenePrompt(selectedProject?.title, clips);
          return { ...scene, clips, prompt };
        }),
      );
    },
    [selectedProject?.title],
  );

  const handleClearScene = useCallback((sceneId: string) => {
    setScenes(prevScenes =>
      prevScenes.map(scene => {
        if (scene.id !== sceneId) return scene;
        const prompt = scene.promptWasEdited ? scene.prompt : "";
        return { ...scene, clips: [], prompt };
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
        setScenes(prevScenes =>
          prevScenes.map(entry =>
            entry.id === sceneId
              ? { ...entry, isSubmitting: false, lastSubmittedAt: new Date().toISOString(), prompt: entry.promptWasEdited ? entry.prompt : autoPrompt }
              : entry,
          ),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to submit animation job.";
        toast({
          title: "Veo render failed",
          description: message,
          variant: "destructive",
        });
        setScenes(prevScenes =>
          prevScenes.map(entry => (entry.id === sceneId ? { ...entry, isSubmitting: false } : entry)),
        );
      }
    },
    [queryClient, scenes, selectedProject?.title, selectedProjectId, toast],
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

  return (
    <div className="min-h-screen bg-background" style={{ paddingTop: "var(--safe-top)" }}>
      <Navigation />
      <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 pb-12 pt-4 sm:gap-6 sm:px-6 sm:pt-6 lg:px-8">
        <header className="rounded-2xl border border-border/60 bg-card/80 p-4 shadow-sm sm:rounded-3xl sm:p-6">
          <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1.5 sm:space-y-2">
              <Badge variant="outline" className="w-fit gap-1">
                <Sparkles className="h-3 w-3" />
                Animation Studio
              </Badge>
              <h1 className="text-xl font-serif font-bold sm:text-2xl">Stitch your comic into motion</h1>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Drag panels into scenes, remix the story beats, and render Veo 3 clips that feel handcrafted for your comic.
              </p>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className={`h-4 w-4 ${isPanelLibraryLoading || isPagesLoading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">
                {selectedProject ? `Working in ${selectedProject.title}` : "Select a project to begin"}
              </span>
            </div>
          </div>
        </header>

        <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
          <SheetTrigger asChild>
            <Button 
              size="lg" 
              variant="outline" 
              className="w-full gap-2 lg:hidden"
              data-testid="button-select-project-mobile"
            >
              <FolderOpen className="h-5 w-5" />
              {selectedProject ? selectedProject.title : "Select Project"}
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

        <div className="flex flex-col gap-4 sm:gap-6 lg:grid lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="hidden space-y-4 lg:block lg:sticky lg:top-28 lg:h-[calc(100vh-8rem)]">
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
          </aside>

          <section className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <div className="space-y-6">
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
                <PanelLibrary
                  panels={panelLibrary}
                  isLoading={isPanelLibraryLoading}
                  onQuickAdd={projectHasPages ? handleQuickAddPanel : undefined}
                  activeSceneName={activeScene?.title}
                />
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

            {!projectHasPages && !isPagesLoading && selectedProject && (
              <Card className="border-dashed border-border/60 bg-muted/20">
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  Generate comic pages for “{selectedProject.title}” to unlock animation stitching.
                </CardContent>
              </Card>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
