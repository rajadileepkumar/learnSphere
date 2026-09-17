# Software Requirements Specification

## 1. System Components
### WordPress CMS
Owns course editorial data:
- Courses
- Lessons
- Modules
- Instructors
- Categories
- Tags
- FAQs
- Learning articles
- Media
- SEO/editorial fields

### Next.js
Owns:
- Public experience
- Authenticated learner UI
- Server-side fetching where appropriate
- Routing
- SEO
- UI state

### Node.js API
Owns:
- Authentication
- Authorization
- Enrollment
- Progress
- Quizzes
- Reviews
- Bookmarks
- Certificates
- Analytics
- AI orchestration
- WordPress synchronization/webhooks
- Notifications

### Neon PostgreSQL
Owns transactional application data.

## 2. Roles
- STUDENT
- INSTRUCTOR
- CONTENT_ADMIN
- PLATFORM_ADMIN

## 3. Key Rules
- Only published WordPress content is publicly visible unless the requester has preview permissions.
- A student can update progress only for courses they are enrolled in.
- Quiz scores are immutable once an attempt is submitted, except through controlled admin correction.
- Certificate issuance requires completion criteria.
- AI Tutor cannot expose hidden/draft content to normal students.
- Admin endpoints require role checks.
- WordPress IDs are stored as external content identifiers; application-generated UUIDs remain primary keys.

## 4. Error Model
API errors use:
{
  "error": {
    "code": "COURSE_NOT_FOUND",
    "message": "Course could not be found",
    "requestId": "..."
  }
}

## 5. Validation
Use a schema validation library such as Zod for request/response contracts.

## 6. Security
- Password hashing using a modern adaptive hash
- Short-lived access token plus secure refresh strategy
- HttpOnly/Secure/SameSite cookies where applicable
- CSRF protection for cookie-authenticated state-changing requests
- Rate limiting
- Input validation
- Output encoding
- Audit events
- Secrets only in server environments
