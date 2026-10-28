import { type DocumentOperation, duplicateBlock } from "@acme/document";
import { Extension } from "@tiptap/core";
import { NodeRangeSelection } from "@tiptap/extension-node-range";
import { closeHistory, history, redo, undo } from "@tiptap/pm/history";
import {
  EditorState,
  NodeSelection,
  Selection,
  TextSelection,
  type Transaction,
} from "@tiptap/pm/state";
import { fromTiptapDocument, toTiptapDocument } from "../serialization/tiptap";
import { blockAt, type IdFactory, joinBlocks, splitBlock } from "./identity";
import { TOGGLE_BLOCK_META } from "./metadata";
import { restoreBlockSelection } from "./selection";

export function selectedBlock(state: Pick<EditorState, "doc" | "selection">) {
  const { $from } = state.selection;
  const selected = state.doc.nodeAt(state.selection.from);
  if (
    (state.selection instanceof NodeSelection ||
      state.selection instanceof NodeRangeSelection) &&
    selected?.type.name === "betterEditorBlock"
  )
    return {
      id: selected.attrs.id as string,
      index: $from.index(),
      node: selected,
      parentId: $from.depth
        ? ($from.node($from.depth - 1).attrs.id as string)
        : null,
      pos: state.selection.from,
      siblings: $from.parent,
    };
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name === "betterEditorBlock")
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
  if (node?.type.name === "betterEditorBlock")
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
  input: Transaction,
  operations: DocumentOperation[],
  focusId?: string,
) {
  // Build in isolation so a late invalid operation cannot leave the caller's
  // transaction partially modified. Only successful steps enter its history.
  const transaction = EditorState.create({
    doc: input.doc,
    selection: input.selection,
    storedMarks: input.storedMarks,
  }).tr;
  const focused = selectedBlock(transaction);
  const selection = transaction.selection;
  const preserve =
    focused &&
    focused.id === focusId &&
    selection.from >= focused.pos &&
    selection.to <= focused.pos + focused.node.nodeSize
      ? {
          anchor: selection.anchor - focused.pos,
          head: selection.head - focused.pos,
          node: selection instanceof NodeSelection,
        }
      : null;
  const destination = (parentId: string | null, afterId: string | null) => {
    let start = 0;
    let group = transaction.doc;
    if (parentId) {
      const parent = blockAt(transaction.doc, parentId);
      if (parent.node.childCount === 1) {
        const children = transaction.doc.type.schema.nodes.betterEditorChildren;
        if (!children) throw new Error("Missing block children schema");
        transaction.insert(
          parent.pos + parent.node.nodeSize - 1,
          children.createChecked(),
        );
      }
      const current = blockAt(transaction.doc, parentId);
      const children = current.node.child(1);
      start = current.pos + 1 + current.node.child(0).nodeSize + 1;
      group = children;
    }
    if (afterId) {
      const preceding = blockAt(transaction.doc, afterId);
      if (transaction.doc.resolve(preceding.pos).parent !== group)
        throw new Error(
          "Preceding block must belong to the destination parent",
        );
      return preceding.pos + preceding.node.nodeSize;
    }
    return start;
  };
  for (const operation of operations) {
    if (operation.type === "remove") {
      const target = blockAt(transaction.doc, operation.id);
      transaction.delete(target.pos, target.pos + target.node.nodeSize);
    } else if (operation.type === "update") {
      const target = blockAt(transaction.doc, operation.id);
      const replacement = toTiptapDocument(
        [{ ...operation.data, id: operation.id }],
        transaction.doc.type.schema,
      ).firstChild?.firstChild;
      if (!replacement || !target.node.firstChild)
        throw new Error("Invalid block update");
      transaction.replaceWith(
        target.pos + 1,
        target.pos + 1 + target.node.firstChild.nodeSize,
        replacement,
      );
    } else if (operation.type === "move") {
      const target = blockAt(transaction.doc, operation.id);
      if (operation.afterId === operation.id)
        throw new Error("Cannot move a block after itself");
      if (operation.parentId) {
        const parent = blockAt(transaction.doc, operation.parentId);
        if (
          parent.pos >= target.pos &&
          parent.pos < target.pos + target.node.nodeSize
        )
          throw new Error("Cannot move a block into itself");
      }
      transaction.delete(target.pos, target.pos + target.node.nodeSize);
      transaction.insert(
        destination(operation.parentId, operation.afterId),
        target.node,
      );
    } else {
      const node = toTiptapDocument(
        [operation.block],
        transaction.doc.type.schema,
      ).firstChild;
      if (!node) throw new Error("Invalid inserted block");
      const ids = new Set<string>();
      transaction.doc.descendants((item) => {
        if (item.type.name === "betterEditorBlock") ids.add(item.attrs.id);
      });
      node.descendants((item) => {
        if (item.type.name === "betterEditorBlock") {
          if (ids.has(item.attrs.id)) throw new Error("Duplicate block ID");
          ids.add(item.attrs.id);
        }
      });
      if (ids.has(node.attrs.id)) throw new Error("Duplicate block ID");
      transaction.insert(
        destination(operation.parentId, operation.afterId),
        node,
      );
    }
  }
  const emptyGroups: number[] = [];
  transaction.doc.descendants((node, pos) => {
    if (node.type.name === "betterEditorChildren" && !node.childCount)
      emptyGroups.push(pos);
  });
  for (const pos of emptyGroups.reverse()) transaction.delete(pos, pos + 2);
  transaction.doc.check();
  if (focusId) {
    const block = blockAt(transaction.doc, focusId);
    transaction.setSelection(
      preserve
        ? preserve.node
          ? NodeSelection.create(transaction.doc, block.pos + preserve.anchor)
          : TextSelection.create(
              transaction.doc,
              block.pos + preserve.anchor,
              block.pos + preserve.head,
            )
        : TextSelection.near(transaction.doc.resolve(block.pos + 2)),
    );
  }
  closeHistory(input);
  for (const step of transaction.steps) input.step(step);
  input.setSelection(
    Selection.fromJSON(input.doc, transaction.selection.toJSON()),
  );
  input.setStoredMarks(transaction.storedMarks);
  return input;
}

