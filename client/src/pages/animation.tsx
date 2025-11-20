import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import Navigation from "@/components/navigation";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, BookOpen, Coins, AlertTriangle, ArrowRight } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Link } from "wouter";

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

function generateScenePrompt(projectTitle: string | undefined, clips: SceneClip[], projectArtStyle?: string, characters: any[] = []): string {
  if (clips.length === 0) return "";

  const header = projectTitle ? `${projectTitle} animated sequence:` : "Animated sequence for this comic story:";
  
  // Build art style guardrails - CRITICAL for preventing photorealistic 3D
  const artStyleInstructions = [
    "🎨 ART STYLE REQUIREMENTS (STRICTLY ENFORCE):",
    projectArtStyle || "Hand-drawn illustrated comic book style with flat colors and bold ink linework",
    "✅ MAINTAIN: Character designs, proportions, color palette, and artistic style from the source panels",
    "❌ DO NOT USE: Photorealistic rendering, 3D animation, Pixar/Toy Story style, realistic textures, or CGI effects",
    "The animation must look like the illustrated panels coming to life, NOT a 3D animated movie.",
  ].join("\n");

  // Build character reference section from project characters
  let characterReferences = "";
  if (characters.length > 0) {
    const charDescs = characters
      .filter((c): c is any => !!c.name)
      .map(c => {
        const desc = [
          c.name,
          c.appearance ? `Appearance: ${c.appearance}` : null,
          c.visualDescriptors ? `Visual traits: ${c.visualDescriptors}` : null,
        ].filter(Boolean).join(", ");
        return desc;
      });
    
    if (charDescs.length > 0) {
      characterReferences = `📋 CHARACTER REFERENCES (MUST MATCH EXACTLY FROM SOURCE PANELS):\n${charDescs.join("\n")}\n`;
    }
  }
  
  if (clips.length === 1) {
    const context = clips[0].panel.scriptSnippet || clips[0].panel.prompt || `Use the original art from page ${clips[0].panel.pageNumber}, panel ${clips[0].panel.panelNumber}.`;
    const motionNote = "Add subtle cinematic camera motion while preserving the exact character designs and art style.";
    return [header, artStyleInstructions, characterReferences, context, motionNote].join("\n");
  }
  
  // Multi-panel: describe flow and transitions
  const beats = clips.map((clip) => {
    const context = clip.panel.scriptSnippet || clip.panel.prompt || `Scene from page ${clip.panel.pageNumber}, panel ${clip.panel.panelNumber}`;
    return `${context}`;
  });

  const transitionDesc = clips.length === 2 
    ? "Create smooth transitions using camera movement and motion blur. Characters must maintain their illustrated comic appearance throughout."
    : `Create flowing transitions between these ${clips.length} story beats using dynamic camera movement and seamless visual continuity. Every frame must preserve the hand-drawn comic aesthetic - do NOT transition to 3D or photorealistic styles.`;
  
  const combinedNarrative = `The sequence flows through ${clips.length} connected beats:\n${beats.map((b, i) => `${i + 1}. ${b}`).join('\n')}\n\n${transitionDesc}`;

  return [header, artStyleInstructions, characterReferences, combinedNarrative].join("\n");
}

