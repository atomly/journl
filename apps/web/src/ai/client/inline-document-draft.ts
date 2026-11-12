import { Editor } from "@tiptap/core";
import type { Node } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";

/** Called only for AI transactions, never for ordinary editor input. */
export function fadeAIChanges(editor: Editor, previous: Node) {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const before =
    previous.type.schema === editor.schema
      ? previous
      : editor.schema.nodeFromJSON(previous.toJSON());
  const doc = editor.state.doc;
  const start = before.content.findDiffStart(doc.content);
  const end = before.content.findDiffEnd(doc.content);
  if (start === null || !end) return;
  const previousBlocks = new Map<string, Node>();
  before.descendants((node) => {
    if (node.type.name === "betterEditorBlock")
      previousBlocks.set(node.attrs.id, node);
  });
  const ids = new Set<string>();
  doc.nodesBetween(Math.min(start, end.b), end.b, (node) => {
    if (node.type.name !== "betterEditorBlock") return;
    // A bounding diff can include untouched writing between two AI edits.
    // Compare each block body, and descend when only its children changed.
    const oldBody = previousBlocks.get(node.attrs.id)?.firstChild;
    if (oldBody && node.firstChild && oldBody.eq(node.firstChild)) return;
    // Existing tables update atomically. Fading the whole table would also dim
    // retained cells and recreate the flash this preview is meant to prevent.
    if (oldBody && node.firstChild?.type.name === "table") return;
    ids.add(node.attrs.id);
  });
  for (const block of editor.view.dom.querySelectorAll<HTMLElement>(
    "[data-block-id]",
  )) {
    if (!ids.has(block.dataset.blockId ?? "")) continue;
    const body =
      block.querySelector<HTMLElement>("[data-better-editor-body]") ?? block;
    body.animate?.([{ opacity: 0.55 }, { opacity: 1 }], {
      duration: 220,
      easing: "ease-out",
    });
  }
}

/** An inline, read-only view of generated blocks. The accepted editor retains
 * its exact document, selection and history until the final atomic edit. */
export class InlineDocumentDraft {
  private readonly lock = new PluginKey("journl-ai-writing-lock");
  private readonly preview: Editor;
  private readonly host = document.createElement("div");
  private readonly originalHidden: HTMLElement["hidden"];
  private readonly originalAriaHidden: string | null;
  private readonly source: HTMLElement;
  private readonly viewport: HTMLElement;
  private following = true;
  private frame: number | undefined;
  private changedPosition: number | undefined;

  constructor(
    private readonly editor: Editor,
    private onFollowChange: (following: boolean) => void,
  ) {
    this.source = editor.view.dom;
    let viewport = this.source.parentElement;
    while (
      viewport &&
      !/auto|scroll/.test(getComputedStyle(viewport).overflowY)
    )
      viewport = viewport.parentElement;
    this.viewport = viewport ?? document.documentElement;
    this.originalHidden = this.source.hidden;
    this.originalAriaHidden = this.source.getAttribute("aria-hidden");
    this.host.dataset.aiInlineDraft = "";
    const mount = document.createElement("div");
    this.host.append(mount);
    this.preview = new Editor({
      content: editor.state.doc.toJSON(),
      editable: false,
      editorProps: {
        attributes: {
          "aria-busy": "true",
          "aria-label": "Document editor",
          "aria-readonly": "true",
          class: this.source.className,
          role: "textbox",
          tabindex: "0",
        },
      },
      element: mount,
      extensions: editor.options.extensions,
    });
    try {
      this.source.before(this.host);
      // A retained menu or asynchronous command must not mutate hidden writing.
      editor.registerPlugin(
        new Plugin({
          filterTransaction: (transaction) => !transaction.docChanged,
          key: this.lock,
          props: { editable: () => false },
        }),
      );
      this.source.hidden = true;
      this.source.setAttribute("aria-hidden", "true");
      this.source
        .closest(".journl-document-editor")
        ?.setAttribute("data-ai-writing", "");
      this.viewport.addEventListener("wheel", this.pauseFollowing, {
        passive: true,
      });
      this.viewport.addEventListener("touchmove", this.pauseFollowing, {
        passive: true,
      });
      this.viewport.addEventListener("keydown", this.onKeyDown);
      this.viewport.addEventListener("pointerdown", this.onPointerDown);
      // Notify native editability subscribers without changing accepted content.
      editor.setEditable(editor.options.editable);
    } catch (error) {
      this.destroy();
      throw error;
    }
  }

