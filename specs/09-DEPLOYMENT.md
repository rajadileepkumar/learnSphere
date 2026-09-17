# Deployment Specification

## Environments
- local
- staging
- production

## Next.js
Deploy to Vercel.

Environment variables:
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_API_URL
WORDPRESS_GRAPHQL_URL
NEXT_PUBLIC_WORDPRESS_BASE_URL

## Node.js API
Deploy to Railway or Render.

Environment variables:
DATABASE_URL
JWT_SECRET
JWT_REFRESH_SECRET
WORDPRESS_GRAPHQL_URL
WORDPRESS_WEBHOOK_SECRET
AI_API_KEY
APP_URL
CORS_ORIGIN

## WordPress
Deploy on a managed WordPress host or Railway-compatible PHP/MySQL setup.

Enable:
- HTTPS
- backups
- WPGraphQL
- required custom fields/plugin
- webhook endpoint integration

## Neon
Create separate databases/branches for environments where practical.

## CI/CD
Pull request:
- lint
- typecheck
- unit tests
- API integration tests
- build

Main branch:
- deploy Next.js
- deploy Node.js API
- run migration step

## Observability
Track:
- request latency
- 4xx/5xx
- database errors
- WordPress API errors
- AI latency/tokens/errors
- webhook failures
