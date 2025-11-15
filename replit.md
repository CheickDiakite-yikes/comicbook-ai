# Overview

Kumayiri is an AI-powered comic creation platform enabling users to design and generate comic books page by page, panel by panel. It features a "Story Bible" system where users define their comic's world (characters, settings, tone, art style) once, ensuring visual and narrative consistency across AI-generated pages. Users can generate individual panels with custom prompts or use one-click page generation to automatically create all panels based on a script. The platform aims to provide a streamlined, consistent comic creation experience.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend
- **Framework**: React with TypeScript (Vite)
- **Routing**: Wouter (client-side, auth-protected)
- **State Management**: TanStack React Query
- **UI Components**: Radix UI primitives, shadcn/ui
- **Styling**: Tailwind CSS (custom design tokens, CSS variables)
- **Form Handling**: React Hook Form with Zod validation

## Backend
- **Server**: Express.js with TypeScript (Node.js)
- **Database ORM**: Drizzle ORM (PostgreSQL dialect)
- **Authentication**: Replit Auth (OpenID Connect, Passport.js)
- **Session Management**: Express sessions (PostgreSQL store)
- **API Design**: RESTful API (JSON responses, error handling)

## AI/Animation Features
- **Panel Animation API**: Provides asynchronous Veo3 video renders for individual panels.
    - **Endpoints**: `POST /api/animation/panels/{panelId}` (enqueue job), `GET /api/animation/panels/{panelId}` (job status), `PATCH /api/animation/panels/{panelId}` (approve/reject), `GET /api/animation/panels/{panelId}/events` (SSE stream).
    - **Job Details**: Configurable duration (4, 6, or 8 seconds), motion presets, style presets, narrative focus, camera prompts, soundtrack mood, subtitle inclusion.
    - **Cost**: 3 credits per panel animation job.
- **Animation Studio API**: Project-scoped animation render jobs using Veo3 for creating video clips organized by comic project.
    - **Endpoints**: `POST /api/animations/jobs` (create job), `GET /api/animations/jobs` (list jobs), `GET /api/animations/jobs/:jobId/video` (stream video).
    - **Job Details**: Requires `prompt` and `projectId`.
    - **Cost**: 80 credits per video.
    - **Access Control**: Open to all authenticated users; jobs are linked to specific projects with ownership validation.

## Data Storage
- **Primary Database**: PostgreSQL (Neon Database serverless hosting)
- **Schema**: User management, project system (Story Bible), page/panel hierarchy, session storage.
- **Migrations**: Drizzle Kit.

## Authentication and Authorization
- **Provider**: Replit Auth integration.
- **Session Security**: HTTP-only cookies, secure flags, TTL.
- **Authorization**: Route-level protection via middleware.
- **User Context**: React context for frontend auth state.

## Key Design Patterns
- **Separation of Concerns**: Clear distinction between client, server, shared code.
- **Type Safety**: Full TypeScript coverage, shared schemas.
- **Component Composition**: Modular UI components, consistent design system.
- **Data Layer Abstraction**: Storage interface for database operations.
- **Error Boundary**: Comprehensive error handling.

# External Dependencies

- **Database Hosting**: Neon Database (PostgreSQL-compatible serverless).
- **Authentication**: Replit OpenID Connect service.
- **AI Integration**: Veo3 (video generation), prepared service layer for other image generation APIs.
- **UI Components**: Radix UI.
- **Development Tools**: Replit-specific plugins.