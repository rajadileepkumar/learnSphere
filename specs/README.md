# LearnSphere AI — Headless Learning Platform

## Project Goal
LearnSphere AI is a production-style headless learning platform that separates editorial learning content from student/application data.

## Technology Stack
- CMS: WordPress + WPGraphQL + custom post types / ACF-style structured fields
- Frontend: Next.js + TypeScript + App Router
- Backend: Node.js + TypeScript + Fastify or Express
- Database: Neon PostgreSQL
- Authentication: JWT/session-based authentication with secure refresh strategy
- AI: LLM provider behind the Node.js service; optional embeddings/RAG layer
- Deployment: Next.js on Vercel; Node.js API on Railway/Render; WordPress on managed WordPress/Railway; Neon for PostgreSQL

## Core Principle
WordPress owns editorial content. Neon owns transactional application data.

## Primary Modules
1. Public website and course discovery
2. Authentication and user profiles
3. Student dashboard
4. Course enrollment
5. Lesson player and progress tracking
6. Quizzes and assessments
7. Certificates
8. Instructor/course administration
9. AI Tutor
10. Search and recommendations
11. Reviews and bookmarks
12. Notifications
13. Learning analytics
14. Content preview/synchronization
