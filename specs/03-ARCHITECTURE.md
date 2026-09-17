# Architecture Specification

## High-Level Architecture

WordPress
  -> WPGraphQL
  -> Next.js

Next.js
  -> Node.js API
  -> WordPress
  -> optional AI service through Node.js

Node.js API
  -> Neon PostgreSQL
  -> WordPress/WPGraphQL
  -> AI provider
  -> Email/notification provider

## Data Ownership

WordPress:
- Editorial course content
- Lesson body/content
- Instructor content
- Taxonomies
- Media metadata
- SEO/editorial metadata

Neon:
- Users
- Enrollments
- Progress
- Quiz attempts
- Reviews
- Bookmarks
- Certificates
- AI conversations
- Analytics
- Platform preferences

## Content Flow

WordPress author publishes course
 -> webhook/event
 -> Node.js receives invalidation/sync event
 -> application refreshes or re-fetches content
 -> Next.js revalidates affected route

## Learning Flow

Student opens course
 -> Next.js loads WordPress content
 -> Node.js checks enrollment from Neon
 -> lesson interaction recorded in Neon
 -> dashboard reads aggregate progress from Node.js

## AI Tutor Flow

Student question
 -> Next.js
 -> Node.js
 -> authorization check
 -> retrieve approved course sources
 -> optional embedding/vector retrieval
 -> prompt construction
 -> LLM
 -> response + source references
 -> store conversation metadata
 -> Next.js renders answer

## Recommended Deployment
- Next.js: Vercel
- Node.js API: Railway or Render
- WordPress: managed WordPress or Railway
- WordPress DB: MySQL/MariaDB managed by WordPress host
- Application DB: Neon PostgreSQL

## Architectural Principle
Do not make Neon the WordPress database. WordPress and Neon have separate responsibilities.
