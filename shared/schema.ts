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
  isLibraryCharacter: boolean("is_library_character").default(false), // true for library characters
  createdAt: timestamp("created_at").defaultNow(),
});

// Character Appearance Profiles - Detailed physical descriptions for consistency
export const characterAppearanceProfiles = pgTable("character_appearance_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: varchar("character_id").notNull().references(() => characters.id),
  
  // Physical Build & Structure
  height: varchar("height"), // "tall", "average", "short", "6'2"", etc.
  build: varchar("build"), // "slim", "athletic", "muscular", "heavyset", "petite", etc.
  bodyType: varchar("body_type"), // "lean", "curvy", "stocky", "lanky", etc.
  posture: varchar("posture"), // "upright", "slouched", "confident", "timid", etc.
  
  // Facial Features
  faceShape: varchar("face_shape"), // "oval", "round", "square", "heart", "diamond", etc.
  eyeColor: varchar("eye_color"), // "blue", "brown", "green", "hazel", "gray", etc.
  eyeShape: varchar("eye_shape"), // "almond", "round", "narrow", "wide-set", etc.
  eyebrowShape: varchar("eyebrow_shape"), // "thick", "thin", "arched", "straight", etc.
  noseShape: varchar("nose_shape"), // "straight", "button", "aquiline", "wide", etc.
  lipShape: varchar("lip_shape"), // "full", "thin", "bow-shaped", "wide", etc.
  jawline: varchar("jawline"), // "strong", "soft", "angular", "rounded", etc.
  
  // Hair Description
  hairColor: varchar("hair_color"), // "blonde", "brown", "black", "red", "gray", "white", etc.
  hairTexture: varchar("hair_texture"), // "straight", "wavy", "curly", "coarse", "fine", etc.
  hairLength: varchar("hair_length"), // "short", "medium", "long", "shoulder-length", etc.
  hairStyle: varchar("hair_style"), // "bob", "ponytail", "braided", "messy", "slicked", etc.
  facialHair: varchar("facial_hair"), // "clean-shaven", "beard", "mustache", "goatee", "stubble", etc.
  
  // Skin & Complexion
  skinTone: varchar("skin_tone"), // "pale", "fair", "olive", "tan", "dark", etc.
  skinTexture: varchar("skin_texture"), // "smooth", "freckled", "scarred", "weathered", etc.
  
  // Distinctive Features
  scarsMarkings: text("scars_markings"), // "scar on left cheek", "birthmark on forehead", etc.
  tattoos: text("tattoos"), // "dragon tattoo on arm", "small star on wrist", etc.
  piercings: text("piercings"), // "ear piercings", "nose ring", etc.
  glasses: varchar("glasses"), // "none", "wire-frame", "thick-rim", "sunglasses", etc.
  
  // Movement & Mannerisms
  walkingStyle: varchar("walking_style"), // "confident stride", "quick steps", "slow shuffle", etc.
  gestureStyle: varchar("gesture_style"), // "animated", "restrained", "fidgety", "graceful", etc.
  expressions: text("expressions"), // "often smiles", "serious demeanor", "expressive eyes", etc.
  
  // Voice & Speech (for reference)
  voiceDescription: varchar("voice_description"), // "deep", "high-pitched", "raspy", "melodic", etc.
  speechPattern: varchar("speech_pattern"), // "fast talker", "measured words", "stutters", etc.
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Character Clothing States - Track different outfits and accessories
export const characterClothingStates = pgTable("character_clothing_states", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: varchar("character_id").notNull().references(() => characters.id),
  stateName: varchar("state_name").notNull(), // "default", "formal", "casual", "work", "battle", etc.
  isDefault: boolean("is_default").default(false),
  
  // Clothing Items
  headwear: varchar("headwear"), // "baseball cap", "beanie", "crown", "none", etc.
  upperBody: text("upper_body").notNull(), // "red t-shirt", "business suit jacket", "armor", etc.
  lowerBody: text("lower_body").notNull(), // "blue jeans", "black pants", "skirt", etc.
  footwear: varchar("footwear").notNull(), // "sneakers", "boots", "sandals", "heels", etc.
  outerwear: varchar("outerwear"), // "leather jacket", "coat", "cloak", "none", etc.
  
  // Accessories
  jewelry: text("jewelry"), // "gold watch", "wedding ring", "necklace", etc.
  bags: varchar("bags"), // "backpack", "purse", "messenger bag", "none", etc.
  weapons: text("weapons"), // "sword", "gun", "staff", "none", etc.
  gadgets: text("gadgets"), // "smartphone", "tablet", "tools", etc.
  
  // Color Coordination
  primaryColors: text("primary_colors").array(), // ["red", "blue", "black"]
  colorScheme: varchar("color_scheme"), // "monochrome", "complementary", "analogous", etc.
  
  // Style Notes
  styleDescription: text("style_description"), // "professional", "casual", "punk", "elegant", etc.
  fittingNotes: text("fitting_notes"), // "loose-fitting", "form-fitting", "oversized", etc.
  
  // Context Usage
  appropriateScenes: text("appropriate_scenes").array(), // ["office", "home", "battle", "formal_event"]
  weatherSuitability: text("weather_suitability").array(), // ["warm", "cold", "rain", "snow"]
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Panel Character States - Track how characters appear in specific panels
export const panelCharacterStates = pgTable("panel_character_states", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  panelId: varchar("panel_id").notNull().references(() => panels.id),
  characterId: varchar("character_id").notNull().references(() => characters.id),
  clothingStateId: varchar("clothing_state_id").references(() => characterClothingStates.id),
  
  // Panel-specific appearance
  emotion: varchar("emotion"), // "happy", "angry", "sad", "surprised", "neutral", etc.
  facialExpression: varchar("facial_expression"), // "smiling", "frowning", "shocked", "focused", etc.
  bodyLanguage: varchar("body_language"), // "relaxed", "tense", "confident", "defensive", etc.
  
  // Positioning & Pose
  position: varchar("position"), // "standing", "sitting", "lying", "crouched", etc.
  pose: text("pose"), // "arms crossed", "pointing", "running", "thinking pose", etc.
  facingDirection: varchar("facing_direction"), // "front", "back", "left_profile", "right_profile", "three_quarter", etc.
  
  // Visibility & Framing
  visibility: varchar("visibility"), // "full_body", "torso", "head_shot", "silhouette", "partially_hidden", etc.
  screenPosition: varchar("screen_position"), // "center", "left", "right", "background", "foreground", etc.
  
  // Lighting & Effects
  lightingCondition: varchar("lighting_condition"), // "bright", "dim", "backlit", "dramatic_shadow", etc.
  visualEffects: text("visual_effects").array(), // ["motion_blur", "glow", "sparkles", "dust_cloud"]
  
  // Injuries or Temporary Changes
  temporaryChanges: text("temporary_changes").array(), // ["dirty_clothes", "bandaged_arm", "wet_hair", "tired_eyes"]
  injuriesVisible: text("injuries_visible").array(), // ["bruise_on_face", "cut_on_hand", "black_eye"]
  
  // Interaction Context
  interactingWith: text("interacting_with").array(), // Character IDs or object names they're interacting with
  proximityToOthers: varchar("proximity_to_others"), // "alone", "close", "distant", "crowded", etc.
  
  // Panel Generation Notes
  generationPrompt: text("generation_prompt"), // The actual prompt used for AI generation
  consistencyNotes: text("consistency_notes"), // Notes about maintaining consistency with previous panels
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Ensure unique character per panel
  index("unique_panel_character").on(table.panelId, table.characterId),
]);

// Character Consistency Rules - Define constraints and guidelines for character appearance
export const characterConsistencyRules = pgTable("character_consistency_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: varchar("character_id").notNull().references(() => characters.id),
  
  // Rule Categories
  ruleType: varchar("rule_type").notNull(), // "appearance", "behavior", "clothing", "expression", etc.
  priority: integer("priority").default(1), // 1=highest, 5=lowest priority
  
  // Rule Definition
  ruleName: varchar("rule_name").notNull(), // "Always wears glasses", "Never shows full face", etc.
  ruleDescription: text("rule_description").notNull(), // Detailed description of the rule
  
  // Enforcement Level
  enforcement: varchar("enforcement").default("strict"), // "strict", "flexible", "guideline"
  
  // Contextual Rules
  appliesWhen: text("applies_when").array(), // ["in_formal_scenes", "during_combat", "at_home"]
  exceptionsWhen: text("exceptions_when").array(), // ["sleeping", "swimming", "disguised"]
  
  // Visual Constraints
  mustInclude: text("must_include").array(), // ["glasses", "scar", "blue_eyes"]
  mustNotInclude: text("must_not_include").array(), // ["hat", "jewelry", "beard"]
  preferredAttributes: text("preferred_attributes").array(), // ["confident_posture", "slight_smile"]
  
  // Generation Guidance
  positivePromptKeywords: text("positive_prompt_keywords").array(), // Keywords to include in AI prompts
  negativePromptKeywords: text("negative_prompt_keywords").array(), // Keywords to exclude from AI prompts
  
  // Rule Status
  isActive: boolean("is_active").default(true),
  violationCount: integer("violation_count").default(0), // Track how often this rule is broken
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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

// Character Consistency insert schemas
export const insertCharacterAppearanceProfileSchema = createInsertSchema(characterAppearanceProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCharacterClothingStateSchema = createInsertSchema(characterClothingStates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPanelCharacterStateSchema = createInsertSchema(panelCharacterStates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCharacterConsistencyRuleSchema = createInsertSchema(characterConsistencyRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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

// Schema for creating characters from script
export const insertCharacterFromScriptSchema = z.object({
  names: z.array(z.string().min(1)).min(1),
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

// Character Consistency types
export type CharacterAppearanceProfile = typeof characterAppearanceProfiles.$inferSelect;
export type InsertCharacterAppearanceProfile = z.infer<typeof insertCharacterAppearanceProfileSchema>;
export type CharacterClothingState = typeof characterClothingStates.$inferSelect;
export type InsertCharacterClothingState = z.infer<typeof insertCharacterClothingStateSchema>;
export type PanelCharacterState = typeof panelCharacterStates.$inferSelect;
export type InsertPanelCharacterState = z.infer<typeof insertPanelCharacterStateSchema>;
export type CharacterConsistencyRule = typeof characterConsistencyRules.$inferSelect;
export type InsertCharacterConsistencyRule = z.infer<typeof insertCharacterConsistencyRuleSchema>;

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

// Composite types for character consistency tracking
export interface CharacterWithAppearance extends Character {
  appearanceProfile?: CharacterAppearanceProfile;
  clothingStates: Array<CharacterClothingState>;
  consistencyRules: Array<CharacterConsistencyRule>;
}

export interface CharacterClothingStateWithRules extends CharacterClothingState {
  consistencyRules: Array<CharacterConsistencyRule>;
}

export interface PanelWithCharacterStates extends Panel {
  characterStates: Array<PanelCharacterStateWithDetails>;
}

export interface PanelCharacterStateWithDetails extends PanelCharacterState {
  character: Character;
  characterAppearance?: CharacterAppearanceProfile;
  clothingState?: CharacterClothingState;
  applicableRules: Array<CharacterConsistencyRule>;
}

export interface FullCharacterProfile extends Character {
  appearanceProfile?: CharacterAppearanceProfile;
  clothingStates: Array<CharacterClothingState>;
  consistencyRules: Array<CharacterConsistencyRule>;
  panelStates: Array<PanelCharacterStateWithDetails>;
}
