import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User profiles table for extended profile info
export const userProfiles = pgTable("user_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  bio: text("bio"),
  bannerImageUrl: varchar("banner_image_url"),
  location: varchar("location"),
  website: varchar("website"),
  socialLinks: jsonb("social_links"), // JSON object for social media links
  isPublicProfile: boolean("is_public_profile").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Comic projects table
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  title: varchar("title").notNull(),
  description: text("description"),
  genre: varchar("genre"), // AI-enhanced detailed genre description for generation
  userSelectedGenres: jsonb("user_selected_genres"), // Simple user-selected genres for UI display
  artStyle: varchar("art_style"),
  script: text("script"),
  settings: jsonb("settings"), // JSON array of setting objects
  canonRules: text("canon_rules"),
  coverArt: varchar("cover_art"), // URL to generated cover art image
  isPublic: boolean("is_public").default(false), // Whether project is shared publicly
  publicDescription: text("public_description"), // Optional public description for shared projects
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Characters table - supports both library characters and project characters
export const characters = pgTable("characters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id), // nullable for library characters
  userId: varchar("user_id").references(() => users.id), // for library characters
  name: varchar("name").notNull(),
  role: varchar("role"),
  bio: text("bio"),
  visualDescriptors: text("visual_descriptors"),
  alwaysTraits: text("always_traits"),
  neverTraits: text("never_traits"),
  referenceImageUrl: varchar("reference_image_url"),
  colorScheme: varchar("color_scheme"),
  wardrobePresets: jsonb("wardrobe_presets"), // JSON array of outfit presets for AI generation
  currentOutfit: jsonb("current_outfit"), // JSON object describing current clothing for consistency
  isLibraryCharacter: boolean("is_library_character").default(false), // true for library characters
  createdAt: timestamp("created_at").defaultNow(),
});

