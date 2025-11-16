# Panel Animation Studio & Veo 3 Integration Plan

## 1. Executive Summary
We are introducing a "Panel Animation Studio" feature that converts generated comic panels into cohesive animated scenes by orchestrating Google Veo 3 (Gemini) video generations. Each clip must be eight seconds or shorter, yet panels should stitch into continuous sequences with preserved story logic, character consistency, and branded aesthetics. This document outlines research findings about Veo 3, detailed technical architecture, UX considerations, prompt construction strategy, and validation plans so that implementation can move forward confidently.

## 2. Goals & Non-Goals
- **Goals**
  - Provide creators with granular, panel-by-panel control over short animated sequences derived from their comics.
  - Leverage Veo 3's text+image prompting to maintain visual continuity, especially around characters, props, and settings already present in the comic panels.
  - Guarantee transitions between adjacent clips feel intentional (camera positions, blocking, ambiance).
  - Offer brand-aligned UX embedded in the current editor, including preview tooling, status tracking, and failure recovery.
  - Create an extensible backend architecture that can support queued generations, retries, auditing, and future providers.
- **Non-Goals**
  - Building a long-form video renderer/editor today (we focus on stitched clip sequences with simple transitions).
  - Crafting a brand-new asset storage pipeline (we reuse existing storage abstraction and CDN delivery paths).
  - Solving soundtrack generation beyond basic prompt-forwarding to Veo (audio mixing can follow later).

## 3. Research Insights on Veo 3
- **Clip Limits**: Veo 3 generates videos up to 8 seconds at 24/30 fps in 720p or 1080p depending on the `aspectRatio` parameter. Requests exceeding 8 seconds will be rejected, so we enforce duration constraints per panel.
- **Input Modalities**: Supports text-only, text+image (image-to-video) and text+video (continuation). For our use case, text+image is critical—we supply the comic panel as an image reference to anchor scene composition.
- **Prompt Structure**: Veo encourages structured prompts describing subject, camera movement, composition, pacing, and ambiance. JSON payloads are effective for machine-generated consistency, e.g. segmented instructions for characters, setting, motion, audio cues, safety requirements.
- **Operations API**: Generation calls return long-running operations; we must poll until completion and then download video files from signed URLs, similar to how we poll for image generations today.
- **Audio**: Veo can embed simple sound beds or dialogue cues based on prompts (dialogue cues, SFX, Foley). We'll expose optional audio directives per panel.
- **Safety**: Use `safetyFilter` parameters when necessary and respect Veo's content policy; propagate our existing moderation checks before hitting the API.

## 4. Experience Overview
1. **Access Point**: Within each page's "Panel Animation Studio" tab (already surfaced as "Coming Soon"), artists can select any panel or create grouped sequences (e.g. panels 1–3).
2. **Workspace Layout**
   - **Panel Timeline**: Horizontal list of panels with status chips (Not Generated, Draft, Rendering, Completed, Needs Revision).
   - **Context Stack**: Shows script excerpt, visual descriptors, and a storyboard preview from prior/next panels for continuity cues.
   - **Prompt Composer**: Form-driven builder with tabs for Motion, Camera, Characters, Audio, Environment. Autosaves to avoid losing work.
   - **Reference Assets**: Displays selected panel image + optional user-uploaded references (poses, prop close-ups).
   - **Preview & Stitching**: Inline player that concatenates generated clips using simple crossfade or match-cut transitions; allows toggling between single clip preview and cumulative sequence.
3. **User Controls**
   - Duration slider (1–8 seconds) with recommended defaults based on panel type (establishing shots longer, action shots shorter).
   - Camera path presets (static, pan, dolly, orbit) plus manual key points.
   - Character spotlight toggles to highlight key characters and their intended actions/emotions.
   - Continuity lock options ("Match prior shot", "Reverse angle") that will influence prompt assembly.
   - Retry & version history list storing up to N past renders per panel.
3. **Animation Studio Alignment**
   - The full editor experience (scenes, beats, track-based timeline, inspector inheritance, prompt composer chips, render drawer) is detailed in `docs/animation-studio-ui-ux-spec.md`. Engineering and design teams should treat that document as the authoritative UX spec when implementing Animation mode, ensuring the backend features described here surface within the new scene-based workflow.

