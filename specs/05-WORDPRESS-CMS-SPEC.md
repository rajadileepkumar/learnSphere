# WordPress Headless CMS Specification

## Custom Content Model

### Course
Fields:
- title
- slug
- short_description
- description
- featured_image
- duration
- difficulty
- category
- tags
- instructor
- learning_objectives
- prerequisites
- target_audience
- featured
- SEO title
- SEO description

### Module
- title
- course reference
- description
- order

### Lesson
- title
- module reference
- lesson type
- content
- video URL/provider
- duration
- objectives
- downloadable resources
- order
- required flag

### Instructor
- name
- photo
- bio
- expertise
- social links

### Learning Article
- title
- body
- category
- tags
- related courses

## API
Use WPGraphQL for typed content queries.

## Webhooks
Events:
- course published
- course updated
- course unpublished
- lesson updated
- instructor updated

Webhook processing must be authenticated, idempotent and logged.

## Draft Preview
Authenticated editors can preview draft content without exposing drafts publicly.

## CMS Boundary
Do not store student progress, quiz attempts or certificates as WordPress posts. Those belong in Neon.
