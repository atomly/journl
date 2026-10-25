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
  const editor = page.locator(".journl-tiptap");
  await editor.fill("Alpha");
  for (const text of ["Middle 1", "Middle 2", "Middle 3", "Beta"]) {
    await page.keyboard.press("Enter");
    await page.keyboard.insertText(text);
  }
  const mobile = info.project.name === "mobile-webkit";
  const rows = editor.locator('[data-journl-body="paragraph"]');
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
