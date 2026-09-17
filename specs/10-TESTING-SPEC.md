# Testing Specification

## Frontend
- Component tests
- Form validation tests
- Route/access tests
- Accessibility checks
- End-to-end tests for registration, enrollment and learning

## Node.js
- Unit tests for services
- Controller tests
- Repository/database tests
- Authentication tests
- Role/permission tests
- API contract tests

## Integration
1. WordPress -> GraphQL -> Next.js
2. WordPress webhook -> Node.js -> revalidation
3. Next.js -> Node.js -> Neon
4. AI Tutor -> retrieval -> LLM -> source references

## Critical E2E Scenarios
- Register
- Login
- Browse courses
- Enroll
- Start lesson
- Resume lesson
- Complete lesson
- Attempt quiz
- Fail quiz
- Pass quiz
- Earn certificate
- Ask AI Tutor
- Logout
- Admin views analytics

## Security Tests
- Unauthorized API access
- Horizontal privilege escalation
- Invalid JWT
- CSRF where applicable
- Rate-limit enforcement
- Injection attempts
- Draft-content leakage
