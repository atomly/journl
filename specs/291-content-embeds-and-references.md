# Rich links, content previews, and document references

Status: approved for implementation and agent handoff. The reviewer accepted the proposed defaults and requested one complete feature release, including section 11 and the previously staged block references, read-only full-content embeds, and graph visualization. This PR remains the design artifact; implementation belongs in its linked implementation branch.

Related issue: [#291 — Spike: Add rich embedded previews for linked content](https://github.com/atomly/journl/issues/291).

Prepared October 6, 2026. Repository baseline: `efe8c9ab81041d5fc6fd60a9f8a18a8b4691f31f`.

This is a temporary design and agent handoff artifact on `codex/spec-291-content-references`. Product review is complete; use this PR as the approved implementation reference. Keep it available throughout the handoff; remove this file from the branch before merging implementation into `main`. Do not merge this design-only PR or automatically close #291 upon approval. If implementation uses a separate branch, link this PR as its design reference and close this PR after the handoff.

## 1. Approved outcome and single-release scope

Users can paste or drop a GitHub URL to produce a recognizable GitHub badge, and reference a Journl page or journal entry to show its current title and a truncated excerpt. The same internal relationship supports navigation, previews, backlinks, and authorized AI lookups. Changing a reference's appearance must not change the relationship it represents.

Terminology:

- **Link:** ordinary editable hyperlink text, including existing BlockNote links.
- **Badge:** an atomic inline reference, suitable within a sentence.
- **Card:** a standalone block with source/type, title, and a short excerpt.
- **Preview:** a temporary hover/focus/touch surface; no editor content mutation.
- **Full-content embed:** a read-only, live view of a referenced document or block subtree, distinct from a title/excerpt card. Source editing happens in its own editor.
- **Reference occurrence:** a link from a particular source block to a target, with provenance. Backlinks are the reverse lookup of these occurrences.

The approved release includes page/entry/block badges and cards, public GitHub metadata enrichment with URL-derived fallbacks, plain external URL fallbacks, accessible previews, a cross-document/block picker, backlinks, a bounded one-hop AI reference query, read-only full-content embeds, and a graph visualization. Explicit references and recognizable existing internal hyperlinks contribute graph edges. Neither title matching nor semantic similarity silently creates edges.

All planned features ship together after M0–M8 pass. General web unfurling, private GitHub OAuth, editing transcluded content, and inferred relationships remain outside this scope because the original design explicitly required separate designs for them.

The graph foundation and AI query extend the narrower preview spike in #291. Milestones describe implementation dependencies within one release; finishing a subset is not release completion. Incremental implementation PRs and deployment preparation remain possible behind the rollout flag.

## 2. Reference research and product choices

These are documented product behaviors, not claims from hands-on testing. Logseq sources below describe its established Markdown/file graph; do not assume its newer database graph has identical behavior.

| Reference | Observed behavior | Journl proposal |
| --- | --- | --- |
| [Atlassian links](https://support.atlassian.com/confluence-cloud/docs/insert-links-and-anchors/) | Pasted URLs can unfurl; URL, inline, card, and interactive embed are distinct presentations. The toolbar can switch views and undo can cancel conversion. | Context-sensitive badge/card defaults, explicit display conversion, and reversible insertion. Skip interactive web embeds initially. |
| [Logseq page/block references](https://raw.githubusercontent.com/logseq/docs/master/pages/Page%20and%20block%20references.md) | Page and block reference triggers offer completion, custom labels, navigation, and hover previews. | A `[[` picker and explicit IDs, with page/entry type labels and previews. Include block selection with stable block IDs. |
| [Logseq block embeds](https://raw.githubusercontent.com/logseq/docs/master/pages/block_embed.md), [page embeds](https://raw.githubusercontent.com/logseq/docs/master/pages/page_embed.md) | Embeds display source content and can edit the source. Page embeds are documented separately from linked references. | Keep reference identity separate from rendering. Unlike that documented page-embed behavior, our cards count as explicit graph relationships. Do not duplicate editable source blocks. |
| [Obsidian links](https://obsidian.md/help/links), [embeds](https://obsidian.md/help/embeds) | Links support labels, heading/block targets, and rename handling; `!` requests live embedded content. | Separate linking from transclusion, preserve labels, and use document IDs so rename needs no source rewrite. |
| [Obsidian backlinks](https://obsidian.md/help/plugins/backlinks), [page preview](https://obsidian.md/help/plugins/page-preview) | Linked and unlinked mentions are distinct; editing-mode hover previews can require a modifier key. | Explicit backlinks only; previews must preserve editor selection and support keyboard/touch alternatives. |

The recommendation combines Atlassian's presentation choices with Logseq/Obsidian's explicit references. It does not propose Markdown syntax compatibility or import of their graphs.

## 3. Requirements and review decisions

### Functional requirements

| ID | Requirement | Observable result |
| --- | --- | --- |
| R1 | Recognize pasted/dropped links | GitHub URLs show a GitHub source badge; owned Journl page/entry URLs resolve to the appropriate internal target. |
| R2 | Internal preview | Current title/type plus a maximum 240-character plain-text excerpt; journal title is its date. Empty content has a useful empty state. |
| R3 | Cross-note authoring | `[[` and `/Reference` search owned pages and persisted entries; choose explicitly when titles collide. |
| R4 | Preserve writing | Prose uses an inline badge; an empty paragraph can become a card. Code, bulk paste, selected text, undo, and drag selection retain predictable behavior. |
| R5 | Stable identity | Rename/move preserves references; deleting and recreating an entry for the same date does not retarget an explicit reference. |
| R6 | Backlinks | Pages and persisted entries list references from both note types, with source context and block navigation. |
| R7 | Graph consistency | Committed block content and derived references change atomically. Removed links, removed subtrees, and rejected AI drafts leave no stale edges. |
| R8 | AI retrieval | A read-only tool returns authorized neighbors and source occurrences, using the same relationships as backlinks. |
| R9 | Harmless failures | Loading, malformed, missing, inaccessible, unsupported, and offline states preserve editable content and safe navigation where possible. |
| R10 | Compatibility | Existing documents render; custom references survive JSON/clipboard round trips; Markdown exports contain readable links. |
| R11 | Public GitHub enrichment | Public repositories/issues/PRs show available titles, descriptions, and statuses; failures preserve URL-derived badges/cards. |
| R12 | Block references | Users select existing blocks across pages/entries, navigate to the exact source, and see block-specific previews/backlinks. |
| R13 | Read-only live embeds | An explicit Embed view shows current document/block content with bounded nesting, cycle handling, authorization, and Open source. |
| R14 | Graph visualization | A bounded interactive graph and equivalent accessible list show authorized document/block connections with source provenance. |

### Nonfunctional requirements

- Every private lookup and graph query derives the user from the session. Caller-supplied IDs confer no access.
- Public GitHub enrichment uses the server provider in section 11; arbitrary external URLs are never fetched. Network enrichment is isolated from document saving.
- One batched query for unique visible references, no request per render or per duplicate occurrence. Queries and graph responses have explicit limits.
- Cards, badges, picker, and preview controls work with keyboard, touch, screen readers, light/dark themes, and narrow screens.
- References in accepted content are the source of truth; preview metadata and graph rows are replaceable projections.

### Approved defaults

The reviewer approved the defaults below, with the scope expanded to include section 11, block references, read-only full-content embeds, and graph visualization in one release. Preserve badge/card paste defaults, personal ownership, and bounded one-hop AI queries.

| Decision | Approved default | Scope implication |
| --- | --- | --- |
| External scope | Public GitHub titles/descriptions/status where available, with URL-derived fallback; hostname fallback for other sites | M5 and its network safeguards are required before release. |
| Paste/drop default | Badge within prose; card in empty paragraph | Always-inline is simpler but makes excerpts less discoverable. |
| Meaning of “embed” | Paste defaults to title/excerpt card; explicit Embed displays read-only live content | M7 defines bounded rendering; editing opens the source. |
| Internal types | Pages, persisted journal entries, and their blocks, across both editor surfaces | M6 defines block targeting and deletion semantics. |
| Picker syntax | `[[` and `/Reference`; block/Embed modes and explicit slash commands; choose existing content only | No create-on-missing or additional shorthand syntax is required. |
| Graph membership | Badges, cards, and resolvable ordinary internal links; direct occurrences only | Excluding plain links would make backlinks incomplete for existing notes. |
| AI scope | One-hop references plus existing semantic search; graph UI uses the same adjacency service | Multi-hop AI traversal and ranking remain outside scope. |
| Editor navigation | Keep single-click for selection; explicit Open and modifier-click for navigation; retain double-click | Replacing single-click behavior would be an editor-wide UX change. |
| Ownership | Personal notes under current user ownership | Sharing/workspace ACLs must be designed before supporting cross-user targets. |

## 4. Existing architecture and integration constraints

Paths are repository-relative; proposed new paths in later sections do not exist yet.

| Existing path | Finding and implication |
| --- | --- |
| `packages/blocknote/src/blocknote-schema.ts` | Shared schema currently contains default block specs. Add explicit custom reference types and retain all defaults. |
| `apps/web/src/components/editor/use-block-editor.ts` | BlockNote `~0.55.0`; single-click on anchors is intercepted and double-click uses `window.open`. Coordinate previews/navigation here rather than attaching competing handlers. |
| `apps/web/src/components/editor/block-editor.tsx` | Diffs content/props into block/edge transactions; skips agentic intermediate changes. Hydrating a preview must not mutate those serialized props. |
| `apps/web/src/components/editor/block-editor-utils.ts` | Flattens nested editor blocks; extraction must also cover table cells and inline arrays, not just paragraph roots. |
| `apps/web/src/app/(app)/pages/_components/page-editor.tsx` | Debounced page saves through `pages.saveTransactions`; preserve its batching and error handling. |
| `apps/web/src/app/(app)/journal/_components/journal-entry-editor.tsx` | Journal drafts can exist before a document is created; use the real document ID returned on first save. |
| `apps/web/src/trpc/procedures/journal.ts` | Journal saves use a transaction, date advisory lock, and optional `expected_updated_at`. Preserve these semantics. |
| `apps/web/src/trpc/shared/block-transaction.ts` | Central block persistence; currently does not wrap page saves in a transaction and starts embedding work inside the helper. Refactor the shared commit boundary before adding the reference projection. |
| `packages/db/src/core/document.schema.ts` | Both note types already have an underlying UUID document owned by a user. This is the graph node identity. |
| `packages/db/src/core/page.schema.ts`, `journal-entry.schema.ts` | Page has `title`; journal has `date`, with no separate title/description field. Excerpts must derive from content. |
| `packages/db/src/core/block-node.schema.ts` | Stable block UUIDs and JSONB content. `BlockEdge` describes sibling ordering, not semantic references. |
| `packages/db/src/core/tree-edge.schema.ts` | Sidebar hierarchy/ordering. Do not store semantic relationships here. |
| `apps/web/src/components/ui/hover-card.tsx` | Uses Base UI PreviewCard. Reuse for passive previews; use an accessible popover for menus/actions that need focus. |
| `packages/blocknote/src/server/blocknote-markdown.ts` | ServerBlockNoteEditor uses the shared schema and lossy Markdown export; custom schema changes must work on the server too. |
| `apps/web/src/ai/tools/semantic-page-search.ts`, `semantic-journal-search.ts` | Existing Mastra tools query authorized tRPC APIs. Return document IDs as well as current page/entry IDs so their results seed graph lookups. |
| `apps/web/src/ai/mastra/agents/journl-agent.ts` | Register the read-only tool in the common tool map used by both agents. |

Required writer hardening within this feature's save boundary: verify source document ownership before any mutation; scope block and edge reads/deletes/updates by user AND document; reject attempts to upsert an existing foreign or other-document block UUID; validate parent/sibling endpoints belong to that source. Current conflict upserts use only block ID, and edge removal lacks user/document filters. Adding graph data must not inherit those assumptions.

Do not reuse `apps/web/src/trpc/embedder/document.ts` as a preview API: it is a public procedure, and its document read does not scope by the supplied user ID. The shown `/api/trpc` route mounts `apiRouter`, not `embedderRouter`; this review does not establish whether that separate router is externally exposed. Its exposure/hardening is a separate audit, not a new dependency for preview reads.

## 5. Authoring and interaction contract

### Insertion matrix

| Input/context | Behavior |
| --- | --- |
| Single URL into empty, top-level paragraph | Insert a card immediately with safe fallback; resolve internal identity asynchronously. Leave a trailing editable paragraph. |
| Single URL within prose or a list item | Insert an inline badge. Internal label resolves to current title; GitHub label uses enriched metadata when available, with a path-derived fallback. |
| URL pasted over selected words | Preserve the words as an ordinary link/custom label. Offer explicit Convert to badge/card. |
| Code block, inline-code span, multiline/multi-URL text, file paste | Delegate to existing/default handling; no automatic conversion. |
| HTML/native BlockNote clipboard data | Preserve native structured content first; do not collapse a rich selection to a single link because plain clipboard text looks URL-like. Validate imported reference props. |
| Plain URL drop (`text/uri-list` or `text/plain`) | Apply the same position/context rules as paste. Files keep existing upload behavior; editor block reorders retain BlockNote behavior. |
| Sidebar page drag | Add a separate custom MIME payload containing page ID; resolve ownership before insertion. Integrate into current sidebar drag handlers without overriding reorder gestures. |
| `/Reference` or `[[` | Open searchable picker; return typed results with title/date and ID. Enter chooses; Escape leaves typed text intact. Slash command inserts a card only in an empty paragraph. |
| Explicit conversion | Offer Link, Badge, Card, and Embed for internal targets. Card conversion is enabled only for an isolated reference; never split surrounding prose automatically. |

Recognition is limited to exact single HTTP(S) URLs or canonical relative internal routes. Do not use a URL regex over arbitrary prose. Typed `[[...]]` is a picker trigger, not title-based persisted syntax. No missing-note creation, title alias registry, `![[...]]`, or `((...))` shorthand is required. Block and embed authoring are available through picker modes and slash commands in section 13.

Insertion is a single local undoable editor operation. Preview hydration never adds undo entries. If resolution is asynchronous, replace the pending internal URL only when the insertion still exists, its identity has not changed, and it belongs to the same editor; never use a stale cursor position. Group that replacement with the insertion where the installed editor history API permits it. If grouping cannot be reliable, keep a plain link and offer explicit conversion; do not ship an async mutation that restores content after undo. Record the chosen behavior in M0.

### Rendering examples

```text
Inline:  Reviewed [GitHub · atomly/journl #291] and [Page · Editor design].

Card:    Page
         Editor design
         The editor should recognize a pasted link and offer…
         Open · Display as… · Copy link

Card:    Journal entry
         October 6, 2026
         Today I mapped the relationships between…
```

Title display is capped at two lines; excerpts at three lines. Generate at most 240 Unicode code points, collapse whitespace, and append an ellipsis when truncated. Journals use the stored calendar date formatted for the user's locale, never a timezone conversion of midnight UTC. Badges show an optional user-authored label instead of title; cards still show the actual target title.

GitHub URL fallbacks (during loading or when metadata is unavailable): repository `GitHub · atomly/journl`, issue `GitHub · atomly/journl #291`, PR `GitHub · atomly/journl PR #300`. Only exact `github.com` is recognized; profiles and unsupported paths use `GitHub · <path>` with length limits. No guessed issue titles/statuses. Other external sites use `Link · <hostname>` and the original URL; their card has no invented description.

### Mouse, keyboard, touch, and selection

- Preserve existing anchor selection/double-click behavior. Cmd/Ctrl-click opens safely; do not intercept Shift-click, middle-click, or browser context menus unnecessarily.
- Hover with a collapsed selection opens after 300 ms; dragging/selecting text suppresses it. Moving into the preview keeps it open; Escape closes it. Avoid one preview per badge.
- Keyboard focus exposes a description and preview without moving the caret. A dedicated Preview button opens a focusable popover with Open/Copy/Display actions. Passive hover information must not be the sole route to those actions.
- On touch, tapping an atomic badge selects it and exposes Preview/Open actions; it never navigates accidentally while editing. Ordinary text links retain caret selection and their editing toolbar.
- Open uses the client router for authorized internal targets and a real safe external link (`noopener,noreferrer`) for external targets. Keyboard activation of Open is independent of contenteditable handling.
- Atomic badges and cards have meaningful accessible names; keyboard can move before/after, select, and delete them. Backspace/Delete removes the selected occurrence, never the target. No nested interactive links/buttons.
- A missing/inaccessible internal reference displays the same “Content unavailable” state. Show no cached target title/excerpt and no existence-specific error; allow removal, replacement, and copying the reference's stored link. User-authored aliases can remain as source text.
- Use skeletons for first load, text fallback for network failure, and a retry action. Preview problems never invoke the editor's save error overlay.

## 6. Target identity and serialized editor data

Internal identity is `Document.id`, independent of page title, sidebar tree node, journal date, and source editor ID. External identity is the normalized URL. A future document-backed note type supplies a resolver without changing source serialization.

Domain-level shape (not a BlockNote prop schema):

```ts
type ReferenceTarget =
  | { kind: "document"; documentId: string; blockId?: string }
  | { kind: "external"; url: string };
```

BlockNote custom props must be scalar. Define `contentReference` inline content, `referenceCard` block, and `contentEmbed` block, all with `content: "none"`. They use the same validated fields:

```ts
type ReferencePropsV1 = {
  version: 1;
  targetKind: "document" | "external";
  documentId: string; // UUID for document; empty string for external
  blockId: string;    // UUID for a block target; empty for whole document/external
  url: string;        // canonical internal fallback href or original external URL
  label: string;      // user-authored alias; empty means resolve current label
};

// Paragraph inline occurrence; UUID below is illustrative.
const inline = {
  type: "contentReference",
  props: {
    version: 1, targetKind: "document",
    documentId: "36b06f18-6e7f-4b9e-9139-773f1f47baac", blockId: "",
    url: "/pages/24c335d6-7c2b-4f57-a911-9c8bbd8a92a6", label: "",
  },
};
// A card stores the same props in BlockNode.data.props;
// BlockNode.data.type is "referenceCard" and it has no editable content.
```

No fetched title, excerpt, icon URL, source status, or nested target content is stored in these props. Metadata updates must not cause block saves, document timestamp changes, or embedding jobs. `label` is intentional source content and can differ from the title.

Validation: version exactly 1; UUID document ID for internal; optional UUID block ID (empty defaults to whole document); empty document/block IDs for external; URL max 2,048 characters; label max 255 characters; allowed scheme and route rules below. `contentEmbed` permits internal targets only. Keep default legacy block validation compatible while adding strict validation for the three new types. Never trust client-provided metadata or ownership. Unknown versions must degrade to escaped readable links, not crash document loading or erase source JSON. The original draft was never deployed, so include these fields in version 1 rather than shipping an intermediate schema.

### URL classification

1. Parse with the URL parser using `PUBLIC_WEB_URL` as base. Relative `/pages/<uuid>` and `/journal/<YYYY-MM-DD>` are internal. Absolute URLs are internal only on configured trusted application origins (production plus explicit preview/development origins); never match by suffix or pathname alone.
2. Match those routes exactly, permitting an optional trailing slash. Validate journal dates as real calendar dates. Queries may be retained for navigation but do not establish identity. Recognize validated `#block=<uuid>` targets as specified in section 13; other unsupported fragments remain ordinary links.
3. Resolve page ID or date under the authenticated user to its document. Resolution is read-only; an unpersisted day returns unavailable and creates no JournalEntry or Document. A user's unsaved source draft can contain references to persisted targets and gains graph occurrences after its first save.
4. Prefer explicit `documentId` whenever present; do not fall back to date/URL resolution if that document has been deleted. The stored URL is a fallback for clipboard/export, not a way to bypass authorization.
5. External URLs permit HTTP(S); reject embedded credentials, control characters, and non-web schemes for custom references. Existing mailto or other legacy links remain ordinary links and receive no rich preview.
6. Normalize external identity by URL parsing: lowercase host, remove default port and fragment, preserve path case and query parameters/order. Preserve the original URL in source content for navigation. Do not strip arbitrary query parameters or equate http with https. A SHA-256 of the normalized URL is the external graph key; never log full URLs.

Resolver interface: `resolveDocuments(userId, documentIds)` returns the supported target type, current route, title, content version, and excerpt. Initially dispatch by owned Page or JournalEntry joined on document ID. A future document-backed note type registers here. Folders and external services are not private document nodes; separate future target kinds require versioned contracts.

Pages and journal rows do not currently enforce unique document IDs across both tables. Audit existing data before rollout; enforce one document per note row with per-table uniqueness and enforce the cross-type invariant in creation code. If a document maps ambiguously to multiple entities, resolver returns unavailable and emits a redacted diagnostic rather than choosing arbitrarily.

## 7. Preview/picker/API contracts

Add a `references` router to the authenticated `apiRouter`. All methods use `protectedProcedure`; no caller-supplied user ID and no public endpoint. UI and AI share server resolver/query functions.

```ts
type Preview =
  | {
      status: "ready"; kind: "page" | "journal";
      documentId: string; entityId: string; href: string;
      title: string; excerpt: string; truncated: boolean;
      contentUpdatedAt: string; metadataUpdatedAt: string;
    }
  | {
      status: "ready"; kind: "external";
      href: string; provider: "github" | "generic";
      title: string; excerpt: string; truncated: boolean;
      metadataState: "url-only" | "enriched";
    }
  | { status: "unavailable" }; // missing and unauthorized are identical

// Authenticated RPC methods (names proposed):
references.resolveUrls({ urls: string[] })
// <= 50 unique URLs; per-item { url, target: ReferenceTarget | null, preview: Preview }

references.getPreviews({ targets: ReferenceTarget[] })
// <= 50; per-item { target, preview: Preview }; external uses the public GitHub provider with local URL fallback

references.searchTargets({ query: string, types?: ("page" | "journal")[], cursor?: string, limit?: number })
// query <= 200 chars; limit default 20/max 50; title/date matching, not paid semantic search
// { items: { documentId, entityId, kind, title, href }[], nextCursor: string | null }

references.listOccurrences({ documentId: string, direction: "incoming" | "outgoing", cursor?: string, limit?: number })
// limit default 20/max 50; { items: OccurrenceView[], nextCursor: string | null }

references.listBacklinks({ documentId: string, cursor?: string, limit?: number })
// limit default 20/max 50 source documents; grouped sources, total occurrence count,
// up to 3 snippets per source, nextCursor. Load only for an authorized target.

references.queryNeighbors({ documentId: string, direction: "incoming" | "outgoing" | "both", cursor?: string, limit?: number })
// limit default 10/max 20 distinct neighbors; shared with the AI tool in section 9
```

Malformed batch envelope is BAD_REQUEST; valid batches with unavailable targets return per-item fallbacks. No existence leaks via counts or error wording. Search filters by owner before matching, ranks exact title/date then prefix then substring, and orders ties by kind/title/document ID. Empty query returns recently updated persisted targets. Escape SQL wildcard characters in search text. Use opaque validated keyset cursors containing the corresponding sort tuple, not unrestricted SQL values.

Generate excerpts deterministically from the current owned blocks in document order, including textual table cells/list content, excluding code, raw URLs, images/files, reference cards/embeds, and resolved target text. Inline aliases may contribute their source-authored text. Never recurse into another reference. Do not use AI summaries or embedding chunks: they can lag behind saves and would couple previews to usage costs. Bound traversal by existing document limits and stop once enough eligible text is collected. Share the extractor with backlink source snippets (max 160 characters).

`contentUpdatedAt` comes from Document; `metadataUpdatedAt` from Page/JournalEntry, since page rename currently updates Page but not Document. Do not assume one timestamp covers both. Fetch only authorized rows and minimal fields; batch blocks/edges by owned document IDs instead of one query per target.

### Client cache and request lifecycle

- A coordinator per editor discovers references in visible cards, and fetches ordinary links/badges on preview activation; deduplicate by target. Batch across simultaneous activations on the next task tick, max 50. Never eagerly resolve every link in a long journal timeline.
- React Query key includes the authenticated user/session scope plus target identity; cache lives only in the session. Clear it on logout/user switch and avoid persisted private previews.
- Internal ready previews: stale after 30 seconds; unavailable after 5 seconds; garbage collect after 5 minutes. Recheck on reopening once stale and on window focus. No polling while closed.
- Own-app content save/rename/delete invalidates affected previews and occurrence lists. Deletion removes ready cached content immediately. Other-tab edits are observed on focus/reopen within the stale window; real-time cross-tab propagation is outside scope.
- Abort unresolved work on editor unmount where no other consumer needs it. Guard asynchronous conversions by editor instance and insertion identity. Transient errors stay separate from `unavailable` and permit retry; do not cache them indefinitely.

## 8. Reference projection and relational graph

Add `packages/db/src/core/document-reference.schema.ts` and export it from `packages/db/src/schema.ts`. Keep relationships in Postgres; a separate graph database is unnecessary for the initial indexed adjacency queries.

Proposed `document_reference` table:

| Column | Type/constraint | Meaning |
| --- | --- | --- |
| `id` | UUID PK, generated | Occurrence row identity, not editor identity |
| `user_id` | text NOT NULL, user FK cascade | Owner, derived from authenticated source |
| `source_document_id` | UUID NOT NULL, Document FK cascade | Source graph node |
| `source_block_id` | UUID NOT NULL, BlockNode FK cascade | Exact authored provenance |
| `occurrence_path` | text NOT NULL, max 256 | Deterministic position, e.g. `/content/2`, `/content/rows/0/cells/1/0`, or `/props` for card |
| `target_kind` | text CHECK document/external | Target discriminator |
| `target_document_id` | UUID nullable, deliberately no target FK | Stable internal identity retained when a target is deleted |
| `target_block_id` | UUID nullable, deliberately no target FK | Optional stable block target; requires internal document identity |
| `target_url` | varchar(2048) nullable | Normalized external URL; null for internal |
| `target_key` | text NOT NULL | `document:<uuid>`, `document:<uuid>#block:<uuid>`, or `external:<sha256>` |
| `presentation` | text CHECK link/badge/card/embed | Source representation, not a semantic edge type |
| `created_at`, `updated_at` | timestamptz NOT NULL | Projection bookkeeping |

Constraints: exactly one of target_document_id/target_url populated consistent with `target_kind`; target_block_id is nullable and permitted only for internal targets; unique `(source_block_id, occurrence_path)`; indexed `(user_id, target_document_id, source_document_id, source_block_id)` for incoming and `(user_id, source_document_id, source_block_id)` for outgoing; external lookup index `(user_id, target_key)` if used. Extractor guarantees target_key matches target fields; only server code writes this table.

Source foreign keys ensure deletion cleanup; same-owner/same-document consistency must be checked inside the locked save transaction because existing single-column FKs do not enforce it. Retaining a deleted target UUID allows truthful dangling relationships and avoids silently binding to a newly created page/date. API resolution checks ownership every time and exposes no target metadata on failure. No separate tombstone containing private target titles.

An edge is a direct occurrence. Two mentions in one block produce two rows; backlinks group by source document and return bounded occurrence snippets. A graph node pair can aggregate occurrences for traversal, but no transitive edges are stored. Self-references and cycles are valid. AI never recursively expands them; embed rendering uses the bounded policy in section 13. Display conversion changes `presentation` only; graph adjacency is unchanged.

### Extractor

Implement a pure server-side extractor over validated persisted block data. Recognize `contentReference`, `referenceCard`, `contentEmbed`, and default inline `link` objects, including nested/table inline content. Do not regex scan strings, code, or prose. For ordinary links, resolve only canonical internal URLs to owned documents; keep external occurrences as external URLs. Unresolved internal routes contribute no edge and never become external network fetches. Invalid custom data fails a new write before mutation; legacy malformed data has a readable fallback and contributes no edge.

Ordinary internal links retain URL navigation semantics: their projection resolves the current route on save/backfill. If an entry is deleted and recreated at the same date, that URL can resolve to the new document; a resave/rebuild updates its projection. Only explicit serialized document references guarantee stable identity across deletion/recreation and arbitrary edits. Explain this distinction in the conversion UI and tests; previews of ordinary URLs resolve their current route, and legacy projections can lag route changes until rebuild. On target deletion, remove incoming ordinary-link rows in the same transaction while retaining badge/card rows. New target creation may discover legacy incoming links during a repair/backfill, not through speculative graph edges.

Occurrence paths are derived from the final block snapshot, not client IDs or text offsets. They can change on edits; graph row IDs are not a permanent citation API. An AI citation uses source document + source block ID and the server-generated href.

### Atomic save algorithm

```text
BEGIN (reuse journal's outer transaction; open one for pages)
  validate source ownership; lock source Document row FOR UPDATE
  validate all existing block/edge IDs and reference prop shapes
  apply block/edge transactions in order, restricted to this owner/document
  collect affected block IDs, including descendants removed by cascade
  read final surviving snapshots for affected blocks, not intermediate upserts
  batch-resolve new internal targets under the same owner
  normalize newly unavailable references; persist normalized block snapshots
  extract occurrences from final normalized snapshots
  replace occurrence rows for affected blocks with extracted rows
  bump Document.updated_at and finish existing page/journal save semantics
COMMIT
  invalidate client projections from response; enqueue embedding after commit
```

New explicit internal IDs must resolve to an owned target. An already-authored dangling ID may be preserved (including display changes) if it belonged to the same source document's committed references. For copy/import/new dangling IDs, normalize to an ordinary safe link before persisting rather than accepting an arbitrary unknown document ID. Return normalized affected blocks in the save response so the client reconciles that committed fallback without generating another save or undo entry. If a target disappears during insertion, preserve the original link without graph creation. Do not expose whether an unavailable ID belongs to someone else. Invalid prop shapes still fail validation; inaccessible targets are a supported normalization result, not an editor-fatal save error.

Select owned targets with `FOR KEY SHARE` on Document to serialize against document deletion; acquire multiple target locks in UUID order. Retain the source's `FOR UPDATE` lock. Allow for database deadlock detection on simultaneous cyclic edits; retry rolled-back transactions up to twice in the router with bounded jitter, then return a retriable save error. Never retry a commit with an uncertain outcome as though it definitely failed. Deleting a target immediately after commit leaves dangling explicit IDs; its delete transaction removes legacy URL occurrences as described above.

Use the existing journal date lock before the source-document lock. Lock source first for save serialization; add no multi-document writes. New journal draft references project only once its outer transaction creates the source Document/JournalEntry. Page saves have serialized commits but retain their current last-commit-wins policy; introducing page optimistic concurrency is separate work. Existing journal version conflict remains atomic and returns no graph changes.

Server helper returns embedding job arguments; router starts the existing embedding workflow only after commit. A workflow enqueue failure is logged separately and never rolls back a successfully committed edit. A durable outbox would improve delivery guarantees but is not required for synchronous reference consistency. Projection failure rolls back blocks, edges, timestamp, and graph together. No network metadata requests run in that transaction.

Keep existing page/journal save response fields and add `normalizedBlocks` only when the server changed source representation. The journal response still includes its current entry version. Update both wrappers to reconcile these blocks using a scoped programmatic change that does not reenter saving, while preserving edits made locally after the submitted batch; if the affected local block has changed meanwhile, resolve through the existing save/version recovery instead of overwriting newer input.

AI intermediate/rejected suggestions are not graph input. Verify that accepted changes flow through normal saving even with `isAgenticEditorChange` filtering. If acceptance does not emit a normal save event, wire a single committed diff there; rejection emits none. This is a required integration check, not an assumption.

### Backlinks and navigation

Both page and single-entry views render a “Referenced by” panel below the editor, lazy loaded when expanded. Each item has current source title/type, max 160-character authored context, occurrence count, and Open at block. A timeline can show a count per persisted entry and open that entry's panel; do not load all backlink lists for the timeline.

Authorize the requested node and source documents/blocks before pagination/aggregation. Resolve each target under the same user; authored dangling IDs may be returned as unavailable without target metadata. Incoming/outgoing row cursors use `(source_document_id, source_block_id, occurrence_path)` in stable order; grouped backlink pagination first selects distinct source-document IDs, then fetches up to 3 occurrences per selected source and a total count. Never paginate occurrence rows and then pretend the results are complete document groups.

Add internal `#block=<uuid>` navigation generated by the server. After the correct editor mounts, locate the block with editor-scoped querying, scroll and highlight it without changing content. If missing, open the source note and show a quiet fallback. Do not interpolate unvalidated hashes into DOM selectors. This supports provenance navigation; selecting a target block as a reference is required by section 13.

## 9. AI querying contract

Add `apps/web/src/ai/tools/query-note-references.ts` using the existing `createTool` pattern and session-bound `api` server caller. Register it in `journl-agent.ts`. Consult the installed Mastra types/docs at implementation time; dependencies were not installed in this design workspace. [Mastra's tool documentation](https://mastra.ai/docs/agents/tools) describes typed input/output and tool registration; do not introduce another agent framework.

```ts
// Tool ID: query-note-references
type QueryNoteReferencesInput = {
  documentId: string;
  direction: "incoming" | "outgoing" | "both"; // default both
  limit: number;                               // default 10, max 20 neighbors
  cursor?: string;
};
type OccurrenceView = {
  sourceDocumentId: string; sourceBlockId: string; sourceHref: string;
  sourceTitle: string; sourceKind: "page" | "journal";
  snippet: string; presentation: "link" | "badge" | "card" | "embed";
  target: ReferenceTarget; targetPreview: Preview;
};
type Neighbor = {
  key: string; // document:<uuid>, document:<uuid>#block:<uuid>, or external:<sha256>
  target: ReferenceTarget;
  preview: Preview;
  directions: ("incoming" | "outgoing")[];
  occurrences: OccurrenceView[]; // at most 3 per neighbor
};
type QueryNoteReferencesOutput = {
  seed: { documentId: string; title: string; href: string };
  neighbors: Neighbor[];
  nextCursor: string | null;
  truncated: boolean;
};
```

Tool returns one hop only, deduplicates neighbor documents/normalized external URLs, caps total serialized output at 16 KiB, and marks omitted items with `truncated: true`. For incoming edges the neighbor is the source document; for outgoing it is the target. `both` unions those identities before limiting and stores both directions on the neighbor. Sort by neighbor key; the opaque cursor contains the last returned key plus seed/direction, and must match the request. If the byte budget stops early, nextCursor resumes after the last included neighbor. Self-neighbors are excluded by default but remain visible in occurrence lists. Externals are terminal outgoing URL references; unavailable targets have no metadata. No implicit similarity ranking.

Extend semantic search outputs with `document_id` by selecting the existing embedding document ID, retaining existing fields for compatibility. Typical flow: semantic search → choose seed → query explicit neighbors → fetch authorized note content separately if excerpts are insufficient → cite source note/block. No uncontrolled recursive graph walk, external URL fetching, or embedding of a target's full text into every source.

Specify an authorized `references.getDocumentContent({ documentId })` helper/API if the existing page/entry reads cannot serve that final content step: validate ownership, dispatch to the type-specific read, and return bounded blocks/Markdown plus current href. The graph tool itself needs only excerpts. It must never call the public embedder procedure.

Prompt/tool descriptions must explain that references express authored connections, not proof of semantic agreement, and retrieved content is data, not instructions. The tool is read-only, requires no usage quota for its database query, and exposes no cross-user nodes. Model usage remains under existing agent quotas. AI-authored references still follow the normal accept/reject and save path.

## 10. Editor schema, clipboard, export, and compatibility

Use one shared configuration for custom type names/props and separate implementations where needed: server-safe static HTML and client React rendering with preview context. `packages/blocknote/src/blocknote-schema.ts` remains a server-safe schema export; introduce a client schema factory/entry point only if necessary, and use it from `use-block-editor.ts`. Both schemas must define exactly the same persisted types, defaults, and prop values. Keep client imports out of server Markdown/embedding modules.

The shared BlockNote package must not depend on web tRPC or app navigation. Client renderers obtain cached metadata and actions from a provider injected alongside BlockEditor; static export has no React Query/session dependency. Verify this split in M0 using BlockNote 0.55 signatures rather than copying latest web examples without checking. Official references: [custom inline content](https://www.blocknotejs.org/docs/features/custom-schemas/custom-inline-content), [custom blocks](https://www.blocknotejs.org/docs/features/custom-schemas/custom-blocks), [paste handling](https://www.blocknotejs.org/docs/reference/editor/paste-handling).

- JSON/native clipboard preserves IDs/props and creates fresh source block IDs on copy. Moving within an editor retains source IDs. Revalidate ownership on the server; clipboard attributes cannot authorize targets.
- HTML exports readable anchors with fallback href/label and versioned `data-journl-reference-*` attributes for reimport. Only recognized validated attributes are parsed; labels are escaped. Static export must work without preview-provider hooks.
- Plain clipboard contains readable label plus URL; normal external applications need no custom renderer.
- Markdown export emits `[label](href)` for badge/card, never a blank unsupported block. Card title/excerpt rendering is intentionally lost. For indexing use deterministic source-authored label/fallback, not fetched metadata or target text. A general future user export may hydrate current authorized titles separately.
- Verify `blocksToMarkdownLossy` output rather than assuming `toExternalHTML` alone guarantees Markdown support. If the custom types are unsupported, transform them to default paragraph links in an export-only clone before conversion.
- Imports of those ordinary Markdown links can derive legacy graph edges but do not promise full badge/card/ID round-trip. A deleted date target cannot retain explicit identity through plain Markdown alone; JSON/native export is the faithful format.
- Existing ordinary links are not visually rewritten by backfill. On-demand preview and explicit conversion are additive. Keep old blocks with optional content valid as in `blocknoteBlocks` today.
- Client display failover for malformed/unknown references must preserve raw source data. Do not silently save a downgraded document until the user explicitly edits the occurrence.

## 11. Public GitHub metadata enrichment (M5, required)

Approved as a required part of the single release: repository/issue/PR titles, descriptions, and statuses where public metadata is available. Internal previews and graph implementation can proceed independently, but release completion requires this provider and its failure handling.

Use a provider registry with `canHandle`, `parseTarget`, `resolveMetadata` and `formatFallback`. GitHub parses recognized repo/issue/PR paths and calls fixed `https://api.github.com` REST endpoints assembled from encoded validated path components. User URLs are never fetched directly. No arbitrary Open Graph scraper in this milestone. Unknown paths and private/404/rate-limited responses retain URL-only fallback. Do not use user credentials or accept custom GitHub hosts in this public provider.

Resolver must use no ambient auth cookies, reject query-bearing URLs for enrichment (render them locally), disable redirects, and permit only HTTPS port 443 to the fixed API hostname. Protect the transport against private/loopback/link-local/metadata addresses for IPv4/IPv6 with DNS validation and connection pinning or equivalent egress enforcement. If the transport cannot provide this, keep enrichment disabled. Do not fetch provider-supplied images/favicon URLs; use local icons. Escape all returned strings and render no provider HTML.

Use a 3-second timeout with abort, 256 KiB streamed response limit, JSON content-type check, and caps of 200 characters for title/500 for provider description (card still displays 240). No automatic retry on interaction; respect rate-limit reset and back off. At most 4 concurrent provider calls per process and 20 cache-miss calls per user/minute with a shared limiter; hits do not consume this limit. Return URL-only fallback instead of throwing into the editor.

Persist metadata in a separate owner-scoped cache: key `(user_id, provider, provider_target_key)`; sanitized metadata JSON, `fetched_at`, `expires_at`, state. Cache positive responses 1 hour, absent metadata 5 minutes, transient failures 30 seconds (rate limits until reset); purge unused rows after 30 days. Bypass cache immediately if provider access policy changes. No private internal metadata in this table. Scope keys by the public provider target, not arbitrary token-bearing query URLs. Concurrent misses coalesce; metadata resolution never runs during a document save.

Any later arbitrary-host fetcher requires a dedicated SSRF design covering redirects, DNS rebinding, IP encodings, response decompression/content limits, private domains, caching, and request privacy. Full-content external iframes/oEmbed need separate sandbox and provider policies.

## 12. Delivery plan and agent handoff

Product approval is recorded; the implementation agent may proceed without another scope approval. Work in dependency order; milestones are internal work units, not separate feature releases or time estimates. Keep implementation PRs reviewable and reference this design PR. The complete release requires M0–M8 and R1–R14.

| Milestone | Work and principal paths | Exit condition |
| --- | --- | --- |
| M0: compatibility spike | Verify installed BlockNote 0.55 custom inline/block specs, server/client schema separation, `[[` trigger support, paste/drop API, async history, AI acceptance saves; inspect sidebar drag integration | One badge/card survives save/reload, copy/paste, server Markdown export, and undo; record API choices before feature work. If `[[` multi-character trigger is unsupported, implement a small tested editor extension rather than assuming SuggestionMenuController handles it. |
| M1: commit foundation | New DB schema/export; shared reference parser/extractor; harden and transact `shared/block-transaction.ts`; update page/journal save callers and `procedures/document.ts` deletion; normalized-save response handling; start embedding after commit | Blocks and occurrences commit together; owner checks, cascade cleanup, retry, and journal conflict tests pass. |
| M2: internal resolution | New `trpc/shared/reference-target.ts`, `reference-preview.ts`, `reference-projection.ts`; `procedures/references.ts` and router registration | Batch previews/search/occurrences are authorized, bounded, deterministic, and usable for both note types. |
| M3: editor authoring | Shared/client schema specs; `components/editor/references/` provider, badge/card, picker, preview coordinator; editor hook/tools and both editor wrappers | Paste/drop/conversion/preview behavior matches section 5 with URL-only GitHub fallback. |
| M4: backlinks and AI | Both note surfaces; block deep-link handling; `query-note-references.ts`; semantic search document IDs; agent registration | Cross-type backlinks and bounded AI neighbor query use the same committed graph, with source citations. |
| M5: GitHub enrichment | New server provider/cache/limiter modules and GitHub tests | Required: public metadata, network policy, cache, and fallback tests pass. |
| M6: block references | Extend target props/projection/preview/backlink APIs; block picker and copy-link action; validate block membership and deletion | Exact block references survive reload/rename and remain unavailable after deletion; document and block backlinks agree. |
| M7: live read-only embeds | `contentEmbed` schema/client/static renderer; bounded `getEmbedContent`; invalidation and cycle handling | Current source content renders without duplicated source blocks, recursive requests, or source writes; limits and exports pass. |
| M8: graph visualization | Bounded `getGraph` API, `/graph` and note-local graph, keyboard/list interface, provenance panel | Complete authorized graph exploration with block nodes, clipping indicators, filters, and accessible navigation. |

M1/M2 can expose server contracts before M3, but do not enable custom-type writes until all readers/server exporters support them. M4 alone is not release completion. M5–M8 are equally required; all feature surfaces become available in the same release after verification.

### Data deployment and backfill

The repo currently uses Drizzle schema discovery and `pnpm db:push`; no versioned migration directory was found. Supply reviewed additive DDL and an explicit deployment/backfill script using the repository's chosen deployment process. Do not invent a migration runner silently and do not run against production during implementation.

1. Audit ambiguous document/entity mappings and add occurrence table/indexes with feature reads/writes initially disabled.
2. Deploy compatible readers/exporters, then enable transactional projection for all normal saves. Custom authoring remains disabled.
3. Run an idempotent owner-scoped backfill in bounded batches (e.g. 100 documents, resumable document-ID cursor), taking the same source lock and using the same extractor. Resolve ordinary page/entry links; do not fetch metadata, rewrite content, bump document versions, or enqueue embeddings.
4. Reconcile projected occurrences against source data, collect malformed/unresolved counts without logging content, and mark projection ready. Do not present incomplete backlink counts as complete during the backfill.
5. After M0–M8 pass, enable previews, block authoring, backlinks, AI querying, GitHub enrichment, embeds, and graph UI together via one server-authoritative rollout flag. Gradual rollout cohorts receive the complete feature set; verify saves and fallbacks.

Repair command rebuilds one owner/document transactionally from persisted content. Backfill cannot recover the historical identity of a date-based plain link whose original target was deleted; it resolves current routes. New explicit references prevent that ambiguity going forward.

Rollback disables authoring and provider fetching but keeps compatible readers and extraction for already-authored references. Do not drop source props/graph schema or deploy a default-only BlockNote reader after custom content has been saved. Projection can be repaired/rebuilt without content loss.

### Required verification for implementation

| Layer | Meaningful scenarios |
| --- | --- |
| URL/parser/extractor | Exact GitHub host vs spoofed suffix; trusted app origins; valid/invalid dates; unsupported schemes/credentials; labels/Unicode; inline/table/nested references; code excluded; duplicate occurrences; legacy URL semantics vs explicit dangling identity. |
| Database integration | Two real users; foreign document/block upsert and edge spoof rejected; rollback on projection failure; subtree cascade removes occurrences; batch final snapshot; concurrent saves; journal creation/conflict; target delete/recreate; self/cyclic references; backfill concurrent with save and rerun. Use real Postgres for locks/FKs/rollback. |
| API | Batch/pagination limits; no metadata/existence leaks; search escaping; exact title collisions; fresh title after rename; deterministic truncation; grouped counts; unavailable target/unsupported kind; no paid embedding dependency. |
| Editor/clipboard | Paste contexts; URL vs native HTML precedence; URI/file/internal drag; inline/card conversion; undo during pending resolution; unmount; badge deletion; schema load/export with no client provider; AI accept/reject; existing draft lifecycle tests. |
| Accessibility/browser | Mouse hover/delay/selection; keyboard picker/focus/Escape/Open; touch selection; screen-reader names; mobile layout; modifier/double-click; block navigation after mount. Check in a real browser, not only mocked DOM. |
| AI | Owned seed only; cross-type neighbors; duplicates/cycles/output budget/pagination; source block citations; external terminal URLs; retrieved instruction text treated as data. |
| GitHub provider | Fixed-host URL construction; redirect/IP/DNS policy; streamed size/timeout; malformed JSON; 404/private/rate limit; cache coalescing/expiry; no cookie/auth forwarding or remote image requests. |
| Block references | Nested/table block lookup; membership checks; copy vs move identity; deleted/recreated block; source-block backlink filtering; scoped deep links and read-only picker search. |
| Live embeds | Whole document/subtree updates; self/mutual/deep cycles; target deletion; size/depth limits; nested read-only links; hidden/unmounted cleanup; no source editor/AI selection registration; faithful JSON and readable Markdown export. |
| Graph UI | Mixed page/entry/block nodes; duplicate edge aggregation; unavailable targets; authorized clipping/counts; expand/reset/filter; keyboard/list equivalence; no implied similarity edges or automatic recursive expansion. |

Suggested implementation checks after dependencies are installed: `pnpm check`, `pnpm typecheck`, focused Vitest through `pnpm --filter @acme/web exec vitest run <test paths>`, and `pnpm build` for client/server boundaries. Preserve existing journal lifecycle/version test coverage. No runtime code changes are made by this planning PR, so those application checks are not evidence of this document's correctness.

Observability: redacted counters for resolver latency/failure, unavailable targets, save/projection failures, backfill progress, cache hit rate, and provider timeouts. Never log note excerpts, titles, raw URLs, or full editor payloads. Validate batching with a 100-reference document and a long timeline: duplicate references resolve once per cache window; UI fetches remain bounded by visible/activated references.

### Approval and handoff checklist

- [x] Reviewer approved defaults, section 11, and all planned features in one release.
- [ ] Implementation agent records M0 compatibility findings and resolves any unsupported APIs before broad changes.
- [ ] R1–R14 and #291's accessibility, ownership, fallback, and request-deduplication criteria have evidence.
- [ ] Backfill, deployment, and rollback steps are concrete and reviewed before rollout.
- [ ] Implementation PR(s) link this design review; source preserved for handoff.
- [ ] Delete this temporary spec from the implementation branch before merge; retain reviewed design in PR history. Do not merge an empty design-only PR just to mark it complete.

## 13. Expanded single-release contracts: blocks, live embeds, and graph

This section supplies the previously deferred functionality approved by the reviewer. Its contracts extend sections 5–10; all three features and section 11 are required release criteria. No intermediate public release of badge/card-only functionality is planned.

### 13.1 Block identity, authoring, and projection

The internal target is a document plus an optional block UUID. The document scopes authorization and routing; the block UUID selects a subtree within it. An empty block ID means the entire document. Block membership is validated by `(user_id, document_id, id)` on every resolve/save/content read. Do not accept a block from another document even when both belong to the same user.

- `/Reference block` and a Blocks mode in the shared picker search existing owned blocks. `/Reference` and `[[` retain their document defaults and expose that mode explicitly. No extra Markdown trigger syntax is required.
- Results show containing note title/type plus a maximum 160-character authored block excerpt. Return `{ documentId, blockId, documentTitle, snippet, href }`. Duplicate text never identifies a target.
- Add Copy block link to the editor block menu. Canonical href is the containing page/entry route plus `#block=<uuid>`. Pasting/dropping it creates a badge/card using the same context rules as document references.
- Block search uses the deterministic authored-text extractor over owned block snapshots, excludes code/reference-only blocks, and matches text without resolving nested targets. Limit defaults to 20/max 50, query max 200 characters, keyset order `(document_id, block_id)`. For scale, maintain a rebuildable `block_search_text` projection keyed by block ID in the save transaction; backfill it with references. Search is bounded by result limits and a query timeout, not by silently searching only recently opened notes.
- Add optional `blockId` filters to preview, occurrence/backlink, neighbor, and content requests. Document backlinks include references targeting the document or any of its blocks. A block-specific backlink list includes only occurrences targeting that exact block; descendant membership does not imply an authored relationship.
- A block preview returns the containing note's title/type and an excerpt of that block subtree. Add `targetBlockId?: string` to ready internal Preview. Missing blocks return unavailable; do not silently substitute the containing document.
- Add `target_block_id` to the table and an incoming index `(user_id, target_document_id, target_block_id, source_document_id, source_block_id)`. CHECK requires it to be null for external targets. Deletion retains explicit target block IDs, while ordinary URL rows targeting deleted blocks are removed transactionally. No private target-text tombstone or target FK cascade.
- Copying a source block creates a new source ID and preserves authorized target IDs. Reordering/reparenting within the same document preserves a target block's identity. A cross-document move is copy/delete under current persistence rules, so old references become unavailable; do not silently retarget them. A future true move requires its own identity migration.

Save normalization and graph extraction handle all three custom types with the same ownership rules. An embed is an explicit occurrence with presentation `embed`; content displayed inside it never adds inherited edges to the host. A block target's graph key includes its block ID. Note-level AI queries aggregate those targets to their containing document, retaining the exact block target in occurrence provenance; block-scoped AI queries retain exact targets. Include the chosen scope in cursors and reject a cursor reused for another scope.

### 13.2 Live, read-only document and block embeds

Add `/Embed note`, `/Embed block`, and an Embed choice on an isolated internal badge/card. External references have no Embed choice. Conversion is a single undoable operation using the same scalar reference props; `contentEmbed` is a source block with no editable child content. Paste/drop still defaults to card/badge, and embedding requires an explicit choice.

Render a source header (type/title, optional block context), live read-only content, and Open source/Display as/Copy link actions. Open source navigates to the exact target; edits occur in that source editor. Do not mount an editable BlockEditor or register a second active AI editor for an embed. Selection/copy within rendered content is allowed; typing, paste, deletion, AI acceptance, and block dragging affect only the host embed block or its own editor, never transcluded source data.

Add `references.getEmbedContent({ targets: InternalTarget[], cursor?: string })`, where `InternalTarget` is the document branch of ReferenceTarget and the batch is at most 10 targets. Each owned target returns current versions, safe href/title, ordered blocks for the document or subtree, and `{ truncated, nextCursor }`. Reuse block reconstruction after authorization. Limit to 200 blocks per target and 500 blocks/256 KiB JSON per batch; page by deterministic document traversal position and bind cursors to target and content version. A version change resets pagination. Target deletion/membership failure produces unavailable without source metadata. Fetch only visible expanded embeds, coalesce requests across them, and cancel on unmount when there are no other consumers.

Limits are loading/rendering budgets, not permanent truncation of the source: expose Load more within the remaining batch budget and Open source for the complete document. A note's top-level embed area may render at most 500 transcluded blocks at once; if exhausted, further expansion requires opening the source. Never retry recursively to fill a quota. Collapse large embeds locally without persisting display state into source props.

Nested contentEmbed nodes render with an ancestor target-key set and a maximum nesting depth of 2 (root embed is depth 1). A repeated key shows “Circular reference — Open source”; a depth-limit node shows a compact reference card. Block targets use their full document/block key; enforce the depth and shared block budget even when different block keys form a cycle. Nested badges/cards remain references with controlled preview activation. A nested embed may fetch only after an explicit Expand action; no eager recursive request tree. Apply the same authorization and byte budget at every request.

Cache with target and user scope, respecting the 30-second internal freshness policy. Invalidate embedded document/subtree content on save/delete of its containing document, including ancestor/block deletion, and metadata on rename. Renders use refreshed blocks without saving target content into the host, altering host timestamps, or triggering host embeddings. Cross-tab refresh occurs on focus/reopen; continuous collaboration remains outside scope.

JSON/native clipboard retains only the host embed block and target identity. HTML/Markdown export emits an ordinary readable source link (with block fragment when applicable), never stale transcluded private content. Server indexing sees only authored host reference labels/fallbacks. Embedded targets' outgoing links remain their own provenance; the host has only its direct embed relationship. Deleting the host embed removes that occurrence and never deletes source content.

### 13.3 Graph API and interaction

Add a global authenticated `/graph` route with a sidebar Graph action and an Open graph action in page/entry/backlink views. A note-local graph is centered on that document and can include referenced block nodes. Nodes are owned documents and explicitly referenced blocks; external URLs appear as terminal source/provider nodes. No similarity-inferred nodes or edges. Use distinguishable shape/icon plus text for page, journal, block, and external types; do not rely on color alone.

```ts
type GraphRequest = {
  seedDocumentId?: string; // absent: global graph
  seedBlockId?: string;    // requires seedDocumentId
  cursor?: string;
  limit?: number;         // default 100, max 200 nodes
  types?: ("page" | "journal" | "block" | "external")[];
};
type GraphResponse = {
  nodes: { key: string; target: ReferenceTarget; title: string; href?: string;
           kind: "page" | "journal" | "block" | "external" | "unavailable" }[];
  edges: { fromKey: string; toKey: string; occurrenceCount: number;
           presentations: ("link" | "badge" | "card" | "embed")[] }[];
  nextCursor: string | null;
  truncated: boolean;
};
// references.getGraph(input: GraphRequest): GraphResponse
```

Every request returns at most 200 nodes, 500 edges, and 256 KiB. Apply ownership before clipping/counting. Global graph pages owned documents and their referenced nodes in stable key order; unused owned documents can appear as isolated nodes. A seeded graph loads one hop; expansion is a separate user-triggered seeded request. Include edges only when both endpoints appear in the returned node set. Mark clipping and permit Load more/Expand; never imply the bounded slice is the user's complete graph. Validate cursor against seed, filters, and sort mode. External nodes require no new provider request to draw the graph.

For outgoing block provenance, anchor the edge at the containing document by default and expose the source block in the edge details; Show block nodes adds block target nodes and their containing-document association. These containment associations are styled separately and excluded from semantic adjacency/backlink counts. Aggregate repeated direct occurrences into a single displayed edge with a count. References to unavailable targets show anonymous “Content unavailable” terminal nodes only when authored by the current user; never reuse cached private titles or enumerate foreign IDs.

Use an interactive client SVG graph with deterministic initial layout, pan/zoom, fit/reset, type filters, select node, and explicit Open. Cap the accumulated visible graph at 200 nodes/500 edges; expanding beyond the cap replaces the seed view rather than growing indefinitely. Layout stays on the client and never requires a new graph database. Freeze/reuse layout positions on metadata refresh; respect reduced motion and avoid continuous force animation.

Provide an equivalent searchable node/connection list and edge-provenance panel alongside the visualization. Keyboard users can select a node, list incoming/outgoing neighbors, inspect occurrence counts/snippets, and open source blocks without navigating an SVG-only interaction. Graph edges use existing occurrence/backlink APIs for provenance, up to 3 snippets with Load more. Screen readers receive titles, types, directions, and bounded-result announcements. Unavailable nodes have no Open action.

Add `apps/web/src/app/(app)/graph/page.tsx`, its client graph/list components, and shared reference graph queries. Verify node selection does not navigate automatically while users pan/select; link navigation requires Open or keyboard activation. Graph UI uses saved content, never rejected/unsaved AI drafts; refresh/invalidate on reference commits, source deletion, and metadata changes. Graph exploration does not increase the AI tool's one-hop scope.

### 13.4 Unified completion gate

M0 must verify all three persisted custom types and both document/block targets together. M1's initial additive schema includes target-block and embed support; do not deploy intermediate target schemas as separate releases. Extend the single backfill to build block-search text. M6–M8 can be developed after their server/editor prerequisites; section 11 can proceed after the shared preview/provider boundary is ready.

Before release, verify R1–R14, M0–M8, all required verification rows in section 12, and the original issue's criteria. Provider unavailability still uses designed fallbacks, but missing provider implementation is incomplete. Cycles/large embeds still use designed bounded rendering, but missing embed or graph UI is incomplete. Remove the temporary spec only after the implementation handoff is preserved in this PR and release criteria have concrete review evidence.
