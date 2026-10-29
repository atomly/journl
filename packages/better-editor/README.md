# BetterEditor

A source-first editor built on Tiptap and ProseMirror. Engine, UI, and serialization sources live in one package. The document contract remains in
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
import { useBetterEditor } from "@acme/better-editor/ui/use-better-editor";
```

The consumer supplies stable presentation extensions to the engine.
Extensions with the same name replace the default schema extension. The engine
owns editing plugins, validation, clipboard handling, and commit delivery. The
caller owns the draft and save queue. `createDocumentEditor` is also available at
`@acme/better-editor/engine/editor` for consumers that manage their own DOM lifecycle;
call `destroy()` when the editor is no longer needed.

## Distribution

Workspace consumers use package subpaths. The package metadata supports a future
npm release; the scope and release version remain provisional. No packages are
published by an application build.

A future shadcn registry can distribute these sources for consumers to own and
edit. The separate source namespaces, relative internal imports, explicit module
exports, and consumer-owned composition preserve that option. This repository
does not currently generate or host an editor registry. Installation manifests,
source-copy import rewriting, and registry hosting are deferred until needed.

Run `pnpm --filter @acme/better-editor test:unit` for engine and UI tests.

## Compose an experience

The consumer application owns its editor component and chooses its extensions,
controls, menu items, responsive layout, and read-only behavior. The package exports
composable parts, with no document-editor preset or application toolbar.
The lifecycle hook returns an editor instance and diagnostic state. The root
shares that stable instance without broadcasting the document through context.

```tsx
import { EditorRoot } from "@acme/better-editor/ui/editor-root";
import { EditorContent } from "@acme/better-editor/ui/editor-content";
import { EditorToolbar } from "@acme/better-editor/ui/editor-toolbar";
import { BoldButton, ItalicButton } from "@acme/better-editor/ui/mark-button";
import { LinkMenu } from "@acme/better-editor/ui/link-menu";
import { SlashMenu } from "@acme/better-editor/ui/slash-menu";
import { useBetterEditor } from "@acme/better-editor/ui/use-better-editor";

const { editor, configurationError } = useBetterEditor({
  initialBlocks,
  editable: true,
  onCommit: saveAcceptedChange,
});

