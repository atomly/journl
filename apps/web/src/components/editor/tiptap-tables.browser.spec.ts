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
  const editor = page.locator(".journl-tiptap");
  await editor.fill("/table");
  await page.getByRole("option", { exact: true, name: "Table" }).click();
});

test("table edge rails and border menus add, select, delete and undo the intended axes", async ({
  page,
}) => {
  const table = page.locator(".journl-tiptap table");
  const rows = table.locator("tr");
  const id = await table
    .locator("xpath=ancestor::*[@data-block-id]")
    .getAttribute("data-block-id");
  await rows.nth(2).locator("td").nth(2).hover();
  await page.getByRole("button", { exact: true, name: "Add row" }).click();
  await expect(rows).toHaveCount(4);
  await rows.last().locator("td").last().hover();
  await page.getByRole("button", { exact: true, name: "Add column" }).click();
  await expect(rows.first().locator("td")).toHaveCount(4);
  await rows.nth(1).locator("td").nth(1).hover();
  const rowHandle = page.getByRole("button", {
    exact: true,
    name: "Row actions",
  });
  await expect(rowHandle).toHaveAttribute("data-table-index", "1");
  await rowHandle.click();
  await expect(table.locator(".selectedCell")).toHaveCount(4);
  await expect(
    page.getByRole("menuitem", { exact: true, name: "Delete column" }),
  ).toBeHidden();
  await page
    .getByRole("menuitem", { exact: true, name: "Insert row below" })
    .click();
  await expect(rows).toHaveCount(5);
  await rows.nth(1).locator("td").nth(1).hover();
  const columnHandle = page.getByRole("button", {
    exact: true,
    name: "Column actions",
  });
  await expect(columnHandle).toHaveAttribute("data-table-index", "1");
  await columnHandle.click();
  await expect(table.locator(".selectedCell")).toHaveCount(5);
  await page
    .getByRole("menuitem", { exact: true, name: "Delete column" })
    .click();
  await expect(rows.first().locator("td")).toHaveCount(3);
  await expect(page.locator(".journl-tiptap")).toBeFocused();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(rows.first().locator("td")).toHaveCount(4);
  await expect(rows).toHaveCount(5);
  await expect(page.locator("[data-save-status]")).toContainText("Saved");
  await page.reload();
  await expect(rows).toHaveCount(5);
  await expect(
    table.locator("xpath=ancestor::*[@data-block-id]"),
  ).toHaveAttribute("data-block-id", id ?? "");
});

test("row dragging preserves cell contents and an extension drag undoes as one action", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "Native mouse dragging is a desktop interaction",
  );
  const table = page.locator(".journl-tiptap table");
  const rows = table.locator("tr");
  for (let i = 0; i < 3; i++) {
    await rows.nth(i).locator("td").first().click();
    await page.keyboard.insertText(`Row ${i + 1}`);
  }
  await rows.first().locator("td").first().hover();
  const handle = page.getByRole("button", { exact: true, name: "Row actions" });
  await expect(handle).toHaveAttribute("data-table-index", "0");
  await expect
    .poll(async () => {
      const grip = await handle.boundingBox();
      const cell = await rows.first().locator("td").first().boundingBox();
      return grip && cell
        ? Math.abs(grip.y + grip.height / 2 - cell.y - cell.height / 2)
        : Number.POSITIVE_INFINITY;
    })
    .toBeLessThan(2);
  await handle.dragTo(rows.last().locator("td").first());
  await expect(rows.last()).toContainText("Row 1");
  // Give the first column a distinct width before moving it.
  const first = rows.first().locator("td").first();
  const firstBox = await first.boundingBox();
  if (!firstBox) throw new Error("Missing first cell");
  await page.mouse.move(
    firstBox.x + firstBox.width - 1,
    firstBox.y + firstBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    firstBox.x + firstBox.width + 49,
    firstBox.y + firstBox.height / 2,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect
    .poll(async () => (await first.boundingBox())?.width ?? 0)
    .toBeGreaterThan(firstBox.width + 20);
  const width = (await first.boundingBox())?.width ?? 0;
  await first.hover();
  const column = page.getByRole("button", {
    exact: true,
    name: "Column actions",
  });
  await expect(column).toHaveAttribute("data-table-index", "0");
  await expect
    .poll(async () => {
      const grip = await column.boundingBox();
      const cell = await first.boundingBox();
      return grip && cell
        ? Math.abs(grip.x + grip.width / 2 - cell.x - cell.width / 2)
        : Number.POSITIVE_INFINITY;
    })
    .toBeLessThan(2);
  await column.dragTo(rows.first().locator("td").last());
  await expect(rows.last().locator("td").last()).toContainText("Row 1");
  await expect
    .poll(
      async () =>
        (await rows.first().locator("td").last().boundingBox())?.width ?? 0,
    )
    .toBeCloseTo(width, 0);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(rows.last().locator("td").first()).toContainText("Row 1");
  await rows.last().locator("td").last().hover();
  const rail = page.getByRole("button", { exact: true, name: "Add row" });
  // Wait for Floating UI to position the rail before taking gesture coordinates.
  await rail.hover();
  const box = await rail.boundingBox();
  if (!box) throw new Error("Missing table extension rail");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 90, { steps: 12 });
  await page.mouse.up();
  await expect.poll(() => rows.count()).toBeGreaterThan(3);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(rows).toHaveCount(3);
  await expect(rows.last()).toContainText("Row 1");
});

