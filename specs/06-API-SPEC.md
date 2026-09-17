# Node.js API Specification

Base URL:
`/api/v1`

## Authentication
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET  /auth/me

## Courses
GET /courses
GET /courses/:courseId
GET /courses/:courseId/progress
POST /courses/:courseId/enroll
POST /courses/:courseId/bookmark
DELETE /courses/:courseId/bookmark

## Lessons
GET /lessons/:lessonId
PUT /lessons/:lessonId/progress
POST /lessons/:lessonId/complete

## Quizzes
GET /quizzes/:quizId
POST /quizzes/:quizId/attempts
POST /quizzes/:quizId/attempts/:attemptId/submit
GET /quizzes/:quizId/results

## Reviews
GET /courses/:courseId/reviews
POST /courses/:courseId/reviews
PUT /reviews/:reviewId
DELETE /reviews/:reviewId

## Certificates
GET /certificates
GET /certificates/:certificateId
GET /certificates/verify/:verificationCode

## Dashboard
GET /dashboard/summary
GET /dashboard/my-courses
GET /dashboard/activity

## AI Tutor
POST /ai/conversations
GET /ai/conversations
GET /ai/conversations/:conversationId
POST /ai/conversations/:conversationId/messages

## Admin
GET /admin/users
GET /admin/courses
GET /admin/analytics
GET /admin/enrollments
POST /admin/content/revalidate

## Standard Response
{
  "data": {},
  "meta": {
    "requestId": "..."
  }
}

## Pagination
Use:
GET /courses?page=1&pageSize=20&sort=popular

Response:
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 100
  }
}