  get surface() {
    return { editor: this.preview, element: this.host };
  }

  update(document: Node) {
    // Tiptap builds a schema per instance. Nodes must use the draft's node types.
    const doc = this.preview.schema.nodeFromJSON(document.toJSON());
    const current = this.preview.state.doc;
    const start = current.content.findDiffStart(doc.content);
    if (start === null) return;
    const end = current.content.findDiffEnd(doc.content);
    if (!end) return;
    // Replace only the changed range. Unchanged node views remain mounted.
    const overlap = start - Math.min(end.a, end.b);
    const endA = end.a + Math.max(0, overlap);
    const endB = end.b + Math.max(0, overlap);
    const transaction = this.preview.state.tr.replace(
      start,
      endA,
      doc.slice(start, endB),
    );
    this.preview.view.dispatch(transaction.setMeta("addToHistory", false));
    fadeAIChanges(this.preview, current);
    this.changedPosition = Math.max(0, endB - 1);
    this.scheduleFollow();
  }

  pauseFollowing = () => {
    if (!this.following) return;
    this.following = false;
    this.onFollowChange(false);
  };
  private onKeyDown = (event: KeyboardEvent) => {
    if (
      [
        "ArrowUp",
        "ArrowDown",
        "PageUp",
        "PageDown",
        "Home",
        "End",
        " ",
      ].includes(event.key)
    )
      this.pauseFollowing();
  };
  private onPointerDown = (event: PointerEvent) => {
    // Dragging the viewport scrollbar is also a deliberate scroll away.
    if (event.target === this.viewport) this.pauseFollowing();
  };
  follow() {
    this.following = true;
    this.onFollowChange(true);
    this.scheduleFollow();
  }
  private scheduleFollow() {
    if (
      !this.following ||
      this.frame !== undefined ||
      this.changedPosition === undefined
    )
      return;
    this.frame = requestAnimationFrame(() => {
      this.frame = undefined;
      if (!this.following || this.preview.isDestroyed || !this.host.isConnected)
        return;
      const changedPosition = this.changedPosition;
      if (changedPosition === undefined) return;
      const root = this.viewport === document.documentElement;
      const height = root ? window.innerHeight : this.viewport.clientHeight;
      if (height <= 0) return;
      // Temporary trailing space lets the last generated line reach the center.
      // It disappears with the draft; accepted document content is untouched.
      this.host.style.paddingBottom = `${height / 2}px`;
      const point = this.preview.view.coordsAtPos(
        Math.min(changedPosition, this.preview.state.doc.content.size),
      );
      const top = root
        ? 0
        : this.viewport.getBoundingClientRect().top + this.viewport.clientTop;
      const delta = (point.top + point.bottom) / 2 - (top + height / 2);
      // Follow the changed line, including inside a tall table or code block,
      // rather than centering the entire enclosing block.
      if (Math.abs(delta) > 1)
        (root ? window : this.viewport).scrollBy({
          behavior: "instant",
          top: delta,
        });
    });
  }

  destroy() {
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    this.viewport.removeEventListener("wheel", this.pauseFollowing);
    this.viewport.removeEventListener("touchmove", this.pauseFollowing);
    this.viewport.removeEventListener("keydown", this.onKeyDown);
    this.viewport.removeEventListener("pointerdown", this.onPointerDown);
    this.preview.destroy();
    this.host.remove();
    if (this.editor.isDestroyed) return;
    this.editor.unregisterPlugin(this.lock);
    this.source.hidden = this.originalHidden;
    if (this.originalAriaHidden === null)
      this.source.removeAttribute("aria-hidden");
    else this.source.setAttribute("aria-hidden", this.originalAriaHidden);
    this.source
      .closest(".journl-document-editor")
      ?.removeAttribute("data-ai-writing");
    this.editor.setEditable(this.editor.options.editable);
  }
}
