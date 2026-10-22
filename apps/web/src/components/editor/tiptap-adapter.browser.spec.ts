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
  const editor = page.locator(".journl-tiptap");
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
  await expect(editor.locator('[data-journl-body="image"] img')).toHaveCount(1);
  await expect(
    editor.locator('[data-journl-body="referenceCard"]'),
  ).toHaveCount(2);
  await expect(editor.locator('[data-journl-body="contentEmbed"]')).toHaveCount(
    1,
  );
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
