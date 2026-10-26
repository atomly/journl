import { expect, test } from "~/testing/browser/fixtures";

test("handle menu opens once, add picker leaves no slash, and divider needs no space", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "Desktop pointer controls",
  );
  await page.goto("/journal");
  await page.getByRole("button", { exact: true, name: "New page" }).click();
  await expect(page).toHaveURL(/\/pages\//);
  await page.keyboard.press("Escape");
  const editor = page.locator(".better-editor-tiptap");
  const body = editor.locator("[data-better-editor-body]").first();
  await body.hover();
  await page
    .getByRole("button", { exact: true, name: "Block actions" })
    .click();
  await expect(
    page.getByRole("menuitem", { exact: true, name: "Duplicate block" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await body.hover();
  await page.getByRole("button", { exact: true, name: "Add block" }).click();
  await expect(
    page.getByRole("listbox", { name: "Block commands" }),
  ).toBeVisible();
  await expect(editor.locator("[data-block-id]")).toHaveCount(1);
  await expect(body).toHaveText("");
  await page.keyboard.press("Escape");
  await expect(body).toHaveText("");
  await editor.click();
  await editor.pressSequentially("---");
  await expect(editor.locator("hr")).toHaveCount(1);
  await editor.pressSequentially("After divider");
  await expect(
    editor.locator('[data-better-editor-body="paragraph"]'),
  ).toHaveText("After divider");
});

test("code language picker produces visible colors and survives save/reload", async ({
  page,
}, info) => {
  await page.goto(
    `/journal/1988-08-${info.project.name === "desktop-chromium" ? "26" : "29"}`,
  );
  const editor = page.locator(".better-editor-tiptap").first();
  await editor.pressSequentially("```javascript ");
  await editor.pressSequentially("console.log('hello world');");
  await editor.press("Enter");
  await editor.pressSequentially("const foo = 'bar';");
  const language = editor.getByRole("combobox", { name: "Code language" });
  await expect(language.locator('[data-slot="select-value"]')).toHaveText(
    "javascript",
  );
  const keyword = editor.locator(".hljs-keyword");
  await expect(keyword).toHaveText("const");
  const colors = await keyword.evaluate((element) => ({
    code: getComputedStyle(element.closest("code") as HTMLElement).color,
    keyword: getComputedStyle(element).color,
  }));
  expect(colors.keyword).not.toBe(colors.code);
  await language.click();
  await page.getByRole("option", { exact: true, name: "Plain text" }).click();
  await expect(keyword).toHaveCount(0);
  await language.click();
  await page.getByRole("option", { exact: true, name: "javascript" }).click();
  await expect(keyword).toHaveText("const");
  await expect(page.locator("[data-save-status]")).toContainText("Saved");
  await page.reload();
  await expect(language.locator('[data-slot="select-value"]')).toHaveText(
    "javascript",
  );
  await expect(keyword).toHaveText("const");
});

test("pasting a plain multiline list creates nested list blocks", async ({
  page,
  context,
}, info) => {
  test.skip(info.project.name !== "desktop-chromium", "Desktop clipboard API");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/journal/1988-08-27");
  const editor = page.locator(".better-editor-tiptap").first();
  await editor.click();
  await page.evaluate(() =>
    navigator.clipboard.writeText("- First **bold**\n  - Child\n- Second"),
  );
  await editor.press("ControlOrMeta+v");
  await expect(
    editor.locator('[data-better-editor-body="bulletListItem"]'),
  ).toHaveCount(3);
  await expect(
    editor.locator(
      '[data-better-editor-children] [data-better-editor-body="bulletListItem"]',
    ),
  ).toHaveText("Child");
  await expect(editor.locator("strong")).toHaveText("bold");
  await expect(page.locator("[data-save-status]")).toContainText("Saved");
  await page.reload();
  await expect(
    editor.locator('[data-better-editor-body="bulletListItem"]'),
  ).toHaveCount(3);
});

test("reference selection highlights its own frame and native handles still move blocks", async ({
  page,
  context,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "Desktop drag and clipboard acceptance",
  );
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/journal");
  await page.getByRole("button", { exact: true, name: "New page" }).click();
  await expect(page).toHaveURL(/\/pages\//);
  await page.keyboard.press("Escape");
  const editor = page.locator(".better-editor-tiptap");
  await editor.click();
  await editor.pressSequentially("First");
  await editor.press("Enter");
  await editor.pressSequentially("Second");
  await editor.press("Enter");
  await editor.pressSequentially("Third");
  const rows = editor.locator("[data-better-editor-body]");
  await rows.first().hover();
  const handle = page.getByRole("button", {
    exact: true,
    name: "Block actions",
  });
  await handle.dragTo(rows.last(), { targetPosition: { x: 40, y: 22 } });
  await expect(rows.first()).not.toHaveText("First");
  await expect(page.locator("[data-save-status]")).toContainText("Saved");
  const targetUrl = page.url();
  await page.getByRole("button", { exact: true, name: "New page" }).click();
  await expect(page).not.toHaveURL(targetUrl);
  await page.keyboard.press("Escape");
  await editor.click();
  await page.evaluate((url) => navigator.clipboard.writeText(url), targetUrl);
  await editor.press("ControlOrMeta+v");
  const card = editor.locator(".content-reference-card");
  await expect(card).toBeVisible();
  await card.hover();
  await handle.click();
  await expect(editor.locator("[data-reference-selected]")).toHaveCount(1);
  expect(
    await card.evaluate((element) => getComputedStyle(element).boxShadow),
  ).not.toBe("none");
  await page.keyboard.press("Escape");
  await card.getByRole("button", { name: "Reference actions" }).click();
  await page
    .getByRole("menuitem", { exact: true, name: "Embedded content" })
    .click();
  const embed = editor.locator(".content-embed");
  await expect(embed).toBeVisible();
  await embed.hover();
  await handle.click();
  expect(
    await embed.evaluate((element) => getComputedStyle(element).boxShadow),
  ).not.toBe("none");
});

test("mobile handles stay compact and anchored through scroll and viewport resize", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile-webkit", "Touch handle acceptance");
  await page.goto("/journal/1988-08-28");
  const editor = page.locator(".better-editor-tiptap").first();
  await editor.fill(
    Array.from({ length: 40 }, (_, i) => `Line ${i}`).join("\n"),
  );
  const body = editor.locator("[data-better-editor-body]").first();
  await body.tap({ position: { x: 20, y: 12 } });
  const handle = page.getByRole("button", {
    exact: true,
    name: "Block actions",
  });
  const add = page.getByRole("button", { exact: true, name: "Add block" });
  const anchored = async () => {
    await expect(handle).toBeVisible();
    await expect(add).toHaveCount(0);
    await expect
      .poll(async () => {
        const grip = await handle.boundingBox();
        const row = await body.boundingBox();
        return grip && row
          ? Math.abs(grip.y + grip.height / 2 - row.y - 15)
          : Number.POSITIVE_INFINITY;
      })
      .toBeLessThan(3);
    const bounds = await handle.boundingBox();
    expect(bounds?.width).toBeGreaterThanOrEqual(44);
    expect(bounds?.height).toBeGreaterThanOrEqual(44);
  };
  await anchored();
  // Move the real scroll ancestor, rather than synthesizing a scroll event.
  await body.evaluate((element) => {
    const top = element.getBoundingClientRect().top;
    for (
      let parent = element.parentElement;
      parent;
      parent = parent.parentElement
    ) {
      if (
        parent.scrollHeight > parent.clientHeight &&
        /auto|scroll/.test(getComputedStyle(parent).overflowY)
      ) {
        parent.scrollTop += Math.min(32, Math.max(0, top - 100));
        break;
      }
    }
  });
  await anchored();
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Missing mobile viewport");
  await page.setViewportSize({ height: 480, width: viewport.width });
  await anchored();
  await handle.tap();
  await expect(
    page.getByRole("menuitem", { exact: true, name: "Duplicate block" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
});

test("crossing the toolbar gap keeps the handle on its block and leaving releases it", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "Pointer corridor acceptance",
  );
  await page.goto("/journal");
  await page.getByRole("button", { exact: true, name: "New page" }).click();
  await expect(page).toHaveURL(/\/pages\//);
  await page.keyboard.press("Escape");
  const editor = page.locator(".better-editor-tiptap");
  await editor.click();
  await editor.pressSequentially("Previous block");
  await editor.press("Enter");
  await editor.pressSequentially("Selected block");
  const rows = editor.locator('[data-better-editor-body="paragraph"]');
  await rows.last().evaluate(async (element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    getSelection()?.removeAllRanges();
    getSelection()?.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
    await new Promise(requestAnimationFrame);
  });
  const toolbar = page.getByRole("toolbar", { name: "Editor controls" });
  await expect(toolbar).toBeVisible();
  await rows.last().hover();
  const handle = page.locator("[data-tiptap-side-menu]");
  const before = await handle.boundingBox();
  const target = await rows.last().boundingBox();
  const menu = await toolbar.boundingBox();
  if (!before || !target || !menu)
    throw new Error("Missing pointer corridor geometry");
  const gapStart = menu.y + menu.height;
  expect(target.y).toBeGreaterThan(gapStart);
  const x = Math.max(target.x + 8, menu.x + menu.width / 2);
  for (let y = target.y - 1; y > gapStart; y--) {
    await page.mouse.move(x, y);
    const current = await handle.boundingBox();
    expect(current?.y).toBeCloseTo(before.y, 0);
  }
  await page
    .getByRole("button", { exact: true, name: "More formatting" })
    .hover();
  expect((await handle.boundingBox())?.y).toBeCloseTo(before.y, 0);
  const other = await rows.first().boundingBox();
  if (!other) throw new Error("Missing neighboring block");
  await page.mouse.move(other.x + other.width - 4, other.y + other.height / 2);
  await expect
    .poll(async () => (await handle.boundingBox())?.y)
    .toBeLessThan(before.y - 4);
});
