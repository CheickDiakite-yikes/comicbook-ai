import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { DEFAULT_VEO_SAFETY_SETTINGS, type VeoSafetySetting } from "@shared/veo";
import { useToast } from "@/hooks/use-toast";
import { usePanelAnimation } from "@/components/panel-animation/PanelAnimationContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Select, SelectTrigger, SelectContent, SelectValue, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ShieldAlert } from "lucide-react";

const RELAXED_SAFETY_SETTINGS: VeoSafetySetting[] = [
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_HIGH_AND_ABOVE" },
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_HIGH_AND_ABOVE" },
  { category: "HARM_CATEGORY_SEXUAL", threshold: "BLOCK_HIGH_AND_ABOVE" },
];

const aspectRatioOptions = [
  { value: "16:9", label: "16:9 (Widescreen)" },
  { value: "1:1", label: "1:1 (Square)" },
  { value: "4:5", label: "4:5 (Portrait)" },
  { value: "9:16", label: "9:16 (Vertical)" },
] as const;

const soundtrackOptions = [
  { value: "none", label: "No soundtrack" },
  { value: "uplifting", label: "Uplifting" },
  { value: "dramatic", label: "Dramatic" },
  { value: "mysterious", label: "Mysterious" },
  { value: "tense", label: "Tense" },
  { value: "whimsical", label: "Whimsical" },
] as const;

const qualityOptions = [
  { value: "quality", label: "Cinematic" },
  { value: "standard", label: "Fast" },
] as const;

const modelOptions = [
  { value: "veo-001", label: "Veo 3 (1080p)" },
  { value: "veo-002", label: "Veo 3 (Experimental)" },
];

const composerSchema = z
  .object({
    prompt: z.string().min(40, "Describe the motion, camera, and emotion in at least 40 characters."),
    durationSeconds: z.coerce.number().min(1).max(8),
    aspectRatio: z.enum(["16:9", "1:1", "4:5", "9:16"]).default("16:9"),
    quality: z.enum(["quality", "standard"]).default("quality"),
    soundtrackMood: z.enum(["none", "uplifting", "dramatic", "mysterious", "tense", "whimsical"]).default("none"),
    includeAudioBed: z.boolean().default(false),
    model: z.string().default("veo-001"),
    relaxSafety: z.boolean().default(false),
    justification: z.string().max(280).optional(),
  })
  .superRefine((values, ctx) => {
    if (values.relaxSafety && (!values.justification || values.justification.trim().length < 24)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide at least 24 characters of justification when relaxing safety filters.",
        path: ["justification"],
      });
    }
  });

type ComposerValues = z.infer<typeof composerSchema>;

