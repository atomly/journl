# Editor feature and content inventory (#369)

This is the parity contract for [#369](https://github.com/atomly/journl/issues/369),
built on save safety ([#368](https://github.com/atomly/journl/issues/368)).
It inventories the installed BlockNote **0.55.0** behavior for the selected Tiptap
frontend migration. Journl owns the framework-independent content contract; the
existing backend block document remains authoritative. This inventory changes no
live document or editor behavior.

The source audit and content checks are recorded here. Production content has
**not** been inspected. Functional mobile keyboard/selection/IME checks belong to
the implementation acceptance in #373. Performance benchmarks and numeric budgets
are outside this migration's scope. This checklist does not certify that the
replacement editor, adapter, or AI implementation has passed compatibility checks.

## Evidence and reproducibility

- [Accepted schema snapshot](../../packages/blocknote/src/inventory/accepted-schema.json) records every block/inline/style config, including property defaults and values. `fixtures.spec.ts` compares both client and server schemas to it; dependency changes require an explicit inventory review.
- [Synthetic fixtures](../../packages/document/src/fixtures.ts) include all accepted block types and text styles, nested writing, both table cell encodings, stable IDs, internal/external/block references, unavailable targets, Unicode and incomplete historical-shaped rows. Every name, ID, URL and passage is synthetic.
- [Executable content checks](../../packages/blocknote/src/inventory/fixtures.spec.ts) exercise the installed server editor and real row reconstruction. They check accepted shapes, ProseMirror JSON round trips, identities/nesting, readable lossy exports, and raw recovery specimens. They do not implement a migration codec.
- [Read-only aggregate SQL](production-shapes.sql) is ready for a separately identified production inventory. Its integration test uses disposable PostgreSQL and checks that reports contain counts/shapes rather than authored passages, titles, target URLs or IDs.

Run from the repository root:

```sh
pnpm --filter @acme/blocknote test:unit
pnpm test:browser
```

Browser acceptance must run the actual Next.js app, authentication, routes, editor,
and storage. Do not substitute a standalone editor screen or fake application
layout for product validation. Keep functional evidence tied to the tested commit,
route, browser, viewport, build mode, and data set.

## Accepted content: preserve even when its control is hidden

There are **16 block types**, **3 inline node types** and **7 text styles**. The
machine-readable snapshot is authoritative for this installed version. A less-visible
type is not permission to drop saved content of that type.

| ID | Existing accepted content | Preserve/check contract | Evidence/check |
| --- | --- | --- | --- |
| C01 | Paragraphs; empty blocks; inline text; line breaks | Retain exact text, Unicode, combining marks, emoji, whitespace and empty positions. | `parityBlocks`, missing-content/string-content fixtures; compare text and root ordering after each adapter round trip. |
| C02 | Headings **1–6**, optional `isToggleable`; text/color/alignment props | Preserve level and toggleable content/children. Slash exposes 1–3 first and 4–6 later; the custom context menu lists only 1–3. | Schema snapshot; installed `getDefaultSlashMenuItems.ts`, Heading spec; fixture headings 1–6 and toggle child. |
| C03 | `bulletListItem`, `numberedListItem`, `checkListItem` | Preserve nested mixed block types, sibling order, numbering `start`, checked/unchecked state and children. | Nested fixture; real linked-edge reconstruction; future browser indent/outdent/split/join/move/undo checks. |
| C04 | `toggleListItem` and nested content | Preserve the toggle type and children. Do not invent a persisted open/closed property: it is not in the current block prop schema. | Installed default specs; toggle fixture; browser expand/collapse and remount check. |
| C05 | `quote`, including children; `divider` | Preserve quote text/nesting and divider position; neither may be treated as an unknown block. | Fixture and accepted schema; browser slash/input-rule/export checks. |
| C06 | `codeBlock` with plain source and `language` string | Keep source newlines/language literally, including reference-looking text. Rich inline marks are not code-block content. Do not promise an extra syntax-highlighting integration. | Type `plain`, Code spec; code fixture and Markdown export; Enter/Tab/paste scenarios. |
| C07 | `table`: column widths, header row/column counts; array cells and `tableCell` object cells | Retain inline links/references, per-cell styles, row/column order, colspan/rowspan and both old/new cell shapes. | Two table fixtures and real editor normalization. Browser resize, selection, Tab traversal and clipboard checks remain required. |
| C08 | Table UI capabilities differ from storage | Current default `tables.splitCells`, cell background/text colors and headers are false; basic row/column handles remain. Imported/stored spans/headers must still survive. Enabling those controls is a separate product choice. | Installed `BlockNoteEditor.ts` settings and `TableCellMergeButton.tsx`; app supplies no table override. |
| C09 | `image`, `video`, `audio`, `file` | Preserve URL, name, caption, background and the applicable alignment/preview-width/show-preview props. Retain broken/empty URLs for recovery rather than dropping a block. | Accepted snapshot; four media fixtures; browser URL embed, resize/caption/rename/download/preview checks. |
| C10 | Bold, italic, underline, strike, inline code, text color and background color | Preserve combinations and arbitrary supported color strings, not only the visible named swatches. Inline code is accepted even though it is absent from the default formatting button list. | All seven styles in fixture; installed default style specs. Test keyboard/input rules as well as toolbar formatting. |
| C11 | Block text alignment: left/center/right/**justify** where accepted | Preserve justify imported/stored content; current toolbar has left/center/right buttons only. | Property snapshot and fixture. |
| C12 | Native `link` inline nodes with styled label content and URLs | Keep native links distinct from custom references, including query/hash and surrounding text. Unsafe navigation must not be introduced by conversion. | Fixture, `reference-href.ts`, existing reference conversion tests; browser click/paste/copy checks. |
| C13 | `contentReference` inline atom | Preserve version, target kind, document ID, optional block ID, authored URL, label and the transient resolution token's meaning. Keep occurrences in paragraphs, lists and table cells. | Custom config, fixture internal/external/block/table references; existing selection/insertion tests. |
| C14 | `referenceCard` block, internal or external | Preserve target identity, authored URL/label and surrounding sibling/child structure. A URL prop does not make this a file block. | Fixture; formatting-item filter and block action tests. |
| C15 | `contentEmbed` block, internal document/block target | Keep live reference identity, recursion/cycle limits, pagination and unavailable states. External embeds are not accepted as a new equivalent. | Fixture; `ReferenceEmbedView`, runtime/procedure tests; browser expansion, Show more and deleted-target checks. |
| C16 | Stable document/block IDs and linked sibling order | Moves keep IDs; duplicate recursively generates new block IDs; reference target props currently remain as authored (including targets in the original subtree). Copies and moves must not be conflated. | `cloneBlockForDuplicate`, block/node schemas, `documentBlocks`; fixture IDs and ordering checks; #370 must prove split/join/paste semantics before changing them. |

## Visible interaction and editing checklist

Every row is a preserve/adapt gate for the replacement. “Source” means configured in
the running code, not a claim that a manual browser scenario has passed. Preserve the
behavior or record an explicit accepted adaptation before cutover.

| ID | Existing behavior | How it will be checked / present evidence |
| --- | --- | --- |
| U01 | Desktop floating selection toolbar; mobile sticky toolbar; shared custom ShadCN/Base UI components; light/dark theme | Select text and whole blocks on page/journal/detail; check labels, focus, keyboard reachability and no covered writing. Source: `block-editor-tools.tsx`, `block-editor.tsx`, app BlockNote CSS. Device check open. |
| U02 | Bold/italic/underline/strike, colors, block type, align, nest/unnest, link controls | Toggle each on text/ranges/multiple blocks; inspect content before/after save, remount, undo and export. Table/file/reference controls are selection- and capability-dependent. |
| U03 | Slash menu combines installed defaults, AI items and four reference actions | Exercise Text, headings 1–6, toggle headings/lists, quote, code, lists/checklist, table, divider, image/video/audio/file, emoji and reference modes; filter with keyboard, select and Escape. No accepted default can disappear because it was omitted from the custom context menu. |
| U04 | Emoji picker `:` (minimum two typed query characters), plus slash Emoji | Insert and save emoji; verify grapheme navigation/deletion and undo on desktop/mobile. Unicode fixture covers storage, not native keyboard behavior. |
| U05 | Side drag handle and custom right-click/block context menus | Pointer move blocks with nesting/order/IDs preserved; duplicate with fresh subtree IDs; delete/undo; turn into Text/Heading 1–3/list/checklist; colors and copy block link. Existing block-menu tests cover action policy and cloning. Real drag browser check open. |
| U06 | Keyboard ContextMenu / Shift+F10; native menus for ordinary links/controls/text selection | Open actions on the selected block without losing selection; Tab through controls; Escape returns focus. Touch/pen deliberately keep native long press rather than the custom desktop menu. Existing menu/selection tests. |
| U07 | Text splitting/joining, hard break, indentation and movement | Enter/Shift+Enter, Backspace/Delete at start/end, Tab/Shift+Tab, Mod+Shift+ArrowUp/Down; verify children, IDs, current selection and undo. Code and table handlers have their own semantics; do not replace them with one generic paragraph keymap. |
| U08 | Formatting/type shortcuts and input rules | Check Mod+B/I/U, Mod+Shift+S, Mod+E, Mod+Alt+0 and 1–6, Mod+Shift+6/7/8/9 (toggle/numbered/bullet/checklist), Mod+Alt+Q, backticks/fences, heading/list/checklist/quote/divider input rules. Confirm platform-specific Mod mapping against installed handlers; no claim that every OS/browser reserves none of them. |
| U09 | Local undo/redo | Mod+Z, Mod+Y, Mod+Shift+Z after typing, formatting, nesting, moving, duplication, paste, async reference resolution and accepted AI work. Resolution reconciliation uses `addToHistory:false`. Dedicated mobile Undo/Redo buttons are a later request, not a current control. |
| U10 | Reference insertion via `[[` and slash Reference note/block/Embed note/block | Search only owned targets; create inline/card/embed forms with the right stable target; no available target becomes plain text during a migration. `@` insertion is not configured today. Existing insertion and reference runtime tests. |
| U11 | Reference display conversion: native link ↔ inline ↔ card ↔ internal embed | Preserve target/label/URL and surrounding writing; conversions split mixed-content blocks deliberately. Reference in a table can become a native link, not an arbitrary promoted block. Async conversion rechecks the captured document/selection. Existing conversion/surfaces tests. |
| U12 | Reference hover/focus previews, explicit source actions, block targets | Exercise hover, focus, open source, copy source URL, #block copy/highlight, unavailable/deleted targets and nested embeds. Custom reference actions suppress inappropriate file controls and unavailable conversion options. Existing runtime/selection tests; full browser check open. |
| U13 | Native link navigation policy | Ordinary click in editable content is suppressed; double click opens the URL; modifier clicks are delegated. Read-only/reference links have their own source actions. Check desktop and touch semantics rather than assuming all links navigate on one tap. |
| U14 | Async bare-URL paste/drop resolution | An unselected plain HTTP(S) URL becomes a card in an empty root paragraph (with trailing writing paragraph) or an inline reference elsewhere. Preserve native HTML/selected-label paste. Failed/stale resolution restores/keeps the URL and cannot resurrect a removed node or hijack later edits. Existing insertion/drop tests. |
| U15 | Internal block drag and Library page drag | BlockNote owns internal moves; Journl does not reinterpret their URLs. `application/x-journl-page-reference` payloads validate page UUID and drop coordinates. Malformed custom data falls back to native behavior. Existing reference-drag tests; actual pointer/touch drag check open. |
| U16 | Clipboard MIME priority and copy output | Paste prefers `vscode-editor-data`, `blocknote/html`, `text/markdown`, `text/html`, `text/plain`, `Files`; plain text may be interpreted as Markdown, code blocks paste plain source. Copy/drag emits `blocknote/html`, external `text/html` and Markdown as `text/plain`. Check styled range, nested blocks, table selection, links and reference atoms between two editors and an external app. |
| U17 | Import/export surfaces and loss | No document import/export screen is configured. Clipboard parsing and editor/server Markdown/HTML APIs exist; draft recovery downloads full rich blocks and title as JSON, with no import UI. Markdown reference exports become readable links, not live embeds; colors, merged table structure and identity are not guaranteed by Markdown. Keep source JSON/IDs as migration recovery evidence. Existing Markdown test plus fixtures. |
| U18 | File/media insertion limits | URL-backed persisted media is supported. Journl supplies no `uploadFile` handler: local file paste/drop/upload is not a working uploaded-media feature merely because upstream has a panel. Keep supported URL/embed/file controls; adding uploads needs a separate product decision. |
| U19 | Save/debounce/error/conflict recovery | Required original version per batch, serialized title/body queue, dirty draft retention on navigation/virtualization, same guarded retry after ambiguous response, backup-before-load and explicit conflict controls; never introduce a reload on save error. Preserve #368's engine, PostgreSQL and real-app browser contracts. #372 also covers leaving the editor layout with unresolved drafts. |
| U20 | Mobile writing and accessibility | Real iOS Safari/WebKit: text handles, long press/native menus, software keyboard, composition/IME, accents/emoji, focus restore, viewport/sticky toolbar offsets, touch scroll, orientation and keyboard navigation to noneditable reference controls. Desktop reference keyboard tests exist; real-device check remains open. Root viewport configures `interactive-widget: resizes-content`; preserve keyboard-aware save/recovery visibility. |
| U21 | No configured comments/collaborative presence | Generic upstream comment buttons are extension-gated; no comments store/provider or Yjs collaboration is configured in `useBlockEditor`. Preserve content semantics without silently adding/removing a claimed product feature that does not exist. Sharing/presence and new comment UI require their own scope. |

Installed-source evidence is in `node_modules/@blocknote/core/src/blocks/defaultBlocks.ts`,
`extensions/SuggestionMenu/getDefaultSlashMenuItems.ts`,
`extensions/tiptap-extensions/KeyboardShortcuts/KeyboardShortcutsExtension.ts`,
`api/clipboard/`, and `@blocknote/react/src/components/FormattingToolbar/`.
Those are version-specific implementation observations, not claims about a future
BlockNote release. Application behavior is configured in
`apps/web/src/components/editor/{block-editor,use-block-editor,block-editor-tools,block-editor-block-menu,reference-insertion,reference-selection,editor-tab-navigation}.tsx/ts`.

## Surface matrix

Run the content and interaction checklist on every applicable surface. An isolated
editor benchmark cannot certify server routing, network loading or save behavior.

| Surface | Existing path/shape | Parity acceptance |
| --- | --- | --- |
| Pages | `/pages/[id]`; editable title and body share a save queue | Full fixture; title/body interleaving; navigation away/back during debounce, in-flight save, error/conflict; block links; backlinks; large-document workload. |
| Journal Entries | `/journal`, Entries mode; newest persisted entries plus Today placeholder; virtualized | Edit/create Today, older entries and sparse histories; load another page; unmount before debounce/during request/after error and restore exact local writing. |
| Journal Timeline | `/journal`, Timeline mode; empty days included; virtualized | Same save and remount contract for empty and existing dates; mode switching; long scroll; today/older-day headings; timezone/date boundaries. |
| Journal detail | `/journal/[date]`; single editable entry, including empty date | Same content, AI tools, references, #block targets and recovery as the list; navigate between detail/list without losing a draft. Isolated editor cost shares the page workload, not route-loading evidence. |
| Read-only previews/embeds | `ReferenceBadge`, `ReferenceCardView`, `ReferenceEmbedView`, `ReadOnlyBlocks`; Explore source excerpts | Keep readable text/links/references, nesting depth/limits, table cells and unavailable/truncated/paginated states. Current `ReadOnlyBlocks` does not render file/media bodies and omits some styling: record that gap; do not delete stored media to match a limited preview. |
| Long scrolling lists | `react-virtuoso`; custom app scroll parent; `increaseViewportBy=200` | Editors mount only for nearby rows, preserve dirty sessions outside rows, keep scroll position/focus and avoid whole-history subscriptions. Benchmark uses a fixed-height Virtuoso scroller; real custom-parent/keyboard behavior still needs app/device checks. |

## Existing AI review is part of parity

Both BlockNote's AI menu/slash actions and the chat `write` / `applyChanges` /
`rejectChanges` tools exist today. The editor registry targets mounted page or dated
journal editors; selection context carries stable block IDs plus Markdown/text.
The current AI package exposes continue writing, summarize, action items, write,
improve, spelling, translate and simplify commands, then review/accept/revert/retry/cancel.
Preserve the configured commands that are actually offered for the current selection.

| ID | Preserve | Deterministic acceptance check |
| --- | --- | --- |
| A01 | Correct editor and selection targeting | Fake writer changes the selected passage in a page, list journal and detail; wrong/unmounted target reports an error without touching another document. |
| A02 | Review before applying; loading/error/no-draft states | Fake streamed proposal appears as reviewable work; error/cancel/no-draft leaves original writing recoverable. Inspect both document output and save queue rather than screenshots alone. |
| A03 | Apply/reject, cancellation, retry and undo grouping | Apply commits the intended final content once and can be undone as one accepted operation; reject restores original content without a new user undo step; cancellation during thinking/writing stops cleanly. Installed `AIExtension.acceptChanges/rejectChanges` preserve history deliberately. |
| A04 | Unaccepted proposals excluded from persisted/derived content | Assert SQL blocks, references, search text and embedding input before review, while reviewing, after rejection and after acceptance using a fake model. Current `isAgenticEditorChange` suppresses thinking/writing, but this inventory does not certify every review/projection transition. #353/#374 must close that validation gap. |
| A05 | Proposal safety when a person edits or leaves | Selection changes, local typing, stale saves, unmount/navigation and async completion cannot silently replace unrelated/newer writing. Keep a recoverable draft and surface a conflict when applicable. |

Source: `apps/web/src/ai/tools/{write,apply-changes,reject-changes}/client.ts`,
`components/editor/block-editor-utils.ts`, `use-block-editor.ts` and installed
`@blocknote/xl-ai/src/AIExtension.ts`. No paid/real model call is needed for these checks.
Owned AI proposal/tool replacement is #374 and streaming/review UX is #376; both precede rollout.

## Historical content and production uncertainty

`block_node.data` is JSONB with a size constraint, not a versioned closed document
schema. `parent_id` and `block_edge` reconstruct hierarchy/order. A valid foreign key
does not prove the parent is in the same document/owner, nor that sibling edges form
one acyclic chain. Journl now validates supported payloads independently of the editor
and reports unsupported data/graph structure with original recovery rows. Code inspection
alone cannot establish the production population.

| Synthetic specimen | Observed/required disposition |
| --- | --- |
| Omitted `content`, with type/props present | Current reconstruction and editor load; retain the empty block and ID. |
| String-shaped paragraph content | Current partial-block input accepts it; normalize only through an explicit codec and preserve original payload for migration recovery. |
| Nested rows returned out of order with a sibling edge | Current reconstruction restores root order and parent/child identity; fixture verifies exact IDs. |
| Omitted `props`, or `{}` JSONB default | The explicit Journl legacy reader accepts omitted optional paragraph props without changing raw rows. A missing block type (`{}`) still requires recovery; do not infer empty text. |
| Unknown block type | Raw row can exist; Journl reports it before editor conversion. Quarantine/report and retain original writing rather than coercing to paragraph or dropping the block. |
| Unexpected content object | Raw recovery specimen; requires shape-specific investigation before conversion. |
| Parent absent from the document being reconstructed | Journl reconstruction reports the missing parent and retains all original rows. The global FK can still point to a parent in another document; investigate ownership/membership. |
| Cyclic/branched/partial sibling relationships | Cycles and branches are reported with original nodes/edges. Disconnected chains retain source-row order between heads. Do not certify malformed graphs as a lossy rewrite. |
| Old/new table cells, nondefault headings, reference props and opaque media URLs | Covered synthetically, not established as present/absent in production. Preserve all accepted configurations regardless of observed frequency. |

The editor schema and save boundary are not identical validators. Current reference
writes require `version: 1`, string target IDs, a document/external target kind, labels
up to 255 characters and URLs up to 2,048 characters; ownership/block membership and
new-target validity are checked in the save transaction. JSONB block payloads also have
a 10,485,760-character serialized-text limit (`length(data::text)`, not a byte ceiling).
New content saves validate the Journl block contract at entry. Existing broad/unknown
JSONB can still be present; reads report it with an original recovery snapshot instead
of handing partial content to the editor. Preserve those failures as evidence.

The aggregate SQL can quantify known/missing/unknown block types, basic legacy shapes,
document sizes, deeper/toggle headings, table spans, projected reference forms, nesting
and ordering anomalies without exporting writing. It is bounded by a statement timeout
and a depth cap; a cap hit is uncertainty, not proof of no cycle. Reference projections
are not raw-content truth, and URL availability cannot be inferred from row counts.

Before #375 conversion/default cutover, record the authorized environment/date and
aggregate results, investigate every unknown/malformed/capped bucket, collect only
sanitized additional specimens, and reconcile raw nodes/edges/text/IDs with fixture
coverage. Production scale, rare/plugin-era shapes, invalid or unavailable targets,
old AI attribution payloads, malformed tables and media lifetime remain unknown now.
No source URLs, document IDs, user IDs or writing should be checked into this inventory.

## Implementation acceptance

Use these fixtures and behavior contracts to validate the Journl content package
(#371), the Tiptap frontend adapter (#370), save-session integration (#372), and
actual-app editor parity (#373). The adapter must preserve existing meaning, IDs,
formatting, nesting/order, and reference targets. Backend entities and operations
remain independent of editor frameworks; Tiptap JSON/positions are frontend details.

Exercise real Journl pages, journals, and read-only consumers with desktop Chromium
and mobile WebKit. Check touch selection, software keyboard, and IME on real devices
where automation is insufficient. Long documents and virtualized journal rows remain
functional correctness cases, not benchmark workloads. Pure codecs/operations and
PostgreSQL persistence have separate meaningful tests; Storybook is suitable for
pure components/user stories, not substitute application acceptance.

Owned AI proposal state (#374) and streaming/review/cancel/accept/reject/undo (#376)
are required before rollout (#375). Unaccepted proposals stay outside accepted
content and ordinary autosaves. No paid editor AI dependency is required.

Performance baselines, numeric budgets, editor comparisons, and new collaboration
infrastructure are excluded. Live synchronization/sharing is later work in #377;
the current migration keeps the existing authoritative backend block structure.

## Scope boundaries and exit checklist

Existing behavior above is the minimum compatibility target, including supported content
with hidden/disabled controls. Proposed product improvements are separate:

- `@` reference insertion and richer reference interactions: #351; current `[[` and conversions remain parity.
- Stable app URLs/block-target enhancements: #352; current IDs and authored URLs remain recoverable.
- Dedicated mobile Undo/Redo buttons: #378; current undo shortcuts/history remain parity.
- Entry-to-page conversion: #379; new calendar/date-navigation UX: #380.
- Owned AI proposal engine and tools: #374; streaming editor UX: #376. Both are required before rollout.
- Later live collaboration, automatic convergence, sharing/presence/permissions: #377.
- New upload service, comments, math/callout/multi-column extensions or additional table controls are not implied by this inventory.
- Journl-owned content contract/backend consumers: #371; frontend Tiptap adapter: #370; existing guarded save sessions: #372; reference/search freshness: #353; compatible rollout and BlockNote removal: #375.

Exit state for #369:

- [x] Installed accepted content, visible controls, keyboard/clipboard, reference, mobile, undo, AI and consumer surfaces enumerated with preserve/check contracts.
- [x] Synthetic accepted-content and historical recovery fixtures plus schema drift checks committed for repeatable comparison.
- [x] Production uncertainty and a privacy-preserving read-only inventory procedure recorded; no production-content inspection claimed.

Implementation acceptance remains in #370–#376 rather than an inventory completion
claim. Tiptap must preserve the checklist before default cutover; this document
does not authorize silent feature removal or certify unimplemented adapters.
