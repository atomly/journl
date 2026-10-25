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
Tailwind scan. The public entry point exposes the editor, commit type, and UI provider;
controls and node-view details remain private implementation files.

`@acme/document` owns the persisted document contract. `@acme/tiptap` owns schema
translation and transactions. `@acme/ui` owns shared design-system primitives.

## UI adapter

Editor controls consume `EditorUIComponents` through context. They do not import
styled buttons, menus, tooltips, popovers, selects or toolbars directly. The
`@acme/editor/ui` entry supplies the existing shared UI as a default adapter:

```tsx
import { DocumentEditor, EditorUIProvider } from "@acme/editor";
import { editorUI } from "@acme/editor/ui";

<EditorUIProvider components={editorUI}>
  <DocumentEditor initialBlocks={blocks} onCommit={save} />
</EditorUIProvider>;
```

Supply a stable adapter object, or spread the default adapter and override only
the components you need. `SurfaceButton` covers custom-styled choices, color
swatches, reference actions and embed disclosures; `Input` covers the link field.
These controls retain their editor-specific classes and event handlers. Nested editors and React portals inherit the provider.
The core entry does not import the default adapter. References are injected
separately through `ReferenceClient`; neither adapter knows about app persistence.

The contract follows the installed Base UI primitives. Replacements must forward
refs, `render`, event handlers, accessible attributes, disabled state, and
portal/focus options. Editor commands and selection restoration stay in the
editor, while the UI adapter owns primitive presentation and interaction. This
is a Base UI adapter seam, not a promise of compatibility with arbitrary UI
libraries. React 19 is required for ref forwarding through component props.

The default adapter uses the app's Tailwind tokens and shared `@acme/ui` source.
This change does not package precompiled styles or make the workspace packages
ready for npm publication.
