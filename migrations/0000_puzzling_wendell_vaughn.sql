CREATE TYPE "public"."panel_video_request_priority" AS ENUM('low', 'normal', 'high');--> statement-breakpoint
CREATE TYPE "public"."panel_video_request_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."panel_video_version_status" AS ENUM('draft', 'review', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."scene_video_sequence_status" AS ENUM('draft', 'assembling', 'rendering', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "character_appearance_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" varchar NOT NULL,
	"height" varchar,
	"build" varchar,
	"body_type" varchar,
	"posture" varchar,
	"face_shape" varchar,
	"eye_color" varchar,
	"eye_shape" varchar,
	"eyebrow_shape" varchar,
	"nose_shape" varchar,
	"lip_shape" varchar,
	"jawline" varchar,
	"hair_color" varchar,
	"hair_texture" varchar,
	"hair_length" varchar,
	"hair_style" varchar,
	"facial_hair" varchar,
	"skin_tone" varchar,
	"skin_texture" varchar,
	"scars_markings" text,
	"tattoos" text,
	"piercings" text,
	"glasses" varchar,
	"walking_style" varchar,
	"gesture_style" varchar,
	"expressions" text,
	"voice_description" varchar,
	"speech_pattern" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "character_clothing_states" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" varchar NOT NULL,
	"state_name" varchar NOT NULL,
	"is_default" boolean DEFAULT false,
	"headwear" varchar,
	"upper_body" text NOT NULL,
	"lower_body" text NOT NULL,
	"footwear" varchar NOT NULL,
	"outerwear" varchar,
	"jewelry" text,
	"bags" varchar,
	"weapons" text,
	"gadgets" text,
	"primary_colors" text[],
	"color_scheme" varchar,
	"style_description" text,
	"fitting_notes" text,
	"appropriate_scenes" text[],
	"weather_suitability" text[],
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "character_consistency_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" varchar NOT NULL,
	"rule_type" varchar NOT NULL,
	"priority" integer DEFAULT 1,
	"rule_name" varchar NOT NULL,
	"rule_description" text NOT NULL,
	"enforcement" varchar DEFAULT 'strict',
	"applies_when" text[],
	"exceptions_when" text[],
	"must_include" text[],
	"must_not_include" text[],
	"preferred_attributes" text[],
	"positive_prompt_keywords" text[],
	"negative_prompt_keywords" text[],
	"is_active" boolean DEFAULT true,
	"violation_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "character_consistency_violations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" varchar NOT NULL,
	"character_id" varchar NOT NULL,
	"character_name" varchar NOT NULL,
	"rule_id" varchar,
	"violation_type" varchar NOT NULL,
	"panel_ids" text[],
	"page_number" integer,
	"panel_number" integer,
	"description" text NOT NULL,
	"expected_value" text,
	"actual_value" text,
	"severity" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "characters" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar,
	"user_id" varchar,
	"name" varchar NOT NULL,
	"role" varchar,
	"bio" text,
	"visual_descriptors" text,
	"always_traits" text,
	"never_traits" text,
	"reference_image_url" varchar,
	"color_scheme" varchar,
	"is_library_character" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "credit_transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"operation_type" varchar NOT NULL,
	"credits_deducted" integer NOT NULL,
	"remaining_credits" integer NOT NULL,
	"related_resource_id" varchar,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"page_number" integer NOT NULL,
	"layout_template" varchar NOT NULL,
	"background_image_url" varchar,
	"panels" jsonb,
	"script_snippet" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "panel_character_states" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"panel_id" varchar NOT NULL,
	"character_id" varchar NOT NULL,
	"clothing_state_id" varchar,
	"is_present" boolean DEFAULT true,
	"confidence_score" integer,
	"detected_upper_body" varchar,
	"detected_lower_body" varchar,
	"detected_outerwear" varchar,
	"detected_clothing_colors" text[],
	"detected_clothing_style" varchar,
	"detected_clothing_accessories" text[],
	"detected_hair_color" varchar,
	"detected_hair_style" varchar,
	"detected_hair_length" varchar,
	"detected_hair_texture" varchar,
	"detected_skin_tone" varchar,
	"detected_eye_color" varchar,
	"detected_jewelry" text[],
	"detected_glasses" boolean DEFAULT false,
	"detected_hat" varchar,
	"detected_other_accessories" text[],
	"emotion" varchar,
	"facial_expression" varchar,
	"body_language" varchar,
	"position" varchar,
	"pose" text,
	"detected_pose" text,
	"facing_direction" varchar,
	"visibility" varchar,
	"screen_position" varchar,
	"detected_screen_position" varchar,
	"detected_interaction" text,
	"lighting_condition" varchar,
	"visual_effects" text[],
	"temporary_changes" text[],
	"injuries_visible" text[],
	"interacting_with" text[],
	"proximity_to_others" varchar,
	"generation_prompt" text,
	"consistency_notes" text,
	"visual_analysis_performed" boolean DEFAULT false,
	"visual_analysis_timestamp" timestamp,
	"visual_analysis_raw_data" jsonb,
	"consistency_violations" text[],
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "panel_video_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"panel_id" varchar NOT NULL,
	"requested_by_user_id" varchar NOT NULL,
	"request_prompt" text NOT NULL,
	"negative_prompt" text,
	"style_preset" varchar,
	"motion_style" varchar,
	"duration_seconds" integer,
	"frame_rate" integer,
	"aspect_ratio" varchar,
	"resolution" varchar,
	"status" "panel_video_request_status" DEFAULT 'pending' NOT NULL,
	"priority" "panel_video_request_priority" DEFAULT 'normal' NOT NULL,
	"failure_reason" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "panel_video_versions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" varchar NOT NULL,
	"created_by_user_id" varchar,
	"version_number" integer DEFAULT 1 NOT NULL,
	"video_url" varchar,
	"preview_image_url" varchar,
	"duration_seconds" integer,
	"resolution" varchar,
	"frame_rate" integer,
	"status" "panel_video_version_status" DEFAULT 'draft' NOT NULL,
	"rejection_reason" text,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "panels" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" varchar NOT NULL,
	"panel_number" integer NOT NULL,
	"global_panel_number" integer,
	"prompt" text,
	"image_url" varchar,
	"speech_bubbles" jsonb,
	"is_generated" boolean DEFAULT false,
	"generation_status" varchar DEFAULT 'pending',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_comments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"comment" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_likes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"genre" varchar,
	"user_selected_genres" jsonb,
	"art_style" varchar,
	"script" text,
	"settings" jsonb,
	"canon_rules" text,
	"cover_art" varchar,
	"is_public" boolean DEFAULT false,
	"public_description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "scene_video_sequences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"created_by_user_id" varchar,
	"title" varchar NOT NULL,
	"description" text,
	"cover_image_url" varchar,
	"audio_track_url" varchar,
	"status" "scene_video_sequence_status" DEFAULT 'draft' NOT NULL,
	"total_duration_seconds" integer,
	"sequence_data" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "script_dialogue" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"script_panel_id" varchar NOT NULL,
	"character" varchar NOT NULL,
	"text" text NOT NULL,
	"tone" varchar,
	"bubble_type" varchar DEFAULT 'speech',
	"emotional_state" varchar,
	"order_index" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "script_pages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"structured_script_id" varchar NOT NULL,
	"page_number" integer NOT NULL,
	"title" varchar,
	"setting" text NOT NULL,
	"mood" varchar,
	"time_of_day" varchar,
	"location" varchar,
	"weather_conditions" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "script_panels" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"script_page_id" varchar NOT NULL,
	"panel_number" integer NOT NULL,
	"action" text NOT NULL,
	"scene_description" text NOT NULL,
	"visual_notes" text,
	"characters" text[],
	"mood" varchar,
	"location_specifics" text,
	"interior_exterior" varchar,
	"room_type" varchar,
	"architectural_style" varchar,
	"set_dressing" text[],
	"props" text[],
	"background_elements" text[],
	"atmosphere" varchar,
	"environmental_soundscape" text[],
	"primary_light_source" varchar,
	"time_of_day" varchar,
	"lighting_mood" varchar,
	"light_direction" varchar,
	"shadow_intensity" varchar,
	"color_temperature" varchar,
	"lighting_effects" text[],
	"practical_lights" text[],
	"weather_condition" varchar,
	"precipitation" varchar,
	"wind_condition" varchar,
	"temperature" varchar,
	"humidity" varchar,
	"visibility" varchar,
	"atmospheric_effects" text[],
	"seasonal_context" varchar,
	"camera_angle" varchar,
	"shot_type" varchar,
	"camera_movement" varchar,
	"frame_composition" varchar,
	"depth_of_field" varchar,
	"focus_point" varchar,
	"perspective_type" varchar,
	"visual_style" varchar,
	"color_grading" varchar,
	"character_positions" jsonb,
	"proxemics" varchar,
	"spatial_relationships" text[],
	"physical_interactions" text[],
	"character_focus" varchar,
	"eyeline_directions" text[],
	"gesture_descriptions" text[],
	"pacing" varchar,
	"timing" varchar,
	"transition_type" varchar,
	"panel_borders" varchar,
	"visual_effects" text[],
	"special_effects" text[],
	"stylized_elements" text[],
	"sound_effects" text[],
	"detailed_sound_effects" jsonb,
	"ambient_sounds" text[],
	"music_cues" varchar,
	"voice_over_text" text,
	"voice_over_character" varchar,
	"dialogue_placement" varchar,
	"silence_emphasis" boolean DEFAULT false,
	"sound_perspective" varchar,
	"generation_prompt" text,
	"negative_prompt" text,
	"prompt_weight" jsonb,
	"consistency_notes" text,
	"reference_images" text[],
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "script_validation_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"structured_script_id" varchar,
	"validation_type" varchar NOT NULL,
	"overall_score" integer NOT NULL,
	"status" varchar DEFAULT 'completed',
	"validation_results" jsonb NOT NULL,
	"recommendations_count" integer DEFAULT 0,
	"critical_issues_count" integer DEFAULT 0,
	"warning_issues_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "structured_scripts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"title" varchar NOT NULL,
	"logline" text,
	"version" integer DEFAULT 1,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_credits" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"credits_used" integer DEFAULT 0 NOT NULL,
	"monthly_limit" integer DEFAULT 200 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_follows" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"follower_id" varchar NOT NULL,
	"following_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"bio" text,
	"banner_image_url" varchar,
	"location" varchar,
	"website" varchar,
	"social_links" jsonb,
	"is_public_profile" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "validation_issues" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" varchar NOT NULL,
	"issue_type" varchar NOT NULL,
	"severity" varchar NOT NULL,
	"category" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text NOT NULL,
	"suggestion" text,
	"affected_elements" jsonb,
	"confidence" integer DEFAULT 100,
	"is_resolved" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "character_appearance_profiles" ADD CONSTRAINT "character_appearance_profiles_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_clothing_states" ADD CONSTRAINT "character_clothing_states_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_consistency_rules" ADD CONSTRAINT "character_consistency_rules_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_consistency_violations" ADD CONSTRAINT "character_consistency_violations_report_id_script_validation_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."script_validation_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_consistency_violations" ADD CONSTRAINT "character_consistency_violations_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_consistency_violations" ADD CONSTRAINT "character_consistency_violations_rule_id_character_consistency_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."character_consistency_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "panel_character_states" ADD CONSTRAINT "panel_character_states_panel_id_panels_id_fk" FOREIGN KEY ("panel_id") REFERENCES "public"."panels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "panel_character_states" ADD CONSTRAINT "panel_character_states_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "panel_character_states" ADD CONSTRAINT "panel_character_states_clothing_state_id_character_clothing_states_id_fk" FOREIGN KEY ("clothing_state_id") REFERENCES "public"."character_clothing_states"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "panel_video_requests" ADD CONSTRAINT "panel_video_requests_panel_id_panels_id_fk" FOREIGN KEY ("panel_id") REFERENCES "public"."panels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "panel_video_requests" ADD CONSTRAINT "panel_video_requests_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "panel_video_versions" ADD CONSTRAINT "panel_video_versions_request_id_panel_video_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."panel_video_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "panel_video_versions" ADD CONSTRAINT "panel_video_versions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "panels" ADD CONSTRAINT "panels_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_comments" ADD CONSTRAINT "project_comments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_comments" ADD CONSTRAINT "project_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_likes" ADD CONSTRAINT "project_likes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_likes" ADD CONSTRAINT "project_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_video_sequences" ADD CONSTRAINT "scene_video_sequences_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_video_sequences" ADD CONSTRAINT "scene_video_sequences_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_dialogue" ADD CONSTRAINT "script_dialogue_script_panel_id_script_panels_id_fk" FOREIGN KEY ("script_panel_id") REFERENCES "public"."script_panels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_pages" ADD CONSTRAINT "script_pages_structured_script_id_structured_scripts_id_fk" FOREIGN KEY ("structured_script_id") REFERENCES "public"."structured_scripts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_panels" ADD CONSTRAINT "script_panels_script_page_id_script_pages_id_fk" FOREIGN KEY ("script_page_id") REFERENCES "public"."script_pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_validation_reports" ADD CONSTRAINT "script_validation_reports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_validation_reports" ADD CONSTRAINT "script_validation_reports_structured_script_id_structured_scripts_id_fk" FOREIGN KEY ("structured_script_id") REFERENCES "public"."structured_scripts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "structured_scripts" ADD CONSTRAINT "structured_scripts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_credits" ADD CONSTRAINT "user_credits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_following_id_users_id_fk" FOREIGN KEY ("following_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_issues" ADD CONSTRAINT "validation_issues_report_id_script_validation_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."script_validation_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "unique_panel_character" ON "panel_character_states" USING btree ("panel_id","character_id");--> statement-breakpoint
CREATE INDEX "idx_panel_video_requests_panel" ON "panel_video_requests" USING btree ("panel_id");--> statement-breakpoint
CREATE INDEX "idx_panel_video_requests_requester" ON "panel_video_requests" USING btree ("requested_by_user_id");--> statement-breakpoint
CREATE INDEX "idx_panel_video_requests_status" ON "panel_video_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_panel_video_versions_request" ON "panel_video_versions" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "idx_panel_video_versions_status" ON "panel_video_versions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_panels_global_number" ON "panels" USING btree ("global_panel_number");--> statement-breakpoint
CREATE INDEX "idx_panels_page_global_number" ON "panels" USING btree ("page_id","global_panel_number");--> statement-breakpoint
CREATE INDEX "unique_project_like" ON "project_likes" USING btree ("project_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_scene_video_sequences_project" ON "scene_video_sequences" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_scene_video_sequences_creator" ON "scene_video_sequences" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "idx_scene_video_sequences_status" ON "scene_video_sequences" USING btree ("status");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "unique_user_month" ON "user_credits" USING btree ("user_id","year","month");--> statement-breakpoint
CREATE INDEX "unique_user_follow" ON "user_follows" USING btree ("follower_id","following_id");