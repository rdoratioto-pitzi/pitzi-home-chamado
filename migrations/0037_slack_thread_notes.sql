ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS slack_message_key text;
CREATE UNIQUE INDEX IF NOT EXISTS ticket_comments_slack_message_key_unique
  ON ticket_comments (slack_message_key);
