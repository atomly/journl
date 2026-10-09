-- Additive schema for issue #291. Apply with the normal database deployment
-- procedure after checking that every BlockNode ID is globally unique (the
-- current primary key already enforces this).
CREATE TABLE IF NOT EXISTS document_reference (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id text NOT NULL,
  source_document_id uuid NOT NULL,
  source_block_id uuid NOT NULL,
  occurrence_path varchar(256) NOT NULL,
  target_identity text NOT NULL DEFAULT 'explicit',
  target_kind text NOT NULL,
  target_document_id uuid,
  target_block_id uuid,
  target_url varchar(2048),
  target_key text NOT NULL,
  presentation text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT document_reference_target_kind_check CHECK (
    (target_kind = 'document' AND target_document_id IS NOT NULL AND target_url IS NULL)
    OR (target_kind = 'external' AND target_document_id IS NULL AND target_block_id IS NULL AND target_url IS NOT NULL)
  ),
  CONSTRAINT document_reference_presentation_check CHECK (
    presentation IN ('link', 'badge', 'card', 'embed')
  ),
  CONSTRAINT document_reference_identity_check CHECK (
    target_identity IN ('route', 'explicit')
  ),
  CONSTRAINT document_reference_block_target_check CHECK (
    target_block_id IS NULL OR target_kind = 'document'
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS document_reference_source_path_unique
  ON document_reference (source_block_id, occurrence_path);
CREATE INDEX IF NOT EXISTS document_reference_incoming_index
  ON document_reference (user_id, target_document_id, target_identity, target_block_id, source_document_id, source_block_id);
CREATE INDEX IF NOT EXISTS document_reference_outgoing_index
  ON document_reference (user_id, source_document_id, source_block_id);
CREATE INDEX IF NOT EXISTS document_reference_external_index
  ON document_reference (user_id, target_key);

CREATE TABLE IF NOT EXISTS block_search_text (
  user_id text NOT NULL,
  document_id uuid NOT NULL,
  block_id uuid NOT NULL,
  search_text text NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS block_search_text_owner_document_block_index
  ON block_search_text (user_id, document_id, block_id);
CREATE UNIQUE INDEX IF NOT EXISTS block_search_text_block_unique
  ON block_search_text (block_id);

-- Drizzle push can stop after creating tables and before adding their foreign
-- keys/indexes. These named constraints also repair that partial state without
-- touching existing note content or unrelated tables.
DO $migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'document_reference'::regclass AND conname = 'document_reference_user_id_user_id_fk') THEN
    ALTER TABLE document_reference ADD CONSTRAINT document_reference_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES "user" (id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'document_reference'::regclass AND conname = 'document_reference_source_document_id_document_id_fk') THEN
    ALTER TABLE document_reference ADD CONSTRAINT document_reference_source_document_id_document_id_fk FOREIGN KEY (source_document_id) REFERENCES document (id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'document_reference'::regclass AND conname = 'document_reference_source_block_id_block_node_id_fk') THEN
    ALTER TABLE document_reference ADD CONSTRAINT document_reference_source_block_id_block_node_id_fk FOREIGN KEY (source_block_id) REFERENCES block_node (id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'block_search_text'::regclass AND conname = 'block_search_text_user_id_user_id_fk') THEN
    ALTER TABLE block_search_text ADD CONSTRAINT block_search_text_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES "user" (id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'block_search_text'::regclass AND conname = 'block_search_text_document_id_document_id_fk') THEN
    ALTER TABLE block_search_text ADD CONSTRAINT block_search_text_document_id_document_id_fk FOREIGN KEY (document_id) REFERENCES document (id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'block_search_text'::regclass AND conname = 'block_search_text_block_id_block_node_id_fk') THEN
    ALTER TABLE block_search_text ADD CONSTRAINT block_search_text_block_id_block_node_id_fk FOREIGN KEY (block_id) REFERENCES block_node (id) ON DELETE CASCADE;
  END IF;
END;
$migration$;
