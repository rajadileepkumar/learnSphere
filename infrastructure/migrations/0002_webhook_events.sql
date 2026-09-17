CREATE TABLE webhook_events (
  id TEXT PRIMARY KEY,
  source VARCHAR NOT NULL,
  event_name VARCHAR NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
