ALTER TABLE ai_messages ADD COLUMN feedback_rating VARCHAR CHECK (feedback_rating IS NULL OR feedback_rating IN ('up', 'down'));
ALTER TABLE ai_messages ADD COLUMN feedback_comment TEXT;

CREATE INDEX idx_ai_conversations_user_id ON ai_conversations(user_id);
CREATE INDEX idx_ai_messages_conversation_id ON ai_messages(conversation_id);
