# OpenEditor

A source-first editor built on Tiptap and ProseMirror. This package combines the
former editor, editor-core, and tiptap packages. The document contract remains in
`@acme/document`, reference contracts in `@acme/references`, and shared controls in
`@acme/ui`.

## Source namespaces

- `src/engine`: Tiptap extensions, ProseMirror plugins, commands, selection,
  tables, reference insertion, and editor orchestration. It has no React imports.
- `src/ui`: React components, the mounting hook, node views, controls, and CSS.
- `src/serialization`: Tiptap document conversion, clipboard, HTML, and Markdown.

Each public module has an explicit export in `package.json`. There is no root
barrel. Import the module you use:

```tsx
import { DocumentEditor } from "@acme/open-editor/ui/document-editor";
```

The React component supplies stable presentation extensions to the engine.
Extensions with the same name replace the default schema extension. The engine
owns editing plugins, validation, clipboard handling, and commit delivery. The
caller owns the draft and save queue. `createDocumentEditor` is also available at
`@acme/open-editor/engine/editor` for consumers that manage their own DOM lifecycle;
call `destroy()` when the editor is no longer needed.

## Distribution

Workspace consumers use package subpaths. The package metadata supports a future
npm release; the scope and release version remain provisional. Nothing is
published by the registry build or application build.

For source ownership through shadcn, generate the registry in the host repository
and serve its output at a URL you control. Set `REGISTRY_URL` to that URL, then install:

```sh
pnpm dlx shadcn@latest add "$REGISTRY_URL/open-editor.json"
```

The registry copies OpenEditor and its document, reference, and shared UI sources
into the consumer's configured components directory. Imports are relative between
copied modules. Consumers own and can edit all installed sources. For example:

```tsx
import { DocumentEditor } from "@/components/open-editor/open-editor/ui/open-editor-ui-document-editor";
```

The component imports `open-editor-ui-editor.css`. The host must configure Tailwind
and scan the installed sources. Regenerate registry output after source changes;
`apps/web/public/r` is generated and ignored by Git.

Run `pnpm --filter @acme/open-editor test:unit` for engine and UI tests, and
`pnpm registry:test` for the copied import graph.
