# Overview

Kumayiri is an AI-powered comic creation platform that allows users to design and generate comic books page by page, panel by panel. The application provides a "Story Bible" system where users define their comic's world once (characters, settings, tone, art style) and then generate consistent comic pages using AI while maintaining visual and narrative coherence. Users can either generate individual panels with custom prompts or use one-click page generation that automatically creates all panels based on the script.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **Routing**: Wouter for client-side routing with authentication-based route protection
- **State Management**: TanStack React Query for server state management and caching
- **UI Components**: Radix UI primitives with shadcn/ui component library
- **Styling**: Tailwind CSS with custom design tokens and CSS variables for theming
- **Form Handling**: React Hook Form with Zod schema validation

## Backend Architecture
- **Server**: Express.js with TypeScript running on Node.js
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Authentication**: Replit Auth using OpenID Connect with Passport.js strategy
- **Session Management**: Express sessions with PostgreSQL session store
- **API Design**: RESTful API with JSON responses and comprehensive error handling

## Panel Animation API
The panel animation workflow provides asynchronous Veo3 video renders for any generated panel while preserving story continuity. All endpoints require authentication via `isAuthenticated` and the POST endpoint additionally deducts animation credits through `requireCredits` (`panel_animation` costs 3 credits).

### `POST /api/animation/panels/{panelId}` — Enqueue animation job
- **Body schema** (`createPanelVideoRequestSchema`):
  - `durationSeconds` *(number, 4-8)* — clip length in seconds (Veo 3 requirement).
  - `motionPreset` *("static" | "gentle" | "dynamic" | "cinematic")* — camera motion recipe.
  - `stylePreset` *(string, optional)* — named Veo3 preset or custom tag.
  - `narrativeFocus` *(string, optional)* — short description of the story beat to emphasise.
  - `cameraPrompts` *(string[≤4], optional)* — fine-grained camera directives.
  - `soundtrackMood` *(enum, optional)* — background audio suggestion.
  - `includeSubtitles` *(boolean, optional)* — request burnt-in captions.
- **Success (202)**: returns job metadata (`jobId`, `status`, `history`, `resultUrl`, `approval`, timestamps).
- **Rate limit**: Maximum **3 jobs per panel per minute**. Exceeding the limit returns **429** with `Retry-After` header and `retryAfterMs` payload.
- **Errors**:
  - `400 validation_failed` — malformed payload (Zod validation details in `details`).
  - `402 insufficient_credits` — handled by credit middleware.
  - `404 panel_not_found` / `project_not_found` — panel does not belong to the authenticated user.
  - `429 rate_limited` — rate limit triggered.
  - `500 panel_animation_failed` — unexpected orchestration errors.

### `GET /api/animation/panels/{panelId}` — Job status & history
- Optional query `jobId` filters to a single job; otherwise returns all jobs for the panel ordered by newest first.
- Response matches `panelVideoJobStatusResponseSchema` and includes `status` progression (`queued`, `rendering`, `ready`, `error`).
- Errors mirror POST plus `404 job_not_found` when requesting unknown job IDs.

### `PATCH /api/animation/panels/{panelId}` — Approve or reject renders
- Body schema (`updatePanelVideoApprovalSchema`):
  - `jobId` *(UUID)* — job to review.
  - `approved` *(boolean)* — approval decision.
  - `notes` *(string, optional)* — reviewer comment.
- Updates `job.approval` and appends to job history; returns `{ job }` with the new approval state.
- Errors: `400 validation_failed`, `403 forbidden` (job owned by another user), `404 job_not_found`.

### `GET /api/animation/panels/{panelId}/events` — SSE stream
- Streams real-time updates as [`PanelVideoJobEvent`](./server/services/PanelVideoJobService.ts) payloads with `type` values `queued`, `rendering`, `ready`, `error`, or `approval` and the current `job` snapshot.
- Clients should keep the connection open and update UI incrementally. Reconnect on network errors.

## Animation Studio API
The Animation Studio provides project-scoped animation render jobs using Veo 3, allowing users to create video clips organized by comic project. All endpoints require authentication and enforce project ownership validation.

