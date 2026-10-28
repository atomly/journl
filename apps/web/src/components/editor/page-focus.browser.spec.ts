import { expect, test } from "~/testing/browser/fixtures";

test.use({ journalPagination: true });
test("page keyboard order follows search, title and document without changing toolbar access", async ({
  page,
}) => {
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
  const title = page.getByPlaceholder("New page");
  const editor = page.getByRole("textbox", {
    exact: true,
    name: "Document editor",
  });
  const search = page.getByRole("button", {
    exact: true,
    name: "Search notes",
  });
  await expect(editor).toBeVisible();
  await search.focus();
  await page.keyboard.press("Tab");
  await expect(title).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(search).toBeFocused();
  await page.keyboard.press("Tab");
  await title.fill("Keyboard order");
  await page.keyboard.press("Tab");
  await expect(editor).toBeFocused();
  await page.keyboard.insertText("Body from the title");
  await expect(
    editor.locator('[data-better-editor-body="paragraph"]'),
  ).toHaveText("Body from the title");
  await expect(title).toHaveValue("Keyboard order");
  await page.keyboard.press("Alt+F10");
  await expect(
    page.getByRole("button", { exact: true, name: "Copy block link" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(editor).toBeFocused();
  await expect(page.locator("[data-save-status]")).toContainText("Saved");
  await page.reload();
  await expect(
    editor.locator('[data-better-editor-body="paragraph"]'),
  ).toHaveText("Body from the title");
  await search.focus();
  await page.keyboard.press("Tab");
  await expect(title).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(editor).toBeFocused();
});
