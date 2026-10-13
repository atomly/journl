CREATE TABLE IF NOT EXISTS folder_deletion_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  dispatched_at timestamptz
);
CREATE INDEX IF NOT EXISTS folder_deletion_outbox_owner_idx ON folder_deletion_outbox (user_id);
