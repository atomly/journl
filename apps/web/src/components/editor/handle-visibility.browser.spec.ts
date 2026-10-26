import { expect, test } from "~/testing/browser/fixtures";

test.use({ journalPagination: true });
test("handles follow focus and navigation, hide only for desktop typing, and persist on mobile", async ({
  page,
}, info) => {
  await page.goto("/journal");
  const create = page.getByRole("button", { exact: true, name: "New page" });
  if (!(await create.isVisible()))
    await page
      .getByRole("button", { exact: true, name: "Toggle Sidebar" })
      .click();
  await create.click();
  await expect(page).toHaveURL(/\/pages\//);
  await page.keyboard.press("Escape");
  const editor = page.locator(".better-editor-tiptap");
  await editor.fill("Alpha");
  for (const text of ["Middle 1", "Middle 2", "Middle 3", "Beta"]) {
    await page.keyboard.press("Enter");
    await page.keyboard.insertText(text);
  }
  const mobile = info.project.name === "mobile-webkit";
  const rows = editor.locator('[data-better-editor-body="paragraph"]');
  if (mobile) await rows.last().tap();
  else await rows.last().click();
  const handle = page.getByRole("button", {
    exact: true,
    name: "Block actions",
  });
  await expect(handle).toBeVisible();
  const follows = async (index: number) => {
    await expect
      .poll(async () => {
        const grip = await handle.boundingBox();
        const row = await rows.nth(index).boundingBox();
        return grip && row
          ? Math.abs(grip.y - row.y)
          : Number.POSITIVE_INFINITY;
      })
      .toBeLessThan(35);
  };
  await follows(4);
  await page.keyboard.insertText("!");
  if (mobile) await expect(handle).toBeVisible();
  else await expect(handle).toHaveCount(0);
  // Keyboard navigation changes the target even when the mouse hasn't moved.
  await page.keyboard.press("ArrowLeft");
  await expect(handle).toBeVisible();
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowUp");
  await follows(0);
  await page.keyboard.insertText("!");
  if (mobile) {
    await expect(handle).toBeVisible();
    await page.getByPlaceholder("New page").focus();
    await expect(handle).toBeVisible();
    await expect(
      page.getByRole("button", { exact: true, name: "Add block" }),
    ).toBeVisible();
  } else {
    await expect(handle).toHaveCount(0);
    await rows.last().hover();
    await follows(4);
    await page.getByPlaceholder("New page").focus();
    await expect(handle).toHaveCount(0);
    await editor.focus();
    await expect(handle).toBeVisible();
    await follows(0);
  }
});

test("mobile handles stay aligned with their block as the viewport shrinks and restores", async ({
  page,
}, info) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/journal");
  const create = page.getByRole("button", { exact: true, name: "New page" });
  if (!(await create.isVisible()))
    await page
      .getByRole("button", { exact: true, name: "Toggle Sidebar" })
      .click();
  const previous = page.url();
  await create.click();
  await expect(page).not.toHaveURL(previous);
  await page.keyboard.press("Escape");
  const editor = page.locator(".better-editor-tiptap");
  await editor.fill("First row");
  for (let index = 1; index <= 7; index++) {
    await page.keyboard.press("Enter");
    await page.keyboard.insertText(`Row ${index}`);
  }
  const row = editor.locator('[data-better-editor-body="paragraph"]').last();
  if (info.project.name === "mobile-webkit") await row.tap();
  else await row.click();
  const handle = page.getByRole("button", {
    exact: true,
    name: "Block actions",
  });
  await expect(handle).toBeVisible();
  const add = page.getByRole("button", { exact: true, name: "Add block" });
  await expect(add).toBeVisible();
  await expect
    .poll(async () => {
      const plus = await add.boundingBox();
      const grip = await handle.boundingBox();
      return plus && grip
        ? Math.abs(plus.y + plus.height / 2 - grip.y - grip.height / 2)
        : Number.POSITIVE_INFINITY;
    })
    .toBeLessThan(1);
  const plus = await add.boundingBox();
  const grip = await handle.boundingBox();
  const content = await row.boundingBox();
  if (!plus || !grip || !content) throw new Error("Missing mobile gutter");
  expect(plus.width).toBeGreaterThanOrEqual(44);
  expect(plus.height).toBeGreaterThanOrEqual(44);
  expect(grip.width).toBeGreaterThanOrEqual(44);
  expect(grip.height).toBeGreaterThanOrEqual(44);
  expect(plus.x + plus.width).toBeLessThanOrEqual(grip.x);
  expect(grip.x + grip.width).toBeLessThanOrEqual(content.x);
  const relativeTop = async () => {
    const grip = await handle.boundingBox();
    const block = await row.boundingBox();
    if (!grip || !block) throw new Error("Missing block handle geometry");
    return grip.y - block.y;
  };
  await expect.poll(relativeTop).toBeGreaterThan(-20);
  const initial = await relativeTop();
  const bounds = await row.boundingBox();
  if (!bounds) throw new Error("Missing selected block");
  // Leave the first line visible but insufficient room for the whole rail.
  // This exercises keyboard-like clipping without claiming a physical keyboard.
  const reducedHeight = Math.ceil(bounds.y + 45);
  expect(reducedHeight).toBeLessThan(844);
  await page.setViewportSize({ height: reducedHeight, width: 390 });
  await expect(handle).toBeVisible();
  await expect
    .poll(async () => Math.abs((await relativeTop()) - initial))
    .toBeLessThan(2);
  await page.keyboard.insertText("!");
  await expect(handle).toBeVisible();
  await expect
    .poll(async () => Math.abs((await relativeTop()) - initial))
    .toBeLessThan(2);
  await page.setViewportSize({ height: 844, width: 390 });
  await expect
    .poll(async () => Math.abs((await relativeTop()) - initial))
    .toBeLessThan(2);
});
