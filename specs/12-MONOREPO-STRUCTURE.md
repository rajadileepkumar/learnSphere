# Suggested Repository Structure

/apps
  /web
    /app
      /(public)
      /(auth)
      /(student)
      /(admin)
    /components
    /lib
    /hooks

  /api
    /src
      /modules
        /auth
        /courses
        /enrollments
        /progress
        /quizzes
        /certificates
        /reviews
        /ai
        /analytics
        /admin
      /middleware
      /plugins
      /config
      /db

/packages
  /shared-types
  /validation
  /ui

/infrastructure
  /docker
  /migrations

/docs
  project specifications
