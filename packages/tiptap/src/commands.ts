import {
  applyDocumentOperations,
  type DocumentOperation,
  duplicateBlock,
} from "@acme/document";
import { Extension } from "@tiptap/core";
import { closeHistory, history, redo, undo } from "@tiptap/pm/history";
import {
  type EditorState,
  TextSelection,
  type Transaction,
} from "@tiptap/pm/state";
import { fromTiptapDocument, toTiptapDocument } from "./codec";
import { blockAt, type IdFactory, joinBlocks, splitBlock } from "./identity";

export function selectedBlock(state: EditorState) {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name === "journlBlock")
      return {
        id: node.attrs.id as string,
        index: $from.index(depth - 1),
        node,
        parentId: depth > 2 ? ($from.node(depth - 2).attrs.id as string) : null,
        pos: $from.before(depth),
        siblings: $from.node(depth - 1),
      };
  }
  const node = state.doc.nodeAt(state.selection.from);
  if (node?.type.name === "journlBlock")
    return {
      id: node.attrs.id as string,
      index: $from.index(),
      node,
      parentId: null,
      pos: state.selection.from,
      siblings: $from.parent,
    };
  return null;
}

/** Structural edits cross the same domain-operation boundary as accepted proposals. */
export function editBlocks(
  transaction: Transaction,
  operations: DocumentOperation[],
  focusId?: string,
) {
  const next = applyDocumentOperations(
    fromTiptapDocument(transaction.doc),
    operations,
  );
  const doc = toTiptapDocument(next, transaction.doc.type.schema);
  closeHistory(transaction).replaceWith(
    0,
    transaction.doc.content.size,
    doc.content,
  );
  if (focusId) {
    const block = blockAt(transaction.doc, focusId);
    transaction.setSelection(
      TextSelection.near(transaction.doc.resolve(block.pos + 2)),
    );
  }
  return transaction;
}

export function indentBlock(
  state: EditorState,
  outdent = false,
): Transaction | null {
  const target = selectedBlock(state);
  if (!target) return null;
  let parentId: string | null;
  let afterId: string | null;
  if (outdent) {
    if (!target.parentId) return null;
    const parent = blockAt(state.doc, target.parentId);
    const $parent = state.doc.resolve(parent.pos);
    parentId =
      $parent.depth > 1 ? $parent.node($parent.depth - 1).attrs.id : null;
    afterId = target.parentId;
  } else {
    if (!target.index) return null;
    const previous = target.siblings.child(target.index - 1);
    parentId = previous.attrs.id;
    const children = previous.childCount === 2 ? previous.child(1) : null;
    afterId = children?.lastChild?.attrs.id ?? null;
  }
  return editBlocks(
    state.tr,
    [{ afterId, id: target.id, parentId, type: "move" }],
    target.id,
  );
}

export function duplicateSelectedBlock(
  state: EditorState,
  createId: IdFactory,
): Transaction | null {
  const target = selectedBlock(state);
  if (!target) return null;
  const [source] = fromTiptapDocument(state.doc.type.create(null, target.node));
  if (!source) return null;
  const copy = duplicateBlock(source, createId);
  return editBlocks(
    state.tr,
    [
      {
        afterId: target.id,
        block: copy,
        parentId: target.parentId,
        type: "insert",
      },
    ],
    copy.id,
  );
}

/** The domain styles text, not reference atoms. Never apply unsupported marks to atoms. */
export function toggleTextMark(
  state: EditorState,
  name: string,
): Transaction | null {
  const type = state.schema.marks[name];
  if (!type) return null;
  const transaction = state.tr;
  if (state.selection.empty) {
    if (!state.selection.$from.parent.type.allowsMarkType(type)) return null;
    const marks = state.storedMarks ?? state.selection.$from.marks();
    return type.isInSet(marks)
      ? transaction.removeStoredMark(type)
      : transaction.addStoredMark(type.create());
  }
  const { from, to } = state.selection;
  const remove = state.doc.rangeHasMark(from, to, type);
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (
      !node.isText ||
      !state.doc.resolve(pos).parent.type.allowsMarkType(type)
    )
      return;
    const start = Math.max(from, pos);
    const end = Math.min(to, pos + node.nodeSize);
    if (remove) transaction.removeMark(start, end, type);
    else transaction.addMark(start, end, type.create());
  });
  return transaction.docChanged ? transaction : null;
}

export function editingExtension(createId: IdFactory) {
  return Extension.create({
    addKeyboardShortcuts() {
      const enter = () => {
        const { state, view } = this.editor;
        const target = selectedBlock(state);
        if (!target) return false;
        if (!state.selection.$from.parent.isTextblock) {
          const wrapper = state.schema.nodes.journlBlock;
          const paragraph = state.schema.nodes.paragraph;
          if (!wrapper || !paragraph) return false;
          const pos = target.pos + target.node.nodeSize;
          const tr = state.tr.insert(
            pos,
            wrapper.createChecked({ id: createId() }, paragraph.create()),
          );
          view.dispatch(tr.setSelection(TextSelection.create(tr.doc, pos + 2)));
          return true;
        }
        if (state.selection.$from.parent.type.name === "codeBlock") {
          view.dispatch(state.tr.insertText("\n"));
          return true;
        }
        if (!state.selection.$from.sameParent(state.selection.$to))
          return false;
        const offset = state.selection.$from.parentOffset;
        const transaction = state.tr.deleteSelection();
        view.dispatch(splitBlock(transaction, target.id, offset, createId));
        return true;
      };
      const join = (backward: boolean) => {
        const { state, view } = this.editor;
        const target = selectedBlock(state);
        if (!target || !state.selection.empty) return false;
        const parent = state.selection.$from.parent;
        const offset = state.selection.$from.parentOffset;
        if (
          !parent.isTextblock ||
          offset !== (backward ? 0 : parent.content.size)
        )
          return false;
        const index = target.index + (backward ? -1 : 1);
        if (index < 0 || index >= target.siblings.childCount) return false;
        const adjacent = target.siblings.child(index);
        if (adjacent.firstChild?.type !== target.node.firstChild?.type)
          return false;
        view.dispatch(
          joinBlocks(
            state.tr,
            backward ? adjacent.attrs.id : target.id,
            backward ? target.id : adjacent.attrs.id,
          ),
        );
        return true;
      };
      const indent = (outdent: boolean) => {
        const transaction = indentBlock(this.editor.state, outdent);
        if (!transaction) return false;
        this.editor.view.dispatch(transaction);
        return true;
      };
      const mark = (name: string) => {
        const transaction = toggleTextMark(this.editor.state, name);
        if (!transaction) return false;
        this.editor.view.dispatch(transaction);
        return true;
      };
      return {
        Backspace: () => join(true),
        Delete: () => join(false),
        Enter: enter,
        "Mod-b": () => mark("bold"),
        "Mod-i": () => mark("italic"),
        "Mod-Shift-z": () => redo(this.editor.state, this.editor.view.dispatch),
        "Mod-u": () => mark("underline"),
        "Mod-y": () => redo(this.editor.state, this.editor.view.dispatch),
        "Mod-z": () => undo(this.editor.state, this.editor.view.dispatch),
        "Shift-Enter": () => {
          this.editor.view.dispatch(this.editor.state.tr.insertText("\n"));
          return true;
        },
        "Shift-Tab": () => indent(true),
        Tab: () => indent(false),
      };
    },
    addProseMirrorPlugins: () => [history()],
    name: "journlEditing",
    priority: 1000,
  });
}
