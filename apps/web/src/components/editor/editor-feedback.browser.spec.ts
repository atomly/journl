import { expect, test } from "~/testing/browser/fixtures";

test.use({ journalPagination: true });
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "journl-editor", url: "http://127.0.0.1:3100", value: "tiptap" },
  ]);
});

test("selected lists convert together, typing dismisses handles and plain copy keeps list markers", async ({
  page,
  context,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "Desktop pointer and clipboard acceptance",
  );
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/journal");
  await page.getByRole("button", { exact: true, name: "New page" }).click();
  await expect(page).toHaveURL(/\/pages\//);
  await page.keyboard.press("Escape");
  const editor = page.locator(".journl-tiptap");
  await editor.pressSequentially("- One");
  await editor.press("Enter");
  await editor.pressSequentially("Two");
  const rows = editor.locator('[data-journl-body="bulletListItem"]');
  await expect(rows).toHaveCount(2);
  await editor.evaluate(async (root) => {
    const rows = root.querySelectorAll('[data-journl-body="bulletListItem"]');
    const first = rows[0]?.firstChild;
    const last = rows[1]?.firstChild;
    if (!first || !last) throw new Error("Missing selected list fixture");
    getSelection()?.setBaseAndExtent(
      first,
      0,
      last,
      last.textContent?.length ?? 0,
    );
    document.dispatchEvent(new Event("selectionchange"));
    await new Promise(requestAnimationFrame);
  });
  await page.getByRole("combobox", { exact: true, name: "Block type" }).click();
  await expect(
    page.getByRole("option", { exact: true, name: "Table" }),
  ).toHaveCount(0);
  await page
    .getByRole("option", { exact: true, name: "Numbered list" })
    .click();
  await expect(
    editor.locator('[data-journl-body="numberedListItem"]'),
  ).toHaveCount(2);
  await editor.press("ControlOrMeta+c");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(
    /1\. One[\s\S]*2\. Two/,
  );
  await editor.locator("[data-journl-body]").last().hover();
  const handle = page.getByRole("button", {
    exact: true,
    name: "Block actions",
  });
  await expect(handle).toBeVisible();
  await editor.press("ArrowRight");
  await editor.pressSequentially("More");
  await expect(handle).toHaveCount(0);
  await editor.locator("[data-journl-body]").first().hover();
  await expect(handle).toBeVisible();
});

test("converting a journal entry keeps its block identity and leaves an expandable page reference", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    // WebKit can cancel Next's dev-overlay symbolication during reload.
    // Keep application errors; this endpoint and stack belong to devtools only.
    if (
      error.message.includes("/__nextjs_original-stack-frames") &&
      error.stack?.includes("next-devtools")
    )
      return;
    errors.push(error.message);
  });
  // Both projects use the same owner/database. Conversion consumes the entry,
  // so each browser needs its own source date.
  const date = `1988-08-${info.project.name === "desktop-chromium" ? "24" : "25"}`;
  await page.goto(`/journal/${date}`);
  const editor = page.locator(".journl-tiptap").first();
  await editor.fill("Entry to move");
  const paragraphs = editor.locator('[data-journl-body="paragraph"]');
  await expect(paragraphs).toHaveCount(1);
  await expect(paragraphs.first()).toHaveText("Entry to move");
  await editor.press("Enter");
  await expect(paragraphs).toHaveCount(2);
  await editor.pressSequentially("Nested writing");
  await expect(paragraphs.last()).toHaveText("Nested writing");
  await editor.press("Tab");
  await expect(paragraphs.first()).toHaveText("Entry to move");
  await expect(
    editor.locator('[data-journl-children] [data-journl-body="paragraph"]'),
  ).toHaveText("Nested writing");
  await expect(page.locator("[data-save-status]")).toContainText("Saved");
  const ids = await editor
    .locator("[data-block-id]")
    .evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLElement).dataset.blockId),
    );
  await page
    .getByRole("button", { exact: true, name: "Convert entry to page" })
    .click();
  await page
    .getByRole("textbox", { exact: true, name: "Page title" })
    .fill("Moved journal entry");
  await page
    .getByRole("button", { exact: true, name: "Convert to page" })
    .click();
  await expect(page).toHaveURL(/\/pages\//);
  await expect(editor).toContainText("Nested writing");
  expect(
    await editor
      .locator("[data-block-id]")
      .evaluateAll((nodes) =>
        nodes.map((node) => (node as HTMLElement).dataset.blockId),
      ),
  ).toEqual(ids);
  const pagePath = new URL(page.url()).pathname;
  await page.goto(`/journal/${date}`);
  await expect(
    editor.locator(".content-reference-card-heading a"),
  ).toHaveAttribute("href", pagePath);
  await page
    .getByRole("button", { exact: true, name: "Reference actions" })
    .click();
  await page
    .getByRole("menuitem", { exact: true, name: "Embedded content" })
    .click();
  await editor.locator(".content-embed-toggle").click();
  await expect(editor.locator(".content-embed-content")).toContainText(
    "Nested writing",
  );
  await expect(page.locator("[data-save-status]")).toContainText("Saved");
  await page.reload();
  await expect(editor.locator(".content-embed")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("new tables accept immediate typing and typing hides controls over another cell", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "Desktop parked-pointer acceptance",
  );
  await page.goto("/journal");
  await page.getByRole("button", { exact: true, name: "New page" }).click();
  await expect(page).toHaveURL(/\/pages\//);
  await page.keyboard.press("Escape");
  const editor = page.locator(".journl-tiptap");
  await editor.fill("/table");
  await page.getByRole("option", { exact: true, name: "Table" }).click();
  const cells = editor.locator("td");
  await expect(cells).toHaveCount(9);
  await cells.first().click();
  await page.keyboard.type("First");
  await expect(cells).toHaveCount(9);
  await cells.last().hover();
  await expect(
    page.getByRole("button", { exact: true, name: "Row actions" }),
  ).toBeVisible();
  await page.keyboard.type(" typed");
  await expect(
    page.getByRole("button", { exact: true, name: "Row actions" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { exact: true, name: "Column actions" }),
  ).toHaveCount(0);
  await expect(cells.first()).toContainText("First typed");
});