export function Veo3AnimationComposer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { clips, activeClipId } = usePanelAnimation();
  const activeClip = useMemo(() => clips.find(clip => clip.id === activeClipId) ?? null, [clips, activeClipId]);

  const form = useForm<ComposerValues>({
    resolver: zodResolver(composerSchema),
    defaultValues: {
      prompt: activeClip?.prompt ?? "",
      durationSeconds: 4,
      aspectRatio: "16:9",
      quality: "quality",
      soundtrackMood: "none",
      includeAudioBed: false,
      model: "veo-001",
      relaxSafety: false,
      justification: "",
    },
  });

  const { isSubmitting } = form.formState;

  useEffect(() => {
    if (activeClip?.prompt && !form.formState.dirtyFields.prompt) {
      form.reset({
        ...form.getValues(),
        prompt: activeClip.prompt,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClip?.prompt]);

  const mutation = useMutation({
    mutationFn: async (values: ComposerValues) => {
      const safetySettings = values.relaxSafety ? RELAXED_SAFETY_SETTINGS : DEFAULT_VEO_SAFETY_SETTINGS;
      const payload = {
        prompt: values.prompt,
        model: values.model,
        safetySettings,
        justification: values.relaxSafety ? values.justification?.trim() : undefined,
        generationConfig: {
          durationSeconds: values.durationSeconds,
          aspectRatio: values.aspectRatio,
          quality: values.quality,
          soundtrackMood: values.soundtrackMood,
          audioBed: values.includeAudioBed ? "subtle" : "none",
        },
        mediaFormats: ["video/mp4"],
        responseMimeType: "application/json",
      } satisfies Record<string, unknown>;

      const response = await fetch('/api/animations/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Unable to submit Veo3 animation job.');
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['veo3', 'jobs'] });
      toast({
        title: 'Animation job queued',
        description: 'We are contacting Veo3 to build your motion clip. You will see updates below in a few seconds.',
      });
      form.reset({
        prompt: activeClip?.prompt ?? '',
        durationSeconds: 4,
        aspectRatio: '16:9',
        quality: 'quality',
        soundtrackMood: 'none',
        includeAudioBed: false,
        model: 'veo-001',
        relaxSafety: false,
        justification: '',
      });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unexpected error while starting the animation job.';
      toast({
        title: 'Unable to contact Veo3',
        description: message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = form.handleSubmit(values => mutation.mutate(values));

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          Veo 3 clip composer
        </CardTitle>
        <CardDescription>
          Generate a short cinematic motion pass for the selected panel prompt. Tuned defaults keep clips cohesive with the
          surrounding story.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {activeClip ? (
          <div className="flex items-center justify-between rounded-lg border border-dashed border-primary/40 bg-primary/5 px-4 py-3 text-sm">
            <div>
              <p className="font-medium text-primary">Rendering clip: {activeClip.id}</p>
              <p className="text-muted-foreground">Prompt edits here will be saved to your clip and forwarded to Veo3.</p>
            </div>
            <Badge variant="outline" className="border-primary/40 text-primary">
              {activeClip.templateId ? `Preset ${activeClip.templateId}` : 'Custom prompt'}
            </Badge>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Select a clip in the timeline to pre-fill the Veo prompt with your latest story direction.
          </div>
        )}

        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-6">
            <FormField
              control={form.control}
              name="prompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motion prompt</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Describe the action, camera moves, atmosphere, and any key continuity notes."
                      className="min-h-[180px] resize-y"
                    />
                  </FormControl>
                  <FormDescription>
                    Structure with beats: establishing shot, character motion, camera move, emotional payoff. Mention palette or
                    props that must persist.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="durationSeconds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration</FormLabel>
                    <FormControl>
                      <div className="space-y-3">
                        <Slider
                          min={1}
                          max={8}
                          step={0.5}
                          value={[field.value ?? 4]}
                          onValueChange={value => field.onChange(value[0])}
                        />
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Clips should stay under 8 seconds.</span>
                          <span className="font-medium text-foreground">{field.value?.toFixed(1)}s</span>
                        </div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="aspectRatio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Aspect ratio</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select aspect ratio" />
                        </SelectTrigger>
                        <SelectContent>
                          {aspectRatioOptions.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="quality"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Render mode</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select render quality" />
                        </SelectTrigger>
                        <SelectContent>
                          {qualityOptions.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormDescription>
                      Cinematic mode favours fidelity; Fast mode trades detail for rapid iteration.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="soundtrackMood"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Soundtrack mood</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select soundtrack" />
                        </SelectTrigger>
                        <SelectContent>
                          {soundtrackOptions.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Veo model</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select model" />
                        </SelectTrigger>
                        <SelectContent>
                          {modelOptions.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="includeAudioBed"
                render={({ field }) => (
                  <FormItem className="flex flex-col rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <FormLabel className="flex items-center gap-2">
                          <span>Atmospheric audio</span>
                        </FormLabel>
                        <FormDescription>
                          Adds a subtle ambience bed so the clip feels alive without overpowering dialogue or voiceover.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Toggle atmospheric audio" />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="relaxSafety"
                render={({ field }) => (
                  <FormItem className="flex flex-col rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <FormLabel className="flex items-center gap-2">
                          <ShieldAlert className="h-4 w-4 text-amber-500" />
                          Safety guardrails
                        </FormLabel>
                        <FormDescription>
                          Relax filtering for mature or intense scenes. A justification is required for audit trails.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Toggle safety override" />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="justification"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Safety override justification</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Explain why this scene needs relaxed filters (e.g. period-accurate battle, stylised horror)."
                      disabled={!form.watch('relaxSafety')}
                    />
                  </FormControl>
                  <FormDescription>
                    Logged for compliance when Veo3 safety filters are softened. Not required when standard guardrails remain enabled.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Jobs run asynchronously. You can keep editing other panels while Veo3 renders this clip.
              </p>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Contacting Veo3…' : 'Generate animation'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
