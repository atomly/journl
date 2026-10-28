# Temporary BlockNote frontend

This package supports the legacy frontend while Journl finishes Tiptap parity
and replaces the existing AI editor integration. It must not become a dependency
of new editor, backend, or shared content code.

- `@acme/document` owns document validation, storage reconstruction, operations,
  and the synthetic compatibility fixtures exported through `/fixtures`.
- `@acme/tiptap` adapts those documents without depending on this package.
- `@acme/editor` owns the React editor, with replaceable UI components.
- This package owns only the legacy schema, adapter, reference node views, and
  tests against the installed BlockNote implementation.

## Removal sequence

[Issue #375](https://github.com/atomly/journl/issues/375) owns full removal.
Complete the remaining actual-app parity checks in #373 and replace the AI
proposal/streaming behavior in #374 and #376 before deleting the fallback.

The remaining consumers are:

- Page and journal frontend branches in `apps/web/src/app/(app)` and the
  comparison switch in `apps/web/src/components/editor/editor-frontend-provider.tsx`.
- Legacy `block-editor*`, `use-block-editor`, insertion/selection/conversion
  helpers, and the BlockNote reference runtime in `apps/web/src/components`.
- Active-editor registration in `apps/web/src/hooks/use-journl-agent.tsx`,
  `apps/web/src/ai/tools`, the writing agent's BlockNote document formats, and
  `apps/web/src/app/api/ai/blocknote/route.ts`.
- Legacy reference/schema/adapter acceptance tests and BlockNote styles.

Remove those consumers, this package, direct `@blocknote/*` dependencies, the
comparison switch, and unused transitive dependencies together after their
replacements pass. Keep the document fixtures and framework-independent tests.
The 404 page and Tiptap's tests no longer require BlockNote.
