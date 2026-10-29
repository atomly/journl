# Native and touch block drag review

## Failure path

Native handle drags previously depended on `EditorView.dragging` surviving until
drop. ProseMirror determines move/copy behavior from that temporary field and the
platform copy modifier at drop time. When the field is absent, the identity
plugin imports the clipboard slice as a copy and creates fresh block IDs. The
result is duplicate content rather than a failed move.

This is a reproducible failure path, rather than proof of which browser event
cleared that field in the reported intermittent incident. A regression deliberately
clears the field during a real code-block handle drag and checks ordering, block
count, stable identity, and save/reload.

## Gesture branches

| Gesture | Ownership and result |
| --- | --- |
| Native handle move | Custom MIME payload identifies the source editor and a unique session. A transaction-mapped source bookmark survives focus and selection changes. The move removes and inserts that source in one history event. |
| Native handle copy | The platform copy modifier at drop explicitly selects a copy. Parent and descendant identities are regenerated. |
| Drop on the source | A move inside its own selected range is consumed without changing the document. |
| Read-only editor, deleted source, stale token, or ended session | The owned drop is consumed. It cannot fall back to importing clipboard content. |
| Source moves after other edits | The bookmark maps through transactions and the selected block IDs must still lie in that range. Removed or mismatched sources cancel. |
| Drop in another editor | The target does not own the session. Normal clipboard import gives that editor fresh identities. |
| Native text or external drag | Without the handle MIME payload, ordinary ProseMirror and identity-plugin behavior remains. |
| Touch handle drag | dnd-kit owns the gesture. Native drag start is prevented while touch owns it. Touch completion uses captured block IDs and explicit move operations, with no copy operation. |
| Touch cancellation or multiple contacts | The touch path clears its destination and selected IDs. A cancelled native start cannot seed a clipboard move. |
| Table axis drag | Its separate MIME guard remains in the engine; stale table gestures cannot become clipboard copies. |

Floating formatting controls hide during the owned native session so their
portals cannot intercept the destination's dragover/drop events. Handle tracking
also follows that session instead of depending on the temporary view field.
Whole-block targets use the body's vertical half, rather than a text caret or
the height of a parent's descendants.

The session is cleared on drop, document drag end, and editor destruction. Source
IDs and bookmarks are scoped to one editor. They are not document metadata or
persisted attributes.

## Related presentation fixes

Code handles align with the language controls. Divider handles align with the
actual horizontal rule. Text blocks still use their first writing line. The
same geometry applies to desktop and touch handles.

Numbered markers do not wrap, and their gutter uses font-relative units. Two-digit
numbers therefore keep their dot on the same line at larger text sizes.

Table selection uses a visible fill and inset border with independent consumer
CSS tokens. It no longer relies on a low-opacity host ring color.

Acceptance checks also exposed native scrolling after a table popup closes.
Column reveal now checks for three stable frames, with an eight-frame limit.
Fresh pointer, keyboard, wheel, or touch input cancels it immediately. Document
changes and editor destruction also cancel it. Wide columns reveal the available
portion without alternating between their edges. Vertical scrolling is preserved.

The regression tests simulate delayed popup scrolling, merged rows, oversized
columns, and interruption. Browser checks wait for popup closure before the next
gesture and verify that typing lands in the intended cell.
