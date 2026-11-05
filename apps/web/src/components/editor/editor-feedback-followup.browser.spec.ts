import {
  expect,
  selectEditorText,
  test,
  typeParagraphs,
} from "~/testing/browser/fixtures";

test.use({ journalPagination: true });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // Model HTTP LAN origins without depending on the browser's secure loopback exception.
    Object.defineProperty(crypto, "randomUUID", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    document.execCommand = (command) => {
      if (command !== "copy") return false;
      (window as Window & { copiedBlockUrl?: string }).copiedBlockUrl = (
        document.activeElement as HTMLTextAreaElement
      ).value;
      return true;
    };
  });
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
});

test("rich conversation HTML keeps sibling blocks and only authored list nesting", async ({
  page,
}) => {
  const editor = page.locator(".better-editor-tiptap");
  await editor.fill("");
  await editor.evaluate((element) => {
    const data = new DataTransfer();
    data.setData(
      "text/html",
      "<div><h2>Recipe</h2><p>Duration</p><p>Servings</p><h3>Ingredients</h3><ul><li>First<ul><li>Nested</li></ul></li><li>Second</li></ul><p>Instructions</p></div>",
    );
    data.setData(
      "text/plain",
      "Recipe\nDuration\nServings\nIngredients\n- First\n  - Nested\n- Second\nInstructions",
    );
    element.dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: data,
      }),
    );
  });
  await expect(editor.locator(":scope > [data-block-id]")).toHaveCount(7);
  await expect(editor.locator("[data-better-editor-children]")).toHaveCount(1);
  await expect(
    editor.locator("[data-better-editor-children] [data-better-editor-body]"),
  ).toHaveText("Nested");
  await expect(page.locator("[data-save-status]")).toContainText("Saved");
  await page.reload();
  await expect(editor.locator(":scope > [data-block-id]")).toHaveCount(7);
  await expect(editor.locator("[data-better-editor-children]")).toHaveCount(1);
});

test("HTTP editing and copy work, More actions has no formatting duplicates, and block choices scroll", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const editor = page.locator(".better-editor-tiptap");
  await typeParagraphs(editor, ["Alpha", "Beta"]);
  await expect(
    editor.locator('[data-better-editor-body="paragraph"]'),
  ).toHaveText(["Alpha", "Beta"]);
  const firstId = await editor
    .locator("[data-block-id]")
    .first()
    .getAttribute("data-block-id");
  await selectEditorText(editor);
  await page.keyboard.press("Alt+F10");
  await page
    .getByRole("button", { exact: true, name: "Copy block link" })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as Window & { copiedBlockUrl?: string }).copiedBlockUrl,
      ),
    )
    .toContain(`#block=${firstId}`);
  await editor.press("ArrowRight");
  if (info.project.name === "desktop-chromium") {
    await page
      .getByRole("button", { exact: true, name: "Insert link" })
      .hover();
    await expect(
      page.getByRole("tooltip", {
        exact: true,
        name: "Insert link or reference",
      }),
    ).toBeVisible();
  }
  await page.getByRole("button", { exact: true, name: "More actions" }).click();
  for (const name of [
    "Turn into",
    "Indent",
    "Outdent",
    "Copy block link",
    "Display as",
  ])
    await expect(page.getByRole("menuitem", { exact: true, name })).toHaveCount(
      0,
    );
  await expect(
    page.getByRole("menuitem", { exact: true, name: "Duplicate block" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Alt+F10");
  await page.getByRole("combobox", { exact: true, name: "Block type" }).click();
  const popup = page.locator('[data-slot="select-content"]');
  const size = await popup.evaluate((element) => ({
    content: element.scrollHeight,
    height: element.clientHeight,
    overflow: getComputedStyle(element).overflowY,
  }));
  expect(size.height).toBeLessThanOrEqual(322);
  expect(size.content).toBeGreaterThan(size.height);
  expect(size.overflow).toBe("auto");
  await page.keyboard.press("Escape");
  expect(errors).toEqual([]);
});

test("table actions are grouped, hide empty conversion menus, and delete selected rows or the table", async ({
  page,
}) => {
  const editor = page.locator(".better-editor-tiptap");
  await editor.fill("/table");
  await page.getByRole("option", { exact: true, name: "Table" }).click();
  const table = editor.locator("table");
  await table.locator("td").first().click();
  await page.keyboard.press("Alt+F10");
  await page.getByRole("button", { exact: true, name: "More actions" }).click();
  await expect(
    page.getByRole("menuitem", { exact: true, name: "Turn into" }),
  ).toHaveCount(0);
  for (const name of ["Rows", "Columns", "Cells", "Headers"])
    await expect(
      page.getByRole("menuitem", { exact: true, name }),
    ).toBeVisible();
  await page.getByRole("menuitem", { exact: true, name: "Rows" }).focus();
  await page.keyboard.press("ArrowRight");
  await page.getByRole("menuitem", { exact: true, name: "Select row" }).click();
  await expect(table.locator(".selectedCell")).toHaveCount(3);
  await page.keyboard.press("Alt+F10");
  await page.getByRole("button", { exact: true, name: "More actions" }).click();
  await page
    .getByRole("menuitem", { exact: true, name: "Delete selected rows" })
    .click();
  await expect(table.locator("tr")).toHaveCount(2);
  await page.keyboard.press("Alt+F10");
  await page.getByRole("button", { exact: true, name: "More actions" }).click();
  await page
    .getByRole("menuitem", { exact: true, name: "Delete table" })
    .click();
  await expect(table).toHaveCount(0);
  await expect(editor.locator("[data-block-id]")).toHaveCount(1);
});
