import type { Locator, Page } from "@playwright/test";
import type { Editor } from "@tiptap/core";
import { expect, test } from "~/testing/browser/fixtures";

test.use({ journalPagination: true });
test.beforeEach(async ({ page, context }) => {
  await context.addCookies([
    { name: "journl-editor", url: "http://127.0.0.1:3100", value: "tiptap" },
  ]);
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
});

async function focusMore(page: Page) {
  const more = page.getByRole("button", {
    exact: true,
    name: "More formatting",
  });
  for (let i = 0; i < 20; i++) {
    if (await more.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press("ArrowRight");
  }
  await expect(more).toBeFocused();
}
async function openMore(page: Page) {
  await expect(page.locator(".open-editor-tiptap")).toBeFocused();
  await page.keyboard.press("Alt+F10");
  await expect(
    page.getByRole("button", { exact: true, name: "Copy block link" }),
  ).toBeFocused();
  await focusMore(page);
  await page.keyboard.press("Enter");
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean(document.activeElement?.closest('[role="menu"]')),
      ),
    )
    .toBe(true);
}
async function menuAction(page: Page, name: string) {
  const item = page.getByRole("menuitem", { exact: true, name });
  await expect(item).toBeVisible();
  await expect(item).toBeEnabled();
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean(document.activeElement?.closest('[role="menu"]')),
      ),
    )
    .toBe(true);
  for (let i = 0; i < 40; i++) {
    if (await item.evaluate((el) => el === document.activeElement)) break;
    await page.keyboard.press("ArrowDown");
  }
  await expect(item).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(item).toBeHidden();
  await expect(page.locator(".open-editor-tiptap")).toBeFocused();
}
async function escapeToEditor(page: Page) {
  const editor = page.locator(".open-editor-tiptap");
  // Escape dismisses the current popup layer, including a focused tooltip.
  for (let i = 0; i < 4; i++) {
    if (await editor.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press("Escape");
    try {
      await expect(editor).toBeFocused({ timeout: 700 });
      return;
    } catch {
      /* Dismiss the next layer. */
    }
  }
  await expect(editor).toBeFocused();
}
async function caretIn(editor: Locator, text: string) {
  await expect
    .poll(() =>
      editor.evaluate((el) => {
        const state = (el as HTMLElement & { editor: Editor }).editor.state;
        return (
          state.selection.empty && state.selection.$from.parent.textContent
        );
      }),
    )
    .toBe(text);
}

test("keyboard users can reach controls, return to their selection, and leave editing", async ({
  page,
}) => {
  const editor = page.locator(".open-editor-tiptap");
  await editor.fill("Alpha");
  await page.keyboard.press("Enter");
  await page.keyboard.insertText("Beta");
  const paragraphs = editor.locator('[data-open-editor-body="paragraph"]');
  await paragraphs.first().click();
  await page.keyboard.press("Home");
  await page.keyboard.press("Shift+End");
  const selection = await editor.evaluate((el) =>
    (el as HTMLElement & { editor: Editor }).editor.state.selection.toJSON(),
  );
  await page.keyboard.press("Alt+F10");
  await expect(
    page.getByRole("button", { exact: true, name: "Copy block link" }),
  ).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("button", { exact: true, name: "Insert link" }),
  ).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("combobox", { exact: true, name: "Block type" }),
  ).toBeFocused();
  await focusMore(page);
  await page.keyboard.press("Enter");
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean(document.activeElement?.closest('[role="menu"]')),
      ),
    )
    .toBe(true);
  await escapeToEditor(page);
  expect(
    await editor.evaluate((el) =>
      (el as HTMLElement & { editor: Editor }).editor.state.selection.toJSON(),
    ),
  ).toEqual(selection);
  await page.keyboard.press("Control+m");
  await page.keyboard.press("Tab");
  await expect(editor).not.toBeFocused();
  await paragraphs.last().click();
  await caretIn(editor, "Beta");
  await page.keyboard.press("Control+m");
  await page.keyboard.press("Tab");
  await expect(
    editor.locator(
      '[data-open-editor-children] [data-open-editor-body="paragraph"]',
    ),
  ).toHaveText("Beta");
  await page.keyboard.press("Shift+Tab");
  await expect(editor.locator("[data-open-editor-children]")).toHaveCount(0);
});

