import type { Page } from "@playwright/test";

/** Native layout and text boxes, captured without adding layout probes to controls. */
export function measureShellControls(page: Page) {
  return page.evaluate(() => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const selectors =
      '[data-sidebar="sidebar"] button, [data-sidebar="sidebar"] a, header[data-hidden] button, [data-sidebar="footer"], .journl-agent-launcher, [aria-label="Chat composer"], [aria-label="Chat composer"] button, [aria-label="Chat composer"] textarea, [aria-label="Chat composer"] [data-slot], .journl-navigation-header .journl-brand, [data-slot="sidebar-inner"] h2, .journl-agent-sheet h2';
    return Array.from(document.querySelectorAll<HTMLElement>(selectors))
      .filter(
        (node) =>
          node.getClientRects().length &&
          getComputedStyle(node).visibility === "visible",
      )
      .map((node) => {
        const style = getComputedStyle(node);
        const textLines: unknown[] = [];
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
        for (
          let text = walker.nextNode();
          text !== null;
          text = walker.nextNode()
        ) {
          if (!text.textContent?.trim()) continue;
          const parent = text.parentElement;
          if (!parent || getComputedStyle(parent).position === "absolute")
            continue;
          const range = document.createRange();
          range.selectNodeContents(text);
          const font = getComputedStyle(parent).font;
          if (context) context.font = font;
          const metrics = context?.measureText(text.textContent);
          textLines.push({
            baselineMethod:
              "Compare native text range boxes and canvas font ascent; baseline is derived, not a browser-exposed coordinate.",
            boxes: Array.from(range.getClientRects(), (box) => box.toJSON()),
            font,
            fontAscent: metrics?.fontBoundingBoxAscent,
            fontDescent: metrics?.fontBoundingBoxDescent,
            text: text.textContent,
          });
        }
        return {
          backdrop: style.backdropFilter,
          background: style.backgroundColor,
          border: style.border,
          borderRadius: style.borderRadius,
          box: node.getBoundingClientRect().toJSON(),
          color: style.color,
          focus: node.matches(":focus-visible"),
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          gap: style.gap,
          hover: node.matches(":hover"),
          icons: Array.from(node.querySelectorAll("svg, img"), (icon) => ({
            box: icon.getBoundingClientRect().toJSON(),
            color: getComputedStyle(icon).color,
          })),
          letterSpacing: style.letterSpacing,
          lineHeight: style.lineHeight,
          margin: style.margin,
          name: node.getAttribute("aria-label") ?? node.textContent?.trim(),
          outline: {
            color: style.outlineColor,
            offset: style.outlineOffset,
            width: style.outlineWidth,
          },
          overflow: style.textOverflow,
          padding: style.padding,
          selected: node.dataset.active,
          shadow: style.boxShadow,
          slot: node.dataset.sidebar ?? node.dataset.slot,
          textLines,
          truncated: node.scrollWidth > node.clientWidth,
          wrapping: style.whiteSpace,
        };
      });
  });
}

/** Identify the visible message and its position relative to the real scroller. */
export function measureConversationAnchor(page: Page) {
  return page.evaluate(() => {
    const node = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-slot="message-scroller-viewport"]',
      ),
    ).find(
      (element) =>
        element.clientWidth &&
        element.clientHeight &&
        !element.closest('[inert], [data-state="closed"]'),
    );
    if (!node) return null;
    const box = node.getBoundingClientRect();
    const items = Array.from(
      node.querySelectorAll<HTMLElement>("[data-message-id]"),
    );
    const visible = items.filter((item) => {
      const rect = item.getBoundingClientRect();
      return rect.bottom > box.top && rect.top < box.bottom;
    });
    const sample = (item: HTMLElement | undefined) =>
      item
        ? {
            bottom: item.getBoundingClientRect().bottom - box.bottom,
            id: item.dataset.messageId,
            top: item.getBoundingClientRect().top - box.top,
          }
        : null;
    return {
      atEnd: node.scrollHeight - node.clientHeight - node.scrollTop <= 1,
      atStart: node.scrollTop <= 1,
      firstMessage: sample(items[0]),
      firstVisible: sample(visible[0]),
      lastMessage: sample(items.at(-1)),
      lastVisible: sample(visible.at(-1)),
      scrollHeight: node.scrollHeight,
      scrollTop: node.scrollTop,
      viewport: box.toJSON(),
    };
  });
}
