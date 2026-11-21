import type { Page } from "@playwright/test";

/** Decode browser screenshots in the browser so no image-decoder dependency is needed. */
export async function pixelDifference(
  page: Page,
  first: Buffer,
  second: Buffer,
) {
  return page.evaluate(
    async ([a, b]) => {
      const pixels = async (source: string) => {
        const image = new Image();
        image.src = source;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Screenshot decoder unavailable");
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, image.width, image.height).data;
      };
      const [left, right] = await Promise.all([pixels(a), pixels(b)]);
      if (left.length !== right.length)
        throw new Error("Screenshot dimensions differ");
      let total = 0;
      for (let i = 0; i < left.length; i++)
        if (i % 4 !== 3) total += Math.abs((left[i] ?? 0) - (right[i] ?? 0));
      return total / (left.length * 0.75);
    },
    [first, second].map(
      (bytes) => `data:image/png;base64,${bytes.toString("base64")}`,
    ) as [string, string],
  );
}