test("context actions target the clicked block and tolerate its concurrent removal", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "The custom mouse context menu preserves native touch menus",
  );
  const editor = page.locator(".open-editor-tiptap");
  await editor.fill("Alpha");
  await page.keyboard.press("Enter");
  await page.keyboard.insertText("Beta");
  const paragraphs = editor.locator('[data-open-editor-body="paragraph"]');
  await paragraphs.first().click();
  await caretIn(editor, "Alpha");
  // Dispatching the context gesture alone retains the independently focused caret.
  await paragraphs
    .last()
    .dispatchEvent("contextmenu", { button: 2, clientX: 450, clientY: 330 });
  await menuAction(page, "Indent");
  await expect(
    editor.locator(
      '[data-open-editor-children] [data-open-editor-body="paragraph"]',
    ),
  ).toHaveText("Beta");
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("ArrowRight");
  await paragraphs.first().click();
  await caretIn(editor, "Alpha");
  await paragraphs
    .last()
    .dispatchEvent("contextmenu", { button: 2, clientX: 450, clientY: 330 });
  await expect(
    page.getByRole("menuitem", { exact: true, name: "Indent" }),
  ).toBeVisible();
  // Fault injection into the actual mounted editor models a document update
  // while a popup still refers to the block. It is not an editor stand-in.
  await editor.evaluate((el) => {
    const instance = (el as HTMLElement & { editor: Editor }).editor;
    const first = instance.state.doc.firstChild;
    const second = instance.state.doc.child(1);
    if (!first) throw new Error("Missing first block");
    instance.view.dispatch(
      instance.state.tr.delete(
        first.nodeSize,
        first.nodeSize + second.nodeSize,
      ),
    );
  });
  await expect(
    page.getByRole("menuitem", { exact: true, name: "Indent" }),
  ).toBeHidden();
  await expect(paragraphs).toHaveText("Alpha");
});

test("table formatting, headers, movement and widths work through accessible controls", async ({
  page,
}) => {
  const editor = page.locator(".open-editor-tiptap");
  await editor.fill("/table");
  await page.getByRole("option", { exact: true, name: "Table" }).click();
  const table = editor.locator("table");
  const rows = table.locator("tr");
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) {
      await rows.nth(r).locator("td").nth(c).click();
      await page.keyboard.insertText(String.fromCharCode(65 + r * 3 + c));
    }
  const selected = [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ];
  await rows.first().locator("td").first().click();
  await rows
    .nth(1)
    .locator("td")
    .nth(1)
    .click({ modifiers: ["Shift"] });
  await expect(table.locator(".selectedCell")).toHaveCount(4);
  await page.keyboard.press("ControlOrMeta+b");
  for (const [r = 0, c = 0] of selected)
    await expect(
      rows.nth(r).locator("td").nth(c).locator("strong"),
    ).toHaveCount(1);
  await page.getByRole("button", { exact: true, name: "Colors" }).click();
  await page.getByRole("button", { exact: true, name: "Text purple" }).click();
  await expect(editor).toBeFocused();
  for (const [r = 0, c = 0] of selected)
    await expect(
      rows
        .nth(r)
        .locator("td")
        .nth(c)
        .locator('[data-open-editor-style="textColor"]'),
    ).toHaveCount(1);
  for (const href of [
    "https://example.com/first",
    "https://example.com/relinked",
  ]) {
    await page.keyboard.press("ControlOrMeta+k");
    await page
      .getByRole("textbox", { exact: true, name: "Reference URL" })
      .fill(href);
    await page.getByRole("button", { exact: true, name: "Apply link" }).click();
    await expect(
      page.getByRole("textbox", { exact: true, name: "Reference URL" }),
    ).toBeHidden();
    await expect(editor).toBeFocused();
    for (const [r = 0, c = 0] of selected)
      await expect(
        rows.nth(r).locator("td").nth(c).locator("a"),
      ).toHaveAttribute("href", href);
  }
  await expect(
    rows
      .first()
      .locator("td")
      .nth(2)
      .locator("a,strong,[data-open-editor-style]"),
  ).toHaveCount(0);
  await rows.first().locator("td").first().click();
  await openMore(page);
  await menuAction(page, "Add header row");
  await expect(table.getByRole("columnheader")).toHaveCount(3);
  await openMore(page);
  await menuAction(page, "Add header column");
  await expect(table.getByRole("rowheader")).toHaveCount(2);
  const before = await rows.first().locator("td").first().boundingBox();
  if (!before) throw new Error("Missing first cell");
  await openMore(page);
  await menuAction(page, "Widen column");
  await expect
    .poll(
      async () =>
        (await rows.first().locator("td").first().boundingBox())?.width ?? 0,
    )
    .toBeGreaterThan(before.width + 10);
  await openMore(page);
  await menuAction(page, "Move row down");
  await expect(rows.nth(1)).toContainText("A");
  await rows.nth(1).locator("td").first().click();
  await caretIn(editor, "A");
  await openMore(page);
  await menuAction(page, "Move column right");
  await expect(rows.nth(1).locator("td").nth(1)).toContainText("A");
  const wrapper = table.locator("xpath=ancestor::*[@data-block-id]");
  const id = await wrapper.getAttribute("data-block-id");
  await expect(page.locator("[data-save-status]")).toContainText("Saved");
  await page.reload();
  await expect(table.getByRole("columnheader")).toHaveCount(3);
  await expect(table.getByRole("rowheader")).toHaveCount(2);
  await expect(wrapper).toHaveAttribute("data-block-id", id ?? "");
});
