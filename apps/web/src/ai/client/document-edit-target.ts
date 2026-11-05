import { diffDocumentSnapshots } from "@acme/better-editor/engine/changes";
import { applyAcceptedOperations } from "@acme/better-editor/engine/commands";
import {
  fromTiptapDocument,
  toTiptapDocument,
} from "@acme/better-editor/serialization/tiptap";
import {
  applyDocumentOperations,
  type DocumentBlock,
  type DocumentOperation,
  documentRows,
} from "@acme/document";
import type { Editor } from "@tiptap/core";
import { closeHistory } from "@tiptap/pm/history";
import { Fragment, type Node, type ResolvedPos } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";

type Range = { from: number; to: number };
type Kind = "document" | "inline" | "blocks";

const selectionError = () =>
  new Error(
    "Select text within one paragraph, or select complete sibling blocks, then try again.",
  );
const retryError = () =>
  new Error(
    "The original target is no longer available. Select text and send your request again.",
  );

function wrapperDepth(position: ResolvedPos) {
  for (let depth = position.depth; depth > 0; depth--)
    if (position.node(depth).type.name === "betterEditorBlock") return depth;
  return null;
}

function ancestry(position: ResolvedPos) {
  return Array.from({ length: position.depth }, (_, index) => {
    const node = position.node(index + 1);
    return { attrs: node.attrs, type: node.type.name };
  });
}

function snapshotRange(doc: Node, range: Range, kind: Kind): DocumentBlock[] {
  if (kind === "document") return fromTiptapDocument(doc);
  if (kind === "blocks") {
    const slice = doc.slice(range.from, range.to);
    let wrappersOnly = slice.openStart === 0 && slice.openEnd === 0;
    slice.content.forEach((node) => {
      wrappersOnly &&= node.type.name === "betterEditorBlock";
    });
    if (!wrappersOnly || !slice.content.size) throw selectionError();
    return fromTiptapDocument(doc.type.createChecked(null, slice.content));
  }
  const from = doc.resolve(range.from);
  const to = doc.resolve(range.to);
  const depth = wrapperDepth(from);
  if (!depth || !from.sameParent(to) || !from.parent.isTextblock)
    throw selectionError();
  const wrapper = from.node(depth);
  const body = from.parent.copy(
    from.parent.content.cut(from.parentOffset, to.parentOffset),
  );
  return fromTiptapDocument(
    doc.type.createChecked(
      null,
      wrapper.type.createChecked(wrapper.attrs, body),
    ),
  );
}

/** Replace a sibling scope in the domain snapshot, retaining all outside blocks. */
function replaceScope(
  blocks: readonly DocumentBlock[],
  firstId: string,
  lastId: string,
  replacement: readonly DocumentBlock[],
): DocumentBlock[] {
  let replaced = false;
  const walk = (siblings: readonly DocumentBlock[]): DocumentBlock[] => {
    const first = siblings.findIndex((block) => block.id === firstId);
    const last = siblings.findIndex((block) => block.id === lastId);
    if (first !== -1 && last >= first) {
      replaced = true;
      return [
        ...siblings.slice(0, first),
        ...replacement,
        ...siblings.slice(last + 1),
      ];
    }
    return siblings.map((block) =>
      block.children?.length
        ? { ...block, children: walk(block.children) }
        : block,
    );
  };
  const next = walk(blocks);
  if (!replaced) throw retryError();
  return next;
}

/** One request owns a fixed range. Selection changes cannot retarget that request. */
export class DocumentEditTarget {
  readonly blocks: DocumentBlock[];
  readonly selection: boolean;
  private current: Range;
  private trackedDoc: Node;
  private valid = true;
  private retryable = true;
  private consumed = false;
  private readonly originalSlice: Fragment;
  private readonly originalAncestry: string;
  private readonly firstId: string | undefined;
  private readonly lastId: string | undefined;

  constructor(
    private readonly editor: Editor,
    private readonly kind: Kind,
    range: Range,
  ) {
    this.current = { ...range };
    this.trackedDoc = editor.state.doc;
    this.blocks = snapshotRange(this.trackedDoc, range, kind);
    this.selection = kind !== "document";
    this.originalSlice = this.trackedDoc.slice(range.from, range.to).content;
    this.originalAncestry = JSON.stringify(
      ancestry(this.trackedDoc.resolve(range.from)),
    );
    this.firstId = this.blocks[0]?.id;
    this.lastId = this.blocks.at(-1)?.id;
  }

  get range(): Range {
    return { ...this.current };
  }

  private sameTarget(doc: Node): boolean {
    if (this.kind === "document") return doc.eq(this.trackedDoc);
    const { from, to } = this.current;
    return (
      from < to &&
      to <= doc.content.size &&
      doc.slice(from, to).content.eq(this.originalSlice) &&
      JSON.stringify(ancestry(doc.resolve(from))) === this.originalAncestry
    );
  }

