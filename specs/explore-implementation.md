# Explore implementation and acceptance reference

Temporary review document; delete before merge. Scope: server-side clustering, durable
snapshots, bounded discovery and evidence, and a clean human exploration flow. No feature
flag. AI naming/insights, plugin integration and semantic inference are deferred.

## Product flow
Overview → thread → note → supporting passage. Help people resume an idea, gather its
notes and sources, discover other threads and understand why a note belongs. Overview
is distinct, deterministic cluster islands with names, three representatives, counts and
activity. Selection reveals authored cross-thread links; no initial web of lines. Provide
an equivalent accessible list, “Find a thread”, and secondary recent/unlinked notes.
A thread has rename, representatives/activity, bounded note/source map, complete paginated
lists, related notes and “Why here?” evidence. Source context lists citing passages.
A note keeps its actual neighborhood, explicit Open note/Explore this cluster actions.
Breadcrumbs/Back restore selection, camera, filters, cursors and scroll. Storage is owner
scoped. Desktop context is sticky; mobile sheet height is fixed; loading causes no shifts.
Use keyboard controls, pinch/trackpad zoom, stable placement and no continuous physics.

## Graph rules and calculation
Authored references remain truth, directed and separate from derived clusters. Each note
has at most 1 primary membership, at most 3 justified secondary memberships, or none. External canonical
URLs may belong to many threads. Shared-domain URLs never connect notes. Undirected direct
pair weight = 3, repeats/self links add nothing. Shared URL contribution = 1 / (degree − 1), capped
at 1 per pair; expand degree 2–20 only and require at least 2 distinct shared sources. Leiden CPM,
seed 42, resolution 0.5; versioned configuration; no connected-component fallback.
Groups need at least 2 primary notes. Related membership requires direct references to at least 2 distinct
primary members, ranked by connected-member count with stable ties and supporting IDs.
Representatives prefer meaningful pages and internal strength, then activity and ID.
Names: manual → meaningful page → honest month fallback. Preserve suitable generated names.

## Persistence and concurrency
Owner-scoped state, immutable snapshots, stable cluster identities, snapshot summaries,
members, sources, typed revision-scoped lineage and transactional outbox. Composite owner
FKs, one primary membership per document/snapshot, unique membership and query indexes.
Jaccard overlap ≥ 0.5; strongest deterministic one-to-one inheritance. Record split/merge/
replacement including branches when predecessor survives; preserve manual names; retired
URLs resolve current descendants. Publish complete snapshots by atomic state switch.
Retain cursors/snapshots for 24 hours. Relevant saves, titles/activity and deletes update projection,
source revision and outbox in one transaction. Five-second coalescing, consistent reads,
owner lease with fencing, idempotency by owner/revision/version, retry changed input and
recover expired workers. Failures preserve previous snapshot. Never truncate worker input.

## Contracts
Shared server service used by tRPC and future agent tools. Cluster list default 12/max 24 with search
and activity cursor. Members/sources default 20/max 50. Recent notes newest/oldest, unlinked filter.
Map: at most 30 notes/sources, authored edges, omitted counts. Rename 1–100 trimmed characters.
All reads owner scoped; metadata includes snapshot/revision/refresh/counts where applicable.
Cursor scopes owner/snapshot/filter/sort tuple; expired snapshot returns restart result.
Routes /explore, /explore/clusters/{id}, /explore/notes/{id}; preserve legacy block targets.
No inferred shared-source similarity lines. Show direct/shared/related explanations.

## Release checks
- Algorithm: distinct projects with one generic source; multiple specific sources; repeats;
  degree-thousands hub; related membership; unrelated additions; split lineage; deletion;
  self links; deterministic fixture results and documented library/license/config.
- DB/API: ownership, exact counts, rollback, real concurrent edits, stale-worker fencing,
  retry idempotency, lease expiry, cursor expiry, names, deletion and split/merge history.
- UI/browser: real route remounts and history; overview/thread/note/passage; owner changes;
  rename; complete pagination; external context; empty/error/refresh; keyboard; mobile bounds;
  pinch and trackpad. No global auto-fetch. Stable shells and last published content.
- Performance: 10k notes/100k references plus high-degree source; worker time and peak memory,
  DB query latency and response sizes. Explicit measured budgets; fail exceeded budgets.
- Apply additive schema, run repeatable backfill through worker, CI/build/typecheck, PR review.

## Implementation decisions and measured validation
- Clustering adapter: MIT-licensed `ngraph.leiden@0.3.0` with `ngraph.graph@20.1.2`.
  Configuration: Leiden CPM, seed 42, resolution 0.5, algorithm `leiden-cpm-v3`.
- Only complete snapshots are persisted, inside the publication transaction. Snapshot
  status is `ready`; failures leave the prior published snapshot and durable request intact.
- Calculation fixture (10k notes/100k references): 500 clusters, 2.098s, peak 281 MiB.
  Calculation budgets: at most 30s and ≤ 768 MiB.
- Actual database fixture (10k notes/100k references, 500 threads): worker publication 9.915s,
  peak 578 MiB. 20 samples per endpoint; p95: overview 865ms, next page 769ms, search 1073ms,
  members 1127ms, sources 615ms, thread connections 623ms, map 1613ms, recent 767ms,
  unlinked 856ms. Largest response 87143 bytes. Budgets: worker ≤ 120s, peak ≤ 768 MiB,
  API p95 ≤ 3000ms, response ≤ 131072 bytes. No violations. Disposable owner removed.
- Separate 20-note fixture: summary p95 745ms; source passages p95 600ms, 20 samples each.
  Full-size 10k/100k follow-up: summary p95 757ms; source passages p95 617ms;
  materialized thread connections p95 647ms (server execution 17.27ms). Follow-up
  publication 9.389s, peak 603 MiB; all original budgets pass.
  Cross-thread query intermediates are materialized to prevent repeated evaluation under
  alternate PostgreSQL plans; full-owner extraction uses linear hash joins.
- 194 regular tests pass (one editor test hit a 5s timeout under concurrent build load and
  passed on isolated rerun); 16 live database tests include concurrency and stale-worker
  fencing. Production build and web/database typechecks pass.

- Authenticated production-browser acceptance: 12 checks pass, including keyboard
  selection, authored cross-thread links, 20+2 note pagination, source passages opened in
  the actual editor, note navigation/Back, origin thread, rename, trackpad zoom, pinch,
  mobile sheet bounds/stability and owner-scoped search.
- Independent review fixes: satisfied-outbox cleanup; typed revision-scoped lineage;
  all retired-thread successor pages, exact counts and snapshot-consistent traversal;
  source-to-note navigation preserves its thread origin.

Browser evidence and final review are recorded in PR302. Passing unit tests alone do not
establish completion. This document is the acceptance checklist.
