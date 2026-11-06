import { Editor } from "@tiptap/core";
import type { Node } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";

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
  private changedPosition = 0;

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
    this.changedPosition = Math.max(0, endB - 1);
    this.scheduleFollow();
  }

  private pauseFollowing = () => {
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
    if (!this.following || this.frame !== undefined) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = undefined;
      if (!this.following || this.preview.isDestroyed) return;
      const position = this.preview.state.doc.resolve(
        Math.min(this.changedPosition, this.preview.state.doc.content.size),
      );
      for (let depth = position.depth; depth > 0; depth--) {
        if (position.node(depth).type.name !== "betterEditorBlock") continue;
        const node = this.preview.view.nodeDOM(position.before(depth));
        if (node instanceof HTMLElement)
          node.scrollIntoView?.({ behavior: "instant", block: "nearest" });
        break;
      }
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
