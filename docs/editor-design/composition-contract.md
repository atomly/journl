# BetterEditor consumer composition

BetterEditor supplies engine behavior and composable React parts. Applications
assemble their own editor. The library does not provide a document-editor preset,
application toolbar, application menu ordering, or recursive editor composition.

## Ownership

- Engine: Tiptap/ProseMirror lifecycle, validation, commands, selection, clipboard,
  and change delivery. Optional behavior is explicitly enabled by the consumer.
- React parts: root/content, positioning, accessible controls, menu shells,
  handle gestures, feature views, and selectors.
- Consumer: extension selection, component order, toolbar items, slash items,
  block/context/table/reference menu content, routing, persistence, typography,
  responsive layout, read-only policy, and embedded content rendering.

Journl implements its composition in
`apps/web/src/components/editor/document-editor-view.tsx`. Its toolbar, block
menu, reference actions, and URL services live alongside that component.
The package does not import those modules or expose aliases for them.

## Component interface

`useBetterEditor` owns a stable engine. `EditorRoot` shares it without putting
changing document snapshots in context. `EditorContent` attaches its view.
Consumers add `EditorToolbar`, command/mark buttons, `LinkMenu`, `SlashMenu`,
`BlockHandle`, `TableControls`, `EditorContextMenu`, and reference views as needed.
Each module has an explicit package export. There is no root barrel.

Toolbar positioning and visibility are separate choices. Inline, sticky, and
floating presentations can change without recreating the engine. The consumer
chooses responsive policy, CSS offsets, portal containers, and collision bounds.
Floating controls remain inside the editor's horizontal bounds by default and
avoid covering table cells during cell selection.

Handle and context-menu components require consumer-supplied `renderMenu` content.
They own targeting, focus return, and gestures. Consumers choose the actions.
`SlashMenu` requires its item source. The optional `defaultSlashItems()` catalog
provides reusable block commands without selecting the application's menu.
The same result snapshot drives keyboard, pointer, and ARIA selection. Async
sources receive an AbortSignal; stale results cannot replace a newer query.

`LinkMenu` owns link editing and maps its captured selection through transactions.
Its child render function exposes the current URL, editor, selection restoration,
and dismissal for consumer-defined actions. Journl adds its reference insertion
button there.

`ReferenceViews` accepts `renderActions` and `renderEmbeddedContent`. It never
instantiates a document editor. Without an embedded renderer it offers the source
link and does not fetch expanded content. Cycle detection remains intrinsic;
the consumer chooses any finite `maxEmbedDepth`. Journl chooses two levels.

Highlighting and drop-cursor feedback are independent extensions. Mounting
reference views does not silently enable drag feedback.

## Lifecycle and permissions

Initial content and extensions are mount-time configuration. Equivalent extension
arrays do not reset drafts. Unsupported extension changes report an error while
preserving content. Changing `resetKey` deliberately loads the current initial
state and clears history.

Editability defaults to true and is independent of persistence callback presence.
A consumer requests read-only mode explicitly. Callbacks and presentation can
change without replacing the editor.

Engine/content failures differ from consumer commit failures. A synchronous
commit failure retains the last delivered baseline and missed edits. `retryCommit`
retries the latest valid snapshot. The application owns asynchronous persistence
and recovery UI.

## Performance and compatibility boundaries

Validated immutable payloads are cached by unchanged ProseMirror node identity.
Data-only diffs use a linear path. Structural commands use targeted transactions
and leave the caller transaction untouched on failure. Delivery clones payloads
to protect cached snapshots from consumer mutation. Selectors limit subscriptions
for independently composed controls.

The existing document/reference contracts and dependencies remain for the planned
later decoupling. Stored content is preserved. Fully optional schema features,
transaction-mapped indexes, and bounded pointer hit testing remain separate work.
AI replacement is outside this cleanup.

## Verification

Run lint, typechecks, frozen installation, registry checks, unit/UI tests, database
integration, actual-app Chromium/WebKit acceptance, and a Turbopack build locally.
Also install the registry into a separate consumer and compile the copied sources.
The registry test rejects library presets and consumer imports.

The final local CI run on Node 26.12.1 and pnpm 12.8.2 passed frozen installation,
dependency checks,
lint/format checks, workspace typechecks, registry checks, 445 unit/UI tests,
43 database tests, and 109 actual-app browser tests with 21 configured platform
skips. The Next.js 16.4.3 production build passed using Turbopack. The build used
an isolated environment with disposable Stripe values and logged missing auth
configuration warnings. It did not use production credentials.

The copied-source registry installed and compiled in a separate consumer.
Standalone composition checks passed in Chromium and mobile WebKit. Package
packing succeeded without publishing. The final complete CI log is retained at
`.cache/openeditor-validation/unification-results/final-toolchain-ci.log` locally.

CI uses `PNPM_VIRTUAL_STORE_TYPE=project`. The requested global-store default
installs and typechecks successfully, but the current Workflow/Turbopack loaders
cannot transform dependencies outside the project filesystem. A separate global
build reproduced that limitation on the same Node/pnpm toolchain.
