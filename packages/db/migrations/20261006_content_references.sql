-- Additive schema for issue #291. Apply with the normal database deployment
-- procedure after checking that every BlockNode ID is globally unique (the
-- current primary key already enforces this).
CREATE TABLE IF NOT EXISTS document_reference (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id text NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  source_document_id uuid NOT NULL REFERENCES document (id) ON DELETE CASCADE,
  source_block_id uuid NOT NULL REFERENCES block_node (id) ON DELETE CASCADE,
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
  user_id text NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES document (id) ON DELETE CASCADE,
  block_id uuid PRIMARY KEY NOT NULL REFERENCES block_node (id) ON DELETE CASCADE,
  search_text text NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS block_search_text_owner_document_block_index
  ON block_search_text (user_id, document_id, block_id);
