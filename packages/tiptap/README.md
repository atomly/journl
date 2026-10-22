# Journl Tiptap adapter

`@acme/tiptap` translates between `@acme/document` and a direct Tiptap schema.
It has no runtime dependency on BlockNote or the database. Its tests reuse the
content inventory from `@acme/blocknote/inventory`.

This is the first implementation layer for #370. Page and journal editors still
use BlockNote. This package does not complete #370 or authorize rollout.

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

## Remaining integration

Before this adapter replaces an editor surface, add the development switch in
the actual page/journal routes. Connect the existing draft/save sessions under
#372. Port block targeting, link conversion, reference insertion, and drag UI
that still depend on BlockNote. Complete the actual-route checks required by
#370 and the editor UI parity work in #373.

The schema's DOM output is a basic representation. It does not yet supply the
app's media views, reference resolution, toolbar, table controls, or keyboard
commands. Split/join functions are ready for those commands to call. The
Journl-owned AI proposal and streaming work remains in #374 and #376.

## Checks

Run `pnpm --filter @acme/tiptap test:unit` and
`pnpm --filter @acme/tiptap typecheck`. Tests exercise the real Tiptap schema,
editor, native paste path, ProseMirror transactions/history, storage codecs, and
the complete preservation inventory. They are adapter checks, not application
acceptance. Application acceptance uses the existing authenticated Next.js
routes and disposable PostgreSQL browser suite.
