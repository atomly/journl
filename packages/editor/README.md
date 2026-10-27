# Journl editor

`@acme/editor` is the styled React writing surface. It imports Journl's Base UI
controls from `@acme/ui` directly. Customize the source to change its appearance;
there is no UI provider or runtime component replacement contract.

## Package installation

```tsx
import { DocumentEditor } from "@acme/editor";
import "@acme/editor/styles.css";

<DocumentEditor initialBlocks={blocks} onCommit={save} references={references} />;
```

Include the editor, references and shared UI sources in the host's Tailwind scan.
The styles use the host's Tailwind theme tokens. The packages export TypeScript
source and require a bundler that compiles TS/TSX, React 19 and Tailwind 4.
`pnpm pack` resolves workspace dependencies to package versions. The editor and
its runtime workspace dependencies have public package manifests; this change
does not publish them or reserve the `@acme` npm scope. Choose the public scope
and release versions together before publishing.

## Source installation through shadcn

Run `pnpm registry:build` to generate six registry items under `apps/web/public/r`.
Web dev and production build regenerate them from the workspace source. To test
another registry host, pass its absolute `/r/` URL (with trailing slash) as the argument to
`pnpm registry:build http://localhost:3100/r/`.

```sh
pnpm dlx shadcn@latest add https://journl-snowy.vercel.app/r/journl-editor.json
```

The URL is served after this change is deployed. The registry copies the editor,
core, document contract, Tiptap implementation, reference components and shared UI
into `components/journl/`. It installs external dependencies and rewrites workspace
imports to local source imports. No private workspace package is required.
Consumers own all of these files, including the core and shared controls. The
registry uses the Base UI controls shipped here; substituting Radix components
requires adapting their props and focus behavior.

Import `DocumentEditor` from `@/components/journl/editor/editor-index` and its
`editor-editor.css` from the same directory. Use your configured components alias if it
differs from `@/components`. Include `components/journl` in your Tailwind sources
and provide the same theme tokens used by the package installation.

## Core and UI responsibilities

`@acme/document` owns the persisted block contract. `@acme/tiptap` owns schema
translation, ProseMirror plugins, commands and transactions.
`@acme/editor-core` exports `useDocumentEditor`, reference insertion and the
commit type. The hook owns mounting, destruction, clipboard handling, reference
resolution, content validation and commit delivery. It imports no styled controls
or editor UI. A UI variation can use the same hook and supply stable node-view
extensions; matching extension names replace the default schema presentation.

`@acme/editor` supplies menus, code and reference node views, tables, touch
controls, selection visibility and styles. Nested read-only editors inherit the
host's `ReferenceClient`. Neither the core nor the UI imports the application,
Next.js, authentication, database access or save queues.

The mounted editor owns selection and undo. The app owns drafts and persistence.
A draft reset remounts the view; acknowledged saves must not reset its state.
`onCommit` emits validated blocks and Journl operations. An unavailable reference
client leaves authored links available without metadata.
