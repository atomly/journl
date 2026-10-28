import type { IdFactory } from "../engine/identity";

/** Adapt standard HTML lists to the owned wrapper schema before ProseMirror's
 * native DOM parser handles links, marks, filtering, and insertion. */
export function normalizePastedLists(
  html: string,
  createId: IdFactory,
): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  const hasLists = Boolean(template.content.querySelector("ul,ol"));
  for (const list of [
    ...template.content.querySelectorAll("ul,ol"),
  ].reverse()) {
    const result = document.createDocumentFragment();
    let number = Number.parseInt(list.getAttribute("start") ?? "1", 10) || 1;
    for (const item of [...list.children]) {
      if (item.tagName !== "LI") continue;
      const wrapper = document.createElement("div");
      wrapper.dataset.betterEditorBlock = "";
      wrapper.dataset.blockId = createId();
      const body = document.createElement("p");
      body.dataset.betterEditorBody =
        list.tagName === "OL" ? "numberedListItem" : "bulletListItem";
      if (list.tagName === "OL") {
        number =
          Number.parseInt(item.getAttribute("value") ?? "", 10) || number;
        body.setAttribute(
          "data-better-editor-attrs",
          JSON.stringify({ props: { start: number++ } }),
        );
      }
      const children = document.createElement("div");
      children.dataset.betterEditorChildren = "";
      for (const child of [...item.childNodes]) {
        if (
          child instanceof HTMLElement &&
          child.hasAttribute("data-better-editor-block")
        )
          children.append(child);
        else if (child instanceof HTMLElement && child.tagName === "P") {
          if (body.childNodes.length)
            body.append(document.createTextNode("\n"));
          body.append(...child.childNodes);
        } else body.append(child);
      }
      wrapper.append(body);
      if (children.childNodes.length) wrapper.append(children);
      result.append(wrapper);
    }
    list.replaceWith(result);
  }
  if (hasLists && !template.content.querySelector("[data-pm-slice]"))
    template.content.firstElementChild?.setAttribute("data-pm-slice", "0 0 []");
  return template.innerHTML;
}
