import type { Page } from "@playwright/test";
import { expect } from "./fixtures";

/** Finish finite transitions before sampling, then require unchanged bounds across frames. */
export async function settleShell(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().iterations !==
            Number.POSITIVE_INFINITY,
        )
        .map(async (animation) => {
          try {
            animation.finish();
            await animation.finished;
          } catch {}
        }),
    );
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
  let previous = "";
  let stable = 0;
  await expect
    .poll(
      async () => {
        const current = JSON.stringify(
          captureGeometry(await shellGeometry(page)),
        );
        stable = current === previous ? stable + 1 : 0;
        previous = current;
        return stable;
      },
      { intervals: [50, 50, 50, 50] },
    )
    .toBeGreaterThanOrEqual(3);
}
export async function shellGeometry(page: Page) {
  return page.evaluate(() => {
    const bounds: Record<string, unknown> = Object.fromEntries(
      Object.entries({
        assistant: '[data-side="right"] [data-slot="sidebar-container"]',
        conversation: '[data-slot="message-scroller-viewport"]',
        dialog: '[role="dialog"]',
        header: "header[data-hidden]",
        launcher:
          '[aria-label="Toggle Chat Sidebar"], [aria-label="Toggle Chat Drawer"]',
        main: "[data-app-container]",
        navigation: '[data-side="left"] [data-slot="sidebar-container"]',
      }).map(([name, selector]) => {
        const element =
          name === "launcher"
            ? Array.from(document.querySelectorAll<HTMLElement>(selector)).find(
                (node) => node.getClientRects().length > 0,
              )
            : document.querySelector<HTMLElement>(selector);
        return [
          name,
          element
            ? {
                box: element.getBoundingClientRect().toJSON(),
                clientHeight: element.clientHeight,
                scrollHeight: element.scrollHeight,
                scrollTop: element.scrollTop,
              }
            : null,
        ];
      }),
    );
    // Prove which typeface actually rendered: the loaded font faces plus the
    // body font's measured advance for a probe string. The v2 chrome uses a
    // host system font by design, so only this probe ties captures to the
    // application's bundled Inter face.
    const style = getComputedStyle(document.body);
    const probe = document.createElement("span");
    probe.style.cssText = `font-family:${style.fontFamily};font-size:14px;font-weight:650;position:absolute;visibility:hidden;white-space:nowrap;`;
    probe.textContent = "Small balcony garden";
    document.body.append(probe);
    const range = document.createRange();
    range.selectNodeContents(probe);
    const probeWidth =
      Math.round(range.getBoundingClientRect().width * 100) / 100;
    probe.remove();
    const fonts = {
      faces: [...document.fonts].map(
        (face) => `${face.family}/${face.weight}/${face.status}`,
      ),
      probeWidth,
    };
    return Object.assign(bounds, { fonts });
  });
}
function captureGeometry({
  fonts,
  ...bounds
}: Awaited<ReturnType<typeof shellGeometry>>) {
  // WebKit can release unused fallback fonts during a screenshot.
  return { ...bounds, fontProbeWidth: fonts.probeWidth };
}

export async function captureSettledShell(page: Page, path: string) {
  await settleShell(page);
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) animation.pause();
  });
  const before = await shellGeometry(page);
  await page.screenshot({ animations: "allow", path, scale: "css" });
  const after = await shellGeometry(page);
  expect(
    captureGeometry(after),
    "Screenshot must preserve shell bounds and measured text width",
  ).toEqual(captureGeometry(before));
  return { after, before };
}
