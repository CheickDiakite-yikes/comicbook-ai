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