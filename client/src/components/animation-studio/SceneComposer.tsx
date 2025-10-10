import { Scene } from "./types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            {scene.title} motion pass
          </CardTitle>
          <Badge variant="secondary" className="gap-1">
            <Timer className="h-3 w-3" />
            {scene.durationSeconds}s · {scene.aspectRatio}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Blend dialogue beats and panel blocking into a Veo 3 clip. Tweak the prompt or lean on the story context.
        </p>
        {framesSummary && (
          <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
            {framesSummary}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="scene-prompt" className="text-sm font-medium">
            Motion prompt
          </Label>
          <Textarea
            id="scene-prompt"
            rows={6}
            value={scene.prompt}
            placeholder={autoPrompt || "Describe the motion, cinematography, and mood for this stitch."}
            onChange={event => onUpdate(scene.id, { prompt: event.target.value, promptWasEdited: true })}
          />
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => onUpdate(scene.id, { prompt: autoPrompt, promptWasEdited: false })}
              disabled={!autoPrompt}
            >
              <RefreshCw className="h-3 w-3" />
              Use story context
            </Button>
            <span className="self-center">
              {scene.prompt.trim().length === 0
                ? "We’ll fall back to the story-derived prompt above."
                : `${scene.prompt.trim().length} characters`}
            </span>
          </div>
        </div>

        <Separator />

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-4 rounded-lg border border-border/60 bg-muted/20 p-4">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Duration</Label>
            <Select
              value={scene.durationSeconds.toString()}
              onValueChange={value => onUpdate(scene.id, { durationSeconds: parseInt(value) })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Duration" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="4">4 seconds</SelectItem>
                <SelectItem value="6">6 seconds</SelectItem>
                <SelectItem value="8">8 seconds</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4 rounded-lg border border-border/60 bg-muted/20 p-4">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Aspect ratio</Label>
            <Select
              value={scene.aspectRatio}
              onValueChange={value => onUpdate(scene.id, { aspectRatio: value as Scene["aspectRatio"] })}
            >
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
            <Select
              value={scene.quality}
              onValueChange={value => onUpdate(scene.id, { quality: value as Scene["quality"] })}
            >
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
                <p className="text-[11px] text-muted-foreground">Adds gentle texture to the motion without narration.</p>
              </div>
              <Switch
                checked={scene.includeAudioBed}
                onCheckedChange={checked => onUpdate(scene.id, { includeAudioBed: checked })}
              />
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
          <p className="text-xs text-muted-foreground">
            Add panels to at least one scene before rendering.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
