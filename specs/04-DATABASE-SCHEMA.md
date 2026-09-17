# Neon PostgreSQL Database Schema

## users
- id UUID PK
- email VARCHAR UNIQUE NOT NULL
- password_hash VARCHAR NULL
- display_name VARCHAR
- role VARCHAR NOT NULL
- avatar_url TEXT
- status VARCHAR NOT NULL
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ

## user_profiles
- user_id UUID PK/FK users.id
- bio TEXT
- timezone VARCHAR
- learning_goal TEXT
- experience_level VARCHAR

## courses
- id UUID PK
- wp_course_id BIGINT UNIQUE NOT NULL
- slug VARCHAR UNIQUE NOT NULL
- title VARCHAR NOT NULL
- status VARCHAR NOT NULL
- thumbnail_url TEXT
- duration_minutes INT
- difficulty VARCHAR
- published_at TIMESTAMPTZ
- synced_at TIMESTAMPTZ
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ

## course_modules
- id UUID PK
- course_id UUID FK
- wp_module_id BIGINT
- title VARCHAR
- sort_order INT

## lessons
- id UUID PK
- module_id UUID FK
- wp_lesson_id BIGINT UNIQUE
- slug VARCHAR
- title VARCHAR
- lesson_type VARCHAR
- duration_minutes INT
- sort_order INT
- is_required BOOLEAN

## enrollments
- id UUID PK
- user_id UUID FK
- course_id UUID FK
- status VARCHAR
- enrolled_at TIMESTAMPTZ
- completed_at TIMESTAMPTZ NULL
- UNIQUE(user_id, course_id)

## lesson_progress
- id UUID PK
- user_id UUID FK
- lesson_id UUID FK
- status VARCHAR
- progress_percent NUMERIC(5,2)
- last_position_seconds INT
- started_at TIMESTAMPTZ
- completed_at TIMESTAMPTZ NULL
- updated_at TIMESTAMPTZ
- UNIQUE(user_id, lesson_id)

## quizzes
- id UUID PK
- wp_quiz_id BIGINT UNIQUE
- lesson_id UUID FK
- passing_score NUMERIC(5,2)
- max_attempts INT NULL

## quiz_questions
- id UUID PK
- quiz_id UUID FK
- question_text TEXT
- question_type VARCHAR
- sort_order INT

## quiz_options
- id UUID PK
- question_id UUID FK
- option_text TEXT
- is_correct BOOLEAN

## quiz_attempts
- id UUID PK
- quiz_id UUID FK
- user_id UUID FK
- attempt_number INT
- score NUMERIC(5,2)
- passed BOOLEAN
- started_at TIMESTAMPTZ
- submitted_at TIMESTAMPTZ

## bookmarks
- id UUID PK
- user_id UUID FK
- course_id UUID NULL
- lesson_id UUID NULL
- created_at TIMESTAMPTZ

## reviews
- id UUID PK
- user_id UUID FK
- course_id UUID FK
- rating INT CHECK 1-5
- review_text TEXT
- status VARCHAR
- created_at TIMESTAMPTZ

## certificates
- id UUID PK
- user_id UUID FK
- course_id UUID FK
- certificate_number VARCHAR UNIQUE
- issued_at TIMESTAMPTZ
- verification_code VARCHAR UNIQUE

## ai_conversations
- id UUID PK
- user_id UUID FK
- course_id UUID NULL
- title VARCHAR
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ

## ai_messages
- id UUID PK
- conversation_id UUID FK
- role VARCHAR
- content TEXT
- model VARCHAR
- latency_ms INT
- created_at TIMESTAMPTZ

## ai_sources
- id UUID PK
- message_id UUID FK
- wp_content_id BIGINT
- source_type VARCHAR
- title VARCHAR
- url TEXT
- relevance_score NUMERIC(8,5)

## analytics_events
- id UUID PK
- user_id UUID NULL
- event_name VARCHAR
- entity_type VARCHAR
- entity_id UUID NULL
- metadata JSONB
- occurred_at TIMESTAMPTZ

## Indexes
Create indexes for:
- users.email
- courses.slug
- courses.wp_course_id
- enrollments.user_id
- enrollments.course_id
- lesson_progress.user_id
- lesson_progress.lesson_id
- quiz_attempts.user_id
- reviews.course_id
- analytics_events.event_name
- analytics_events.occurred_at
