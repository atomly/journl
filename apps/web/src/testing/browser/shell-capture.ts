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
        const current = JSON.stringify(await shellGeometry(page));
        stable = current === previous ? stable + 1 : 0;
        previous = current;
        return stable;
      },
      { intervals: [50, 50, 50, 50] },
    )
    .toBeGreaterThanOrEqual(3);
}
export async function shellGeometry(page: Page) {
  return page.evaluate(() =>
    Object.fromEntries(
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
    ),
  );
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
    after,
    "Screenshot must not finish a transition after geometry was sampled",
  ).toEqual(before);
  return { after, before };
}
