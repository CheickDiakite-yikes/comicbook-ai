# Kumayiri - AI-Powered Comic Creation Platform

<p align="center">
  <strong>Create stunning comic books with AI-powered visual generation, intelligent character consistency, and cinematic video animations</strong>
</p>

---

## Overview

Kumayiri is a comprehensive AI-powered comic creation platform that enables users to design and generate comic books page by page, panel by panel. The platform features a revolutionary **Story Bible** system where users define their comic's world once—characters, settings, art style, and tone—ensuring visual and narrative consistency across all AI-generated content.

### Key Capabilities

- **AI Panel Generation**: Generate individual comic panels with custom prompts or use one-click page generation
- **Story Bible System**: Define characters, art styles, and world-building once for consistent AI generation
- **Character Consistency**: Advanced tracking system ensures characters look the same across all panels
- **Video Animation Studio**: Transform static panels into cinematic animated videos using Veo3 API
- **Structured Script System**: AI-powered script generation with scene breakdowns and dialogue
- **Credit-Based Access**: Fair usage system with monthly credit allocations

---

## Table of Contents

1. [Features](#features)
2. [System Architecture](#system-architecture)
3. [Story Bible System](#story-bible-system)
4. [Panel Generation](#panel-generation)
5. [Animation Studio](#animation-studio)
6. [Character Consistency](#character-consistency)
7. [Script System](#script-system)
8. [Credit System](#credit-system)
9. [API Reference](#api-reference)
10. [Database Schema](#database-schema)
11. [Development](#development)
12. [Environment Variables](#environment-variables)

---

## Features

### Core Features

| Feature | Description |
|---------|-------------|
| **Project Management** | Create, edit, and organize comic book projects |
| **Story Bible** | Define art style, genre, settings, and canon rules |
| **Character Designer** | Create detailed character profiles with reference portraits |
| **Page Editor** | Visual layout editor with multiple panel templates |
| **AI Panel Generation** | Generate panels from text prompts with character awareness |
| **Parallel Generation** | Generate multiple panels/pages simultaneously with session tracking |
| **Structured Scripts** | AI-generated scripts with scenes, panels, and dialogue |
| **Animation Studio** | Convert panels to animated videos with Veo3 (project-scoped) |
| **Visual Continuity** | Track character appearances across panels for consistency |
| **Panel QA System** | Automated quality analysis for generated content |
| **Social Features** | Share projects, likes, comments, and user profiles |
| **Public Gallery** | Browse public comics from the community |

### Advanced Services

| Service | Description |
|---------|-------------|
| **ParallelGenerationService** | Manages concurrent panel/page generation with session tracking |
| **VisualContinuityService** | Analyzes panels to detect and track character appearances |
| **PanelVideoQAService** | Quality assurance for generated video content |
| **ContinuityContextService** | Builds context from previous panels for consistent generation |
| **ScriptValidationService** | Validates scripts for character consistency and completeness |
| **PromptOrchestrator** | Enriches prompts with Story Bible data and consistency context |
| **MultiPageConsistencyTracker** | Tracks character state across multiple pages |

### AI Capabilities

| Capability | Model | Description |
|------------|-------|-------------|
| Image Generation | Gemini 2.0 Flash | Generate comic panels from text descriptions |
| Script Generation | Gemini | Create structured scripts from story prompts |
| Character Analysis | Gemini Vision | Analyze generated panels for consistency |
| Video Animation | Veo3 | Transform static panels into animated videos |
| Visual QA | Gemini Vision | Quality assurance for generated content |

---

## System Architecture

### Technology Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  React + TypeScript │ Vite │ TanStack Query │ Tailwind + shadcn │
├─────────────────────────────────────────────────────────────────┤
│                         BACKEND                                  │
│  Express.js + TypeScript │ Drizzle ORM │ PostgreSQL (Neon)      │
├─────────────────────────────────────────────────────────────────┤
│                      AI SERVICES                                 │
│  Gemini (Image/Text) │ Veo3 (Video) │ Vision Analysis           │
├─────────────────────────────────────────────────────────────────┤
│                       STORAGE                                    │
│  Object Storage (GCS) │ PostgreSQL │ Session Store              │
└─────────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
kumayiri/
├── client/                    # Frontend React application
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   │   ├── animation-studio/  # Animation Studio components
│   │   │   ├── layout/        # Layout components
│   │   │   └── ui/            # shadcn UI primitives
│   │   ├── pages/             # Route pages
│   │   ├── hooks/             # Custom React hooks
│   │   └── lib/               # Utilities and helpers
│   └── index.html
├── server/                    # Backend Express application
│   ├── services/              # Business logic services
│   │   ├── Veo3AnimationRenderJobService.ts
│   │   ├── VisualContinuityService.ts
│   │   ├── CharacterDescriptorService.ts
│   │   ├── PromptOrchestrator.ts
│   │   └── ScriptValidationService.ts
│   ├── parallel-processing/   # Parallel generation system
│   ├── middleware/            # Express middleware
│   ├── routes.ts              # API route definitions
│   ├── storage.ts             # Database interface
│   └── gemini.ts              # Gemini AI integration
├── shared/                    # Shared types and schemas
│   ├── schema.ts              # Drizzle database schemas
│   └── veo.ts                 # Veo3 types
└── migrations/                # Database migrations
```

---

## Story Bible System

The Story Bible is the foundation of every comic project. It defines the visual and narrative rules that AI follows during generation.

### Story Bible Components

#### 1. Project Settings
```typescript
{
  title: string;           // Project name
  description: string;     // Story synopsis
  genre: string;           // AI-enhanced genre description
  artStyle: string;        // Visual style (e.g., "manga", "western comic")
  settings: Setting[];     // Location definitions
  canonRules: string;      // World-building rules for AI to follow
}
```

#### 2. Character Profiles
Each character has comprehensive profile data for consistent generation:

```typescript
{
  name: string;
  role: string;              // "protagonist", "antagonist", etc.
  bio: string;               // Character backstory
  visualDescriptors: string; // Physical description for AI
  alwaysTraits: string;      // Traits to always include
  neverTraits: string;       // Traits to never show
  referenceImageUrl: string; // AI-generated reference portrait
  colorScheme: string;       // Character's color palette
}
```

#### 3. Character Appearance Profiles
Detailed physical attributes for generation consistency:

- **Physical Build**: Height, build, body type, posture
- **Facial Features**: Face shape, eye color/shape, nose, lips, jawline
- **Hair**: Color, texture, length, style, facial hair
- **Skin**: Tone, texture, scars, tattoos
- **Distinctive Features**: Piercings, glasses, markings
- **Movement**: Walking style, gesture patterns, expressions

#### 4. Clothing States
Track multiple outfit variations per character:

```typescript
{
  stateName: "default" | "formal" | "casual" | "battle";
  upperBody: string;
  lowerBody: string;
  footwear: string;
  outerwear: string;
  accessories: string[];
  colorScheme: string;
  appropriateScenes: string[];
}
```

---

## Panel Generation

### Generation Flow

1. **Prompt Creation**: User writes panel description or AI generates from script
2. **Character Injection**: System adds character visual descriptors to prompt
3. **Style Enforcement**: Art style and consistency rules added
4. **AI Generation**: Gemini generates the panel image
5. **Visual Analysis**: AI analyzes output for character consistency
6. **Storage**: Image saved to object storage with metadata

### Generation Modes

| Mode | Credits | Description |
|------|---------|-------------|
| Single Panel | 1 | Generate one panel with custom prompt |
| Full Page | 1 per panel | Generate all panels on a page |
| Parallel Batch | 1 per panel | Generate multiple pages simultaneously |
| Reference Portrait | 3 | Generate character reference image |

### Prompt Orchestration

The `PromptOrchestrator` service enriches user prompts with:

- Project art style specifications
- Character visual descriptors from Story Bible
- Clothing state for current scene
- Consistency notes from previous panels
- Negative prompts to avoid common issues

---

## Animation Studio

Transform static comic panels into cinematic animated videos using Google's Veo3 API.

### Animation Workflow

```
Panel Selection → Scene Composition → Prompt Generation → Veo3 Rendering → Video Storage
```

### Scene Composer Features

- **Multi-Panel Scenes**: Combine multiple panels into flowing sequences
- **Transition Descriptions**: AI generates smooth transitions between panels
- **Art Style Guardrails**: Explicit instructions to maintain comic aesthetic
- **Motion Presets**: Subtle camera movements, character animations
- **Duration Control**: 4, 6, or 8 second clips

### Art Style Preservation

Animation prompts include explicit guardrails:

```
🎨 ART STYLE REQUIREMENTS (STRICTLY ENFORCE):
[Project Art Style or Default]
✅ MAINTAIN: Character designs, proportions, color palette, artistic style
❌ DO NOT USE: Photorealistic rendering, 3D animation, Pixar style, CGI effects
```

### Animation API

| Endpoint | Method | Description | Credits | Notes |
|----------|--------|-------------|---------|-------|
| `/api/animations/jobs` | POST | Create render job | 80 | Requires `projectId`, validates ownership |
| `/api/animations/jobs` | GET | List user's jobs | - | Optional `projectId` filter |
| `/api/animations/jobs/:id` | GET | Get job status | - | |
| `/api/animations/jobs/:id/video` | GET | Stream video | - | |

**Requirements:**
- All animation jobs must be linked to a project via `projectId`
- Project ownership is validated before job creation
- Credits are deducted via middleware before processing

### Job Status Flow

```
pending → processing → completed/failed
```

### Video Storage

Completed videos are stored in object storage for permanent access. The video endpoint (`/api/animations/jobs/:id/video`) handles two scenarios:
- **Object Storage**: Videos stored in GCS are streamed directly with proper headers
- **Legacy/External**: Older jobs may reference temporary Google URLs that are proxied through the API

---

## Character Consistency

### Visual Continuity System

The platform tracks character appearances across panels to maintain consistency:

1. **Panel Character States**: Track how characters appear in each panel
2. **Visual Analysis**: AI analyzes generated panels for character detection
3. **Consistency Violations**: Flag when characters deviate from profiles
4. **Appearance History**: Track character appearance evolution

### Character State Tracking

For each character in a panel:

```typescript
{
  isPresent: boolean;
  confidenceScore: number;     // AI detection confidence (0-100)
  
  // Detected attributes
  detectedUpperBody: string;
  detectedHairColor: string;
  detectedHairStyle: string;
  detectedClothingColors: string[];
  
  // Pose and position
  position: string;            // standing, sitting, etc.
  facingDirection: string;     // front, profile, back
  visibility: string;          // full_body, torso, head_shot
  
  // Consistency tracking
  consistencyViolations: string[];
}
```

### Consistency Rules

Define constraints for character appearance:

```typescript
{
  ruleType: "appearance" | "behavior" | "clothing";
  priority: 1-5;
  enforcement: "strict" | "flexible" | "guideline";
  mustInclude: string[];       // Required elements
  mustNotInclude: string[];    // Forbidden elements
  positivePromptKeywords: string[];
  negativePromptKeywords: string[];
}
```

---

## Script System

### Structured Script Format

Scripts are organized hierarchically:

```
Structured Script
├── Script Pages (scenes)
│   ├── Script Panels (beats)
│   │   ├── Action & Description
│   │   ├── Visual Notes
│   │   ├── Camera Direction
│   │   ├── Lighting & Weather
│   │   └── Dialogue entries
```

### Script Panel Fields

Each script panel contains comprehensive generation data:

**Core Content**
- `action`: What happens in the panel
- `sceneDescription`: Visual description for AI
- `visualNotes`: Art direction notes
- `characters`: Characters present

**Environmental Details**
- Location, interior/exterior, room type
- Props, background elements
- Atmospheric conditions

**Lighting**
- Light source, time of day, mood
- Direction, shadow intensity
- Color temperature, effects

**Camera**
- Angle, shot type, movement
- Composition, depth of field
- Visual style, color grading

**Audio Cues**
- Sound effects, ambient sounds
- Music cues, voice-over
- Dialogue placement

### Script Generation API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/projects/:id/generate-structured-script` | POST | AI-generate full script |
| `/api/projects/:id/structured-script` | GET | Get active script |
| `/api/projects/:id/save-structured-script` | POST | Save script to database |
| `/api/projects/:id/fix-script` | POST | Fix validation errors |

---

## Credit System

### Credit Allocations

Credits are managed per-user with monthly limits stored in the database. The default allocation is **200 credits per month** for standard users. Admin users (determined by email) have unlimited credits.

| User Type | Monthly Credits |
|-----------|-----------------|
| Standard Users | 200 (default) |
| Admin | Unlimited |

*Note: Monthly limits can be customized per-user in the database.*

### Credit Costs

| Operation | Cost |
|-----------|------|
| Panel Generation | 1 |
| Page Generation | 1 per panel |
| Reference Portrait | 3 |
| Animation Video | 80 |
| Background Generation | 1 |
| Cover Art Generation | 1 |

### Credit Tracking

Credits are tracked monthly with automatic reset:

```typescript
{
  userId: string;
  year: number;
  month: number;
  creditsUsed: number;
  monthlyLimit: number;
}
```

Every credit usage creates a transaction log:

```typescript
{
  operationType: "panel_generation" | "animation_studio" | "reference_portrait";
  creditsDeducted: number;
  remainingCredits: number;
  relatedResourceId: string;
  metadata: object;
}
```

---

## API Reference

### Authentication

All protected routes require authentication via Replit Auth (OpenID Connect).

```
GET /api/auth/user - Get current user
PUT /api/auth/user - Update user profile
GET /api/credits - Get credit balance
```

### Projects

```
POST /api/projects - Create project
GET /api/projects - List user's projects
GET /api/projects/:id - Get project details
PUT /api/projects/:id - Update project
DELETE /api/projects/:id - Delete project
PUT /api/projects/:id/public - Toggle public visibility
```

### Characters

```
POST /api/projects/:id/characters - Create character
GET /api/projects/:id/characters - List project characters
PUT /api/characters/:id - Update character
DELETE /api/characters/:id - Delete character
POST /api/characters/:id/generate-reference-portrait - Generate portrait
```

### Pages & Panels

```
POST /api/projects/:id/pages - Create page
GET /api/projects/:id/pages - List pages
PUT /api/pages/:id - Update page
DELETE /api/pages/:id - Delete page

POST /api/pages/:id/panels - Create panel
GET /api/pages/:id/panels - List panels
PUT /api/panels/:id - Update panel
POST /api/panels/:id/analyze-visual - Analyze panel for consistency
```

### Generation

```
POST /api/projects/:id/generate-image - Generate panel image
POST /api/projects/:id/parallel/panels - Parallel panel generation
POST /api/projects/:id/parallel/pages - Parallel page generation
POST /api/projects/:id/parallel/batch - Parallel batch generation
POST /api/projects/:id/generate-cover-art - Generate cover art
POST /api/projects/:id/generate-background - Generate background
```

### Parallel Generation Sessions

```
GET /api/parallel/sessions - List active sessions
GET /api/parallel/sessions/:id - Get session status
POST /api/parallel/sessions/:id/cancel - Cancel session
GET /api/parallel/sessions/:id/events - SSE stream for real-time updates
```

### Animation Studio

```
POST /api/animations/jobs - Create animation job
GET /api/animations/jobs - List animation jobs
GET /api/animations/jobs/:id - Get job status
GET /api/animations/jobs/:id/video - Stream video
```

### Social

```
GET /api/explore/projects - Browse public projects
POST /api/projects/:id/like - Like project
POST /api/projects/:id/unlike - Unlike project
GET /api/projects/:id/comments - Get comments
POST /api/projects/:id/comments - Add comment
GET /api/profile/:userId - View user profile
```

---

## Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `users` | User accounts (Replit Auth) |
| `user_profiles` | Extended profile information |
| `projects` | Comic book projects |
| `characters` | Character definitions |
| `pages` | Comic pages |
| `panels` | Individual panels |

### Character System

| Table | Purpose |
|-------|---------|
| `character_appearance_profiles` | Detailed physical descriptions |
| `character_clothing_states` | Outfit variations |
| `panel_character_states` | Character tracking per panel |
| `character_consistency_rules` | Appearance rules |

### Script System

| Table | Purpose |
|-------|---------|
| `structured_scripts` | Script metadata |
| `script_pages` | Scene definitions |
| `script_panels` | Detailed panel specs |
| `script_dialogue` | Dialogue entries |

### Animation System

| Table | Purpose |
|-------|---------|
| `animation_render_jobs` | Veo3 job tracking |
| `panel_video_versions` | Generated videos |
| `panel_video_qa_results` | Quality analysis |
| `scene_video_sequences` | Multi-panel sequences |

### Credits & Validation

| Table | Purpose |
|-------|---------|
| `user_credits` | Monthly credit tracking |
| `credit_transactions` | Usage log |
| `script_validation_reports` | Validation results |
| `validation_issues` | Flagged issues |

---

## Development

### Prerequisites

- Node.js 20+
- PostgreSQL (Neon Database)
- Replit Auth configured
- Gemini API key
- Veo3 API key (for animations)

### Setup

```bash
# Install dependencies
npm install

# Push database schema
npm run db:push

# Start development server
npm run dev
```

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (frontend + backend) |
| `npm run db:push` | Push schema to database |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run test` | Run test suite |

### Code Organization

- **Frontend**: React components in `client/src/`
- **Backend**: Express routes in `server/routes.ts`
- **Services**: Business logic in `server/services/`
- **Schemas**: Types in `shared/schema.ts`

---

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `GEMINI_API_KEY` | Google Gemini API key |
| `SESSION_SECRET` | Express session secret |
| `REPLIT_DOMAINS` | Replit Auth domains |

### Optional

| Variable | Description |
|----------|-------------|
| `VEO_API_KEY` | Veo3 API key (separate from Gemini) |
| `PRIVATE_OBJECT_DIR` | Object storage private directory |
| `PUBLIC_OBJECT_SEARCH_PATHS` | Object storage public paths |

---

## Security

### Authentication

- Replit OpenID Connect integration
- HTTP-only secure session cookies
- Route-level middleware protection

### Authorization

- Project ownership validation on all operations
- Admin-only routes for feature management
- Credit enforcement on generation endpoints

### Data Safety

- Prepared statements via Drizzle ORM
- Input validation with Zod schemas
- Audit logging for sensitive operations

---

## License

Proprietary - All rights reserved.

---

<p align="center">
  Built with AI-powered creativity in mind
</p>
