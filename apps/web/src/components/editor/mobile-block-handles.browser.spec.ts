import type { Locator } from "@playwright/test";
import { expect, test } from "~/testing/browser/fixtures";

test.use({ journalPagination: true });
async function touch(
  handle: Locator,
  type: "touchstart" | "touchmove" | "touchend",
  x: number,
  y: number,
) {
  await handle.evaluate(
    (element, { type, x, y }) => {
      const point = {
        clientX: x,
        clientY: y,
        identifier: 1,
        pageX: x + scrollX,
        pageY: y + scrollY,
        target: element,
      };
      const event = new TouchEvent(type, { bubbles: true, cancelable: true });
      Object.defineProperties(event, {
        changedTouches: { value: [point] },
        targetTouches: { value: type === "touchend" ? [] : [point] },
        touches: { value: type === "touchend" ? [] : [point] },
      });
      element.dispatchEvent(event);
    },
    { type, x, y },
  );
}
test("mobile block handles follow taps and move nested blocks with stable identity", async ({
  page,
  context,
}, info) => {
  test.skip(
    info.project.name !== "mobile-webkit",
    "Touch handle acceptance runs on mobile WebKit",
  );
  await context.addCookies([
    {
      name: "journl-editor",
      sameSite: "Lax",
      url: "http://127.0.0.1:3100",
      value: "tiptap",
    },
  ]);
  await page.goto("/journal");
  await expect(page.locator("a a")).toHaveCount(0);
  const create = page.getByRole("button", { exact: true, name: "New page" });
  if (!(await create.isVisible()))
    await page
      .getByRole("button", { exact: true, name: "Toggle Sidebar" })
      .click();
  const old = page.url();
  await create.click();
  await expect(page).not.toHaveURL(old, { timeout: 30000 });
  await page.keyboard.press("Escape");
  const editor = page.locator(".better-editor-tiptap");
  await editor.fill("Alpha");
  await page.keyboard.press("Enter");
  await page.keyboard.insertText("Beta");
  await page.keyboard.press("Enter");
  await page.keyboard.insertText("Gamma");
  const beta = editor
    .locator('[data-better-editor-body="paragraph"]')
    .filter({ hasText: /^Beta$/ });
  await beta.tap();
  const handle = page.getByRole("button", {
    exact: true,
    name: "Block actions",
  });
  await expect(handle).toBeVisible();
  const size = await handle.boundingBox();
  if (!size) throw new Error("Missing touch handle");
  expect(size.width).toBeGreaterThanOrEqual(44);
  expect(size.height).toBeGreaterThanOrEqual(44);
  const id = await beta.evaluate(
    (el) => el.closest<HTMLElement>("[data-block-id]")?.dataset.blockId,
  );
  await handle.tap();
  await page.getByRole("menuitem", { exact: true, name: "Indent" }).click();
  await expect(editor.locator("[data-better-editor-children]")).toContainText(
    "Beta",
  );
  await beta.tap();
  const start = await handle.boundingBox();
  const end = await editor
    .locator('[data-better-editor-body="paragraph"]')
    .filter({ hasText: /^Gamma$/ })
    .boundingBox();
  if (!start || !end) throw new Error("Missing drag geometry");
  await touch(
    handle,
    "touchstart",
    start.x + start.width / 2,
    start.y + start.height / 2,
  );
  await page.waitForTimeout(300); // dnd-kit requires a deliberate hold before touch dragging.
  await touch(handle, "touchmove", end.x + 16, end.y + end.height - 2);
  await expect(
    page.locator(".better-editor-block-drop-indicator"),
  ).toBeVisible();
  await touch(handle, "touchend", end.x + 16, end.y + end.height - 2);
  await expect(editor.locator(":scope > [data-block-id]")).toHaveCount(3);
  await expect(editor.locator(":scope > [data-block-id]").last()).toContainText(
    "Beta",
  );
  expect(
    await editor
      .locator(":scope > [data-block-id]")
      .last()
      .getAttribute("data-block-id"),
  ).toBe(id);
  await beta.tap();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(editor.locator("[data-better-editor-children]")).toContainText(
    "Beta",
  );
  await expect(page.locator("[data-save-status]")).toContainText("Saved", {
    timeout: 60000,
  });
  await page.reload();
  await expect(editor.locator("[data-better-editor-children]")).toContainText(
    "Beta",
  );
});
