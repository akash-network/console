CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  recipient TEXT NOT NULL,
  received_ms INTEGER NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  text_body TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_messages_recipient_received ON messages (recipient, received_ms);