  /** Returns false after overlap, including formatting and structural changes.
   * Continue mapping invalidated targets so Retry still uses the original scope. */
  map(transaction: Transaction): boolean {
    if (this.consumed) return false;
    if (transaction.before !== this.trackedDoc) {
      this.valid = false;
      this.retryable = false;
      return false;
    }
    if (!transaction.docChanged) return this.valid;
    if (this.kind === "document") {
      this.current = { from: 0, to: transaction.doc.content.size };
      this.trackedDoc = transaction.doc;
      this.valid = false;
      return false;
    }
    let { from, to } = this.current;
    let overlaps = false;
    for (const step of transaction.steps) {
      const map = step.getMap();
      let hasRanges = false;
      map.forEach((start, end) => {
        hasRanges = true;
        if (start <= to && end >= from) overlaps = true;
      });
      if (!hasRanges) {
        const json = step.toJSON();
        if (typeof json.from === "number" && typeof json.to === "number") {
          if (json.from < to && json.to > from) overlaps = true;
        } else if (typeof json.pos !== "number") {
          // Unknown document changes must not become silent overlapping merges.
          overlaps = true;
        }
      }
      from = map.map(from, overlaps ? -1 : 1);
      to = map.map(to, overlaps ? 1 : -1);
    }
    this.current = { from, to };
    this.valid &&= !overlaps && this.sameTarget(transaction.doc);
    this.trackedDoc = transaction.doc;
    return this.valid;
  }

  /** Retry refreshes the same mapped scope, even if typing collapsed the cursor. */
  recapture(): DocumentEditTarget {
    if (
      this.editor.isDestroyed ||
      !this.editor.isEditable ||
      !this.retryable ||
      this.consumed
    )
      throw retryError();
    if (this.kind === "document")
      return new DocumentEditTarget(this.editor, this.kind, {
        from: 0,
        to: this.editor.state.doc.content.size,
      });
    if (this.current.from >= this.current.to) throw retryError();
    const next = new DocumentEditTarget(this.editor, this.kind, this.current);
    if (next.firstId !== this.firstId || next.lastId !== this.lastId)
      throw retryError();
    return next;
  }

  apply(operations: readonly DocumentOperation[]): boolean {
    if (
      !this.valid ||
      this.consumed ||
      this.editor.isDestroyed ||
      !this.editor.isEditable ||
      this.editor.state.doc !== this.trackedDoc ||
      !this.sameTarget(this.editor.state.doc)
    )
      return false;
    const after = applyDocumentOperations(this.blocks, operations);
    // The operation validator normalizes inline strings to document content.
    // Compare the editor representation so semantically unchanged output is a
    // successful completion without a save or undo event.
    if (
      toTiptapDocument(after, this.editor.state.schema).eq(
        toTiptapDocument(this.blocks, this.editor.state.schema),
      )
    ) {
      this.consumed = true;
      return true;
    }
    if (this.kind === "inline") {
      const replacement = toTiptapDocument(after, this.editor.state.schema);
      const body = replacement.firstChild?.firstChild;
      const currentBody = this.editor.state.doc.resolve(
        this.current.from,
      ).parent;
      if (
        after.length > 1 ||
        (after.length === 1 &&
          (after[0]?.id !== this.firstId ||
            replacement.firstChild?.childCount !== 1 ||
            !body?.sameMarkup(currentBody)))
      )
        throw new Error(
          "This edit changes the structure outside the selected text. Select complete blocks and try again.",
        );
      const content = body?.content ?? Fragment.empty;
      const transaction = closeHistory(this.editor.state.tr).replaceWith(
        this.current.from,
        this.current.to,
        content,
      );
      this.consumed = true;
      if (transaction.doc.eq(this.editor.state.doc)) return true;
      this.editor.view.dispatch(transaction);
      this.editor.view.dispatch(closeHistory(this.editor.state.tr));
      return true;
    }
    let accepted = [...operations];
    if (this.kind === "blocks") {
      if (!this.firstId || !this.lastId) return false;
      const before = fromTiptapDocument(this.editor.state.doc);
      const combined = replaceScope(before, this.firstId, this.lastId, after);
      // A fresh scoped ID may already belong to an unselected block. The diff
      // requires unique IDs and must never reinterpret that collision as a move.
      documentRows(combined);
      accepted = diffDocumentSnapshots(before, combined);
    }
    this.consumed = true;
    if (!accepted.length) return true;
    return applyAcceptedOperations(this.editor, accepted);
  }
}

export function captureDocumentEditTarget(editor: Editor): DocumentEditTarget {
  if (editor.isDestroyed || !editor.isEditable)
    throw new Error("The editor is not available for writing.");
  const { doc, selection } = editor.state;
  if (selection.empty)
    return new DocumentEditTarget(editor, "document", {
      from: 0,
      to: doc.content.size,
    });
  const { $from, $to, from, to } = selection;
  if ($from.sameParent($to) && $from.parent.isTextblock) {
    const depth = wrapperDepth($from);
    if (!depth) throw selectionError();
    const wrapper = $from.node(depth);
    if (
      $from.parentOffset === 0 &&
      $to.parentOffset === $to.parent.content.size &&
      wrapper.childCount === 1
    )
      return new DocumentEditTarget(editor, "blocks", {
        from: $from.before(depth),
        to: $from.after(depth),
      });
    return new DocumentEditTarget(editor, "inline", { from, to });
  }
  // Whole-body text selections across sibling blocks are also exact scopes.
  const firstDepth = wrapperDepth($from);
  const lastDepth = wrapperDepth($to);
  if (
    firstDepth &&
    lastDepth &&
    firstDepth === lastDepth &&
    $from.parent.isTextblock &&
    $to.parent.isTextblock &&
    $from.parentOffset === 0 &&
    $to.parentOffset === $to.parent.content.size &&
    $from.node(firstDepth - 1) === $to.node(lastDepth - 1) &&
    $to.node(lastDepth).childCount === 1
  )
    return new DocumentEditTarget(editor, "blocks", {
      from: $from.before(firstDepth),
      to: $to.after(lastDepth),
    });
  return new DocumentEditTarget(editor, "blocks", { from, to });
}
