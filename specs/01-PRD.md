# Product Requirements Document

## 1. Product Vision
Provide a modern learning experience where content authors manage courses in WordPress while students use a fast Next.js application with personalized learning, progress tracking and an AI tutor.

## 2. Personas
### Student
Discovers courses, enrolls, learns, takes quizzes, tracks progress and asks the AI Tutor questions.

### Instructor
Creates and maintains course content through WordPress and reviews learning analytics.

### Content Admin
Manages taxonomy, publishing workflows, featured courses and content quality.

### Platform Admin
Manages users, roles, reports, platform settings and operational controls.

## 3. MVP Scope
- Public home page
- Course catalog
- Course detail page
- WordPress-backed course/lesson content
- Registration/login/logout
- Student dashboard
- Enrollment
- Lesson completion
- Progress percentage
- Quiz creation and attempts
- Course reviews
- Bookmarks
- Certificate eligibility and generation
- Admin reporting
- Basic AI Tutor using approved course content

## 4. Phase 2
- RAG-based AI Tutor
- Personalized learning recommendations
- Adaptive quizzes
- Email/push notifications
- Instructor dashboard
- Course discussion
- Learning streaks
- Advanced analytics
- Payments/subscriptions
- Multi-tenant organizations

## 5. Functional Requirements
FR-001 Course catalog shall retrieve published course metadata from WordPress.
FR-002 Course detail pages shall render WordPress course content with SEO metadata.
FR-003 A user shall be able to register and authenticate.
FR-004 A student shall be able to enroll in an available course.
FR-005 Lesson completion shall be persisted in Neon.
FR-006 Progress shall be calculated at course and lesson level.
FR-007 Quiz attempts shall be persisted with score and status.
FR-008 Certificate eligibility shall be calculated from completion rules.
FR-009 Students shall be able to bookmark courses.
FR-010 Students shall be able to submit ratings/reviews.
FR-011 The AI Tutor shall answer questions using permitted learning content.
FR-012 Admins shall be able to view enrollment/progress/quiz metrics.

## 6. Non-Functional Requirements
- Responsive from mobile to desktop
- Accessible WCAG-oriented UI
- Server-render public content with appropriate caching/revalidation
- API validation and rate limiting
- Secure password handling
- Audit logging for privileged actions
- Pagination on large datasets
- Observability for API errors and AI requests
- Environment-specific configuration
- Automated tests and CI checks

## 7. Success Metrics
- Course page performance and Core Web Vitals
- Enrollment conversion
- Lesson completion rate
- Quiz completion rate
- 30-day learner retention
- AI Tutor helpfulness feedback
- Search-to-course-click rate
