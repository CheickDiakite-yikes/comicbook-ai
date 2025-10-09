import { z } from "zod";

export const animationTemplateSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional().nullable(),
  accentColor: z.string().optional().nullable(),
  recommendedDuration: z.number().min(1).max(8).optional(),
});

export const animationClipSchema = z.object({
  id: z.string(),
  prompt: z.string().min(1),
  durationSeconds: z.number().min(1).max(8),
  templateId: z.string().optional().nullable(),
  templateLabel: z.string().optional().nullable(),
  lastRenderedAt: z.string().optional().nullable(),
  previewUrl: z.string().url().optional().nullable(),
  alternatePreviewUrl: z.string().url().optional().nullable(),
});

export const animationPromptUpdateSchema = z.object({
  clipId: z.string(),
  prompt: z.string().min(8, "Prompts should be at least 8 characters"),
  durationSeconds: z.number().min(1).max(8),
  templateId: z.string().optional().nullable(),
});

export const animationContinuitySchema = z.object({
  id: z.string(),
  clipId: z.string(),
  message: z.string(),
  severity: z.enum(["info", "warning", "critical"]).default("info"),
  suggestion: z.string().optional().nullable(),
  affectedCharacters: z.array(z.string()).optional().default([]),
  frameComparison: z
    .object({
      previous: z.string().url().optional().nullable(),
      current: z.string().url().optional().nullable(),
    })
    .optional(),
  createdAt: z.string().optional().nullable(),
});

export type AnimationTemplate = z.infer<typeof animationTemplateSchema>;
export type AnimationClip = z.infer<typeof animationClipSchema>;
export type AnimationPromptUpdate = z.infer<typeof animationPromptUpdateSchema>;
export type AnimationContinuityInsight = z.infer<typeof animationContinuitySchema>;
