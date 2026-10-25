# Journl Tiptap adapter

`@acme/tiptap` translates between `@acme/document` and a direct Tiptap schema.
It has no runtime dependency on BlockNote or the database. Its tests reuse the
content inventory from `@acme/blocknote/inventory`.

The adapter is available in actual page and journal routes behind a preview-only
switch. Select “Try Tiptap editor” in the header of a development or Vercel preview
build. The server reads the `journl-editor=tiptap` cookie before rendering, so the
selected frontend is consistent through hydration and ordinary navigation.
Production keeps the current editor until #375's rollout. Editable preview views
use the existing draft/save sessions.

## Content boundary

`documentExtensions()` builds Tiptap nodes and marks. `documentSchema()` builds
the same schema for headless transactions. Each `journlBlock` contains an ID,
one content node, and optional `journlChildren`. Children remain Journl blocks.
Lists do not add identities or change existing parent relationships.

`toTiptapDocument()` validates the complete Journl input before constructing
editor nodes. `fromTiptapDocument()` validates the editor tree and its complete
domain output. Failed conversions throw `AdapterReadError` with an independent
original snapshot. Callers must surface this error and prevent saving a partial
or empty replacement.

Text, formatting, tables, media properties, reference targets, and nesting cross
this boundary. Equivalent legacy encodings normalize: string content becomes
text runs, code becomes plain text, false styles become absent marks, and empty
child arrays become absent child groups. Unspecified table widths use `null`
inside the editor and normalize through the domain validator on return.

Internal clipboard HTML includes editor attributes to preserve references and
table metadata. These attributes are a frontend clipboard format. Database
records and backend APIs continue to contain Journl payloads and sibling edges.

`documentChanges(before, committedDoc)` returns validated Journl insert, update,
move, and remove operations. It places surviving descendants before removing
their former ancestors. Feed the result to `applyDocumentOperations()` and the
existing storage/save adapter. Never persist editor JSON, positions, or steps.

## Identity rules

- `splitBlock()` retains the original ID and children on the left. It creates a
  right sibling with a fresh ID. Offsets are frontend ProseMirror text offsets.
- `joinBlocks()` joins adjacent text blocks of the same type. The first ID and
  block properties survive. Children from both blocks retain their IDs and order.
  The second block no longer exists, so references to its ID need normal missing
  target handling.
- `copySlice()` assigns fresh IDs recursively. Reference targets retain their
  authored IDs, including references to the source blocks.
- `identityPlugin()` refreshes pasted and copied-drop IDs. Native moves retain
  IDs. Paste is a copy operation, including content from another document.
- The plugin repairs IDs after native split and insertion transactions. When a
  duplicate is inserted before its source, mapped positions identify the source.
- Repairs join the editing transaction's history event. Undo and redo restore
  the same IDs. Consumers must process the final state after appended transactions.
- Inject an ID factory that returns globally unique, nonempty strings. The app
  must use UUIDs for its existing database API. Invalid factory output throws.

`referenceSelectionPlugin()` ports the existing atom-selection and decoration
behavior without BlockNote document or DOM assumptions. The BlockNote frontend
now wraps this shared plugin.

## Frontend integration

`editingExtension()` wires native split/join, indentation, text formatting, and
history. Structural commands use the Journl operation boundary. `captureLink()`
and `convertReference()` support selection-based display changes while preserving
surrounding text and children. Clipboard/drop identity handling and reference
selection use the owned wrappers rather than BlockNote's DOM or document layout.
Text marks skip reference atoms because the domain contract styles text only.

The app's Tiptap URL insertion follows resolution tokens after caret movement.
Deleted references are not resurrected by a late resolver. A failed resolution
restores the original selected alias and styling. Reference and media properties
remain in Journl payloads; previews and resolved rendering can evolve under #373.

Actual-route inventory acceptance covers the complete installed content inventory,
block identity/order, tables, media, and references in the new view, then opens
the same saved document through BlockNote. Neither frontend changes stored rows
just by opening the document. Full UI parity remains in #373. The Journl-owned
AI proposal and streaming work remains in #374 and #376, before rollout.

## Checks

Run `pnpm --filter @acme/tiptap test:unit` and
`pnpm --filter @acme/tiptap typecheck`. Tests exercise the real Tiptap schema,
editor, native paste path, ProseMirror transactions/history, storage codecs, and
the complete preservation inventory. They are adapter checks, not application
acceptance. Application acceptance uses the existing authenticated Next.js
routes and disposable PostgreSQL browser suite.

## Save sessions

The app revalidates committed operations with `acceptedDocumentChange()` before
building existing database transactions. Both page and journal views pass these
deltas through `DocumentDraft`, including queued title edits, guarded versions,
retry reconciliation, and recovery copies. No Tiptap JSON or steps enter saves.
`applyAcceptedOperations()` uses the same update bridge and isolates an accepted
proposal as one undo event. Unaccepted streaming content belongs outside this
committed document; #374 and #376 implement that proposal/review experience.

Owner-scoped draft maps and activity live in `DraftSessionsProvider` above route
layouts. Account Settings and Subscription expose the same save/recovery controls.
Drafts remain in tab memory and are not durable browser storage. The root lifetime
keeps reconnect retries and reload warnings active across those layouts. An owner
change starts an isolated session; the backend still checks ownership on every save.
