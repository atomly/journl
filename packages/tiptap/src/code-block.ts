import type { NodeViewRendererProps } from "@tiptap/core";
import { all, createLowlight } from "lowlight";
import { createHighlightPlugin } from "prosemirror-highlight";
import { createParser } from "prosemirror-highlight/lowlight";

const lowlight = createLowlight(all);
const highlight = createParser(lowlight);
const languages = lowlight.listLanguages().sort();

/** Highlighting is transient ProseMirror decoration state, never stored content. */
export const codeHighlightPlugin = () =>
  createHighlightPlugin({
    languageExtractor: (node) => node.attrs.props?.language ?? "auto",
    nodeTypes: ["codeBlock"],
    parser: (options) =>
      options.language === "auto"
        ? highlight({ ...options, language: undefined })
        : options.language && lowlight.registered(options.language)
          ? highlight(options)
          : [],
  });

/** Native select owns keyboard/type-ahead behavior; Lowlight owns the language list.
 * Controls stay outside contentDOM, and never enter copied or persisted code. */
export function codeBlockView({
  node: initial,
  getPos,
  editor,
}: NodeViewRendererProps) {
  let node = initial;
  const dom = document.createElement("div");
  dom.dataset.journlBody = "codeBlock";
  dom.className = "journl-code-block";
  const controls = document.createElement("div");
  controls.dataset.tiptapControls = "";
  controls.className = "journl-code-controls";
  controls.contentEditable = "false";
  const select = document.createElement("select");
  select.setAttribute("aria-label", "Code language");
  for (const [value, label] of [
    ["auto", "Auto detect"],
    ["text", "Plain text"],
    ...languages.map((language) => [language, language]),
  ]) {
    const option = document.createElement("option");
    option.value = value ?? "";
    option.textContent = label ?? "";
    select.append(option);
  }
  controls.append(select);
  const pre = document.createElement("pre");
  pre.spellcheck = false;
  const contentDOM = document.createElement("code");
  pre.append(contentDOM);
  dom.append(controls, pre);
  const sync = () => {
    const language = node.attrs.props?.language ?? "auto";
    if (![...select.options].some((option) => option.value === language)) {
      const option = document.createElement("option");
      option.value = language;
      option.textContent = language;
      select.append(option);
    }
    select.value = language;
    select.disabled = !editor.isEditable;
    dom.setAttribute("data-journl-attrs", JSON.stringify(node.attrs));
  };
  select.addEventListener("change", () => {
    const pos = getPos();
    if (pos === undefined || !editor.isEditable) return;
    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        props: { ...node.attrs.props, language: select.value },
      }),
    );
  });
  sync();
  return {
    contentDOM,
    dom,
    ignoreMutation: (mutation: import("@tiptap/pm/view").ViewMutationRecord) =>
      mutation.type !== "selection" &&
      (mutation.target === dom || controls.contains(mutation.target)),
    stopEvent: (event: Event) =>
      event.target instanceof globalThis.Node &&
      controls.contains(event.target),
    update(next: typeof node) {
      if (next.type !== node.type) return false;
      node = next;
      sync();
      return true;
    },
  };
}
