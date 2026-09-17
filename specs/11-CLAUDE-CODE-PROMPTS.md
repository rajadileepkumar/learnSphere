# Claude Code Implementation Prompts

## Prompt 1 — Project Bootstrap
Build the monorepo with:
- Next.js + TypeScript frontend
- Node.js + TypeScript API
- shared types/package
- ESLint
- Prettier
- environment validation
- Docker local development
- test setup

Do not implement business features yet.

## Prompt 2 — Database
Implement Neon PostgreSQL schema from 04-DATABASE-SCHEMA.md.
Use migrations.
Add indexes and foreign keys.
Add seed data for development.

## Prompt 3 — Authentication
Implement registration, login, refresh, logout and current-user APIs.
Use secure password hashing.
Add role-based authorization.
Add integration tests.

## Prompt 4 — WordPress Integration
Implement WPGraphQL client.
Create typed Course, Module, Lesson and Instructor queries.
Add caching and error handling.
Create webhook processing with signature verification and idempotency.

## Prompt 5 — Student Learning
Implement course catalog, enrollment, lesson progress, completion and dashboard APIs.
Build corresponding Next.js pages.
Add optimistic UI only where consistency is safe.

## Prompt 6 — Quiz
Implement quiz retrieval, attempts, submission, scoring and result history.
Prevent duplicate submission.
Add tests for pass/fail and attempt limits.

## Prompt 7 — Certificates
Implement completion rules and certificate issuance.
Create verification endpoint and student certificate UI.

## Prompt 8 — AI Tutor
Implement conversation/message APIs.
Start with course-context prompting.
Then add retrieval/RAG behind an interface so the retrieval implementation can evolve.
Log usage, latency and feedback.

## Prompt 9 — Admin
Build admin dashboard, users, enrollments, content status and analytics.
Protect every admin route server-side and API-side.

## Prompt 10 — Production Hardening
Add:
- rate limiting
- structured logging
- request IDs
- API error normalization
- security headers
- input validation
- monitoring hooks
- retry policies
- timeout handling
- test coverage
