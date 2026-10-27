# Journl editor core

`useDocumentEditor` owns a mounted Tiptap editor, validates document changes and
emits commits. It accepts initial blocks, a commit callback, a URL resolver and a
stable array of presentation extensions. It returns the editor, a host ref and an
error flag. Attach the host ref before effects run. Remount to load a new draft;
callback changes and acknowledged saves preserve selection and undo.

Default schema extensions and editing plugins come from `@acme/tiptap`. A supplied
extension with the same name replaces its default presentation. Other extensions
are added. The hook imports no styled UI. `@acme/editor` is the default UI and an
example of composing this hook with code/reference node views and controls.

Both package and shadcn source installation are described in
[`@acme/editor`](../editor/README.md).