### Project-Based Organization (2025-10-10)
**Implementation**: Animation render jobs are now linked to specific projects via `projectId` column in `animation_render_jobs` table.
- Each animation job belongs to one project
- Users can only view/create animations for their own projects
- Render queue displays only animations from the selected project
- Backward compatible: existing jobs without `projectId` still accessible

### `POST /api/animations/jobs` — Create animation render job
- **Body schema**:
  - `prompt` *(text, required)* — Description of the scene to animate
  - `projectId` *(string, required)* — UUID of the project this animation belongs to
  - `model` *(string, optional)* — Veo model to use (defaults to `veo-3.0-generate-001`)
  - `settings` *(object, optional)* — Additional Veo configuration
- **Validation**: Verifies user owns the specified project before creating job
- **Success (201)**: Returns job metadata with `id`, `status`, `prompt`, `projectId`, timestamps
- **Errors**:
  - `400 validation_failed` — Missing required fields or invalid projectId format
  - `403 forbidden` — User does not own the specified project
  - `404 project_not_found` — Project does not exist

### `GET /api/animations/jobs` — List animation jobs
- **Query parameters**:
  - `limit` *(number, optional)* — Maximum jobs to return (default 10)
  - `projectId` *(string, optional)* — Filter jobs by project UUID
- **Behavior**: 
  - Without `projectId`: Returns all user's jobs across all projects
  - With `projectId`: Returns only jobs for specified project (validates ownership)
- **Success (200)**: Returns `{ jobs: [...] }` array ordered by creation date (newest first)

### `GET /api/animations/jobs/:jobId/video` — Stream video file
- Proxies authenticated video requests to Google's storage
- Converts Web Streams to Node.js streams for proper playback
- **Success (200)**: Streams video with correct `Content-Type` header
- **Errors**: `404` if job not found or video not ready

## Data Storage Solutions
- **Primary Database**: PostgreSQL with Neon Database serverless hosting
- **Schema Design**: 
  - User management (required for Replit Auth)
  - Project system with Story Bible (title, genre, art style, characters, settings, canon rules)
  - Page and panel hierarchy for comic structure
  - Session storage for authentication persistence
- **Migrations**: Drizzle Kit for database schema management

## Authentication and Authorization
- **Provider**: Replit Auth integration with mandatory user and session tables
- **Session Security**: HTTP-only cookies with secure flags and TTL management
- **Authorization**: Route-level protection with authentication middleware
- **User Context**: React context for authentication state management

## External Dependencies
- **Database Hosting**: Neon Database (PostgreSQL-compatible serverless)
- **Authentication**: Replit OpenID Connect service
- **AI Integration**: Prepared service layer for image generation APIs
- **UI Components**: Radix UI primitives for accessible component foundation
- **Development Tools**: Replit-specific plugins for development experience

## Key Design Patterns
- **Separation of Concerns**: Clear separation between client, server, and shared code
- **Type Safety**: Full TypeScript coverage with shared schema definitions
- **Component Composition**: Modular UI components with consistent design system
- **Data Layer Abstraction**: Storage interface pattern for database operations
- **Error Boundary**: Comprehensive error handling with user-friendly messages

# Debugging Guide

## Common Issues and Solutions

### JSON Parsing Errors ("Unexpected token < in JSON")
**Root Cause**: Double JSON parsing after `apiRequest()` calls
**Pattern**: `const response = await apiRequest(...); const data = await response.json();`
**Solution**: `apiRequest()` already returns parsed JSON, so use directly: `const data = await apiRequest(...);`
**Files to Check**: Any component making API calls (profile.tsx, explore.tsx, templates.tsx, characters.tsx, editor.tsx)