## 5. System Architecture
### 5.1 High-Level Components
- **Client (React/Vite)**
  - `PanelAnimationStudio` route module orchestrating UI.
  - `PanelTimeline`, `PromptComposer`, `ContinuityInspector`, `ClipPreviewer` components.
  - `usePanelAnimation()` React Query hook to fetch context, submit jobs, and stream progress (via SSE/WebSocket).
  - Local prompt builder that outputs normalized JSON payloads.
- **Server (Express/TypeScript)**
  - `PanelAnimationController` (new route handlers under `/api/projects/:projectId/panels/:panelId/animation`).
  - `PanelAnimationService` orchestrating job creation, context aggregation, prompt synthesis, and Veo call.
  - `Veo3Client` thin wrapper around `@google/genai` for video operations with resilience (timeouts, retries, exponential backoff).
  - `PanelAnimationJobQueue` (using existing parallel-processing utilities) to offload long-running generations.
  - `ClipRepository` storing job metadata, prompt JSON, output URIs, audit logs.
  - **Continuity Orchestrator** leveraging existing `PanelVisualAnalysisService`, `VisualContinuityService`, and `MultiPageConsistencyTracker` to enrich prompts with continuity directives.
  - Integration with `ObjectStorageService` for storing downloaded MP4 clips and thumbnails.
- **Shared**
  - Type definitions for prompt schema and job statuses under `shared/animation.ts`.
  - Extend existing database schema with `panel_animation_clips` table capturing: `id`, `project_id`, `panel_id`, `sequence_group_id`, `status`, `duration`, `prompt_json`, `veo_operation_id`, `video_url`, `thumbnail_url`, `error`, `created_at`, `updated_at`.

### 5.2 Data Flow
1. User adjusts settings and presses **Generate Clip**.
2. Client validates duration ≤ 8 seconds, packages JSON payload, and posts to `/animation/generate`.
3. Controller validates project access, persists job record (`status = queued`), and pushes job to queue.
4. Worker fetches canonical context (script excerpt, characters, continuity hints) and merges with user prompt JSON to create Veo request:
   - Builds `prompt` string summarizing narrative.
   - Sets `image` reference to the canonical panel art.
   - Includes `negativePrompt`, `motion`, `camera`, `audio`, `safetySettings`, `aspectRatio`.
5. Worker calls `Veo3Client.generateVideo()` (async long-running operation) and polls until completion.
6. On success, worker downloads the MP4 to temp storage, uploads to object storage, updates DB record, emits progress events.
7. Client receives push updates and refreshes timeline; preview is ready.
8. When users request a stitched preview, backend streams a concatenated playlist manifest (M3U8 or JSON) for the selected sequence; stitching is performed client-side initially, with optional server-side re-encode later.

## 6. Prompt Construction Strategy
### 6.1 JSON Schema (Client → Server)
```json
{
  "panel": {
    "panelId": "panel-12",
    "pageNumber": 4,
    "title": "Ty confronts the ringmaster",
    "durationSeconds": 6,
    "aspectRatio": "16:9"
  },
  "narrative": {
    "summary": "Ty storms into the circus tent to stop the ringmaster.",
    "scriptExcerpt": "Ty: 'This show ends tonight!'"
  },
  "visual": {
    "setting": "Victorian circus tent with flickering lanterns",
    "camera": {
      "movement": "push-in",
      "startFrame": "medium shot on Ty",
      "endFrame": "tight close-up on Ty's determined face"
    },
    "lighting": "warm lantern glow with deep shadows",
    "palette": ["burnt orange", "midnight blue"]
  },
  "characters": [
    {
      "name": "Ty Granum",
      "action": "steps forward, pointing finger",
      "emotion": "defiant",
      "reference": "https://cdn.comicbook.ai/projects/123/panels/ty-reference.png"
    },
    {
      "name": "Ringmaster",
      "action": "stumbles back, shocked",
      "emotion": "fearful"
    }
  ],
  "motion": {
    "pace": "moderate",
    "beats": [
      { "time": 0, "description": "Camera starts on wide shot" },
      { "time": 3, "description": "Pushes toward Ty" },
      { "time": 6, "description": "Hold on close-up" }
    ]
  },
  "audio": {
    "dialogue": ["Ty: 'This show ends tonight!'"],
    "sfx": ["distant thunder rumble"],
    "ambience": "crowd murmurs fade"
  },
  "continuity": {
    "precedingPanelId": "panel-11",
    "followingPanelId": "panel-13",
    "notes": "Match Ty's torn sleeve from prior shot"
  },
  "constraints": {
    "safety": ["violence_low"],
    "qualityTarget": "cinematic",
    "retryPolicy": { "maxRetries": 2 }
  }
}
```

