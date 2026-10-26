import type { Page } from "@playwright/test";
import { expect, test } from "~/testing/browser/fixtures";

test.use({ journalPagination: true });

async function newEditor(page: Page) {
  await page.goto("/journal");
  const create = page.getByRole("button", { exact: true, name: "New page" });
  if (!(await create.isVisible()))
    await page
      .getByRole("button", { exact: true, name: "Toggle Sidebar" })
      .first()
      .click();
  const previous = page.url();
  await create.click();
  await expect(page).not.toHaveURL(previous);
  await page.keyboard.press("Escape");
  return page.getByRole("textbox", { exact: true, name: "Document editor" });
}

test("only the initiating pointer can finish a pending handle press", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop-chromium", "Mouse ownership checks");
  const editor = await newEditor(page);
  await editor.fill("Alpha");
  await page.keyboard.press("Enter");
  await page.keyboard.insertText("Beta");
  const rows = editor.locator('[data-journl-body="paragraph"]');
  const alpha = rows.first();
  const beta = rows.last();
  await alpha.hover();
  const handle = page.getByRole("button", {
    exact: true,
    name: "Block actions",
  });
  await expect(handle).toBeVisible();
  const origin = await handle.boundingBox();
  if (!origin) throw new Error("Missing handle");
  const point = {
    button: 0,
    clientX: origin.x + origin.width / 2,
    clientY: origin.y + origin.height / 2,
    isPrimary: true,
    pointerType: "mouse",
  };
  const actions = page.getByRole("menuitem", {
    exact: true,
    name: "Duplicate block",
  });
  // Explicit IDs exercise multiple contacts against the real mounted controls.
  await handle.dispatchEvent("pointerdown", { ...point, pointerId: 11 });
  await beta.dispatchEvent("pointerup", { ...point, pointerId: 11 });
  await beta.dispatchEvent("pointerdown", { ...point, pointerId: 11 });
  await handle.dispatchEvent("pointerup", { ...point, pointerId: 11 });
  await expect(actions).toHaveCount(0);

  for (const ending of ["pointerup", "pointercancel"]) {
    await alpha.hover();
    await handle.dispatchEvent("pointerdown", { ...point, pointerId: 21 });
    // A pen can also be primary while the original mouse press is pending.
    await handle.dispatchEvent("pointerdown", {
      ...point,
      pointerId: 22,
      pointerType: "pen",
    });
    await beta.dispatchEvent(ending, { ...point, pointerId: 22 });
    await beta.hover();
    await expect
      .poll(async () => (await handle.boundingBox())?.y)
      .toBeCloseTo(origin.y, 1);
    await beta.dispatchEvent(ending, { ...point, pointerId: 21 });
    await alpha.hover();
    await beta.hover();
    await expect
      .poll(async () => (await handle.boundingBox())?.y ?? origin.y)
      .toBeGreaterThan(origin.y + 10);
    await expect(actions).toHaveCount(0);
  }
  await handle.click();
  await expect(actions).toBeVisible();
  await page.keyboard.press("Escape");
  await handle.evaluate((element: HTMLButtonElement) => element.click());
  await expect(actions).toBeVisible();
});

test("nested code handles align with the writing line below the language picker", async ({
  page,
}, info) => {
  const editor = await newEditor(page);
  await editor.fill("Parent");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await editor.pressSequentially("```javascript ");
  await editor.pressSequentially("console.log('nested');");
  const body = editor.locator(
    '[data-journl-children] [data-journl-body="codeBlock"]',
  );
  await expect(body).toHaveCount(1);
  const code = body.locator("pre");
  if (info.project.name === "mobile-webkit") await code.tap();
  else await code.hover();
  const handle = page.getByRole("button", {
    exact: true,
    name: "Block actions",
  });
  await expect(handle).toBeVisible();
  await expect
    .poll(async () => {
      const grip = await handle.boundingBox();
      const center = await code.evaluate((element) => {
        const style = getComputedStyle(element);
        return (
          element.getBoundingClientRect().top +
          Number.parseFloat(style.paddingTop) +
          Number.parseFloat(style.lineHeight) / 2
        );
      });
      return grip
        ? Math.abs(grip.y + grip.height / 2 - center)
        : Number.POSITIVE_INFINITY;
    })
    .toBeLessThan(2);
  await expect(
    editor.getByRole("combobox", { name: "Code language" }),
  ).toBeVisible();
});
