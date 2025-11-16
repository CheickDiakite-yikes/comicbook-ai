import { Scene } from "./types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PromptComposer } from "./PromptComposer";
import { Film, Sparkles, RefreshCw, Timer } from "lucide-react";
import { useMemo } from "react";

interface SceneComposerProps {
  scene: Scene | null;
  autoPrompt: string;
  onUpdate: (sceneId: string, updates: Partial<Scene>) => void;
  onGenerate: (sceneId: string) => void;
  onGenerateAll: () => void;
  scenes: Scene[];
}

const aspectRatioOptions = [
  { value: "16:9", label: "16:9 Widescreen" },
  { value: "1:1", label: "1:1 Square" },
  { value: "4:5", label: "4:5 Portrait" },
  { value: "9:16", label: "9:16 Vertical" },
] as const;

const qualityOptions = [
  { value: "quality", label: "Cinematic" },
  { value: "standard", label: "Fast" },
] as const;

const soundtrackOptions = [
  { value: "none", label: "No soundtrack" },
  { value: "uplifting", label: "Uplifting" },
  { value: "dramatic", label: "Dramatic" },
  { value: "mysterious", label: "Mysterious" },
  { value: "tense", label: "Tense" },
  { value: "whimsical", label: "Whimsical" },
] as const;

const modelOptions = [
  { value: "veo-3.0-generate-001", label: "Veo 3 (1080p)" },
  { value: "veo-3.0-fast-generate-001", label: "Veo 3 Fast" },
];

export function SceneComposer({ scene, autoPrompt, onUpdate, onGenerate, onGenerateAll, scenes }: SceneComposerProps) {
  const framesSummary = useMemo(() => {
    if (!scene || scene.clips.length === 0) return "";
    return scene.clips
      .map((clip, index) => `Beat ${index + 1}: Page ${clip.panel.pageNumber} panel ${clip.panel.panelNumber}`)
      .join(" · ");
  }, [scene]);

  const scenesWithPanels = useMemo(() => scenes.filter(s => s.clips.length > 0), [scenes]);

  if (!scene) {
    return (
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            Pick a scene to compose motion
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Choose a scene from the timeline to blend story beats, motion cues, and Veo render settings.
          </p>
        </CardContent>
      </Card>
    );
  }

  const canGenerate = scene.clips.length > 0 && (scene.prompt.trim().length > 0 || autoPrompt.trim().length > 0);

  return (
    <Card className="border-border/60">
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Sparkles className="h-4 w-4 text-primary" />
              {scene.title} inspector
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Blend dialogue beats and panel blocking into a Veo 3 clip.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => onGenerate(scene.id)}
              disabled={!canGenerate || scene.isSubmitting}
            >
              {scene.isSubmitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
              Render scene
            </Button>
            <Badge variant="secondary" className="gap-1">
              <Timer className="h-3 w-3" /> {scene.durationSeconds}s · {scene.aspectRatio}
            </Badge>
          </div>
        </div>
        {framesSummary && (
          <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
            {framesSummary}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs defaultValue="scene" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="scene">Scene</TabsTrigger>
            <TabsTrigger value="beat">Beats</TabsTrigger>
            <TabsTrigger value="prompt">Prompt</TabsTrigger>
          </TabsList>

          <TabsContent value="scene" className="space-y-4 pt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-4 rounded-lg border border-border/60 bg-muted/20 p-4">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Duration</Label>
                <Slider
                  value={[scene.durationSeconds]}
                  min={4}
                  max={12}
                  step={2}
                  onValueChange={value => onUpdate(scene.id, { durationSeconds: value[0] })}
                />
                <div className="text-xs text-muted-foreground">{scene.durationSeconds} seconds</div>
              </div>
              <div className="space-y-4 rounded-lg border border-border/60 bg-muted/20 p-4">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Aspect ratio</Label>
                <Select value={scene.aspectRatio} onValueChange={value => onUpdate(scene.id, { aspectRatio: value as Scene["aspectRatio"] })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Aspect ratio" />
                  </SelectTrigger>
                  <SelectContent>
                    {aspectRatioOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Quality</Label>
                <Select value={scene.quality} onValueChange={value => onUpdate(scene.id, { quality: value as Scene["quality"] })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Quality" />
                  </SelectTrigger>
                  <SelectContent>
                    {qualityOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-4 rounded-lg border border-border/60 bg-muted/20 p-4">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Soundtrack mood</Label>
                <Select
                  value={scene.soundtrackMood}
                  onValueChange={value => onUpdate(scene.id, { soundtrackMood: value as Scene["soundtrackMood"] })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Soundtrack" />
                  </SelectTrigger>
                  <SelectContent>
                    {soundtrackOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/50 px-3 py-2">
                  <div>
                    <div className="text-xs font-medium">Include subtle audio bed</div>
                    <p className="text-[11px] text-muted-foreground">Adds gentle texture without narration.</p>
                  </div>
                  <Switch checked={scene.includeAudioBed} onCheckedChange={checked => onUpdate(scene.id, { includeAudioBed: checked })} />
                </div>
              </div>
              <div className="space-y-4 rounded-lg border border-border/60 bg-muted/20 p-4">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Model</Label>
                <Select value={scene.model} onValueChange={value => onUpdate(scene.id, { model: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Model" />
                  </SelectTrigger>
                  <SelectContent>
                    {modelOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="beat" className="space-y-3 pt-4">
            {scene.clips.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                Drop a panel into the timeline to define beat 1.
              </div>
            ) : (
              scene.clips.map((clip, index) => (
                <div key={clip.id} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/70 p-3 text-xs">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-muted">
                    {clip.panel.imageUrl ? (
                      <img src={clip.panel.imageUrl} alt="Panel" className="h-full w-full object-cover" />
                    ) : (
                      <Film className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-foreground">Beat {index + 1}</div>
                    <p className="text-muted-foreground">Page {clip.panel.pageNumber} · Panel {clip.panel.panelNumber}</p>
                    <p className="line-clamp-2 text-[11px] text-muted-foreground">
                      {clip.panel.scriptSnippet || clip.panel.prompt || "No script context available."}
                    </p>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="prompt" className="pt-4">
            <PromptComposer scene={scene} autoPrompt={autoPrompt} onUpdate={onUpdate} />
          </TabsContent>
        </Tabs>

        <Button
          type="button"
          size="lg"
          className="w-full gap-2"
          disabled={scenesWithPanels.length === 0}
          onClick={onGenerateAll}
          data-testid="button-render-all-scenes"
        >
          {scenes.some(s => s.isSubmitting) ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Film className="h-4 w-4" />
          )}
          {scenes.some(s => s.isSubmitting) ? "Rendering…" : `Render All Scenes (${scenesWithPanels.length})`}
        </Button>

        {scenesWithPanels.length === 0 && (
          <p className="text-xs text-muted-foreground">Add panels to at least one scene before rendering.</p>
        )}
      </CardContent>
    </Card>
  );
}