/** Select the sibling range at the nearest shared level. Descendants move with
 * their parent, so a range never moves the same subtree twice. */
export function selectedBlocks(state: EditorState) {
  const { selection } = state;
  if (selection.empty || selection instanceof NodeSelection) {
    const block = selectedBlock(state);
    return block ? [block] : [];
  }
  const { $from } = selection;
  const end = Math.max(selection.from, selection.to - 1);
  for (let depth = $from.depth; depth >= 0; depth--) {
    const group = $from.node(depth);
    if (group.type.name !== "doc" && group.type.name !== "betterEditorChildren")
      continue;
    if (end > $from.end(depth)) continue;
    const start = $from.start(depth);
    const result: NonNullable<ReturnType<typeof selectedBlock>>[] = [];
    group.forEach((node, offset, index) => {
      const pos = start + offset;
      if (pos < selection.to && pos + node.nodeSize > selection.from)
        result.push({
          id: node.attrs.id as string,
          index,
          node,
          parentId: depth ? ($from.node(depth - 1).attrs.id as string) : null,
          pos,
          siblings: group,
        });
    });
    return result;
  }
  return [];
}

/** Cheap applicability check: does not serialize content or construct an edit. */
export function canIndentBlock(state: EditorState, outdent = false): boolean {
  const target = selectedBlocks(state)[0];
  return Boolean(target && (outdent ? target.parentId : target.index > 0));
}