return (
  <EditorRoot editor={editor}>
    <EditorToolbar
      mode={compact ? "sticky" : "floating"}
      visibility={compact ? "always" : "selection"}
      className="article-toolbar"
    >
      <BoldButton />
      <ItalicButton />
      <LinkMenu />
    </EditorToolbar>
    <EditorContent aria-label="Article" />
    <SlashMenu items={articleCommands} />
    {configurationError && <p role="alert">{configurationError.message}</p>}
  </EditorRoot>
);
```

The consumer owns `compact`, CSS offsets, DOM order, typography, routing, persistence,
and recovery UI. Toolbar modes are inline, sticky, and floating. Visibility is
always, selection, or manual; manual visibility uses `open` and `onOpenChange`.
Floating controls accept placement, offset, collision padding, and a portal
container. Use a portal container within your theme scope when themes vary by
editor. Controls support Base UI element/ref composition through `render`.

Set `--better-editor-cell-selection` and `--better-editor-cell-selection-border`
on the editor container to customize the table-selection fill and border.

`CommandButton` accepts an independent command with `run`, `canRun`, and `isActive`.
`useEditorCommand` supplies the same state, execution guard, and focus behavior
for custom menu items. `useEditorSelector` from the root module subscribes to selected values, with an
optional equality function. Applicability checks should not construct transactions.
Use `BlockHandle` and `TableControls` from their leaf modules to retain native
selection, drag, and touch behavior while replacing handle contents or menu
contents through `renderHandle` and `renderMenu`. `useBetterEditor` installs the
native block-drag controller. When constructing your own Tiptap engine for
`BlockHandle`, include `nativeBlockDragExtension` from `engine/native-block-drag`
alongside the required block schema. A handle cancels native drag start if that
controller is absent, rather than falling back to an unsafe clipboard move.

`useReferenceViews` returns a stable presentation store and its extension. Include
that extension at mount, and render `ReferenceViews` with the store when opting
into rich reference presentation. Reference services still use the existing
reference package during the planned later decoupling.

### Slash commands

`SlashMenu` requires a readonly item collection, or a source function receiving the
query and `{ editor, signal }`. Async sources provide already filtered/ranked
results; static collections filter title and keywords. Superseded requests are
aborted and late results cannot replace a newer query.

```ts
const articleCommands = [
  {
    id: "signature",
    title: "Signature",
    keywords: "author sign",
    group: "Writing",
    run: ({ transaction }) => transaction.insertText("Written by me"),
  },
];
```

Each item requires a unique nonempty ID. `transaction` already removes the trigger
query and maps its selection. Return a transaction to execute the edit atomically,
or null to leave the document unchanged. Actions are synchronous; async work belongs
in the result source and must revalidate its target before creating an edit.
`defaultSlashItems()` supplies the standard block actions. Use `renderItem` to
customize item content, or `useSlashMenu` to build your own list presentation.
The same ordered result snapshot drives pointer, keyboard, and ARIA selection.
A minimal `useBetterEditor` instance does not capture slash keys without a menu.

### Lifecycle and consumer behavior

`initialBlocks` and extensions are mount-time configuration. Recreating an equivalent
extensions array does not reset content. An unsupported extension change produces
`configurationError` while preserving the draft. Change `resetKey` explicitly to
load the current initial blocks/configuration and reset history. Editable state,
callbacks, services, and presentation can change without rebuilding the engine.

`error`/`cause` report engine or content failure; `callbackError` reports a consumer
commit failure. A synchronous commit callback exception does not disable editing.
Synchronous callback failures retain the last delivered baseline. Call `retryCommit()`
to retry the latest valid snapshot, or continue editing to deliver the accumulated
changes on the next commit. The consumer still owns asynchronous save retries and
persistence errors.

Pass `openLink` and `normalizeReferenceUrl` explicitly to `useBetterEditor` when
needed. `EditorRoot` accepts an `onActionError` callback. Block URL
construction, navigation, persistence, and menu ordering belong to the application.
Editability defaults to true and is independent of commit callback presence.
Set `editable: false` explicitly for read-only views.

Handle and context-menu parts require `renderMenu`; they retain targeting and
gestures while the consumer supplies the menu contents. `LinkMenu` accepts a child
render function with `url`, `editor`, `restoreSelection`, and `close` for optional
consumer actions. Reference insertion buttons belong in that consumer content.

`ReferenceViews` accepts `renderActions` and `renderEmbeddedContent`. It does not
create nested editors or choose an action menu. Without an embedded renderer it
leaves an Open source link and does not fetch embedded content. Cycle detection
is built in; consumers can set `maxEmbedDepth` to bound expanded previews.

### Performance and optional presentation

The engine reuses validated immutable snapshots for unchanged ProseMirror nodes.
It checks document structure, identity uniqueness, and depth on each read, validates
changed payloads, and clones commit payloads to protect internal snapshots from
consumer mutation. Data-only diffs use reusable indexes; structural commands emit
targeted steps and leave the caller transaction untouched if validation fails.

Highlighting is no longer part of the schema. Include `syntaxHighlightExtension`
from `engine/code-block` explicitly. A basic hook
import does not include the menus, drag UI, reference views, or language grammars.
The schema still supports existing document block kinds for content preservation.

Run `pnpm --filter @acme/better-editor bench` for repeatable 100/1,000/5,000-paragraph
benchmarks. The report separates full decoding from the cached engine-delivery
path; neither measures browser input-to-paint latency. Benchmark sources and tests are development tools, separate from the public module
exports.
