# Journl document contract

`@acme/document` owns version 1 of Journl's block content: types, validation,
row/edge reconstruction, headless operations, and lossy Markdown/HTML exports.
It imports neither editor framework nor database/runtime code. Existing database
Document/BlockNode/BlockEdge records remain authoritative; no storage migration
or second writable representation is introduced.

- `documentBlocks` reads structural DB rows and linked sibling edges. Missing
  paragraph props/content are accepted explicitly. Unknown payload keys/types,
  orphaned children, cycles, scope mismatches, and ambiguous ordering throw
  `DocumentReadError` with diagnostics and an independent complete original
  snapshot. Callers must not catch that error and save a partial/empty document.
  This package does not implement a recovery UI or automatic repair.
- `documentRows` encodes the same storage shape while preserving identity/order.
- `applyDocumentOperations` edits a copy atomically; moving preserves IDs and
  duplication requires injected new IDs. The server still checks ownership and
  loaded versions inside its existing write transaction.
- `zDocument` validates the versioned interchange envelope; legacy stored rows
  remain readable without adding a version column or rewriting content.
- Markdown/HTML exports are explicitly lossy interchange: references become
  readable links, not live embeds. JSON remains the lossless representation.
  Existing frontend clipboard/import behavior stays with the editor adapter;
  no import/export screen or new parser API is introduced here.

The current BlockNote consumer uses `@acme/blocknote/adapter` only at its frontend
boundary. The Tiptap adapter follows in #370. AI extension orchestration remains
in the current editor until #374/#376; server content reconstruction, embeddings,
and AI search serialization use this package now.

Run `pnpm --filter @acme/document test:unit` for pure codec/operation/serialization
checks. The BlockNote package tests additionally round-trip the full inventory
through the actual installed editor and serialized storage. App database/browser
suites check the unchanged guarded save path and real routes.