test("scrolled table gutters resolve drops and extension gestures cancel cleanly", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "Native mouse dragging is a desktop interaction",
  );
  const editor = page.locator(".journl-tiptap");
  const table = editor.locator("table");
  const rows = table.locator("tr");
  const wrapper = editor.locator(".journl-table-wrapper");
  const hoverRightEdge = async () => {
    await wrapper.evaluate(async (el) => {
      el.scrollLeft = el.scrollWidth;
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
    });
    // Scroll hides handles. Move deliberately even when the new last cell's
    // center occupies the same screen position as the previous last cell.
    const cell = rows.last().locator("td").last();
    await cell.hover({ position: { x: 2, y: 2 } });
    await cell.hover();
  };
  for (let i = 0; i < 3; i++) {
    await rows.nth(i).locator("td").first().click();
    await page.keyboard.insertText(`Row ${i + 1}`);
  }
  for (let c = 3; c < 8; c++) {
    await hoverRightEdge();
    await page.getByRole("button", { exact: true, name: "Add column" }).click();
    await expect(rows.first().locator("td")).toHaveCount(c + 1);
  }
  await rows.last().locator("td").last().click();
  await wrapper.evaluate((el) => {
    el.scrollLeft = 0;
  });
  const columnRail = page.getByRole("button", {
    exact: true,
    name: "Add column",
  });
  await expect(columnRail).toBeHidden();
  await hoverRightEdge();
  await expect(columnRail).toBeVisible();
  await rows.first().locator("td").last().hover();
  const handle = page.getByRole("button", { exact: true, name: "Row actions" });
  await expect(handle).toHaveAttribute("data-table-index", "0");
  await expect
    .poll(async () => {
      const grip = await handle.boundingBox();
      const row = await rows.first().boundingBox();
      return grip && row
        ? Math.abs(grip.y + grip.height / 2 - row.y - row.height / 2)
        : Number.POSITIVE_INFINITY;
    })
    .toBeLessThan(2);
  const grip = await handle.boundingBox();
  const middle = await rows.nth(1).locator("td").last().boundingBox();
  const last = await rows.last().boundingBox();
  if (!grip || !middle || !last) throw new Error("Missing table drag geometry");
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    grip.x + grip.width / 2 + 8,
    grip.y + grip.height / 2 + 8,
    { steps: 4 },
  );
  await page.mouse.move(
    middle.x + middle.width / 2,
    middle.y + middle.height / 2,
    { steps: 8 },
  );
  await page.mouse.move(grip.x + grip.width / 2, last.y + last.height / 2, {
    steps: 8,
  });
  await page.mouse.up();
  await expect(rows.last()).toContainText("Row 1");
  await page.keyboard.press("ControlOrMeta+z");
  await expect(rows.first()).toContainText("Row 1");
  const extend = async () => {
    await hoverRightEdge();
    const rail = page.getByRole("button", { exact: true, name: "Add row" });
    await rail.hover();
    const box = await rail.boundingBox();
    if (!box) throw new Error("Missing extension rail");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + 85, { steps: 10 });
    await expect.poll(() => rows.count()).toBeGreaterThan(3);
  };
  await extend();
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(rows).toHaveCount(3);
  await extend();
  await page.keyboard.press("ControlOrMeta+z");
  await page.mouse.up();
  await expect(rows).toHaveCount(3);
  await extend();
  const extendedCount = await rows.count();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Backspace");
  await expect(table).toHaveCount(0);
  await page.mouse.up();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(table).toHaveCount(1);
  await hoverRightEdge();
  await page.getByRole("button", { exact: true, name: "Add row" }).click();
  await expect(rows).toHaveCount(extendedCount + 1);
});

test("merged cells and outer gutters keep the table extension rails reachable", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "Cell range selection uses Shift-click",
  );
  const table = page.locator(".journl-tiptap table");
  const rows = table.locator("tr");
  await rows.first().locator("td").first().click();
  await rows
    .last()
    .locator("td")
    .last()
    .click({ modifiers: ["Shift"] });
  await expect(table.locator(".selectedCell")).toHaveCount(9);
  await page
    .getByRole("button", { exact: true, name: "More formatting" })
    .click();
  await page
    .getByRole("menuitem", { exact: true, name: "Merge cells" })
    .click();
  const merged = table.locator('td[colspan="3"][rowspan="3"]');
  await expect(merged).toHaveCount(1);
  await merged.hover();
  await expect(
    page.getByRole("button", { exact: true, name: "Add row" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { exact: true, name: "Add column" }),
  ).toBeVisible();
  await page.getByRole("button", { exact: true, name: "Add row" }).click();
  await expect(rows).toHaveCount(4);
  await merged.click();
  await expect(page.locator(".journl-tiptap")).toBeFocused();
  const box = await table.boundingBox();
  if (!box) throw new Error("Missing table geometry");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height + 8);
  await expect(
    page.getByRole("button", { exact: true, name: "Add row" }),
  ).toBeVisible();
  await page.mouse.move(box.x + box.width + 8, box.y + box.height / 2);
  await page.getByRole("button", { exact: true, name: "Add column" }).click();
  await expect(rows.last().locator("td")).toHaveCount(4);
  await expect(merged).toHaveCount(1);
});
