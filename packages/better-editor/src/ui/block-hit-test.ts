/** Browser hit testing bounds layout reads independently of document length. */
export function blockBodyAtPointer(
  root: HTMLElement,
  target: Element,
  clientY: number,
): HTMLElement | undefined {
  const ownedBody = (element: Element) => {
    const body = element.closest<HTMLElement>("[data-better-editor-body]");
    return body?.closest(".better-editor-tiptap") === root ? body : undefined;
  };
  const direct = ownedBody(target);
  if (direct) return direct;
  const bounds = root.getBoundingClientRect();
  // Non-body hits include padding inside the editor, not only the outer gutter.
  // Sample the rightmost content pixel so nested indentation cannot hide the row.
  const paddingRight =
    Number.parseFloat(
      root.ownerDocument.defaultView?.getComputedStyle(root).paddingRight ??
        "0",
    ) || 0;
  const x = Math.max(bounds.left + 1, bounds.right - paddingRight - 1);
  for (const element of root.ownerDocument.elementsFromPoint(x, clientY)) {
    const body = ownedBody(element);
    if (body) return body;
  }
  return undefined;
}
