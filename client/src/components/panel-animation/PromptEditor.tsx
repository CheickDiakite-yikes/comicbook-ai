import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Wand2 } from "lucide-react";
import { z } from "zod";

import { usePanelAnimation } from "./PanelAnimationContext";
import { animationPromptUpdateSchema } from "@shared/animation-schemas";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const promptFormSchema = animationPromptUpdateSchema.pick({
  prompt: true,
  durationSeconds: true,
  templateId: true,
});

type PromptFormValues = z.infer<typeof promptFormSchema>;

export function PanelAnimationPromptEditor() {
  const { clips, activeClipId, updateClipPrompt, templates, statuses } = usePanelAnimation();
  const activeClip = useMemo(() => clips.find((clip) => clip.id === activeClipId) ?? null, [clips, activeClipId]);
  const activeStatus = activeClip ? statuses[activeClip.id] : undefined;

  const form = useForm<PromptFormValues>({
    resolver: zodResolver(promptFormSchema),
    mode: "onBlur",
    defaultValues: {
      prompt: activeClip?.prompt ?? "",
      durationSeconds: activeClip?.durationSeconds ?? 4,
      templateId: activeClip?.templateId ?? undefined,
    },
  });

  useEffect(() => {
    form.reset({
      prompt: activeClip?.prompt ?? "",
      durationSeconds: activeClip?.durationSeconds ?? 4,
      templateId: activeClip?.templateId ?? undefined,
    });
  }, [activeClip?.prompt, activeClip?.durationSeconds, activeClip?.templateId, form]);

  const onSubmit = form.handleSubmit((values) => {
    if (!activeClip) return;
    updateClipPrompt({
      clipId: activeClip.id,
      ...values,
    });
  });

  if (!activeClip) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/40 p-6 text-center text-sm text-muted-foreground">
        Select a clip from the timeline to start editing prompts.
      </div>
    );
  }

  const currentTemplate = templates.find((template) => template.id === activeClip.templateId);

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Prompt editor</h2>
          <p className="text-sm text-muted-foreground">Craft the narrative for clip-level renders with on-brand presets.</p>
        </div>
        {activeStatus?.status ? (
          <Badge variant={activeStatus.status === "error" ? "destructive" : "secondary"}>
            {activeStatus.status === "rendering" ? "Rendering" : activeStatus.status === "completed" ? "Ready" : activeStatus.status}
          </Badge>
        ) : null}
      </header>
      <Form {...form}>
        <form onSubmit={onSubmit} className="space-y-6">
          <FormField
            control={form.control}
            name="prompt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Prompt</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="Describe the motion, framing, and emotion you want to convey..."
                    className="min-h-[160px] resize-y"
                  />
                </FormControl>
                <FormDescription>Use vivid verbs, cinematography cues, and ensure continuity with prior clips.</FormDescription>
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
                  <FormDescription>Clips render best between 1s and 8s.</FormDescription>
                  <FormControl>
                    <div className="space-y-3">
                      <Slider
                        max={8}
                        min={1}
                        step={0.5}
                        value={[field.value ?? 4]}
                        onValueChange={(value) => field.onChange(value[0])}
                        aria-label="Clip duration"
                      />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Fine tune with ← →</span>
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
              name="templateId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Template preset</FormLabel>
                  <FormDescription>Select a preset to match your story pacing.</FormDescription>
                  <Select
                    value={field.value ?? ""}
                    onValueChange={(value) => field.onChange(value === "" ? undefined : value)}
                  >
                    <FormControl>
                      <SelectTrigger aria-label="Choose template">
                        <SelectValue placeholder="Select template" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">No preset</SelectItem>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{template.label}</span>
                            {template.description ? (
                              <span className="text-xs text-muted-foreground">{template.description}</span>
                            ) : null}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {currentTemplate ? (
            <div className="flex flex-col gap-2 rounded-lg border bg-muted/50 p-4">
              <div className="flex items-center gap-2">
                <Badge
                  className="bg-primary/10 text-primary"
                  style={
                    currentTemplate.accentColor
                      ? {
                          borderColor: currentTemplate.accentColor,
                          color: currentTemplate.accentColor,
                          backgroundColor: `${currentTemplate.accentColor}1a`,
                        }
                      : undefined
                  }
                >
                  {currentTemplate.label}
                </Badge>
                {currentTemplate.recommendedDuration ? (
                  <span className="text-xs text-muted-foreground">
                    Recommended {currentTemplate.recommendedDuration.toFixed(1)}s
                  </span>
                ) : null}
              </div>
              {currentTemplate.description ? (
                <p className="text-sm text-muted-foreground">{currentTemplate.description}</p>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Saving updates will trigger a re-render for this clip.
            </p>
            <Button type="submit" size="sm">
              <Wand2 className="mr-2 h-4 w-4" aria-hidden />
              Update clip
            </Button>
          </div>
        </form>
      </Form>
    </section>
  );
}
