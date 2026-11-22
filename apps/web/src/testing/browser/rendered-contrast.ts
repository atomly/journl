import type { Locator } from "@playwright/test";
import { expect } from "./fixtures";

/** Build a selector from the target's position in the document tree. Editors
 * reconcile class and attribute edits on their managed nodes, but the tree
 * itself stays stable while a screenshot pair is captured.
 */
async function structuralPath(target: Locator) {
  return target.evaluate((element) => {
    const parts: string[] = [];
    let node: Element | null = element;
    while (node && node !== document.documentElement) {
      const parent: Element | null = node.parentElement;
      const index = parent ? Array.from(parent.children).indexOf(node) + 1 : 1;
      parts.unshift(`${node.tagName.toLowerCase()}:nth-child(${index})`);
      node = parent;
    }
    return ["html", ...parts].join(" > ");
  });
}

/** Isolate each text run or SVG. Compare its strongest glyph core with the same
 * composited background pixel, then report the lowest per-run contrast.
 * Antialias fringes are excluded; this does not measure every fringe pixel.
 */
export async function renderedTextContrast(
  target: Locator,
  paint: "text" | "icons" = "text",
) {
  await expect(target).toBeVisible();
  const regions = await target.evaluate((element, mode) => {
    const origin = element.getBoundingClientRect();
    const relative = (rect: DOMRect) => ({
      height: rect.height,
      width: rect.width,
      x: rect.x - origin.x,
      y: rect.y - origin.y,
    });
    if (mode === "icons")
      return Array.from(element.querySelectorAll("svg"))
        .filter((icon) => getComputedStyle(icon).opacity !== "0")
        .map((icon, index) => ({
          label: `SVG ${index + 1}`,
          rects: [relative(icon.getBoundingClientRect())],
        }));
    const result: {
      label: string;
      rects: { x: number; y: number; width: number; height: number }[];
    }[] = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (
        !node.textContent?.trim() ||
        node.parentElement?.closest('svg,[aria-hidden="true"],.sr-only')
      )
        continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const rects = Array.from(range.getClientRects())
        .filter((rect) => rect.width > 1 && rect.height > 1)
        .map(relative);
      if (rects.length) result.push({ label: node.textContent.trim(), rects });
    }
    return result;
  }, paint);
  const before = await target.screenshot({
    animations: "disabled",
    scale: "css",
  });
  let background: Buffer;
  if (paint === "icons") {
    const previous = await target.evaluate((element) =>
      Array.from(element.querySelectorAll<SVGElement>("svg")).map((node) => {
        const value = node.style.getPropertyValue("opacity");
        const priority = node.style.getPropertyPriority("opacity");
        node.style.setProperty("opacity", "0", "important");
        return { priority, property: "opacity", value };
      }),
    );
    try {
      background = await target.screenshot({
        animations: "disabled",
        scale: "css",
      });
    } finally {
      await target.evaluate((element, previous) => {
        Array.from(element.querySelectorAll<SVGElement>("svg")).forEach(
          (node, index) => {
            const old = previous[index];
            if (!old) return;
            if (old.value)
              node.style.setProperty(old.property, old.value, old.priority);
            else node.style.removeProperty(old.property);
          },
        );
      }, previous);
    }
  } else {
    // Editors reconcile the inline styles of their managed nodes back to
    // document state (ProseMirror redraws a node whose style attribute
    // drifts), which reverts an inline transparent fill before it can be
    // captured. Hide the text through a stylesheet keyed to the target's
    // structural path instead: it never mutates the element, so no
    // reconciliation reverts it.
    const style = await target.page().addStyleTag({
      content: `${await structuralPath(target)}{-webkit-text-fill-color:transparent !important;}`,
    });
    try {
      background = await target.screenshot({
        animations: "disabled",
        scale: "css",
      });
    } finally {
      await style.evaluate((element) => {
        (element as ChildNode).remove();
      });
      await style.dispose();
    }
  }
  return target.evaluate(
    async (element, input) => {
      const decode = async (base64: string) => {
        const bytes = Uint8Array.from(atob(base64), (char) =>
          char.charCodeAt(0),
        );
        const bitmap = await createImageBitmap(
          new Blob([bytes], { type: "image/png" }),
        );
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas unavailable");
        context.drawImage(bitmap, 0, 0);
        return {
          height: canvas.height,
          pixels: context.getImageData(0, 0, canvas.width, canvas.height).data,
          width: canvas.width,
        };
      };
      const foreground = await decode(input.foreground);
      const surface = await decode(input.background);
      const luminance = (rgb: number[]) =>
        rgb
          .map((value) => {
            const channel = value / 255;
            return channel <= 0.04045
              ? channel / 12.92
              : ((channel + 0.055) / 1.055) ** 2.4;
          })
          .reduce(
            (sum, value, index) =>
              sum + value * ([0.2126, 0.7152, 0.0722][index] ?? 0),
            0,
          );
      const samples = input.regions.map((region) => {
        let strongest = -1;
        let position = -1;
        for (const rect of region.rects)
          for (
            let y = Math.max(0, Math.floor(rect.y));
            y < Math.min(foreground.height, Math.ceil(rect.y + rect.height));
            y++
          )
            for (
              let x = Math.max(0, Math.floor(rect.x));
              x < Math.min(foreground.width, Math.ceil(rect.x + rect.width));
              x++
            ) {
              const index = (y * foreground.width + x) * 4;
              const distance = [0, 1, 2].reduce(
                (sum, channel) =>
                  sum +
                  Math.abs(
                    (foreground.pixels[index + channel] ?? 0) -
                      (surface.pixels[index + channel] ?? 0),
                  ),
                0,
              );
              if (distance > strongest) {
                strongest = distance;
                position = index;
              }
            }
        if (strongest < 30)
          throw new Error(`No glyph core isolated for ${region.label}`);
        const ink = Array.from(foreground.pixels.slice(position, position + 3));
        const background = Array.from(
          surface.pixels.slice(position, position + 3),
        );
        const a = luminance(ink);
        const b = luminance(background);
        return {
          background,
          foreground: ink,
          label: region.label,
          ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
          rects: region.rects,
        };
      });
      const weakest = samples.reduce<(typeof samples)[number] | undefined>(
        (a, b) => (!a || b.ratio < a.ratio ? b : a),
        undefined,
      );
      if (!weakest) throw new Error("No visible glyph regions");
      const { label: glyphLabel, ...sample } = weakest;
      return {
        ...sample,
        font: getComputedStyle(element).font,
        glyphLabel,
        method:
          "Minimum of separately isolated text-run or SVG core ratios; antialias fringes excluded.",
        samples,
      };
    },
    {
      background: background.toString("base64"),
      foreground: before.toString("base64"),
      regions,
    },
  );
}
