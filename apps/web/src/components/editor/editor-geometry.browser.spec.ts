import type { Page } from "@playwright/test";
import type { Editor } from "@tiptap/core";
import { fixtureId } from "~/testing/browser/data";
import { expect, test } from "~/testing/browser/fixtures";

test.use({ journalPagination: true });

async function createPage(page: Page) {
  await page.goto("/journal");
  const create = page.getByRole("button", { exact: true, name: "New page" });
  if (!(await create.isVisible()))
    await page
      .getByRole("button", { exact: true, name: "Toggle Sidebar" })
      .first()
      .click();
  await create.click();
  await expect(page).toHaveURL(/\/pages\//, { timeout: 60000 });
  await page.keyboard.press("Escape");
}

test("numbered markers stay on one line at double-digit boundaries and dividers align with their handles", async ({
  page,
}, info) => {
  await createPage(page);
  const editor = page.locator(".better-editor-tiptap");
  await expect(editor).toBeVisible();
  await editor.evaluate((root) => {
    const instance = (root as HTMLElement & { editor: Editor }).editor;
    instance.commands.setContent({
      content: [
        ...Array.from({ length: 16 }, (_, i) => ({
          attrs: { id: crypto.randomUUID() },
          content: [
            {
              attrs: { props: { start: i + 1 } },
              content: [{ text: String(i + 1), type: "text" }],
              type: "numberedListItem",
            },
          ],
          type: "betterEditorBlock",
        })),
        {
          attrs: { id: crypto.randomUUID() },
          content: [{ type: "divider" }],
          type: "betterEditorBlock",
        },
      ],
      type: "doc",
    });
  });
  await editor.evaluate((root) => {
    root.style.fontSize = "32px";
    root.style.lineHeight = "48px";
  });
  const markers = await editor
    .locator('[data-better-editor-body="numberedListItem"]')
    .evaluateAll((rows) =>
      rows.map((row) => {
        const style = getComputedStyle(row, "::before");
        return {
          content: style.content,
          height: Number.parseFloat(style.height),
          line: Number.parseFloat(style.lineHeight),
          wrap: style.whiteSpace,
        };
      }),
    );
  expect(markers).toHaveLength(16);
  for (const marker of markers) {
    expect(marker.content.replace(/["\s]/g, "")).toMatch(/\d+\./);
    expect(marker.wrap).toBe("nowrap");
    expect(marker.height).toBeLessThanOrEqual(marker.line + 1);
  }
  const divider = editor.locator('[data-better-editor-body="divider"]');
  await divider.scrollIntoViewIfNeeded();
  if (info.project.name === "mobile-webkit") await divider.tap();
  else await divider.hover();
  const handle = page.getByRole("button", {
    exact: true,
    name: "Block actions",
  });
  await expect(handle).toBeVisible();
  await expect
    .poll(async () => {
      const grip = await handle.boundingBox();
      const line = await divider.locator("hr").boundingBox();
      return grip && line
        ? Math.abs(grip.y + grip.height / 2 - line.y - line.height / 2)
        : Number.POSITIVE_INFINITY;
    })
    .toBeLessThan(2);
});

test("dark table selection has a visible fill and edge independent of the host ring", async ({
  page,
  context,
}) => {
  await context.addInitScript(() => localStorage.setItem("theme", "dark"));
  await page.goto(`/pages/${fixtureId(980)}`);
  const editor = page.locator(".better-editor-tiptap");
  const cell = editor.locator("td,th").first();
  await expect(cell).toBeVisible();
  const paint = await cell.evaluate((element) => {
    element.classList.add("selectedCell");
    const style = getComputedStyle(element, "::after");
    const result = { edge: style.boxShadow, fill: style.backgroundColor };
    element.classList.remove("selectedCell");
    return result;
  });
  expect(paint.fill).toBe("rgba(80, 130, 245, 0.35)");
  expect(paint.edge).toContain("rgba(100, 155, 255, 0.75)");
});

test("native code drag preserves block count when ProseMirror loses transient drag state", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop-chromium", "Native mouse drag");
  await createPage(page);
  const editor = page.locator(".better-editor-tiptap");
  await expect(editor).toBeVisible();
  const ids = await editor.evaluate((root) => {
    const codeId = crypto.randomUUID();
    const targetId = crypto.randomUUID();
    const instance = (root as HTMLElement & { editor: Editor }).editor;
    instance.commands.setContent({
      content: [
        {
          attrs: { id: codeId },
          content: [
            {
              attrs: { props: { language: "javascript" } },
              content: [{ text: "console.log('once');", type: "text" }],
              type: "codeBlock",
            },
          ],
          type: "betterEditorBlock",
        },
        {
          attrs: { id: targetId },
          content: [
            {
              content: [{ text: "Drag below this block", type: "text" }],
              type: "paragraph",
            },
          ],
          type: "betterEditorBlock",
        },
      ],
      type: "doc",
    });
    return { codeId, targetId };
  });
  const code = editor.locator(`[data-block-id="${ids.codeId}"]`);
  const target = editor.locator(`[data-block-id="${ids.targetId}"]`);
  for (let pass = 0; pass < 4; pass++) {
    await code.locator("pre").hover();
    const grip = await page
      .getByRole("button", { exact: true, name: "Block actions" })
      .boundingBox();
    const destination = await target.boundingBox();
    if (!grip || !destination) throw new Error("Missing drag geometry");
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      grip.x + grip.width / 2 + 12,
      grip.y + grip.height / 2,
      { steps: 4 },
    );
    await editor.evaluate((root) => {
      (root as HTMLElement & { editor: Editor }).editor.view.dragging = null;
    });
    await expect(
      page.locator('[data-better-editor-toolbar-mode="floating"]'),
    ).toHaveCount(0);
    const y =
      pass % 2 === 0
        ? destination.y + destination.height - 1
        : destination.y + 1;
    await page.mouse.move(destination.x + 80, y, { steps: 12 });
    await page.mouse.up();
    await expect(editor.locator(":scope > [data-block-id]")).toHaveCount(2);
    await expect(
      editor.locator(":scope > [data-block-id]").last(),
    ).toHaveAttribute(
      "data-block-id",
      pass % 2 === 0 ? ids.codeId : ids.targetId,
    );
    await expect(code).toHaveCount(1);
  }
  await expect(page.locator("[data-save-status]")).toContainText("Saved");
  await page.reload();
  await expect(editor.locator(":scope > [data-block-id]")).toHaveCount(2);
  await expect(editor.locator(`[data-block-id="${ids.codeId}"]`)).toHaveCount(
    1,
  );
});
