ALTER TABLE explore_cluster_lineage ADD COLUMN IF NOT EXISTS source_revision integer NOT NULL DEFAULT 0;
ALTER TABLE explore_cluster_lineage ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'replacement';
ALTER TABLE explore_cluster_lineage DROP CONSTRAINT explore_cluster_lineage_from_id_to_id_pk;
ALTER TABLE explore_cluster_lineage ADD CONSTRAINT explore_cluster_lineage_revision_kind_pk PRIMARY KEY (from_id, to_id, source_revision, kind);
ALTER TABLE explore_cluster_lineage ADD CONSTRAINT explore_lineage_kind CHECK (kind IN ('split', 'merge', 'replacement'));
CREATE INDEX IF NOT EXISTS explore_lineage_owner_from ON explore_cluster_lineage (user_id, from_id);
