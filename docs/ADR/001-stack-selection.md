# ADR-001: Stack Selection

## Status
Accepted

## Context
SUDS v2 is a web-based dungeon crawler moving from a Go TUI + Hadron backend to a self-contained web application. Requirements: cross-platform (Windows/Mac/Linux/mobile), social auth, invite-only, OSS/free stack, terminal aesthetic in browser.

## Decision
- **Framework**: Next.js 15 (App Router) - fullstack React with API routes
- **UI**: React 19 + Shadcn/ui + Tailwind CSS - component library with terminal theming
- **API**: tRPC - end-to-end type safety
- **Auth**: NextAuth.js v5 - social login providers
- **Database**: PostgreSQL + Drizzle ORM - JSONB for flexible game data
- **State**: Zustand - lightweight client state
- **AI**: Anthropic Claude API - content generation with word bank fallback
- **Hosting**: DigitalOcean App Platform

## Rationale
- Next.js gives us fullstack in one deploy unit (self-contained requirement)
- tRPC eliminates API contract drift between client/server
- PostgreSQL JSONB handles flexible game state without schema migration churn
- Drizzle is lighter than Prisma, SQL-first, better for game workloads
- Zustand over Redux: minimal boilerplate for game state management
- Shadcn gives unstyled primitives we can theme as terminal components

## Consequences
- TypeScript everywhere (positive: one language, type safety)
- Server-side game logic prevents cheating
- AI generation adds API cost but enables dynamic content
