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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Film, Sparkles, RefreshCw, Timer, ChevronDown, Settings2 } from "lucide-react";
import { useMemo, useState } from "react";

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
  const [advancedOpen, setAdvancedOpen] = useState(false);
  
  const framesSummary = useMemo(() => {
    if (!scene || scene.clips.length === 0) return "";
    return scene.clips
      .map((clip, index) => `Beat ${index + 1}: Page ${clip.panel.pageNumber} panel ${clip.panel.panelNumber}`)
      .join(" · ");
  }, [scene]);

  const scenesWithPanels = useMemo(() => scenes.filter(s => s.clips.length > 0), [scenes]);
  
  const qualityLabel = qualityOptions.find(opt => opt.value === scene?.quality)?.label || "Cinematic";
  const soundtrackLabel = soundtrackOptions.find(opt => opt.value === scene?.soundtrackMood)?.label || "No soundtrack";
  const modelLabel = modelOptions.find(opt => opt.value === scene?.model)?.label || "Veo 3 (1080p)";

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
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="scene-prompt" className="text-sm font-medium">
            Motion prompt
          </Label>
          <Textarea
            id="scene-prompt"
            rows={5}
            value={scene.prompt}
            placeholder={autoPrompt || "Describe the motion, cinematography, and mood for this stitch."}
            onChange={event => onUpdate(scene.id, { prompt: event.target.value, promptWasEdited: true })}
            className="resize-none"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => onUpdate(scene.id, { prompt: autoPrompt, promptWasEdited: false })}
              disabled={!autoPrompt}
              data-testid="button-use-story-context"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Use story context
            </Button>
            <span className="text-xs text-muted-foreground">
              {scene.prompt.trim().length === 0
                ? "We'll use story context"
                : `${scene.prompt.trim().length} chars`}
            </span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
            <Label className="text-xs font-medium text-muted-foreground">Duration</Label>
            <Select
              value={scene.durationSeconds.toString()}
              onValueChange={value => onUpdate(scene.id, { durationSeconds: parseInt(value) })}
            >
              <SelectTrigger data-testid="select-duration">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="4">4 seconds</SelectItem>
                <SelectItem value="6">6 seconds</SelectItem>
                <SelectItem value="8">8 seconds</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
            <Label className="text-xs font-medium text-muted-foreground">Aspect ratio</Label>
            <Select
              value={scene.aspectRatio}
              onValueChange={value => onUpdate(scene.id, { aspectRatio: value as Scene["aspectRatio"] })}
            >
              <SelectTrigger data-testid="select-aspect-ratio">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {aspectRatioOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"
              data-testid="toggle-advanced-settings"
            >
              <Settings2 className="h-4 w-4" />
              Advanced settings
              <div className="ml-auto flex items-center gap-1.5">
                <span className="text-xs">{qualityLabel} · {modelLabel}</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
              </div>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
                <Label className="text-xs font-medium text-muted-foreground">Quality</Label>
                <Select
                  value={scene.quality}
                  onValueChange={value => onUpdate(scene.id, { quality: value as Scene["quality"] })}
                >
                  <SelectTrigger data-testid="select-quality">
                    <SelectValue />
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

              <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
                <Label className="text-xs font-medium text-muted-foreground">Model</Label>
                <Select value={scene.model} onValueChange={value => onUpdate(scene.id, { model: value })}>
                  <SelectTrigger data-testid="select-model">
                    <SelectValue />
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

              <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
                <Label className="text-xs font-medium text-muted-foreground">Soundtrack</Label>
                <Select
                  value={scene.soundtrackMood}
                  onValueChange={value => onUpdate(scene.id, { soundtrackMood: value as Scene["soundtrackMood"] })}
                >
                  <SelectTrigger data-testid="select-soundtrack">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {soundtrackOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
                <Label className="text-xs font-medium text-muted-foreground">Audio bed</Label>
                <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2">
                  <span className="text-sm">{scene.includeAudioBed ? 'Enabled' : 'Disabled'}</span>
                  <Switch
                    checked={scene.includeAudioBed}
                    onCheckedChange={checked => onUpdate(scene.id, { includeAudioBed: checked })}
                    data-testid="switch-audio-bed"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">Subtle background audio texture</p>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Button
          type="button"
          size="lg"
          className="w-full gap-2 h-12 text-base"
          disabled={scenesWithPanels.length === 0}
          onClick={onGenerateAll}
          data-testid="button-render-all-scenes"
        >
          {scenes.some(s => s.isSubmitting) ? (
            <RefreshCw className="h-5 w-5 animate-spin" />
          ) : (
            <Film className="h-5 w-5" />
          )}
          {scenes.some(s => s.isSubmitting) ? "Rendering…" : `Render All Scenes (${scenesWithPanels.length})`}
        </Button>

        {scenesWithPanels.length === 0 && (
          <p className="text-xs text-center text-muted-foreground">
            Add panels to at least one scene before rendering.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
