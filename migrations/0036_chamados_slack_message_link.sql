ALTER TABLE tickets ADD COLUMN IF NOT EXISTS slack_team_id text;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS slack_user_id text;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS slack_permalink text;

CREATE UNIQUE INDEX IF NOT EXISTS tickets_slack_message_unique
  ON tickets (coalesce(slack_team_id, ''), slack_channel_id, slack_message_ts)
  WHERE slack_channel_id IS NOT NULL AND slack_message_ts IS NOT NULL;
