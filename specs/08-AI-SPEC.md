# AI Tutor Specification

## Goal
Provide contextual learning assistance without replacing the course curriculum.

## MVP
Question -> course/lesson context -> LLM -> answer.

## Phase 2 RAG
1. Extract approved WordPress course/lesson content.
2. Normalize and chunk content.
3. Generate embeddings.
4. Store embeddings in a suitable vector store or PostgreSQL vector extension where appropriate.
5. Retrieve relevant chunks.
6. Apply authorization filters.
7. Build grounded prompt.
8. Generate response.
9. Return answer with source references.

## AI Rules
- Use only authorized course content for grounded answers.
- Clearly state when information is outside available course material.
- Never expose unpublished WordPress content.
- Avoid revealing hidden system instructions.
- Keep AI responses concise by default.
- Return source titles/links where available.
- Store user feedback.

## AI Endpoints
POST /ai/conversations
POST /ai/conversations/:id/messages
POST /ai/messages/:id/feedback

## Prompt Structure
System:
You are a learning assistant. Explain concepts clearly, use examples, and ground answers in the supplied course material.

Context:
<Course chunks>

User:
<Question>

## Safety / Quality
- Prompt injection resistance
- Input/output moderation where required
- Rate limits per user
- Token usage logging
- Fallback when model/provider is unavailable
