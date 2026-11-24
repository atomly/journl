import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { pixelDifference } from "./backdrop-pixels";

test("measure backdrop rasterization independently of app portals and stacking", async ({
  page,
  browserName,
}, info) => {
  await page.setViewportSize({ height: 844, width: 390 });
  const observations: Record<string, number> = {};
  let sharp: Buffer | undefined;
  for (const [name, css] of [
    ["sharp", ""],
    ["standard", "backdrop-filter:blur(3px)"],
    ["prefixed", "-webkit-backdrop-filter:blur(3px)"],
    ["both", "-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)"],
    ["isolated", "isolation:isolate;backdrop-filter:blur(3px)"],
  ] as const) {
    await page.setContent(
      `<style>body{margin:0}#pattern{position:fixed;inset:0;background:repeating-linear-gradient(90deg,#000 0 2px,#fff 2px 4px)}#scrim{position:fixed;inset:0;background:rgba(5,15,32,.45);${css}}</style><div id="pattern"></div><div id="scrim"></div>`,
    );
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    const screenshot = await page.screenshot({
      path: info.outputPath(`${name}.png`),
      scale: "css",
    });
    if (name === "sharp") sharp = screenshot;
    if (!sharp)
      throw new Error("Sharp calibration image must precede blur variants");
    observations[name] = await pixelDifference(page, sharp, screenshot);
  }
  if (browserName === "chromium") {
    expect(observations.standard).toBeGreaterThan(20);
    expect(observations.both).toBeGreaterThan(20);
    expect(observations.isolated).toBeGreaterThan(20);
  } else if ((observations.both ?? 0) < 0.1) {
    info.annotations.push({
      description:
        "This Linux WebKit screenshot path parses both property spellings but captures no backdrop blur, even without app DOM, portals, animations or stacking wrappers. This does not establish real Safari/device rendering.",
      type: "renderer-limitation",
    });
  }
  await writeFile(
    info.outputPath("raster-capability.json"),
    JSON.stringify(
      {
        browserName,
        browserVersion: page.context().browser()?.version(),
        capturesBackdropBlur: (observations.both ?? 0) > 20,
        observations,
        platform: process.platform,
      },
      null,
      2,
    ),
  );
});
