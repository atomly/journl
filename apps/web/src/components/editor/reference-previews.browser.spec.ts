import type { Editor } from "@tiptap/core";
import { expect, test } from "~/testing/browser/fixtures";

test.use({ journalPagination: true });
test("saved external previews keep source presentation and navigation after saving and reloading", async ({
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
  const editor = page.locator(".better-editor-tiptap");
  await editor.fill("Preview acceptance");
  await page.keyboard.press("Enter");
  const urls = [
    "https://example.com/#section",
    "https://github.com/atomly/journl/pull/399",
    "https://missing-preview.example.invalid/no-preview",
  ];
  // Seed only this owned page through its real mounted editor and save session.
  await editor.evaluate((root, urls) => {
    const editor = (root as HTMLElement & { editor: Editor }).editor;
    editor.commands.insertContent(
      urls.map((url) => ({
        attrs: { id: crypto.randomUUID() },
        content: [
          {
            attrs: {
              props: {
                blockId: "",
                documentId: "",
                label: "",
                resolutionToken: "",
                targetKind: "external",
                url,
                version: 1,
              },
            },
            type: "referenceCard",
          },
        ],
        type: "betterEditorBlock",
      })),
    );
  }, urls);
  const cards = page.locator(".better-editor-tiptap .content-reference-card");
  for (const reload of [false, true]) {
    if (reload) await page.reload();
    await expect(cards).toHaveCount(3);
    await expect(
      cards.nth(1).locator(".content-reference-source"),
    ).toContainText("GitHub");
    await expect(cards.nth(2).getByRole("status")).toContainText(
      "Preview unavailable",
    );
    for (const [i, url] of urls.entries())
      await expect(
        cards.nth(i).locator(".content-reference-card-heading a"),
      ).toHaveAttribute("href", url);
    await expect(page.locator("[data-save-status]")).toContainText("Saved");
  }
});
