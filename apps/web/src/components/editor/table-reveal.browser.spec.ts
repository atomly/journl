import type { Page } from "@playwright/test";
import type { Editor } from "@tiptap/core";
import { fixtureId } from "~/testing/browser/data";
import { expect, test, typeParagraphs } from "~/testing/browser/fixtures";

async function menuClosed(page: Page) {
  // A hidden popup can still be completing its final-focus transition.
  await expect(page.locator('[role="menu"][data-tiptap-owner]')).toHaveCount(0);
  await expect(page.locator(".better-editor-tiptap")).toBeFocused();
}

test.use({ journalPagination: true });
test("added columns reveal themselves without moving the document vertically", async ({
  page,
}, info) => {
  await page.goto("/journal");
  const create = page.getByRole("button", { exact: true, name: "New page" });
  if (!(await create.isVisible()))
    await page
      .getByRole("button", { exact: true, name: "Toggle Sidebar" })
      .click();
  const previous = page.url();
  await create.click();
  await expect(page).not.toHaveURL(previous, { timeout: 60_000 });
  await page.keyboard.press("Escape");
  const editor = page.locator(".better-editor-tiptap");
  await typeParagraphs(editor, ["/table"]);
  await page.getByRole("option", { exact: true, name: "Table" }).click();
  const wrapper = editor.locator(".better-editor-table-wrapper");
  const cells = editor.locator("tr").first().locator("td");
  const vertical = () =>
    wrapper.evaluate((element) => {
      const values: number[] = [];
      for (let node: Element | null = element; node; node = node.parentElement)
        values.push(node.scrollTop);
      return values;
    });
  const initial = await vertical();
  const visibleColumn = async (index: number) => {
    await expect
      .poll(() =>
        cells.nth(index).evaluate((cell) => {
          const viewport = cell
            .closest(".better-editor-table-wrapper")
            ?.getBoundingClientRect();
          const rect = cell.getBoundingClientRect();
          return viewport
            ? rect.left >= viewport.left - 1 && rect.right <= viewport.right + 1
            : false;
        }),
      )
      .toBe(true);
  };
  for (let count = 3; count < 8; count++) {
    const last = editor.locator("td").last();
    if (info.project.name === "mobile-webkit") await last.tap();
    else {
      await last.hover({ position: { x: 2, y: 2 } });
      await last.hover();
    }
    const add = page.getByRole("button", { exact: true, name: "Add column" });
    if (info.project.name === "mobile-webkit") await add.tap();
    else await add.click();
    await expect(cells).toHaveCount(count + 1);
    await visibleColumn(count);
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await visibleColumn(count);
  }
  await expect
    .poll(() => wrapper.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(0);
  await expect.poll(vertical).toEqual(initial);
  const last = editor.locator("td").last();
  if (info.project.name === "mobile-webkit") await last.tap();
  else {
    await last.hover({ position: { x: 2, y: 2 } });
    await last.hover();
  }
  const add = page.getByRole("button", { exact: true, name: "Add column" });
  await add.focus();
  await page.keyboard.press("Enter");
  await expect(cells).toHaveCount(9);
  await visibleColumn(8);
  if (info.project.name === "mobile-webkit") await cells.first().tap();
  else {
    await cells.first().hover({ position: { x: 2, y: 2 } });
    await cells.first().hover();
  }
  await page
    .getByRole("button", { exact: true, name: "Column actions" })
    .click();
  await page
    .getByRole("menuitem", { exact: true, name: "Insert column left" })
    .click();
  await menuClosed(page);
  await expect(cells).toHaveCount(10);
  await visibleColumn(0);
  await expect.poll(vertical).toEqual(initial);
  // A merged header must not substitute its entire width for one column.
  await cells.first().click();
  await cells.nth(7).scrollIntoViewIfNeeded();
  await cells.nth(7).click({ modifiers: ["Shift"] });
  await expect(editor.locator(".selectedCell")).toHaveCount(8);
  await page
    .getByRole("button", { exact: true, name: "More formatting" })
    .click();
  await page
    .getByRole("menuitem", { exact: true, name: "Merge cells" })
    .click();
  await menuClosed(page);
  await expect(editor.locator('td[colspan="8"]')).toHaveCount(1);
  const lower = editor.locator("tr").nth(1).locator("td");
  for (const [index, direction] of [
    [6, "right"],
    [1, "left"],
  ] as const) {
    await lower.nth(index).click();
    await page.keyboard.insertText(direction);
    await expect(lower.nth(index)).toHaveText(direction);
    for (let i = 0; i < direction.length; i++)
      await page.keyboard.press("Shift+ArrowLeft");
    const more = page.getByRole("button", {
      exact: true,
      name: "More formatting",
    });
    await expect(more).toHaveAttribute("aria-expanded", "false");
    await more.click();
    const insert = page.getByRole("menuitem", {
      exact: true,
      name: `Insert column ${direction}`,
    });
    await expect(insert).toBeVisible();
    await wrapper.evaluate((element) => {
      element.scrollLeft = 480;
    });
    await insert.click();
    await menuClosed(page);
    await expect(lower).toHaveCount(11);
    const added = lower.nth(direction === "right" ? index + 1 : index);
    await expect
      .poll(() =>
        added.evaluate((cell) => {
          const viewport = cell
            .closest(".better-editor-table-wrapper")
            ?.getBoundingClientRect();
          const rect = cell.getBoundingClientRect();
          return (
            !!viewport &&
            rect.left >= viewport.left - 1 &&
            rect.right <= viewport.right + 1
          );
        }),
      )
      .toBe(true);
    await expect.poll(vertical).toEqual(initial);
    await editor.focus();
    await page.keyboard.press("ControlOrMeta+z");
    await expect(lower).toHaveCount(10);
  }
  await expect(page.locator("[data-save-status]")).toContainText("Saved");
  await page.reload();
  await expect(cells).toHaveCount(3);
  await expect(editor.locator('td[colspan="8"]')).toHaveCount(1);
  await expect(lower).toHaveCount(10);
});

test("table controls stop a pending gesture when the editor becomes read-only", async ({
  page,
}, info) => {
  await page.goto(`/pages/${fixtureId(980)}`);
  const editor = page.locator(".better-editor-tiptap").first();
  const cell = editor.locator("table").first().locator("td,th").last();
  if (info.project.name === "mobile-webkit") await cell.tap();
  else await cell.hover();
  const add = page.getByRole("button", { exact: true, name: "Add column" });
  await expect(add).toBeVisible();
  const before = await editor.evaluate((root) =>
    (root as HTMLElement & { editor: Editor }).editor.state.doc.toJSON(),
  );
  if (info.project.name === "desktop-chromium") {
    const rect = await add.boundingBox();
    if (!rect) throw new Error("Missing column control");
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await page.mouse.down();
  }
  await editor.evaluate((root) =>
    (root as HTMLElement & { editor: Editor }).editor.setEditable(false),
  );
  await expect(add).toHaveCount(0);
  await expect(
    page.getByRole("button", { exact: true, name: "Add block" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { exact: true, name: "Block actions" }),
  ).toHaveCount(0);
  if (info.project.name === "desktop-chromium") await page.mouse.up();
  expect(
    await editor.evaluate((root) =>
      (root as HTMLElement & { editor: Editor }).editor.state.doc.toJSON(),
    ),
  ).toEqual(before);
  await editor.evaluate((root) =>
    (root as HTMLElement & { editor: Editor }).editor.setEditable(true),
  );
  if (info.project.name === "mobile-webkit") await cell.tap();
  else await cell.hover();
  await expect(add).toBeVisible();
});
