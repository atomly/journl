import { expect, test } from "~/testing/browser/fixtures";

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
  await expect(page).not.toHaveURL(previous);
  await page.keyboard.press("Escape");
  const editor = page.locator(".better-editor-tiptap");
  await editor.fill("/table");
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
  await expect(cells).toHaveCount(10);
  await visibleColumn(0);
  await expect.poll(vertical).toEqual(initial);
  // A merged header must not substitute its entire width for one column.
  await cells.first().click();
  await cells.nth(7).click({ modifiers: ["Shift"] });
  await expect(editor.locator(".selectedCell")).toHaveCount(8);
  await page
    .getByRole("button", { exact: true, name: "More formatting" })
    .click();
  await page
    .getByRole("menuitem", { exact: true, name: "Merge cells" })
    .click();
  await expect(editor.locator('td[colspan="8"]')).toHaveCount(1);
  const lower = editor.locator("tr").nth(1).locator("td");
  for (const [index, direction] of [
    [6, "right"],
    [1, "left"],
  ] as const) {
    await lower.nth(index).click();
    await page.keyboard.insertText(direction);
    for (let i = 0; i < direction.length; i++)
      await page.keyboard.press("Shift+ArrowLeft");
    await page
      .getByRole("button", { exact: true, name: "More formatting" })
      .click();
    await wrapper.evaluate((element) => {
      element.scrollLeft = 480;
    });
    await page
      .getByRole("menuitem", {
        exact: true,
        name: `Insert column ${direction}`,
      })
      .click();
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
