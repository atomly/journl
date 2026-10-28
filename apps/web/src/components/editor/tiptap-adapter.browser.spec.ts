import { parityBlocks } from "@acme/blocknote/inventory";
import { documentRows } from "@acme/document";
import { fixtureId } from "~/testing/browser/data";
import { expect, test } from "~/testing/browser/fixtures";

test.use({ journalPagination: true });

test("the actual page route loads every inventory block through the Tiptap switch", async ({
  page,
}) => {
  await page
    .context()
    .addCookies([
      { name: "journl-editor", url: "http://127.0.0.1:3100", value: "tiptap" },
    ]);
  await page.goto(`/pages/${fixtureId(980)}`);
  const editor = page.locator(".openeditor-tiptap");
  await expect(editor).toHaveCount(1);
  await expect(editor).toBeVisible();
  await expect(editor).toContainText("Styled writing 世界");
  await expect(editor).toContainText("Numbered child");
  await expect(editor).toContainText("Merged heading");
  const ids = await editor
    .locator("[data-block-id]")
    .evaluateAll((items) =>
      items.map((item) => item.getAttribute("data-block-id")),
    );
  expect(ids).toEqual(
    documentRows(parityBlocks).blocks.map((block) => block.id),
  );
  await expect(editor.locator("table")).toHaveCount(2);
  await expect(
    editor.locator('[data-openeditor-body="image"] img'),
  ).toHaveCount(1);
  await expect(
    editor.locator('[data-openeditor-body="referenceCard"]'),
  ).toHaveCount(2);
  await expect(
    editor.locator('[data-openeditor-body="contentEmbed"]'),
  ).toHaveCount(1);
  await page.context().addCookies([
    {
      name: "journl-editor",
      url: "http://127.0.0.1:3100",
      value: "blocknote",
    },
  ]);
  await page.goto(`/pages/${fixtureId(980)}`);
  await expect(page.locator(".bn-editor")).toBeVisible();
  await expect(page.locator(".bn-editor")).toContainText("Styled writing 世界");
});

test("split, duplicate, nest, undo and reload preserve committed block identities", async ({
  page,
}, info) => {
  const marker = `Split writing persisted ${info.project.name}`;
  await page
    .context()
    .addCookies([
      { name: "journl-editor", url: "http://127.0.0.1:3100", value: "tiptap" },
    ]);
  await page.goto(`/pages/${fixtureId(982)}`);
  const editor = page.locator(".openeditor-tiptap");
  const original = fixtureId(983);
  const heading = editor
    .locator(`[data-block-id="${original}"] [data-openeditor-body]`)
    .first();
  await heading.click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.insertText(marker);
  const split = editor
    .locator("[data-block-id]")
    .filter({ hasText: marker })
    .first();
  const splitId = await split.getAttribute("data-block-id");
  expect(splitId).not.toBe(original);
  await split.locator("[data-openeditor-body]").first().hover();
  await page
    .getByRole("button", { exact: true, name: "Block actions" })
    .click();
  await page
    .getByRole("menuitem", { exact: true, name: "Duplicate block" })
    .click();
  await expect(
    page.getByRole("menu", { exact: true, name: "Block actions" }),
  ).toBeHidden();
  const copies = editor
    .locator("[data-openeditor-body]")
    .filter({ hasText: marker });
  await expect(copies).toHaveCount(2);
  await page.keyboard.press("Tab");
  const nested = split.locator("[data-block-id]");
  await expect(nested).toHaveCount(1);
  const copyId = await nested.getAttribute("data-block-id");
  expect(copyId).not.toBe(splitId);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(nested).toHaveCount(0);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(nested).toHaveCount(1);
  await expect(page.locator("[data-save-status]")).toContainText("Saved");
  const ids = await editor
    .locator("[data-block-id]")
    .evaluateAll((items) =>
      items.map((item) => item.getAttribute("data-block-id")),
    );
  expect(new Set(ids).size).toBe(ids.length);
  await expect(editor).toContainText("Stored reference");
  await expect(
    editor.locator(
      `[data-block-id="${fixtureId(984)}"] [data-block-id="${fixtureId(985)}"]`,
    ),
  ).toHaveCount(1);
  await page.reload();
  await expect(
    editor.locator(`[data-block-id="${splitId}"] [data-block-id="${copyId}"]`),
  ).toHaveCount(1);
  expect(
    await editor
      .locator("[data-block-id]")
      .evaluateAll((items) =>
        items.map((item) => item.getAttribute("data-block-id")),
      ),
  ).toEqual(ids);
});
