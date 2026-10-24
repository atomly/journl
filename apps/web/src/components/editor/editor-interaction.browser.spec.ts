import { expect, test } from "~/testing/browser/fixtures";

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "journl-editor", url: "http://127.0.0.1:3100", value: "tiptap" },
  ]);
});

test("handle menu opens once, add picker leaves no slash, and divider needs no space", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "Desktop pointer controls",
  );
  await page.goto("/journal");
  await page.getByRole("button", { exact: true, name: "New page" }).click();
  await expect(page).toHaveURL(/\/pages\//);
  await page.keyboard.press("Escape");
  const editor = page.locator(".journl-tiptap");
  const body = editor.locator("[data-journl-body]").first();
  await body.hover();
  await page
    .getByRole("button", { exact: true, name: "Block actions" })
    .click();
  await expect(
    page.getByRole("menuitem", { exact: true, name: "Duplicate block" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await body.hover();
  await page.getByRole("button", { exact: true, name: "Add block" }).click();
  await expect(
    page.getByRole("listbox", { name: "Block commands" }),
  ).toBeVisible();
  await expect(editor.locator("[data-block-id]")).toHaveCount(1);
  await expect(body).toHaveText("");
  await page.keyboard.press("Escape");
  await expect(body).toHaveText("");
  await editor.click();
  await editor.pressSequentially("---");
  await expect(editor.locator("hr")).toHaveCount(1);
  await editor.pressSequentially("After divider");
  await expect(editor.locator('[data-journl-body="paragraph"]')).toHaveText(
    "After divider",
  );
});

test("code language picker produces visible colors and survives save/reload", async ({
  page,
}) => {
  await page.goto("/journal/1988-08-26");
  const editor = page.locator(".journl-tiptap").first();
  await editor.pressSequentially("```javascript ");
  await editor.pressSequentially("console.log('hello world');");
  await editor.press("Enter");
  await editor.pressSequentially("const foo = 'bar';");
  const language = editor.getByRole("combobox", { name: "Code language" });
  await expect(language).toHaveValue("javascript");
  const keyword = editor.locator(".hljs-keyword");
  await expect(keyword).toHaveText("const");
  const colors = await keyword.evaluate((element) => ({
    code: getComputedStyle(element.closest("code") as HTMLElement).color,
    keyword: getComputedStyle(element).color,
  }));
  expect(colors.keyword).not.toBe(colors.code);
  await language.selectOption("text");
  await expect(keyword).toHaveCount(0);
  await language.selectOption("javascript");
  await expect(keyword).toHaveText("const");
  await expect(page.locator("[data-save-status]")).toContainText("Saved");
  await page.reload();
  await expect(language).toHaveValue("javascript");
  await expect(keyword).toHaveText("const");
});

test("pasting a plain multiline list creates nested list blocks", async ({
  page,
  context,
}, info) => {
  test.skip(info.project.name !== "desktop-chromium", "Desktop clipboard API");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/journal/1988-08-27");
  const editor = page.locator(".journl-tiptap").first();
  await editor.click();
  await page.evaluate(() =>
    navigator.clipboard.writeText("- First **bold**\n  - Child\n- Second"),
  );
  await editor.press("ControlOrMeta+v");
  await expect(
    editor.locator('[data-journl-body="bulletListItem"]'),
  ).toHaveCount(3);
  await expect(
    editor.locator(
      '[data-journl-children] [data-journl-body="bulletListItem"]',
    ),
  ).toHaveText("Child");
  await expect(editor.locator("strong")).toHaveText("bold");
  await expect(page.locator("[data-save-status]")).toContainText("Saved");
  await page.reload();
  await expect(
    editor.locator('[data-journl-body="bulletListItem"]'),
  ).toHaveCount(3);
});

test("reference selection highlights its own frame and native handles still move blocks", async ({
  page,
  context,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "Desktop drag and clipboard acceptance",
  );
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/journal");
  await page.getByRole("button", { exact: true, name: "New page" }).click();
  await expect(page).toHaveURL(/\/pages\//);
  await page.keyboard.press("Escape");
  const editor = page.locator(".journl-tiptap");
  await editor.click();
  await editor.pressSequentially("First");
  await editor.press("Enter");
  await editor.pressSequentially("Second");
  await editor.press("Enter");
  await editor.pressSequentially("Third");
  const rows = editor.locator("[data-journl-body]");
  await rows.first().hover();
  const handle = page.getByRole("button", {
    exact: true,
    name: "Block actions",
  });
  await handle.dragTo(rows.last(), { targetPosition: { x: 40, y: 22 } });
  await expect(rows.first()).not.toHaveText("First");
  await expect(page.locator("[data-save-status]")).toContainText("Saved");
  const targetUrl = page.url();
  await page.getByRole("button", { exact: true, name: "New page" }).click();
  await expect(page).not.toHaveURL(targetUrl);
  await page.keyboard.press("Escape");
  await editor.click();
  await page.evaluate((url) => navigator.clipboard.writeText(url), targetUrl);
  await editor.press("ControlOrMeta+v");
  const card = editor.locator(".content-reference-card");
  await expect(card).toBeVisible();
  await card.hover();
  await handle.click();
  await expect(editor.locator("[data-reference-selected]")).toHaveCount(1);
  expect(
    await card.evaluate((element) => getComputedStyle(element).boxShadow),
  ).not.toBe("none");
  await page.keyboard.press("Escape");
  await card.getByRole("button", { name: "Reference actions" }).click();
  await page
    .getByRole("menuitem", { exact: true, name: "Embedded content" })
    .click();
  const embed = editor.locator(".content-embed");
  await expect(embed).toBeVisible();
  await embed.hover();
  await handle.click();
  expect(
    await embed.evaluate((element) => getComputedStyle(element).boxShadow),
  ).not.toBe("none");
});