export function indentBlock(
  state: EditorState,
  outdent = false,
): Transaction | null {
  const targets = selectedBlocks(state);
  const target = targets[0];
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
  const operations: DocumentOperation[] = targets.map((block) => {
    const operation: DocumentOperation = {
      afterId,
      id: block.id,
      parentId,
      type: "move",
    };
    afterId = block.id;
    return operation;
  });
  const tr = editBlocks(state.tr, operations, target.id);
  restoreBlockSelection(state, tr);
  return tr;
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

/** The selection may contain one range per table cell. Style only text in
 * parents that support the requested mark; reference atoms stay unmarked. */
function selectedText(
  state: EditorState,
  name: string,
  range?: { from: number; to: number },
) {
  const type = state.schema.marks[name];
  const segments: { from: number; to: number; marked: boolean }[] = [];
  if (!type) return segments;
  const ranges = range
    ? [range]
    : state.selection.ranges.map(({ $from, $to }) => ({
        from: $from.pos,
        to: $to.pos,
      }));
  for (const { from, to } of ranges)
    state.doc.nodesBetween(from, to, (node, pos, parent) => {
      if (node.isText && parent?.type.allowsMarkType(type))
        segments.push({
          from: Math.max(from, pos),
          marked: Boolean(type.isInSet(node.marks)),
          to: Math.min(to, pos + node.nodeSize),
        });
    });
  return segments;
}

export function textMarkActive(state: EditorState, name: string) {
  if (state.selection.empty)
    return Boolean(
      state.schema.marks[name]?.isInSet(
        state.storedMarks ?? state.selection.$from.marks(),
      ),
    );
  const segments = selectedText(state, name);
  return segments.length > 0 && segments.every((segment) => segment.marked);
}

export function setTextMark(
  state: EditorState,
  name: string,
  attrs: Record<string, unknown> | null,
  range?: { from: number; to: number },
): Transaction | null {
  const type = state.schema.marks[name];
  if (!type) return null;
  const tr = state.tr;
  if (state.selection.empty && !range) {
    if (!state.selection.$from.parent.type.allowsMarkType(type)) return null;
    return attrs === null
      ? tr.removeStoredMark(type)
      : tr.addStoredMark(type.create(attrs));
  }
  for (const { from, to } of selectedText(state, name, range)) {
    tr.removeMark(from, to, type);
    if (attrs !== null) tr.addMark(from, to, type.create(attrs));
  }
  return tr.docChanged ? tr : null;
}

export function toggleTextMark(
  state: EditorState,
  name: string,
): Transaction | null {
  return setTextMark(state, name, textMarkActive(state, name) ? null : {});
}

export function editingExtension(createId: IdFactory) {
  return Extension.create({
    addKeyboardShortcuts() {
      const enter = () => {
        const { state, view } = this.editor;
        if (view.composing) return false;
        const target = selectedBlock(state);
        if (!target) return false;
        if (
          state.selection instanceof NodeSelection &&
          target.node.firstChild?.isTextblock
        ) {
          view.dispatch(
            state.tr.setSelection(
              TextSelection.near(state.doc.resolve(target.pos + 2)),
            ),
          );
          return true;
        }
        if (!state.selection.$from.parent.isTextblock) {
          const wrapper = state.schema.nodes.betterEditorBlock;
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
        if (view.composing) return false;
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
        const left = backward ? adjacent.firstChild : target.node.firstChild;
        const right = backward ? target.node.firstChild : adjacent.firstChild;
        if (!left?.isTextblock || !right?.isTextblock) return false;
        if (!left.type.validContent(left.content.append(right.content)))
          return true;
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
        if (this.editor.view.composing) return false;
        const transaction = indentBlock(this.editor.state, outdent);
        if (!transaction) return Boolean(selectedBlock(this.editor.state));
        this.editor.view.dispatch(transaction);
        return true;
      };
      const mark = (name: string) => {
        if (this.editor.view.composing) return false;
        const transaction = toggleTextMark(this.editor.state, name);
        if (!transaction) return false;
        this.editor.view.dispatch(transaction);
        return true;
      };
      return {
        Backspace: () => join(true),
        Delete: () => join(false),
        Enter: enter,
        Escape: () => {
          const { state, view } = this.editor;
          const target = selectedBlock(state);
          if (
            !target ||
            view.composing ||
            state.selection instanceof NodeSelection
          )
            return false;
          view.dispatch(
            state.tr.setSelection(NodeSelection.create(state.doc, target.pos)),
          );
          return true;
        },
        "Mod-[": () => indent(true),
        "Mod-]": () => indent(false),
        "Mod-b": () => mark("bold"),
        "Mod-d": () => {
          if (this.editor.view.composing) return false;
          const tr = duplicateSelectedBlock(this.editor.state, createId);
          if (!tr) return false;
          this.editor.view.dispatch(tr.scrollIntoView());
          return true;
        },
        "Mod-Enter": () => {
          const { state, view } = this.editor;
          if (view.composing) return false;
          const target = selectedBlock(state);
          const body = target?.node.firstChild;
          if (!target || !body) return false;
          if (body.type.name === "checkListItem") {
            view.dispatch(
              state.tr.setNodeMarkup(target.pos + 1, undefined, {
                ...body.attrs,
                props: {
                  ...body.attrs.props,
                  checked: !body.attrs.props?.checked,
                },
              }),
            );
            return true;
          }
          if (
            body.type.name === "toggleListItem" ||
            (body.type.name === "heading" && body.attrs.props?.isToggleable)
          ) {
            view.dispatch(state.tr.setMeta(TOGGLE_BLOCK_META, target.id));
            return true;
          }
          return false;
        },
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
    name: "better-editor-editing",
    priority: 1000,
  });
}

/** Accepted proposals use normal document transactions and one isolated undo event. */
export function applyAcceptedOperations(
  editor: import("@tiptap/core").Editor,
  operations: DocumentOperation[],
) {
  editor.view.dispatch(editBlocks(editor.state.tr, operations));
  editor.view.dispatch(closeHistory(editor.state.tr));
}

/** Drag the selected sibling range as complete wrappers, retaining descendants. */
export function blockDragSelection(state: EditorState, id: string) {
  const chosen = selectedBlocks(state);
  if (chosen.length > 1 && chosen.some((block) => block.id === id)) {
    const first = chosen[0];
    const last = chosen.at(-1);
    if (first && last)
      return NodeRangeSelection.create(
        state.doc,
        first.pos,
        last.pos + last.node.nodeSize,
        state.doc.resolve(first.pos).depth,
      );
  }
  return NodeSelection.create(state.doc, blockAt(state.doc, id).pos);
}
