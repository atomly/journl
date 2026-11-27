import type { Page } from "@playwright/test";
import { expect, test, typeParagraphs } from "~/testing/browser/fixtures";

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

test("nested code handles align with the language picker", async ({
  page,
}, info) => {
  const editor = await newEditor(page);
  await typeParagraphs(editor, ["Parent", ""]);
  await editor.press("Tab");
  await expect(editor.locator("[data-better-editor-children]")).toHaveCount(1);
  await editor.pressSequentially("```javascript ");
  await editor.pressSequentially("console.log('nested');");
  const body = editor.locator(
    '[data-better-editor-children] [data-better-editor-body="codeBlock"]',
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
      const center = await body
        .getByRole("combobox", { name: "Code language" })
        .evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return rect.top + rect.height / 2;
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
