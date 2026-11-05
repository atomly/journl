---
name: better-editor-consume
description: Compose or integrate @acme/better-editor in a React consumer without coupling the package to application persistence or UI policy.
---

Read `packages/better-editor/README.md` and its leaf export map before choosing APIs.
Paths refer to the Journl repository, not this skill directory.

- Import explicit package leaves. Do not add barrels, presets, injection providers,
  or a second persisted document format.
- Compose engine and optional presentation extensions through `useBetterEditor`.
  Factories are mount-time configuration. Keep instances stable; change `resetKey`
  only to deliberately reset the document and undo history.
- Supply grammars to `createSyntaxHighlighting`, install its extension, and pass
  its languages to code-block presentation. Do not bundle a grammar catalog into
  the basic editor import.
- The consumer owns persistence, routing, menu choices, AI proposal policy, and
  services. Keep stored IDs, accepted content, read-only state, and cancellation
  intact. Revalidate retained actions against the current editor state.
- Use `@acme/ui` for shared styled primitives. Keep selection and drag positioning
  in editor UI. Do not replace virtual-anchor geometry with a triggered popover
  without checking focus, selection, collision, and cancellation behavior.
- Validate relevant engine/UI specs and real-app browser behavior for user-visible
  changes. Benchmarks do not substitute for correctness or browser acceptance.
