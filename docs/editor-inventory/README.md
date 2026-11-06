# Editor content inventory

Journl owns its stored block document contract. Removing the previous editor does
not change stored type names, identities, nesting, reference targets, or recovery
behavior. The [accepted content snapshot](../../packages/document/src/accepted-content.json)
records the historical block, inline, style, and property definitions.

[Shared synthetic fixtures](../../packages/document/src/fixtures.ts) cover all
16 block types, three inline types, seven text styles, nested writing, both table
cell encodings, stable IDs, references, Unicode, media metadata, and historical
row shapes. These examples contain no production content.

[Document checks](../../packages/document/src/historical-content.spec.ts) retain
coverage, storage round trips, readable lossy exports, and raw recovery evidence.
[BetterEditor adapter checks](../../packages/better-editor/src/serialization/adapter.spec.ts)
exercise the current Tiptap schema and serialized storage with the same fixtures.

Run from the repository root:

```sh
pnpm --filter @acme/document test:unit
pnpm --filter @acme/better-editor test:unit
pnpm test:browser
```

Unknown blocks, malformed payloads, missing parents, and invalid ordering must
retain complete independent raw copies for recovery. Do not coerce them into
empty paragraphs or save a partial document. JSON is lossless; Markdown/HTML
exports deliberately retain readable reference labels and URLs, not live embeds.

[Read-only inventory SQL](production-shapes.sql) and its disposable-database
integration test report counts and shapes without authored content or identifiers.
Synthetic tests do not establish which shapes exist in production.

Browser acceptance must use the actual app, authentication, routes, editor, and
storage. Record failures and skips accurately. Physical-device keyboard, IME,
selection, and live-provider AI acceptance remain separate from codec checks.
