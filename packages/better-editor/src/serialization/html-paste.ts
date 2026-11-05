import type { IdFactory } from "../engine/identity";

// External HTML interoperability policy, not the editor's document schema.
// Keep the detection selector derived from the same tags used by normalization.
const containers = new Set([
  "DIV",
  "ARTICLE",
  "SECTION",
  "MAIN",
  "HEADER",
  "FOOTER",
]);
const bodies = new Set([
  "P",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "PRE",
  "TABLE",
  "HR",
  "BLOCKQUOTE",
]);
const externalBlockSelector = [...containers, ...bodies].join(",");

/** Give external HTML blocks explicit siblings while retaining authored lists.
 * ProseMirror still parses marks, links, filtering and insertion. */
export function normalizePastedHTML(html: string, createId: IdFactory): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  const isOwned = Boolean(
    template.content.querySelector("[data-better-editor-block]"),
  );
  for (const list of [
    ...template.content.querySelectorAll("ul,ol"),
  ].reverse()) {
    const result = document.createDocumentFragment();
    const start = Number.parseInt(list.getAttribute("start") ?? "1", 10);
    let number = Number.isNaN(start) ? 1 : start;
    for (const item of [...list.children]) {
      if (item.tagName !== "LI") continue;
      const wrapper = document.createElement("div");
      wrapper.dataset.betterEditorBlock = "";
      wrapper.dataset.blockId = createId();
      const body = document.createElement("p");
      body.dataset.betterEditorBody =
        list.tagName === "OL" ? "numberedListItem" : "bulletListItem";
      if (list.tagName === "OL") {
        const explicit = Number.parseInt(item.getAttribute("value") ?? "", 10);
        if (!Number.isNaN(explicit)) number = explicit;
        body.setAttribute(
          "data-better-editor-attrs",
          JSON.stringify({ props: { start: number++ } }),
        );
      }
      const children = document.createElement("div");
      children.dataset.betterEditorChildren = "";
      const append = (child: ChildNode) => {
        if (
          child instanceof HTMLElement &&
          child.hasAttribute("data-better-editor-block")
        )
          children.append(child);
        else if (child instanceof HTMLElement && child.tagName === "P") {
          if (body.childNodes.length)
            body.append(document.createTextNode("\n"));
          body.append(...child.childNodes);
        } else if (
          child instanceof HTMLElement &&
          ["DIV", "SECTION", "ARTICLE"].includes(child.tagName)
        ) {
          for (const nested of [...child.childNodes]) append(nested);
        } else body.append(child);
      };
      for (const child of [...item.childNodes]) append(child);
      wrapper.append(body);
      if (children.childNodes.length) wrapper.append(children);
      result.append(wrapper);
    }
    list.replaceWith(result);
  }
  // ProseMirror can fit a following paragraph into the previous block's child
  // group. Give external semantic blocks explicit sibling wrappers instead.
  const wrap = (body: HTMLElement) => {
    const wrapper = document.createElement("div");
    wrapper.dataset.betterEditorBlock = "";
    wrapper.dataset.blockId = createId();
    body.replaceWith(wrapper);
    wrapper.append(body);
    return wrapper;
  };
  const normalize = (container: HTMLElement | DocumentFragment) => {
    for (const node of [...container.children]) {
      if (!(node instanceof HTMLElement)) continue;
      if (node.hasAttribute("data-better-editor-block")) continue;
      if (containers.has(node.tagName)) {
        normalize(node);
        node.replaceWith(...node.childNodes);
      } else if (bodies.has(node.tagName)) {
        if (
          node.tagName === "BLOCKQUOTE" &&
          node.querySelector("p,h1,h2,h3,h4,h5,h6,ul,ol,blockquote")
        ) {
          normalize(node);
          for (const child of node.children) {
            const body = child.firstElementChild;
            if (
              body instanceof HTMLElement &&
              body.tagName === "P" &&
              !body.dataset.betterEditorBody
            )
              body.dataset.betterEditorBody = "quote";
          }
          node.replaceWith(...node.childNodes);
        } else {
          if (node.tagName === "BLOCKQUOTE")
            node.dataset.betterEditorBody = "quote";
          wrap(node);
        }
      }
    }
    // Inline fragments next to block elements also need their own sibling body.
    let pending: ChildNode[] = [];
    const flush = () => {
      if (!pending.length) return;
      if (
        pending.some(
          (node) =>
            node.textContent?.trim() ||
            (node instanceof HTMLElement &&
              ["BR", "IMG"].includes(node.tagName)),
        )
      ) {
        const body = document.createElement("p");
        pending[0]?.before(body);
        body.append(...pending);
        wrap(body);
      } else for (const node of pending) node.remove();
      pending = [];
    };
    for (const node of [...container.childNodes]) {
      if (
        node instanceof HTMLElement &&
        node.hasAttribute("data-better-editor-block")
      )
        flush();
      else pending.push(node);
    }
    flush();
  };
  if (!isOwned && template.content.querySelector(externalBlockSelector))
    normalize(template.content);
  // A single paragraph is an inline rich-text insertion. Keep ProseMirror's
  // open slice so it joins the destination instead of splitting it into blocks.
  if (!isOwned && template.content.childElementCount === 1) {
    const wrapper = template.content.firstElementChild;
    const body = wrapper?.firstElementChild;
    if (
      wrapper?.hasAttribute("data-better-editor-block") &&
      wrapper.childElementCount === 1 &&
      body?.tagName === "P" &&
      !body.hasAttribute("data-better-editor-body")
    )
      return body.outerHTML;
  }
  if (
    template.content.querySelector("[data-better-editor-block]") &&
    !template.content.querySelector("[data-pm-slice]")
  )
    template.content.firstElementChild?.setAttribute("data-pm-slice", "0 0 []");
  return template.innerHTML;
}