### Page Context Issues (Wrong Script Content in Generations)
**Root Cause**: Database page numbering inconsistency where multiple pages have same `page_number`
**Symptoms**: Generation uses Page 1 script content when on Page 2
**Debug Steps**:
1. Check browser console for 🔍 GENERATION DEBUG output
2. Verify `currentPageNumber` matches expected page
3. Check database: `SELECT id, page_number FROM pages WHERE project_id = 'PROJECT_ID' ORDER BY page_number;`
**Solution**: Update incorrect page numbers: `UPDATE pages SET page_number = 2 WHERE id = 'PAGE_ID';`

### Generation Context Debugging
**Debug System**: Look for 🔍 GENERATION DEBUG logs in browser console showing:
- `currentPageIndex`: Position in pages array (0-based)
- `currentPageNumber`: Expected page number from database
- `pagesArray`: All pages with their stored page numbers
**Key Check**: Ensure `currentPageNumber` matches the UI display and `pagesArray` has sequential page numbers

### Server vs Browser Logs
**Server Logs**: Use `refresh_all_logs` tool for backend errors, API responses, database queries
**Browser Console**: Check for frontend errors, generation debug output, network failures
**Pattern**: "Failed to fetch" errors usually indicate JSON parsing issues in frontend code

### Google OAuth Duplicate Email Errors (Fixed 2025-10-10)
**Root Cause**: Users with existing Replit Auth accounts couldn't log in with Google OAuth due to duplicate email constraint violation
**Error**: `duplicate key value violates unique constraint "users_email_unique"`
**Problem**: Google OAuth was creating new users with different IDs but the same email as existing Replit Auth accounts
**Solution**: 
1. Added `getUserByEmail()` method to storage layer
2. Modified Google OAuth flow to check for existing users by email BEFORE creating new accounts
3. If user exists, updates their profile with Google data while keeping original user ID
4. If no existing user, creates new account with Google ID
**Files Changed**: `server/replitAuth.ts`, `server/storage.ts`, `client/src/pages/login.tsx` (also fixed Replit button pointing to wrong endpoint)
**Impact**: Users can now seamlessly switch between authentication providers without losing their projects/data

### Veo 3 Animation Issues
**Model Names**: Veo 3 uses `veo-3.0-generate-001` (quality) or `veo-3.0-fast-generate-001` (speed). Old `veo-001` model is invalid.
**Duration Validation**: Veo 3 only accepts exactly 4, 6, or 8 seconds - no other values allowed. Backend enforces this via Zod schema with `z.literal` union.

#### Critical Polling Fix (2025-10-10)
**Problem**: SDK's `.get()` and `.getVideosOperation()` methods require full operation objects with `_fromAPIResponse()` method, but we only store operation name strings in the database.
**Solution**: Bypass SDK and make direct HTTP calls to Google's API:
```typescript
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/${operationName}`,
  { headers: { 'x-goog-api-key': apiKey } }
);
const operation = await response.json();
```

#### Job Persistence Fix (2025-10-10)
**Problem**: Service stored operations in memory only - server restarts lost all pending jobs.
**Solution**: 
1. Added `initializeFromDatabase()` method to load pending/processing jobs on startup
2. Called during server initialization in `server/index.ts`
3. Service now automatically resumes polling for all incomplete jobs after restart

**Status**: All fixes deployed and tested. Jobs successfully poll and complete after server restarts.

## Secrets Management

### Veo Credentials

- Store Veo access tokens using the existing environment secret path (`VEO_API_KEY`). The backend automatically falls back to `GEMINI_API_KEY` if a dedicated Veo key is not configured.
- Optional project metadata can be provided through `VEO_PROJECT_ID` and `VEO_LOCATION` when regional scoping is required by the API.

#### Rotation Procedure

1. Generate a new Veo API key in Google AI Studio.
2. Add the new value to the secrets manager as `VEO_API_KEY_NEW`, deploy, and trigger a smoke test render to validate the credentials.
3. Update the primary `VEO_API_KEY` entry with the new value and remove the temporary secret after validation succeeds.
4. Document the rotation (date, operator, justification) in the compliance log and record an admin audit event through the feature entitlement endpoint for traceability.
5. Rotate related service accounts and update `VEO_PROJECT_ID`/`VEO_LOCATION` if the new key is bound to a different project or region.