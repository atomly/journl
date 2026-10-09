ALTER TABLE explore_snapshot ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ready';
ALTER TABLE explore_snapshot ADD COLUMN IF NOT EXISTS published_at timestamptz;
UPDATE explore_snapshot SET published_at = created_at WHERE published_at IS NULL;
ALTER TABLE explore_snapshot ALTER COLUMN published_at SET DEFAULT now();
ALTER TABLE explore_snapshot ALTER COLUMN published_at SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'explore_snapshot_ready' AND conrelid = 'public.explore_snapshot'::regclass) THEN
    ALTER TABLE explore_snapshot ADD CONSTRAINT explore_snapshot_ready CHECK (status = 'ready');
  END IF;
END $$;
