-- Optional, authorized read-only inventory. Only aggregates: no authored text, labels, URLs or IDs.
-- psql "$POSTGRES_URL" -X -v ON_ERROR_STOP=1 -f docs/editor-inventory/production-shapes.sql
-- Run against the deployed schema, retain date/environment with results, then discard the connection secret.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '20s';
SET LOCAL lock_timeout = '2s';

SELECT 'document_counts' AS section,
       (SELECT count(*) FROM document) AS documents,
       (SELECT count(*) FROM page) AS pages,
       (SELECT count(*) FROM journal_entry) AS journal_entries,
       (SELECT count(*) FROM block_node) AS blocks,
       (SELECT count(*) FROM block_edge) AS sibling_edges;

WITH classified AS (
  SELECT CASE
    WHEN data->>'type' IN ('audio','bulletListItem','checkListItem','codeBlock','divider','file','heading','image','numberedListItem','paragraph','quote','table','toggleListItem','video','referenceCard','contentEmbed') THEN data->>'type'
    WHEN NOT (data ? 'type') THEN '<missing>' ELSE '<unknown>' END AS block_type,
    data
  FROM block_node
)
SELECT 'block_shapes' AS section, block_type, count(*) AS blocks,
       count(*) FILTER (WHERE jsonb_typeof(data) IS DISTINCT FROM 'object') AS non_object_data,
       count(*) FILTER (WHERE NOT (data ? 'props')) AS missing_props,
       count(*) FILTER (WHERE data ? 'props' AND jsonb_typeof(data->'props') IS DISTINCT FROM 'object') AS non_object_props,
       count(*) FILTER (WHERE NOT (data ? 'content')) AS missing_content,
       count(*) FILTER (WHERE jsonb_typeof(data->'content') = 'string') AS string_content,
       count(*) FILTER (WHERE jsonb_path_exists(data, '$.content.rows[*].cells[*] ? (@.type() == "array")')) AS legacy_table_arrays,
       max(octet_length(data::text)) AS largest_payload_bytes
FROM classified GROUP BY block_type ORDER BY block_type;

WITH sizes AS (
  SELECT document_id, count(*) AS blocks, sum(octet_length(data::text)) AS payload_bytes
  FROM block_node GROUP BY document_id
)
SELECT 'document_sizes' AS section, count(*) AS nonempty_documents,
       percentile_disc(0.50) WITHIN GROUP (ORDER BY blocks) AS p50_blocks,
       percentile_disc(0.95) WITHIN GROUP (ORDER BY blocks) AS p95_blocks,
       percentile_disc(0.99) WITHIN GROUP (ORDER BY blocks) AS p99_blocks,
       max(blocks) AS maximum_blocks,
       percentile_disc(0.95) WITHIN GROUP (ORDER BY payload_bytes) AS p95_payload_bytes
FROM sizes;

SELECT 'headings_and_tables' AS section,
       count(*) FILTER (WHERE data->>'type'='heading' AND (data->'props'->>'level') IN ('4','5','6')) AS deeper_headings,
       count(*) FILTER (WHERE data->'props'->>'isToggleable'='true') AS toggle_headings,
       count(*) FILTER (WHERE data->>'type'='table' AND jsonb_path_exists(data, '$.content.rows[*].cells[*].props ? (@.colspan > 1 || @.rowspan > 1)')) AS tables_with_spans
FROM block_node;

SELECT 'reference_projections' AS section, target_kind, presentation, target_identity, count(*) AS occurrences
FROM document_reference GROUP BY target_kind, presentation, target_identity
ORDER BY target_kind, presentation, target_identity;
-- Projection counts do not prove raw reference validity or current target availability.

WITH RECURSIVE ancestry AS (
  SELECT id AS start_id, id, parent_id, document_id, user_id, ARRAY[id] AS path, 0 AS depth, false AS cycle
  FROM block_node
  UNION ALL
  SELECT a.start_id, p.id, p.parent_id, a.document_id, a.user_id, a.path || p.id, a.depth + 1, p.id = ANY(a.path)
  FROM ancestry a JOIN block_node p ON p.id=a.parent_id AND p.document_id=a.document_id AND p.user_id=a.user_id
  WHERE NOT a.cycle AND a.depth < 64
), summary AS (
  SELECT start_id, max(depth) AS depth, bool_or(cycle) AS cycle,
         bool_or(depth=64 AND parent_id IS NOT NULL) AS capped
  FROM ancestry GROUP BY start_id
)
SELECT 'nesting' AS section, max(depth) AS maximum_observed_depth,
       count(*) FILTER (WHERE cycle) AS blocks_reaching_cycles,
       count(*) FILTER (WHERE capped) AS chains_requiring_deeper_audit,
       (SELECT count(*) FROM block_node b LEFT JOIN block_node p ON p.id=b.parent_id AND p.document_id=b.document_id AND p.user_id=b.user_id WHERE b.parent_id IS NOT NULL AND p.id IS NULL) AS parents_outside_document
FROM summary;

SELECT 'ordering_anomalies' AS section,
       (SELECT count(*) FROM (SELECT from_id FROM block_edge GROUP BY from_id HAVING count(*)>1) branches) AS nodes_with_multiple_successors,
       (SELECT count(*) FROM (SELECT to_id FROM block_edge GROUP BY to_id HAVING count(*)>1) branches) AS nodes_with_multiple_predecessors,
       count(*) FILTER (WHERE e.from_id=e.to_id OR f.parent_id IS DISTINCT FROM t.parent_id OR f.document_id<>e.document_id OR t.document_id<>e.document_id OR f.user_id<>e.user_id OR t.user_id<>e.user_id) AS inconsistent_edges
FROM block_edge e JOIN block_node f ON f.id=e.from_id JOIN block_node t ON t.id=e.to_id;

ROLLBACK;
-- This bounded aggregate scan is not a migration approval. Unknown shapes, cycles beyond
-- the cap, inaccessible/deleted targets, media availability, and historical AI payloads
-- require a separate sanitized investigation before any conversion or default cutover.
