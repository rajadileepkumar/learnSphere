# LearnSphere AI

Headless learning platform. WordPress owns editorial content, Neon owns application data. See `specs/` for the full spec set (PRD, architecture, DB schema, API, UX, milestones).

## Structure
- `apps/web` — Next.js (App Router, TS)
- `apps/api` — Fastify (TS)
- `packages/shared-types` — types shared across apps
- `infrastructure/docker` — local WordPress + MySQL

## Setup
```
npm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local
npm run dev:api    # http://localhost:4000
npm run dev:web    # http://localhost:3000
docker compose -f infrastructure/docker/docker-compose.yml up -d   # WordPress at :8080
```

## Status
Milestone 1 (bootstrap) scaffolded: monorepo, Next.js shell, API shell with one health route, shared types, lint/test wiring, CI. No business features yet — see `specs/13-MILESTONES.md` for what's next.
