import type { Editor } from "@tiptap/core";
import { fixtureId } from "~/testing/browser/data";
import { expect, test } from "~/testing/browser/fixtures";

test.use({ journalPagination: true });
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "journl-editor", url: "http://127.0.0.1:3100", value: "tiptap" },
  ]);
});

test("journal slash commands, checkboxes, and collapsible writing save with stable identities", async ({
  page,
}, info) => {
  await page.goto(
    `/journal/2099-11-${info.project.name === "desktop-chromium" ? "22" : "23"}`,
  );
  const editor = page.getByRole("textbox", {
    exact: true,
    name: "Document editor",
  });
  await expect(editor).toBeVisible();
  const firstId = await editor
    .locator("[data-block-id]")
    .first()
    .getAttribute("data-block-id");
  await editor.focus();
  await page.keyboard.type("/hea");
  await expect(
    page.getByRole("listbox", { name: "Block commands" }),
  ).toBeVisible();
  await page.getByRole("button", { exact: true, name: "Save details" }).focus();
  await expect(
    page.getByRole("listbox", { name: "Block commands" }),
  ).toBeHidden();
  await editor.focus();
  await page.keyboard.press("Backspace");
  await page.keyboard.type("ading 4");
  await expect(
    page.getByRole("listbox", { name: "Block commands" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("listbox", { name: "Block commands" })
      .getByRole("option", { exact: true, name: "Heading 4" }),
  ).toBeVisible();
  await page.keyboard.press("Enter");
  await page.keyboard.insertText(`Journal heading ${info.project.name}`);
  await expect(editor.locator("h4")).toContainText("Journal heading");
  await page.keyboard.press("Enter");
  await expect
    .poll(() =>
      editor.evaluate(() => {
        const anchor = window.getSelection()?.anchorNode;
        const element =
          anchor instanceof Element ? anchor : anchor?.parentElement;
        return element
          ?.closest("[data-better-editor-body]")
          ?.getAttribute("data-better-editor-body");
      }),
    )
    .toBe("paragraph");
  await page.keyboard.type("/checklist");
  await page.keyboard.press("Enter");
  await page.keyboard.insertText("A saved task");
  const checkbox = editor.getByRole("checkbox", {
    name: "Checklist item complete",
  });
  await checkbox.check();
  await expect(checkbox).toBeChecked();
  await editor.locator('[data-better-editor-body="checkListItem"]').click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(editor.getByRole("checkbox")).toHaveCount(2);
  await page.keyboard.press("Enter");
  await page.keyboard.type("/toggle list");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Details");
  const details = editor
    .locator('[data-better-editor-body="toggleListItem"]')
    .filter({ hasText: /^Details$/ });
  await expect(details).toHaveCount(1);
  await page.keyboard.press("Enter");
  await expect(
    editor.locator('[data-better-editor-body="toggleListItem"]'),
  ).toHaveCount(2);
  await page.keyboard.press("Tab");
  await page.keyboard.type("Nested writing survives collapse");
  const child = editor
    .locator("[data-better-editor-children] [data-block-id]")
    .filter({ hasText: "Nested writing survives collapse" });
  await expect(child).toHaveCount(1);
  const childId = await child.getAttribute("data-block-id");
  await editor
    .getByRole("button", { exact: true, name: "Collapse content" })
    .first()
    .click();
  await expect(child).toBeHidden();
  await editor
    .getByRole("button", { exact: true, name: "Expand content" })
    .first()
    .click();
  await expect(child).toBeVisible();
  await expect(page.locator("[data-save-status]")).toContainText("Saved");
  const ids = await editor
    .locator("[data-block-id]")
    .evaluateAll((items) =>
      items.map((item) => item.getAttribute("data-block-id")),
    );
  expect(ids[0]).toBe(firstId);
  expect(new Set(ids).size).toBe(ids.length);
  await page.reload();
  await expect(
    editor.getByRole("checkbox", { name: "Checklist item complete" }),
  ).toBeChecked();
  await expect(editor.locator(`[data-block-id="${childId}"]`)).toContainText(
    "Nested writing survives collapse",
  );
  expect(
    await editor
      .locator("[data-block-id]")
      .evaluateAll((items) =>
        items.map((item) => item.getAttribute("data-block-id")),
      ),
  ).toEqual(ids);
});

test("page code indentation and table navigation edit bodies without moving blocks or references", async ({
  page,
}, info) => {
  const pageNumber = info.project.name === "desktop-chromium" ? 1000 : 1010;
  await page.goto(`/pages/${fixtureId(pageNumber)}`);
  const editor = page.getByRole("textbox", {
    exact: true,
    name: "Document editor",
  });
  const source = editor
    .locator(
      `[data-block-id="${fixtureId(pageNumber + 1)}"] [data-better-editor-body]`,
    )
    .first();
  await source.click();
  await source.evaluate((element) => {
    // Select this body on both macOS and Linux; Home/End have different
    // native meanings and can include the following reference on macOS.
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
  });
  await page.getByRole("combobox", { exact: true, name: "Block type" }).click();
  await page.getByRole("option", { exact: true, name: "Code" }).click();
  const code = editor.locator(
    `[data-block-id="${fixtureId(pageNumber + 1)}"] pre`,
  );
  await expect(code).toBeVisible();
  const language = editor.getByRole("combobox", {
    exact: true,
    name: "Code language",
  });
  await language.click();
  await page.getByRole("option", { exact: true, name: "typescript" }).click();
  await expect(language.locator('[data-slot="select-value"]')).toHaveText(
    "typescript",
  );
  await code.click();
  await page.keyboard.press("Tab");
  const codeText = ` // code ${info.project.name}`;
  await page.keyboard.insertText(codeText);
  await page.keyboard.press("Enter");
  await expect(code).toContainText(codeText);
  expect(await code.textContent()).toContain("\t");
  const table = editor.locator(
    `[data-block-id="${fixtureId(pageNumber + 4)}"]`,
  );
  const cells = table.locator("td");
  await cells.first().click();
  // The browser can expose its new DOM range before ProseMirror has processed
  // selectionchange. Wait for the installed editor's selection before typing.
  await expect
    .poll(() =>
      editor.evaluate(
        (element) =>
          (element as HTMLElement & { editor: Editor }).editor.state.selection
            .$from.parent.type.name,
      ),
    )
    .toBe("tableParagraph");
  await page.keyboard.press("Enter");
  // Table Enter moves down; Tab then moves to the next cell in that row.
  await expect
    .poll(() =>
      cells
        .nth(2)
        .evaluate((cell) =>
          cell.contains(window.getSelection()?.anchorNode ?? null),
        ),
    )
    .toBe(true);
  await page.keyboard.press("Tab");
  const cellText = ` table ${info.project.name}`;
  await page.keyboard.insertText(cellText);
  await expect(cells.nth(3)).toContainText(cellText);
  await expect(table.locator("tr")).toHaveCount(2);
  await expect(editor).toContainText("Stored reference");
  await expect(page.locator("[data-save-status]")).toContainText("Saved");
  const ids = await editor
    .locator("[data-block-id]")
    .evaluateAll((items) =>
      items.map((item) => item.getAttribute("data-block-id")),
    );
  await page.reload();
  await expect(editor.locator("pre")).toContainText(codeText);
  await expect(language.locator('[data-slot="select-value"]')).toHaveText(
    "typescript",
  );
  await expect(editor.locator("td").nth(3)).toContainText(cellText);
  expect(
    await editor
      .locator("[data-block-id]")
      .evaluateAll((items) =>
        items.map((item) => item.getAttribute("data-block-id")),
      ),
  ).toEqual(ids);
  await expect(editor).toContainText("Stored reference");
});

test("block menus move, copy, delete and undo the selected block while text formatting persists", async ({
  page,
}, info) => {
  await page.goto(
    `/journal/2099-11-${info.project.name === "desktop-chromium" ? "24" : "25"}`,
  );
  const editor = page.getByRole("textbox", {
    exact: true,
    name: "Document editor",
  });
  await editor.pressSequentially("Move me");
  await editor.press("Enter");
  await page.keyboard.insertText("Keep me ");
  await page.keyboard.press("ControlOrMeta+b");
  await page.keyboard.insertText("bold writing");
  await expect(editor.locator("strong")).toContainText("bold writing");
  await page.keyboard.press("Home");
  await page.keyboard.press("Shift+End");
  await page
    .getByRole("button", { exact: true, name: "Text alignment" })
    .click();
  await page.getByRole("menuitem", { exact: true, name: "Right" }).click();
  await expect(page.getByRole("menu")).toBeHidden();
  await page.keyboard.press("ArrowRight");
  const blockMenu = page.getByRole("menu", {
    exact: true,
    name: "Block actions",
  });
  const contextMenu = page.getByRole("menu", {
    exact: true,
    name: "Context block actions",
  });
  const original = await editor
    .locator("[data-block-id]")
    .evaluateAll((items) =>
      items.map((item) => item.getAttribute("data-block-id")),
    );
  await editor
    .locator(`[data-block-id="${original[1]}"] [data-better-editor-body]`)
    .first()
    .hover();
  await page
    .getByRole("button", {
      disabled: false,
      exact: true,
      name: "Block actions",
    })
    .click();
  await page
    .getByRole("menuitem", { exact: true, name: "Move block up" })
    .click();
  await expect(blockMenu).toBeHidden();
  expect(
    await editor
      .locator("[data-block-id]")
      .evaluateAll((items) =>
        items.map((item) => item.getAttribute("data-block-id")),
      ),
  ).toEqual([...original].reverse());
  await editor
    .locator(`[data-block-id="${original[1]}"] [data-better-editor-body]`)
    .first()
    .hover();
  await page
    .getByRole("button", {
      disabled: false,
      exact: true,
      name: "Block actions",
    })
    .click();
  await page
    .getByRole("menuitem", { exact: true, name: "Duplicate block" })
    .click();
  await expect(blockMenu).toBeHidden();
  await expect(editor.locator("[data-block-id]")).toHaveCount(3);
  const copied = await editor
    .locator("[data-block-id]")
    .nth(1)
    .getAttribute("data-block-id");
  expect(original).not.toContain(copied);
  await page.keyboard.press("Shift+F10");
  await expect(
    contextMenu.getByRole("menuitem", { exact: true, name: "Delete block" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(contextMenu).toBeHidden();
  await editor
    .locator(`[data-block-id="${copied}"] [data-better-editor-body]`)
    .first()
    .hover();
  await page
    .getByRole("button", {
      disabled: false,
      exact: true,
      name: "Block actions",
    })
    .click();
  await page
    .getByRole("menuitem", { exact: true, name: "Delete block" })
    .click();
  await expect(blockMenu).toBeHidden();
  await expect(editor.locator("[data-block-id]")).toHaveCount(2);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(editor.locator(`[data-block-id="${copied}"]`)).toHaveCount(1);
  await expect(page.locator("[data-save-status]")).toContainText("Saved");
  await page.reload();
  await expect(
    editor.locator(`[data-block-id="${copied}"] strong`),
  ).toContainText("bold writing");
  await expect(
    editor.locator(`[data-block-id="${copied}"] [data-better-editor-body]`),
  ).toHaveCSS("text-align", "right");
});