### 6.2 Server-Side Prompt Rendering
- Convert JSON into a structured text prompt with labeled sections (Subject, Setting, Motion, Camera, Audio, Continuity Guards).
- Append a **continuity diff** generated by comparing preceding/following panel visual embeddings (leveraging `PanelVisualAnalysisService`).
- Map `durationSeconds` to Veo's `options.duration` and `fps` fields.
- Attach the authoritative panel image as the `image` parameter; include optional user references as `additionalInputImages`.
- Provide `negativePrompt` derived from style guardrails (e.g. "no modern props", "consistent outfit").
- Set `aspectRatio` to maintain alignment with the panel layout (derive from panel metadata).

## 7. Continuity and Context Handling
- **Continuity Graph**: Extend `VisualContinuityService` to return a continuity graph keyed by panel IDs with character pose vectors, camera metadata, and palette. The animation service requests this graph to inform prompts and to decide recommended transitions.
- **Shot Suggestions**: The client displays heuristics (e.g. "Match cut recommended" if prior panel shares focal character). These heuristics come from new `ContinuitySuggestionService` that runs on the server using embeddings and script cues.
- **State Carryover**: Worker caches previously generated clip metadata (camera orientation, ending pose) and exposes them to subsequent jobs so prompts can reference "Start where panel-12 ended".
- **Fallback Handling**: If Veo returns outputs deviating from design (e.g. wardrobe drift), we surface `continuityWarnings` in the job result, using image comparison algorithms already in `PanelVisualAnalysisService`.

## 8. Storage & Delivery
- Store videos as MP4 in the same bucket namespace as panel images, under `/projects/{projectId}/animations/{panelId}/{jobId}.mp4`.
- Generate poster frames using `ffmpeg` (or Veo thumbnails when available) to show quick previews in the UI.
- Maintain signed URL expirations consistent with images; leverage `ObjectStorageService` for uniform ACL logic.
- Stitched previews initially run client-side by chaining `video` elements. Long-term we can export EDL/JSON for offline editing or run server-side `ffmpeg` merge for downloads.

## 9. Error Handling & Observability
- **Job States**: `queued`, `running`, `needs_context`, `failed`, `completed`.
- **Retry Logic**: Automatic retry on transient API failures with jittered exponential backoff. Escalate to `failed` with human-readable error and attach Veo operation ID.
- **Monitoring**: Emit structured logs containing `projectId`, `panelId`, `veoOperationId`, and latency metrics. Add dashboard tiles to track success rate and average duration.
- **User Feedback**: UI shows inline toasts for failures, with option to clone prompt and retry.

## 10. Testing & Validation Strategy
- **Unit Tests**
  - Prompt renderer converts JSON into expected text format, including continuity merges.
  - `Veo3Client` handles polling and error translation.
  - Continuity suggestion algorithms produce consistent recommendations for known scenarios.
- **Integration Tests**
  - Mock Veo API with canned responses verifying job lifecycle.
  - Generate a stitched preview manifest from multiple clips.
  - Permission checks ensure only project members can generate clips.
- **UX Validation**
  - Conduct heuristic evaluation of Panel Animation Studio workflow.
  - Record instrumentation to ensure users can reach successful render within two iterations on average.
- **Performance Checks**
  - Queue workers handle concurrent jobs without starving existing image generations.
  - Throttle API requests to remain within Veo quota.

## 11. Roadmap & Phases
1. **Phase 1**: Ship MVP with manual prompt composer, single clip generation, manual stitching preview.
2. **Phase 2**: Add sequence grouping, automatic continuity suggestions, and history management.
3. **Phase 3**: Advanced audio controls, collaborative annotations, export to timeline editor.

## 12. Risks & Mitigations
- **API Quotas**: High usage may exhaust Veo quota → implement rate limiting per project and fallback queue scheduling.
- **Continuity Drift**: Despite prompts, Veo might alter character appearance → integrate automated visual diffing and highlight drifts for manual correction.
- **User Overwhelm**: Too many controls could intimidate artists → provide preset templates and progressive disclosure (advanced settings behind toggle).
- **Storage Costs**: Video files are larger than images → implement retention policy and allow users to prune unused versions.

---
This plan ensures we translate static panel art into cinematic sequences while upholding continuity, user control, and engineering robustness. Implementation can proceed by scaffolding the backend services, updating the database, and building the Panel Animation Studio interface following the architecture above.