async function submitSceneToVeo(prompt: string, scene: Scene, projectId: string) {
  // Collect all panel images as references for character consistency
  const referenceImageUrls: string[] = [];
  for (const clip of scene.clips) {
    if (clip.panel.imageUrl) {
      const imageUrl = clip.panel.imageUrl;
      if (imageUrl.startsWith('/')) {
        referenceImageUrls.push(`${window.location.origin}${imageUrl}`);
      } else {
        referenceImageUrls.push(imageUrl);
      }
    }
  }

  // Use the first panel's image for primary motion conditioning
  const sourceImageUrl = referenceImageUrls.length > 0 ? referenceImageUrls[0] : null;

  const payload = {
    projectId,
    prompt,
    sourceImageUrl, // Primary image for motion and scene context
    referenceImageUrls: referenceImageUrls.length > 1 ? referenceImageUrls : undefined, // Additional panels as character references
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

  // Fetch characters for the project to include in animation prompts
  const { data: projectCharacters = [] } = useQuery<any[]>({
    queryKey: ["animation", "characters", selectedProjectId],
    enabled: Boolean(selectedProjectId),
    queryFn: async () => {
      if (!selectedProjectId) return [];
      try {
        return await apiRequest("GET", `/api/projects/${selectedProjectId}/characters`);
      } catch {
        return [];
      }
    },
  });

  const panelMap = useMemo(() => {
    return new Map(panelLibrary.map(panel => [panel.id, panel]));
  }, [panelLibrary]);

  const activeScene = useMemo(() => scenes.find(scene => scene.id === selectedSceneId) ?? scenes[0] ?? null, [scenes, selectedSceneId]);
  const activeSceneAutoPrompt = useMemo(() => generateScenePrompt(selectedProject?.title, activeScene?.clips ?? [], selectedProject?.artStyle ?? undefined, projectCharacters), [selectedProject?.title, activeScene?.clips, selectedProject?.artStyle, projectCharacters]);

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
            merged.prompt = generateScenePrompt(selectedProject?.title, merged.clips, selectedProject?.artStyle ?? undefined, projectCharacters);
          }
          return merged;
        }),
      );
    },
    [selectedProject?.title, selectedProject?.artStyle],
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
          const prompt = scene.promptWasEdited ? scene.prompt : generateScenePrompt(selectedProject?.title, clips, selectedProject?.artStyle ?? undefined, projectCharacters);
          return { ...scene, clips, prompt };
        }),
      );
      setSelectedSceneId(sceneId);
    },
    [panelMap, selectedProject?.title, selectedProject?.artStyle, projectCharacters, toast],
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
          const prompt = scene.promptWasEdited ? scene.prompt : generateScenePrompt(selectedProject?.title, clips, selectedProject?.artStyle ?? undefined, projectCharacters);
          return { ...scene, clips, prompt };
        }),
      );
    },
    [selectedProject?.title, selectedProject?.artStyle, projectCharacters],
  );

  const handleRemoveLastClip = useCallback(
    (sceneId: string) => {
      setScenes(prevScenes =>
        prevScenes.map(scene => {
          if (scene.id !== sceneId) return scene;
          if (scene.clips.length === 0) return scene;
          const clips = scene.clips.slice(0, -1);
          const prompt = scene.promptWasEdited ? scene.prompt : generateScenePrompt(selectedProject?.title, clips, selectedProject?.artStyle ?? undefined, projectCharacters);
          return { ...scene, clips, prompt };
        }),
      );
    },
    [selectedProject?.title, selectedProject?.artStyle, projectCharacters],
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

      if (remainingCredits !== Infinity && remainingCredits < 80) {
        setUpgradeDialogOpen(true);
        return;
      }

      const autoPrompt = generateScenePrompt(selectedProject?.title, scene.clips, selectedProject?.artStyle ?? undefined, projectCharacters);
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
          prevScenes.map(entry =>
            entry.id === sceneId
              ? { ...entry, isSubmitting: false, lastSubmittedAt: new Date().toISOString(), prompt: entry.promptWasEdited ? entry.prompt : autoPrompt }
              : entry,
          ),
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

  return (
    <div className="min-h-screen overflow-x-hidden bg-background" style={{ paddingTop: "var(--safe-top)" }}>
      <Navigation />
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 pb-12 pt-4 sm:gap-6 sm:px-6 sm:pt-6 lg:px-8">
        <header className="rounded-2xl border border-border/60 bg-card/80 p-4 shadow-sm sm:rounded-3xl sm:p-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-1.5 sm:space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="w-fit gap-1">
                    <Sparkles className="h-3 w-3" />
                    Animation Studio
                  </Badge>
                  {!isCreditsLoading && (
                    <span className={`text-sm font-medium ${isLowOnCredits ? "text-orange-600 dark:text-orange-500" : "text-muted-foreground"}`}>
                      AI Credit: {remainingCredits === Infinity ? "∞" : `${remainingCredits}${creditsData?.monthlyLimit ? `/${creditsData.monthlyLimit}` : ''}`} {remainingCredits !== Infinity && 'left'}
                    </span>
                  )}
                </div>
                <h1 className="text-xl font-serif font-bold sm:text-2xl">Stitch your comic into motion</h1>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  Drag panels into scenes, remix the story beats, and render Veo 3 clips that feel handcrafted for your comic.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                {isProjectsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading projects...</span>
                  </div>
                ) : projects.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Working in:</span>
                    <Select value={selectedProjectId ?? undefined} onValueChange={handleSelectProject}>
                      <SelectTrigger className="w-[200px] sm:w-[250px]" data-testid="select-active-project">
                        <SelectValue placeholder="Select a project" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map(project => (
                          <SelectItem key={project.id} value={project.id} data-testid={`select-item-project-${project.id}`}>
                            {project.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {(isPanelLibraryLoading || isPagesLoading) && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No projects available</p>
                )}
              </div>
            </div>

            {selectedProject && (
              <div className="rounded-lg border border-border/60 bg-card p-3">
                <div className="mb-2 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Story overview</span>
                </div>
                <p className="mb-2 text-xs text-muted-foreground">Reference the script while crafting motion cues.</p>
                {selectedProject.script ? (
                  <ScrollArea className="h-24">
                    <div className="space-y-2 pr-4">
                      {(() => {
                        try {
                          const parsed = JSON.parse(selectedProject.script);
                          return (
                            <>
                              {parsed.title && (
                                <p className="text-xs font-semibold text-foreground">
                                  {parsed.title}
                                </p>
                              )}
                              {parsed.logline && (
                                <p className="text-xs leading-relaxed text-muted-foreground">
                                  {parsed.logline}
                                </p>
                              )}
                            </>
                          );
                        } catch {
                          return (
                            <p className="break-words text-xs leading-relaxed text-muted-foreground">
                              {selectedProject.script}
                            </p>
                          );
                        }
                      })()}
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-xs text-muted-foreground">This project does not have a stored script yet.</p>
                )}
              </div>
            )}
          </div>
        </header>

        <section className="w-full space-y-6">
          <div className="grid w-full gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-6">
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
                <RenderQueuePanel projectId={selectedProjectId ?? undefined} />
              </div>

              <div className="min-w-0 space-y-6">
                <SceneComposer
                  scene={activeScene}
                  autoPrompt={activeSceneAutoPrompt}
                  onUpdate={handleUpdateScene}
                  onGenerate={handleRenderScene}
                  onGenerateAll={handleRenderAllScenes}
                  scenes={scenes}
                />
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

        <AlertDialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
          <AlertDialogContent data-testid="dialog-upgrade">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Insufficient Credits
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <p>
                  You need <strong>80 credits</strong> to render a video animation. You currently have{" "}
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