// Comic pages table
export const pages = pgTable("pages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  pageNumber: integer("page_number").notNull(),
  layoutTemplate: varchar("layout_template").notNull(),
  backgroundImageUrl: varchar("background_image_url"), // URL to generated page background
  panels: jsonb("panels"), // JSON array of panel objects
  scriptSnippet: text("script_snippet"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Panels table for individual panel data
export const panels = pgTable("panels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pageId: varchar("page_id").notNull().references(() => pages.id),
  panelNumber: integer("panel_number").notNull(),
  prompt: text("prompt"),
  imageUrl: varchar("image_url"),
  speechBubbles: jsonb("speech_bubbles"), // JSON array of speech bubble objects
  revisions: jsonb("revisions"), // JSON array of previous image versions for undo functionality
  isGenerated: boolean("is_generated").default(false),
  generationStatus: varchar("generation_status").default("pending"), // pending, generating, completed, failed
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Structured Scripts table - Enhanced script system
export const structuredScripts = pgTable("structured_scripts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  title: varchar("title").notNull(),
  logline: text("logline"),
  version: integer("version").default(1),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Script Pages table - Page-level script data
export const scriptPages = pgTable("script_pages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  structuredScriptId: varchar("structured_script_id").notNull().references(() => structuredScripts.id),
  pageNumber: integer("page_number").notNull(),
  title: varchar("title"),
  setting: text("setting").notNull(),
  mood: varchar("mood"), // tense, lighthearted, dramatic, etc.
  timeOfDay: varchar("time_of_day"), // morning, night, etc.
  location: varchar("location"), // specific location name
  weatherConditions: varchar("weather_conditions"), // sunny, rainy, etc.
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Script Panels table - Panel-level script data
export const scriptPanels = pgTable("script_panels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scriptPageId: varchar("script_page_id").notNull().references(() => scriptPages.id),
  panelNumber: integer("panel_number").notNull(),
  action: text("action").notNull(), // What happens in this panel
  sceneDescription: text("scene_description").notNull(), // Visual description for AI
  visualNotes: text("visual_notes"), // Art direction notes
  characters: text("characters").array(), // Character names present in panel
  mood: varchar("mood"), // panel-specific mood
  cameraAngle: varchar("camera_angle"), // close-up, wide-shot, bird's-eye, etc.
  shotType: varchar("shot_type"), // establishing, reaction, action, etc.
  timing: varchar("timing"), // fast, slow, dramatic-pause, etc.
  soundEffects: text("sound_effects").array(), // SFX for this panel
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Script Dialogue table - Dialogue with metadata
export const scriptDialogue = pgTable("script_dialogue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scriptPanelId: varchar("script_panel_id").notNull().references(() => scriptPanels.id),
  character: varchar("character").notNull(),
  text: text("text").notNull(),
  tone: varchar("tone"), // angry, whisper, shout, thought, etc.
  bubbleType: varchar("bubble_type").default("speech"), // speech, thought, shout, whisper, caption
  emotionalState: varchar("emotional_state"), // happy, sad, angry, surprised, etc.
  orderIndex: integer("order_index").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Project likes table
export const projectLikes = pgTable("project_likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  // Ensure a user can only like a project once
  index("unique_project_like").on(table.projectId, table.userId),
]);

// Project comments table
export const projectComments = pgTable("project_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  comment: text("comment").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User follows table (for future use)
export const userFollows = pgTable("user_follows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  followerId: varchar("follower_id").notNull().references(() => users.id),
  followingId: varchar("following_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  // Ensure a user can only follow another user once
  index("unique_user_follow").on(table.followerId, table.followingId),
]);

// AI Credits tracking table - Monthly credit usage
export const userCredits = pgTable("user_credits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  year: integer("year").notNull(), // 2024, 2025, etc.
  month: integer("month").notNull(), // 1-12
  creditsUsed: integer("credits_used").notNull().default(0),
  monthlyLimit: integer("monthly_limit").notNull().default(200),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Ensure only one record per user per month
  index("unique_user_month").on(table.userId, table.year, table.month),
]);

// AI Credit transactions table - Log of every credit usage
export const creditTransactions = pgTable("credit_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  operationType: varchar("operation_type").notNull(), // "panel_generation", "background_generation", etc.
  creditsDeducted: integer("credits_deducted").notNull(),
  remainingCredits: integer("remaining_credits").notNull(),
  relatedResourceId: varchar("related_resource_id"), // panel ID, project ID, etc.
  metadata: jsonb("metadata"), // Additional context like panel number, project title, etc.
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCharacterSchema = createInsertSchema(characters).omit({
  id: true,
  createdAt: true,
});

export const insertPageSchema = createInsertSchema(pages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPanelSchema = createInsertSchema(panels).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Structured Scripts insert schemas
export const insertStructuredScriptSchema = createInsertSchema(structuredScripts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScriptPageSchema = createInsertSchema(scriptPages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScriptPanelSchema = createInsertSchema(scriptPanels).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScriptDialogueSchema = createInsertSchema(scriptDialogue).omit({
  id: true,
  createdAt: true,
});

// Social feature insert schemas
export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProjectLikeSchema = createInsertSchema(projectLikes).omit({
  id: true,
  createdAt: true,
});

export const insertProjectCommentSchema = createInsertSchema(projectComments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserFollowSchema = createInsertSchema(userFollows).omit({
  id: true,
  createdAt: true,
});

// Redress job tables for AI-powered clothing changes
export const redressJobs = pgTable("redress_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  panelId: varchar("panel_id").notNull().references(() => panels.id),
  status: varchar("status").notNull().default("queued"), // queued, processing, completed, failed
  originalImageUrl: varchar("original_image_url").notNull(),
  previewImageUrl: varchar("preview_image_url"),
  finalImageUrl: varchar("final_image_url"),
  characterIds: jsonb("character_ids").notNull(), // Array of character IDs being edited
  outfitSpecs: jsonb("outfit_specs").notNull(), // Outfit specification object
  isPreview: boolean("is_preview").default(false), // Whether this is a preview mode job
  strength: integer("strength").default(75), // Inpainting strength 0-100
  progress: integer("progress").default(0), // Progress percentage 0-100
  errorMessage: text("error_message"),
  processingSteps: jsonb("processing_steps"), // Array of processing step statuses
  metadata: jsonb("metadata"), // Additional job metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// AI Credits insert schemas
export const insertUserCreditsSchema = createInsertSchema(userCredits).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCreditTransactionSchema = createInsertSchema(creditTransactions).omit({
  id: true,
  createdAt: true,
});

// Redress job schemas
export const insertRedressJobSchema = createInsertSchema(redressJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Redress request/response schemas
export const redressRequestSchema = z.object({
  characters: z.array(z.object({
    characterId: z.string(),
    referenceImageUrl: z.string().optional(),
    targetRegion: z.enum(["upper_clothes", "lower_clothes", "dress", "shoes", "hat", "accessories"]).optional(),
  })).min(1),
  outfit: z.object({
    type: z.enum([
      // Basic clothing types
      "shirt", "dress", "pants", "skirt", "jacket", "coat", "shoes", "hat", "accessories",
      // Outfit categories for better UX
      "casual_wear", "business_suit", "evening_wear", "athletic_wear", "fantasy_clothing",
      "vintage_clothing", "futuristic_clothing", "traditional_clothing", "uniform",
      // Extended variety for comics
      "swimwear", "sleepwear", "cosplay", "seasonal_wear", "party_outfit",
      // Mature content (properly gated)
      "lingerie", "fetish_wear", "revealing_outfit"
    ]),
    style: z.string(), // e.g. "casual", "formal", "vintage", etc.
    colors: z.array(z.string()).optional(), // Array of color names or hex codes
    description: z.string().optional(), // Additional description of the outfit
    pattern: z.enum(["solid", "stripes", "polka_dots", "plaid", "floral", "geometric", "abstract", "character_themed"]).optional(),
    fabric: z.enum(["cotton", "denim", "silk", "leather", "wool", "synthetic", "latex", "lace", "metallic"]).optional(),
    formality: z.number().min(0).max(100).optional(), // 0=very casual, 100=very formal
    modesty: z.number().min(0).max(100).optional(), // 0=revealing, 100=conservative
  }),
  preview: z.boolean().default(false), // Preview mode: fast, lower quality
  strength: z.number().min(0).max(100).default(75), // Inpainting strength
});

export const redressResponseSchema = z.object({
  jobId: z.string(),
  status: z.enum(["queued", "processing", "completed", "failed"]),
  progress: z.number().min(0).max(100).optional(),
  previewUrl: z.string().optional(),
  finalUrl: z.string().optional(),
  errorMessage: z.string().optional(),
  processingSteps: z.array(z.object({
    step: z.string(),
    status: z.enum(["pending", "processing", "completed", "failed"]),
    message: z.string().optional(),
  })).optional(),
  estimatedTimeRemaining: z.number().optional(), // seconds
  metadata: z.record(z.any()).optional(),
});

export const redressJobStatusSchema = z.object({
  jobId: z.string(),
  status: z.enum(["queued", "processing", "completed", "failed"]),
  progress: z.number().min(0).max(100),
  originalImageUrl: z.string(),
  previewImageUrl: z.string().optional(),
  finalImageUrl: z.string().optional(),
  characterIds: z.array(z.string()),
  outfitSpecs: z.record(z.any()),
  isPreview: z.boolean(),
  strength: z.number().min(0).max(100),
  errorMessage: z.string().optional(),
  processingSteps: z.array(z.object({
    step: z.string(),
    status: z.enum(["pending", "processing", "completed", "failed"]),
    message: z.string().optional(),
  })).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Types
export type UpsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertCharacter = z.infer<typeof insertCharacterSchema>;
export type Character = typeof characters.$inferSelect;
export type InsertPage = z.infer<typeof insertPageSchema>;
export type Page = typeof pages.$inferSelect;
export type InsertPanel = z.infer<typeof insertPanelSchema>;
export type Panel = typeof panels.$inferSelect;

// Structured Script types
export type StructuredScript = typeof structuredScripts.$inferSelect;
export type InsertStructuredScript = z.infer<typeof insertStructuredScriptSchema>;
export type ScriptPage = typeof scriptPages.$inferSelect;
export type InsertScriptPage = z.infer<typeof insertScriptPageSchema>;
export type ScriptPanel = typeof scriptPanels.$inferSelect;
export type InsertScriptPanel = z.infer<typeof insertScriptPanelSchema>;
export type ScriptDialogue = typeof scriptDialogue.$inferSelect;
export type InsertScriptDialogue = z.infer<typeof insertScriptDialogueSchema>;

// Social feature types
export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type ProjectLike = typeof projectLikes.$inferSelect;
export type InsertProjectLike = z.infer<typeof insertProjectLikeSchema>;
export type ProjectComment = typeof projectComments.$inferSelect;
export type InsertProjectComment = z.infer<typeof insertProjectCommentSchema>;
export type UserFollow = typeof userFollows.$inferSelect;
export type InsertUserFollow = z.infer<typeof insertUserFollowSchema>;

// AI Credits types
export type UserCredits = typeof userCredits.$inferSelect;
export type InsertUserCredits = z.infer<typeof insertUserCreditsSchema>;
export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type InsertCreditTransaction = z.infer<typeof insertCreditTransactionSchema>;



// Composite types for working with structured scripts
export interface FullStructuredScript extends StructuredScript {
  pages: Array<ScriptPageWithPanels>;
}

export interface ScriptPageWithPanels extends ScriptPage {
  panels: Array<ScriptPanelWithDialogue>;
}

export interface ScriptPanelWithDialogue extends ScriptPanel {
  dialogue: Array<ScriptDialogue>;
}

// Redress job types
export type RedressJob = typeof redressJobs.$inferSelect;
export type InsertRedressJob = z.infer<typeof insertRedressJobSchema>;
export type RedressRequest = z.infer<typeof redressRequestSchema>;
export type RedressResponse = z.infer<typeof redressResponseSchema>;
export type RedressJobStatus = z.infer<typeof redressJobStatusSchema>;
