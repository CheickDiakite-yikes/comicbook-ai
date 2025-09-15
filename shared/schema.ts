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

// Script Panels table - Movie-level detailed panel data
export const scriptPanels = pgTable("script_panels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scriptPageId: varchar("script_page_id").notNull().references(() => scriptPages.id),
  panelNumber: integer("panel_number").notNull(),
  
  // Core Panel Information
  action: text("action").notNull(), // What happens in this panel
  sceneDescription: text("scene_description").notNull(), // Visual description for AI
  visualNotes: text("visual_notes"), // Art direction notes
  characters: text("characters").array(), // Character names present in panel
  mood: varchar("mood"), // panel-specific mood
  
  // ENVIRONMENTAL DETAILS
  // Location & Set Details
  locationSpecifics: text("location_specifics"), // "bustling downtown street corner", "cozy living room with fireplace"
  interiorExterior: varchar("interior_exterior"), // "interior", "exterior", "mixed"
  roomType: varchar("room_type"), // "bedroom", "office", "kitchen", "vehicle", "outdoor_space"
  architecturalStyle: varchar("architectural_style"), // "modern", "victorian", "industrial", "futuristic"
  setDressing: text("set_dressing").array(), // ["family photos on mantle", "scattered books", "vintage lamp"]
  props: text("props").array(), // ["laptop computer", "coffee mug", "car keys", "smartphone"]
  backgroundElements: text("background_elements").array(), // ["city skyline", "mountains", "busy crowd"]
  atmosphere: varchar("atmosphere"), // "tense", "peaceful", "chaotic", "mysterious", "romantic"
  environmentalSoundscape: text("environmental_soundscape").array(), // ["traffic noise", "birds chirping", "air conditioning hum"]
  
  // LIGHTING CONDITIONS
  primaryLightSource: varchar("primary_light_source"), // "natural_sunlight", "artificial_indoor", "candlelight", "moonlight"
  timeOfDay: varchar("time_of_day"), // "dawn", "morning", "midday", "afternoon", "dusk", "night", "midnight"
  lightingMood: varchar("lighting_mood"), // "bright_cheerful", "dim_moody", "dramatic_contrast", "soft_romantic"
  lightDirection: varchar("light_direction"), // "front_lit", "back_lit", "side_lit", "top_lit", "under_lit"
  shadowIntensity: varchar("shadow_intensity"), // "no_shadows", "soft_shadows", "medium_shadows", "hard_dramatic_shadows"
  colorTemperature: varchar("color_temperature"), // "warm_golden", "cool_blue", "neutral_white", "mixed_sources"
  lightingEffects: text("lighting_effects").array(), // ["god_rays", "lens_flare", "volumetric_fog", "rim_lighting"]
  practicalLights: text("practical_lights").array(), // ["table_lamp", "neon_signs", "candles", "phone_screen"]
  
  // WEATHER & ATMOSPHERIC CONDITIONS
  weatherCondition: varchar("weather_condition"), // "clear", "cloudy", "rainy", "stormy", "snowy", "foggy"
  precipitation: varchar("precipitation"), // "none", "light_rain", "heavy_rain", "drizzle", "snow", "hail"
  windCondition: varchar("wind_condition"), // "still", "light_breeze", "moderate_wind", "strong_wind", "gale"
  temperature: varchar("temperature"), // "freezing", "cold", "cool", "mild", "warm", "hot", "sweltering"
  humidity: varchar("humidity"), // "dry", "normal", "humid", "muggy"
  visibility: varchar("visibility"), // "crystal_clear", "hazy", "foggy", "very_poor"
  atmosphericEffects: text("atmospheric_effects").array(), // ["mist", "dust_particles", "steam", "smoke"]
  seasonalContext: varchar("seasonal_context"), // "spring", "summer", "autumn", "winter"
  
  // CAMERA SPECIFICATIONS & CINEMATOGRAPHY
  cameraAngle: varchar("camera_angle"), // "eye_level", "high_angle", "low_angle", "bird's_eye", "worm's_eye"
  shotType: varchar("shot_type"), // "establishing", "wide", "medium", "close_up", "extreme_close_up", "over_shoulder"
  cameraMovement: varchar("camera_movement"), // "static", "pan", "tilt", "zoom_in", "zoom_out", "dolly", "tracking"
  frameComposition: varchar("frame_composition"), // "centered", "rule_of_thirds", "off_center", "symmetric", "dynamic"
  depthOfField: varchar("depth_of_field"), // "shallow", "medium", "deep", "everything_in_focus"
  focusPoint: varchar("focus_point"), // "foreground", "middle_ground", "background", "character_face", "object"
  perspectiveType: varchar("perspective_type"), // "single_point", "two_point", "three_point", "atmospheric"
  visualStyle: varchar("visual_style"), // "realistic", "stylized", "noir", "comic_book", "cinematic"
  colorGrading: varchar("color_grading"), // "natural", "warm_tones", "cool_tones", "high_contrast", "desaturated"
  
  // CHARACTER POSITIONING & INTERACTIONS
  characterPositions: jsonb("character_positions"), // JSON object with character spatial relationships
  proxemics: varchar("proxemics"), // "intimate", "personal", "social", "public" (distance between characters)
  spatialRelationships: text("spatial_relationships").array(), // ["John_left_of_Mary", "Sarah_behind_desk", "crowd_surrounds_hero"]
  physicalInteractions: text("physical_interactions").array(), // ["handshake", "pointing_at_object", "looking_towards_door"]
  characterFocus: varchar("character_focus"), // "single_character", "two_characters", "group", "no_characters"
  eyelineDirections: text("eyeline_directions").array(), // ["John_looking_at_Mary", "Sarah_staring_off_panel", "crowd_watching_action"]
  gestureDescriptions: text("gesture_descriptions").array(), // ["raised_eyebrows", "crossed_arms", "open_palms"]
  
  // TECHNICAL DIRECTION
  pacing: varchar("pacing"), // "very_slow", "slow", "moderate", "fast", "very_fast", "frozen_moment"
  timing: varchar("timing"), // "real_time", "slow_motion", "time_lapse", "frozen", "compressed_time"
  transitionType: varchar("transition_type"), // "cut", "fade", "dissolve", "wipe", "match_cut", "jump_cut"
  panelBorders: varchar("panel_borders"), // "standard", "rounded", "irregular", "borderless", "overlapping"
  visualEffects: text("visual_effects").array(), // ["motion_blur", "speed_lines", "impact_lines", "thought_bubbles"]
  specialEffects: text("special_effects").array(), // ["explosions", "magical_aura", "energy_beams", "particle_effects"]
  stylizedElements: text("stylized_elements").array(), // ["halftone_shading", "bold_outlines", "watercolor_background"]
  
  // AUDIO ELEMENTS & SOUND DESIGN
  soundEffects: text("sound_effects").array(), // Traditional SFX array maintained for compatibility
  detailedSoundEffects: jsonb("detailed_sound_effects"), // JSON with volume, duration, source, type
  ambientSounds: text("ambient_sounds").array(), // ["city_traffic", "office_chatter", "nature_sounds"]
  musicCues: varchar("music_cues"), // "dramatic_orchestral", "light_jazz", "no_music", "fade_in", "fade_out"
  voiceOverText: text("voice_over_text"), // Narrator or character voice-over content
  voiceOverCharacter: varchar("voice_over_character"), // Name of character doing voice-over or "narrator"
  dialoguePlacement: varchar("dialogue_placement"), // "top_panel", "bottom_panel", "distributed", "minimal"
  silenceEmphasis: boolean("silence_emphasis").default(false), // Whether silence is a key element
  soundPerspective: varchar("sound_perspective"), // "close_intimate", "distant_muffled", "echo_reverb"
  
  // AI GENERATION METADATA
  generationPrompt: text("generation_prompt"), // Complete AI prompt for this panel
  negativePrompt: text("negative_prompt"), // Things to avoid in generation
  promptWeight: jsonb("prompt_weight"), // JSON with element importance weights
  consistencyNotes: text("consistency_notes"), // Notes for maintaining visual consistency
  referenceImages: text("reference_images").array(), // URLs or paths to reference materials
  
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

// Parallel processing request schemas for validation
export const parallelPanelGenerationSchema = z.object({
  projectId: z.string().uuid("Invalid project ID format"),
  panels: z.array(z.object({
    id: z.string().min(1, "Panel ID required"),
    panelNumber: z.number().int().positive("Panel number must be positive"),
    prompt: z.string().min(1, "Prompt is required"),
    pageId: z.string().uuid("Invalid page ID format").optional(),
    dependencies: z.array(z.string()).optional().default([]),
    priority: z.number().int().min(1).max(10).optional().default(5),
    aspectRatio: z.number().positive().optional(),
    dimensions: z.object({
      width: z.number().positive(),
      height: z.number().positive()
    }).optional(),
    styleOptions: z.object({
      artStyle: z.string().optional(),
      colorPalette: z.array(z.string()).optional(),
      mood: z.string().optional()
    }).optional()
  })).min(1, "At least one panel required").max(50, "Maximum 50 panels allowed per batch"),
  options: z.object({
    maxConcurrency: z.number().int().min(1).max(10).optional().default(3),
    batchSize: z.number().int().min(1).max(20).optional().default(5),
    enableDependencyTracking: z.boolean().optional().default(true),
    enableCharacterConsistency: z.boolean().optional().default(true),
    enableProgressTracking: z.boolean().optional().default(true),
    timeoutMs: z.number().int().min(30000).max(600000).optional().default(300000),
    retryStrategy: z.enum(['exponential', 'linear', 'none']).optional().default('exponential'),
    priorityMode: z.enum(['fifo', 'priority', 'dependency']).optional().default('dependency')
  }).optional().default({})
});

export const parallelPageGenerationSchema = z.object({
  projectId: z.string().uuid("Invalid project ID format"),
  pages: z.array(z.object({
    id: z.string().min(1, "Page ID required"),
    pageNumber: z.number().int().positive("Page number must be positive"),
    script: z.object({
      title: z.string(),
      panels: z.array(z.object({
        panelNumber: z.number().int().positive(),
        prompt: z.string().min(1),
        visualDescription: z.string().optional(),
        dialogue: z.array(z.object({
          characterName: z.string(),
          text: z.string()
        })).optional()
      })).min(1)
    }),
    layout: z.object({
      template: z.string(),
      panelCount: z.number().int().positive()
    }),
    dependencies: z.array(z.string()).optional().default([]),
    priority: z.number().int().min(1).max(10).optional().default(5)
  })).min(1, "At least one page required").max(20, "Maximum 20 pages allowed per batch"),
  options: z.object({
    maxConcurrency: z.number().int().min(1).max(5).optional().default(2),
    batchSize: z.number().int().min(1).max(10).optional().default(3),
    enableDependencyTracking: z.boolean().optional().default(true),
    enableCharacterConsistency: z.boolean().optional().default(true),
    enableProgressTracking: z.boolean().optional().default(true),
    timeoutMs: z.number().int().min(60000).max(1800000).optional().default(900000),
    retryStrategy: z.enum(['exponential', 'linear', 'none']).optional().default('exponential'),
    priorityMode: z.enum(['fifo', 'priority', 'dependency']).optional().default('dependency')
  }).optional().default({})
});

export const parallelBatchGenerationSchema = z.object({
  projectId: z.string().uuid("Invalid project ID format"),
  batches: z.array(z.object({
    type: z.enum(['panels', 'pages', 'backgrounds', 'covers'], {
      errorMap: () => ({ message: "Type must be one of: panels, pages, backgrounds, covers" })
    }),
    items: z.array(z.any()).min(1, "Each batch must have at least one item"),
    batchPriority: z.number().int().min(1).max(10).optional().default(5),
    metadata: z.object({
      description: z.string().optional(),
      tags: z.array(z.string()).optional()
    }).optional()
  })).min(1, "At least one batch required").max(10, "Maximum 10 batches allowed"),
  options: z.object({
    maxConcurrency: z.number().int().min(1).max(8).optional().default(3),
    batchSize: z.number().int().min(1).max(15).optional().default(5),
    enableDependencyTracking: z.boolean().optional().default(true),
    enableCharacterConsistency: z.boolean().optional().default(true),
    enableProgressTracking: z.boolean().optional().default(true),
    timeoutMs: z.number().int().min(120000).max(3600000).optional().default(1800000),
    retryStrategy: z.enum(['exponential', 'linear', 'none']).optional().default('exponential'),
    priorityMode: z.enum(['fifo', 'priority', 'dependency']).optional().default('dependency')
  }).optional().default({})
});

export const parallelSessionStatusSchema = z.object({
  sessionId: z.string().uuid("Invalid session ID format")
});

export const parallelSessionCancelSchema = z.object({
  sessionId: z.string().uuid("Invalid session ID format"),
  reason: z.string().optional()
});

// Parallel processing types
export type ParallelPanelGenerationRequest = z.infer<typeof parallelPanelGenerationSchema>;
export type ParallelPageGenerationRequest = z.infer<typeof parallelPageGenerationSchema>;
export type ParallelBatchGenerationRequest = z.infer<typeof parallelBatchGenerationSchema>;
