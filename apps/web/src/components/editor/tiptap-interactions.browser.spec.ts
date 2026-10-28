import {
  expect,
  selectEditorText,
  test,
  typeParagraphs,
} from "~/testing/browser/fixtures";

test.use({ journalPagination: true });
test.beforeEach(async ({ page }) => {
  // Each acceptance case owns a real page instead of overwriting shared codec fixtures.
  await page.goto("/journal");
  const create = page.getByRole("button", { exact: true, name: "New page" });
  if (!(await create.isVisible()))
    await page
      .getByRole("button", { exact: true, name: "Toggle Sidebar" })
      .click();
  const previous = page.url();
  await create.click();
  await expect(page).not.toHaveURL(previous, { timeout: 60000 });
  await page.keyboard.press("Escape");
  await expect(page.locator(".better-editor-tiptap")).toBeVisible();
});

test("selected blocks indent together and a child handle remains stable across its gutter", async ({
  page,
}) => {
  const editor = page.locator(".better-editor-tiptap");
  await typeParagraphs(editor, ["Parent", "First", "Second"]);
  const roots = editor.locator(":scope > [data-block-id]");
  const ids = await roots.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-block-id")),
  );
  await editor.evaluate(async (root) => {
    const rows = [...root.querySelectorAll("[data-better-editor-body]")];
    const first = rows[1]?.firstChild;
    const last = rows[2]?.firstChild;
    if (!first || !last) throw new Error("Selection rows missing");
    getSelection()?.setBaseAndExtent(
      first,
      0,
      last,
      last.textContent?.length ?? 0,
    );
    document.dispatchEvent(new Event("selectionchange"));
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
  });
  await expect(
    page.getByRole("toolbar", { name: "Editor controls" }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(roots).toHaveCount(1);
  await expect(roots.first().locator("[data-block-id]")).toHaveCount(2);
  await page.keyboard.press("Shift+Tab");
  await expect(roots).toHaveCount(3);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(roots).toHaveCount(1);
  const child = editor.locator(
    `[data-block-id="${ids[2]}"] [data-better-editor-body]`,
  );
  // Undo restores the multi-block selection. Place a caret before testing a
  // single-block handle; clicking a selected group intentionally retains it.
  await child.click();
  await child.hover();
  const rect = await child.boundingBox();
  if (!rect) throw new Error("Child row missing");
  await page.mouse.move(rect.x - 16, rect.y + 12);
  const handle = page.getByRole("button", {
    exact: true,
    name: "Block actions",
  });
  await expect(handle).toBeVisible();
  expect((await handle.boundingBox())?.width).toBeGreaterThanOrEqual(28);
  await handle.click();
  await expect(editor.locator(`[data-block-id="${ids[2]}"]`)).toHaveClass(
    /ProseMirror-selectednode/,
  );
  const duplicate = page.getByRole("menuitem", {
    exact: true,
    name: "Duplicate block",
  });
  await duplicate.hover();
  await expect(page.getByRole("tooltip")).toContainText("Duplicate");
  await expect(
    page.getByRole("menuitem", { exact: true, name: "Undo" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-save-status]")).toContainText("Saved");
  await page.reload();
  await expect(
    editor.locator(`[data-block-id="${ids[0]}"] [data-block-id]`),
  ).toHaveCount(2);
});

test("select-all text keeps formatting controls available and saves their changes", async ({
  page,
}) => {
  const editor = page.locator(".better-editor-tiptap");
  await typeParagraphs(editor, ["First paragraph", "Second paragraph"]);
  await selectEditorText(editor);
  const colors = page.getByRole("button", { exact: true, name: "Colors" });
  await expect(colors).toBeEnabled();
  await colors.click();
  await page.getByRole("button", { exact: true, name: "Text purple" }).click();
  await expect(
    editor.locator('[style*="--better-editor-text-purple"]'),
  ).toHaveCount(2);
  await selectEditorText(editor);
  await page.getByRole("button", { exact: true, name: "Bold" }).click();
  await expect(editor.locator("strong")).toHaveText([
    "First paragraph",
    "Second paragraph",
  ]);
  await expect(page.locator("[data-save-status]")).toContainText("Saved");
  await page.reload();
  await expect(editor.locator("strong")).toHaveText([
    "First paragraph",
    "Second paragraph",
  ]);
  await expect(
    editor.locator('[style*="--better-editor-text-purple"]'),
  ).toHaveCount(2);
});

test("tables are discoverable and row/column edits save on the actual route", async ({
  page,
}) => {
  const editor = page.locator(".better-editor-tiptap");
  await editor.fill("/table");
  await page.getByRole("option", { exact: true, name: "Table" }).click();
  const table = editor.locator("table");
  await expect(table.locator("tr")).toHaveCount(3);
  await expect(table.locator("tr").first().locator("td")).toHaveCount(3);
  await table.locator("td").first().hover();
  await page
    .getByRole("button", { exact: true, name: "Block actions" })
    .click();
  await page
    .getByRole("menuitem", { exact: true, name: "Insert row below" })
    .click();
  await expect(table.locator("tr")).toHaveCount(4);
  await table.locator("td").first().hover();
  await page
    .getByRole("button", { exact: true, name: "Block actions" })
    .click();
  await page
    .getByRole("menuitem", { exact: true, name: "Insert column right" })
    .click();
  await expect(table.locator("tr").first().locator("td")).toHaveCount(4);
  const wrapper = editor.locator(".better-editor-table-wrapper");
  await wrapper.evaluate(async (element) => {
    element.scrollLeft = element.scrollWidth;
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
  });
  const last = table.locator("td").last();
  await last.hover({ position: { x: 2, y: 2 } });
  await last.hover();
  const rowHandle = page.getByRole("button", {
    exact: true,
    name: "Row actions",
  });
  const columnRail = page.getByRole("button", {
    exact: true,
    name: "Add column",
  });
  await expect(rowHandle).toBeVisible();
  await expect(columnRail).toBeVisible();
  await expect
    .poll(async () => {
      const row = await rowHandle.boundingBox();
      const rail = await columnRail.boundingBox();
      return row && rail
        ? row.x - rail.x - rail.width
        : Number.NEGATIVE_INFINITY;
    })
    .toBeGreaterThanOrEqual(1);
  await rowHandle.click();
  await expect(
    page.getByRole("menuitem", { exact: true, name: "Insert row below" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-save-status]")).toContainText("Saved");
  await page.reload();
  await expect(table.locator("tr")).toHaveCount(4);
  await expect(table.locator("tr").first().locator("td")).toHaveCount(4);
});

test("a plain link exposes consistent display choices and converts to a card", async ({
  page,
}) => {
  const editor = page.locator(".better-editor-tiptap");
  await typeParagraphs(editor, ["Example link"]);
  await selectEditorText(editor);
  await page.keyboard.press("ControlOrMeta+k");
  await page
    .getByRole("textbox", { name: "Reference URL" })
    .fill("https://example.com");
  await page.getByRole("button", { exact: true, name: "Apply link" }).click();
  await editor.locator("a[data-better-editor-link]").click();
  await page.getByRole("button", { exact: true, name: "Display as" }).click();
  await expect(
    page.getByRole("menuitem", { exact: true, name: "Mention" }),
  ).toBeVisible();
  await expect(
    page.getByRole("menuitem", { exact: true, name: "Embedded content" }),
  ).toBeHidden();
  await page.getByRole("menuitem", { exact: true, name: "Card" }).click();
  await expect(editor.locator(".content-reference-card")).toBeVisible();
  await expect(page.locator("[data-save-status]")).toContainText("Saved");
  await page.reload();
  await expect(editor.locator(".content-reference-card")).toBeVisible();
});

test("native handle drag moves nested blocks and copies receive fresh identities", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "Native mouse drag is a desktop interaction",
  );
  const editor = page.locator(".better-editor-tiptap");
  await editor.fill("Parent move");
  await page.keyboard.press("Enter");
  await page.keyboard.insertText("Child move");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.insertText("Last root");
  const roots = editor.locator(":scope > [data-block-id]");
  await expect(roots).toHaveCount(2);
  const parentId = await roots.first().getAttribute("data-block-id");
  const childId = await roots
    .first()
    .locator("[data-block-id]")
    .getAttribute("data-block-id");
  const lastId = await roots.last().getAttribute("data-block-id");
  const copyModifier = (await page.evaluate(() =>
    /Mac/.test(navigator.platform),
  ))
    ? "Alt"
    : "Control";
  const drag = async (copy: boolean) => {
    const source = copy ? roots.last() : roots.first();
    const target = copy ? roots.first() : roots.last();
    await source.locator("[data-better-editor-body]").first().hover();
    const handle = await page
      .getByRole("button", { exact: true, name: "Block actions" })
      .boundingBox();
    const end = await target.boundingBox();
    if (!handle || !end) throw new Error("Drag surface unavailable");
    if (copy) await page.keyboard.down(copyModifier);
    await page.mouse.move(
      handle.x + handle.width / 2,
      handle.y + handle.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      handle.x + handle.width / 2 + 10,
      handle.y + handle.height / 2 + 10,
      { steps: 4 },
    );
    await page.mouse.move(end.x + 100, end.y + end.height - 2, { steps: 15 });
    await page.mouse.up();
    if (copy) await page.keyboard.up(copyModifier);
  };
  await drag(false);
  await expect(roots.first()).toHaveAttribute("data-block-id", lastId ?? "");
  await expect(roots.last()).toHaveAttribute("data-block-id", parentId ?? "");
  await expect(roots.last().locator("[data-block-id]")).toHaveAttribute(
    "data-block-id",
    childId ?? "",
  );
  await drag(true);
  await expect(roots).toHaveCount(3);
  const ids = await editor
    .locator("[data-block-id]")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-block-id")),
    );
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids).toContain(parentId);
  expect(ids).toContain(childId);
  await expect(page.locator("[data-save-status]")).toContainText("Saved");
  await page.reload();
  await expect(roots).toHaveCount(3);
});
