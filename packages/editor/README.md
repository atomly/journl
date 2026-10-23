# Journl editor

`@acme/editor` owns the React writing surface: block controls, menus, references,
tables, touch controls and editor styles. It composes Base UI, Floating UI and the
low-level `@acme/tiptap` adapter. It does not import the web app, Next.js, tRPC,
authentication, database code, or save queues.

`DocumentEditor` accepts initial Journl blocks and emits validated blocks plus
Journl operations through `onCommit`. The mounted view owns selection and undo;
the app owns document sessions and persistence. A draft reset remounts the view.
Changes to an acknowledged save must not reset editor state.

The app injects a `ReferenceClient` from `@acme/references` for queries,
subscriptions and navigation. Nested read-only embeds inherit it. Without a
client, authored links remain available but metadata is unavailable. Reference
payloads remain independent of either editor frontend.

Use `@acme/editor/styles.css` and include this package's source in the host's
Tailwind scan. The public entry point exposes the editor and its commit type;
controls and node-view details are private implementation files.

`@acme/document` owns the persisted document contract. `@acme/tiptap` owns schema
translation and transactions. `@acme/ui` owns shared design-system primitives.
