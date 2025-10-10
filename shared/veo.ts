import { z } from "zod";

export const veoSafetySettingSchema = z.object({
  category: z.string().min(1, "Safety category is required"),
  threshold: z.string().min(1, "Safety threshold is required"),
});

export const veoJobRequestSchema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
  safetySettings: z.array(veoSafetySettingSchema).optional(),
  justification: z.string().min(10, "Justification must be at least 10 characters").optional(),
  model: z.string().min(1).optional(),
  generationConfig: z.record(z.any()).optional(),
  tools: z.array(z.record(z.any())).optional(),
  responseMimeType: z.string().optional(),
  mediaFormats: z.array(z.string()).optional(),
});

export type VeoSafetySetting = z.infer<typeof veoSafetySettingSchema>;
export type VeoJobRequest = z.infer<typeof veoJobRequestSchema>;

export const DEFAULT_VEO_SAFETY_SETTINGS: VeoSafetySetting[] = [
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  { category: "HARM_CATEGORY_SEXUAL", threshold: "BLOCK_ONLY_HIGH" },
];
