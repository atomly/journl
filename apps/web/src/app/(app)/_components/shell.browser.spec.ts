import { expect, test } from "~/testing/browser/fixtures";
import { renderedTextContrast } from "~/testing/browser/rendered-contrast";

test("panel keyboard resizing is bounded and independent of route identity", async ({
  page,
}, info) => {
  test.skip(info.project.name === "mobile-webkit", "Desktop resize separators");
  await page.setViewportSize({ height: 1000, width: 1440 });
  await page.goto("/explore");
  await expect(page.locator("header[data-hidden]")).toContainText("Explore");
  await expect(
    page
      .locator("header[data-hidden]")
      .getByRole("button", { exact: true, name: "Entries" }),
  ).toHaveCount(0);
  const navigation = page.getByRole("separator", { name: "Resize navigation" });
  const assistant = page.getByRole("separator", { name: "Resize assistant" });
  await expect(navigation).toHaveAttribute("aria-valuenow", "216");
  await navigation.focus();
  await page.keyboard.press("End");
  await expect(navigation).toHaveAttribute("aria-valuenow", "320");
  await page.keyboard.press("ArrowLeft");
  await expect(navigation).toHaveAttribute("aria-valuenow", "312");
  await page.keyboard.press("Home");
  await expect(navigation).toHaveAttribute("aria-valuenow", "200");
  await expect(assistant).toHaveAttribute("aria-valuenow", "400");
  await assistant.focus();
  await page.keyboard.press("End");
  await expect(assistant).toHaveAttribute("aria-valuenow", "520");
  await page.keyboard.press("Home");
  await expect(assistant).toHaveAttribute("aria-valuenow", "360");
  await expect(navigation).toHaveAttribute("aria-valuenow", "200");
});

test("mobile navigation sheet restores focus", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile-webkit", "Mobile sheet");
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/journal");
  const trigger = page
    .getByRole("button", { exact: true, name: "Toggle Sidebar" })
    .first();
  await trigger.click();
  const sheet = page.getByRole("dialog", { name: "Notebook navigation" });
  await expect(sheet).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("assistant controls update live width, restore focus and retain independent navigation", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop-chromium", "Desktop panel controls");
  await page.setViewportSize({ height: 1000, width: 1440 });
  await page.goto("/explore");
  const assistant = page.getByRole("separator", { name: "Resize assistant" });
  await page
    .getByRole("button", { exact: true, name: "Expand assistant" })
    .click();
  await expect(assistant).toHaveAttribute("aria-valuenow", "704");
  await expect(page.locator("header[data-hidden]")).toHaveCSS(
    "width",
    "1176px",
  );
  const expanded = await page
    .locator('[data-side="right"] [data-slot="sidebar-container"]')
    .boundingBox();
  expect(expanded?.y).toBe(16);
  expect(expanded?.height).toBe(968);
  const navigationBox = await page
    .locator('[data-side="left"] [data-slot="sidebar-container"]')
    .boundingBox();
  expect(expanded?.y).toBe(navigationBox?.y);
  expect((expanded?.y ?? 0) + (expanded?.height ?? 0)).toBe(
    (navigationBox?.y ?? 0) + (navigationBox?.height ?? 0),
  );
  await expect(
    page.locator('[data-side="right"] [data-slot="sidebar-container"]'),
  ).toHaveCSS("width", "704px");
  await page
    .getByRole("button", { exact: true, name: "Default assistant width" })
    .click();
  await expect(assistant).toHaveAttribute("aria-valuenow", "400");
  await page
    .getByRole("button", { exact: true, name: "Close assistant" })
    .click();
  await expect(
    page.getByRole("button", { exact: true, name: "Toggle Chat Sidebar" }),
  ).toBeFocused();
  await expect(
    page.getByRole("button", { exact: true, name: "Close assistant" }),
  ).toHaveCount(0);
  await expect(page.locator("[data-app-container]")).toHaveCSS(
    "width",
    "1176px",
  );
  const main = await page.locator("[data-app-container]").boundingBox();
  expect(main?.x).toBe(248);
  expect(main?.y).toBe(78);
  expect((main?.y ?? 0) + (main?.height ?? 0)).toBe(984);
  await expect(
    page.getByRole("separator", { name: "Resize navigation" }),
  ).toHaveAttribute("aria-valuenow", "216");
  await page
    .getByRole("button", { exact: true, name: "Toggle Chat Sidebar" })
    .click();
  await expect(assistant).toHaveAttribute("aria-valuenow", "400");
  for (const width of [700, 701, 767, 768, 834, 1100, 1101, 1440]) {
    await page.setViewportSize({ height: 1112, width });
    if (width <= 700) {
      await expect(
        page.getByRole("button", { exact: true, name: "Toggle Chat Drawer" }),
      ).toBeVisible();
      continue;
    }
    await expect(
      page.getByRole("button", { exact: true, name: "Close assistant" }),
    ).toBeVisible();
    const navigation = page.locator('[data-side="left"][data-slot="sidebar"]');
    await expect(navigation).toHaveAttribute(
      "data-state",
      width <= 1100 ? "collapsed" : "expanded",
    );
    if (width <= 1100) {
      await expect(page.locator("[data-app-container]")).toHaveAttribute(
        "inert",
        "",
      );
      const box = await page
        .locator('[data-side="right"] [data-slot="sidebar-container"]')
        .boundingBox();
      expect(box?.x).toBe(88);
      expect(box?.y).toBe(86);
      await expect(
        page.locator('[data-side="right"] [data-slot="sidebar-container"]'),
      ).toHaveCSS("width", `${width - 100}px`);
      await page
        .getByRole("button", { exact: true, name: "Toggle Sidebar" })
        .click();
      await expect(navigation).toHaveAttribute("data-state", "expanded");
      await page
        .getByRole("button", { exact: true, name: "Toggle Sidebar" })
        .click();
      await expect(page.locator(".journl-navigation-toggle")).toBeFocused();
    }
  }
  await expect(
    page.locator('[data-side="left"][data-slot="sidebar"]'),
  ).toHaveAttribute("data-state", "expanded");
});

test("context menus preserve Journal date navigation and keep page identity", async ({
  page,
  isMobile,
}) => {
  if (!isMobile) await page.setViewportSize({ height: 1080, width: 1920 });
  await page.goto("/journal/2000-01-01");
  await expect(
    page.locator('.better-editor-tiptap[contenteditable="true"]').first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { exact: true, name: "Search notes" }),
  ).toBeInViewport();
  if (page.viewportSize()?.width !== 390)
    await expect(
      page.getByRole("link", { exact: true, name: "Journal" }),
    ).toHaveAttribute("aria-current", "page");
  if (!isMobile) {
    const header = page.locator("header[data-hidden]");
    const modes = header.getByRole("group", { name: "Journal view" });
    await expect(modes.getByRole("button", { name: "Entries" })).toBeVisible();
    await expect(modes.getByRole("button", { name: "Timeline" })).toBeVisible();
    const date = header.getByRole("button", { name: "Browse journal dates" });
    await expect(date).toHaveText("Jan 1");
    await date.click();
    await expect(page.getByRole("grid")).toBeVisible();
    await expect(
      page.getByRole("button", { exact: true, name: "Today" }),
    ).toBeVisible();

    await page.setViewportSize({ height: 900, width: 620 });
    await expect(page.getByRole("grid")).toBeHidden();
  }
  await page
    .getByRole("button", { exact: true, name: "Journal route menu" })
    .click();
  const menu = page.getByRole("dialog", { name: "Journal" });
  await expect(menu).toBeVisible();
  const modes = menu.getByRole("group", { name: "Journal view" });
  const [entries, timeline] = await modes
    .getByRole("button")
    .evaluateAll((buttons) =>
      buttons.map((button) => button.getBoundingClientRect().toJSON()),
    );
  expect(entries.y).toBeCloseTo(timeline.y, 0);
  expect(entries.x).toBeLessThan(timeline.x);
  if (page.viewportSize()?.width === 390) {
    await expect
      .poll(async () => (await page.getByRole("dialog").boundingBox())?.x)
      .toBe(12);
    const box = await page.getByRole("dialog").boundingBox();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBe(378);
  }
  await page
    .getByRole("button", { exact: true, name: "Browse dates / history" })
    .click();
  await expect(page.getByRole("grid")).toBeVisible();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { exact: true, name: "Journal route menu" })
    .click();
  await expect(
    page.getByRole("button", { exact: true, name: "Timeline" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { exact: true, name: "Today" }),
  ).toBeVisible();
  await page.getByRole("button", { exact: true, name: "Today" }).click();
  await expect(page).not.toHaveURL(/2000-01-01/);
});

test("cancelled pointer resizing restores the original width", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "Desktop resize boundary",
  );
  await page.goto("/explore");
  const separator = page.getByRole("separator", { name: "Resize navigation" });
  const box = await separator.boundingBox();
  if (!box) throw new Error("Navigation resize separator is missing");
  await separator.dispatchEvent("pointerdown", {
    buttons: 1,
    clientX: box.x,
    pointerId: 1,
    pointerType: "touch",
  });
  await page.evaluate(
    (x) =>
      document.dispatchEvent(
        new PointerEvent("pointermove", {
          buttons: 1,
          clientX: x + 40,
          pointerId: 1,
          pointerType: "touch",
        }),
      ),
    box.x,
  );
  await expect(separator).toHaveAttribute("aria-valuenow", "256");
  await page.evaluate(() =>
    document.dispatchEvent(
      new PointerEvent("pointercancel", { pointerId: 1, pointerType: "touch" }),
    ),
  );
  await expect(separator).toHaveAttribute("aria-valuenow", "216");
  await separator.dispatchEvent("pointerdown", {
    buttons: 1,
    clientX: box.x,
    pointerId: 1,
    pointerType: "touch",
  });
  await page.evaluate(
    (x) =>
      document.dispatchEvent(
        new PointerEvent("pointermove", {
          buttons: 1,
          clientX: x - 120,
          pointerId: 1,
          pointerType: "touch",
        }),
      ),
    box.x,
  );
  await expect(
    page.locator('[data-side="left"][data-slot="sidebar"]'),
  ).toHaveAttribute("data-state", "collapsed");
  await page.keyboard.press("Escape");
  await expect(
    page.locator('[data-side="left"][data-slot="sidebar"]'),
  ).toHaveAttribute("data-state", "expanded");
  await expect(separator).toHaveAttribute("aria-valuenow", "216");
  await page.reload();
  await expect(separator).toHaveAttribute("aria-valuenow", "216");
});

test("dirty page session and assistant draft survive panel changes", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "Desktop panel composition",
  );
  await page.setViewportSize({ height: 1000, width: 1440 });
  await page.goto("/pages/00000000-0000-4000-8000-000000000025");
  await page.route("**/api/trpc/pages.saveTransactions**", (route) =>
    route.abort(),
  );
  const editor = page
    .locator('.better-editor-tiptap[contenteditable="true"]')
    .first();
  await editor.fill("Unsaved shell session remains mounted");
  const node = await editor.elementHandle();
  await page.getByPlaceholder("New page").fill("Unsaved shell title");
  await expect(page.locator("header[data-hidden]")).toContainText(
    "Unsaved shell title",
  );
  const message = page
    .getByRole("textbox", { exact: true, name: "Message" })
    .filter({ visible: true });
  await expect(message).toBeEnabled();
  await message.fill("Retained assistant draft");
  await page
    .getByRole("button", { exact: true, name: "Close assistant" })
    .click();
  await page
    .getByRole("button", { exact: true, name: "Toggle Sidebar" })
    .click();
  await page
    .getByRole("button", { exact: true, name: "Toggle Chat Sidebar" })
    .click();
  await expect(message).toHaveValue("Retained assistant draft");
  expect(await node?.evaluate((element) => element.isConnected)).toBe(true);
  await expect(editor).toContainText("Unsaved shell session remains mounted");
  await expect(
    page.getByRole("button", { name: "Review drafts" }),
  ).toBeVisible();
});

test("mobile assistant dismissal restores focus and retains draft and editor scroll", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile-webkit", "Mobile assistant sheet");
  await page.goto("/journal/2000-01-01");
  const editor = page
    .locator('.better-editor-tiptap[contenteditable="true"]')
    .first();
  await expect(editor).toBeVisible();
  const retainedEditor = await editor.elementHandle();
  const scroller = page.locator("[data-app-container]");
  await scroller.evaluate((element) => {
    element.scrollTop = 600;
  });
  const scrollTop = await scroller.evaluate((element) => element.scrollTop);
  const trigger = page.getByRole("button", {
    exact: true,
    name: "Toggle Chat Drawer",
  });
  await trigger.click();
  const sheet = page.getByRole("dialog", { name: "Ask Journl" });
  await expect(sheet).toBeVisible();
  const message = sheet.getByRole("textbox", { exact: true, name: "Message" });
  await expect(message).toBeEnabled();
  await message.fill("Retained mobile assistant draft");
  await sheet
    .getByRole("button", { exact: true, name: "Close assistant" })
    .click();
  await expect(sheet).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(await retainedEditor?.evaluate((element) => element.isConnected)).toBe(
    true,
  );
  expect(await scroller.evaluate((element) => element.scrollTop)).toBe(
    scrollTop,
  );
  await trigger.click();
  await expect(message).toHaveValue("Retained mobile assistant draft");
  await page.keyboard.press("Escape");
  await expect(sheet).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("shell controls remain reachable with solid materials and system colors", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "Chromium system-color emulation",
  );
  await page.setViewportSize({ height: 1000, width: 1101 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/pages/00000000-0000-4000-8000-000000000025");
  await expect(page.locator("header[data-hidden]")).toContainText(
    "Browser folder",
  );
  await page.evaluate(() =>
    document.documentElement.classList.add("opaque-mode"),
  );
  const chrome = page.locator("header[data-hidden] > div");
  await expect(chrome).toHaveCSS("backdrop-filter", "none");
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await expect(chrome).toHaveCSS("box-shadow", "none");
  await expect(page.locator("[data-app-container]")).toHaveAttribute(
    "inert",
    "",
  );
  await page
    .getByRole("button", { exact: true, name: "Close assistant" })
    .click();
  await expect(
    page.getByRole("button", { exact: true, name: "Search notes" }),
  ).toBeInViewport();
  await expect(
    page.getByRole("button", { exact: true, name: "Toggle Chat Sidebar" }),
  ).toBeInViewport();
  const selected = page.getByRole("button", { exact: true, name: "Library" });
  const labelContrast = await renderedTextContrast(selected);
  const iconContrast = await renderedTextContrast(selected, "icons");
  expect(labelContrast.ratio).toBeGreaterThanOrEqual(4.5);
  expect(iconContrast.ratio).toBeGreaterThanOrEqual(3);
  await info.attach("system-color-selected-contrast", {
    body: JSON.stringify({ iconContrast, labelContrast }),
    contentType: "application/json",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("compact rail keeps normal assistant space when the center fits", async ({
  baseURL,
  page,
  context,
}, info) => {
  test.skip(info.project.name !== "desktop-chromium", "Desktop fit boundary");
  await page.setViewportSize({ height: 1000, width: 1250 });
  await context.addCookies([
    {
      name: "journl:preferences",
      url: baseURL,
      value: encodeURIComponent(
        JSON.stringify({
          appSidebarOpen: false,
          appSidebarWidthRem: 19,
          chatSidebarOpen: true,
          chatSidebarWidthRem: 32.5,
          journalTimelineView: "entries",
        }),
      ),
    },
  ]);
  await page.goto("/pages/00000000-0000-4000-8000-000000000025");
  await expect(page.locator("header[data-hidden]")).toHaveCSS("width", "602px");
  await expect(page.locator("[data-app-container]")).not.toHaveAttribute(
    "inert",
    "",
  );
  await page.setViewportSize({ height: 1000, width: 1200 });
  await expect(page.locator("[data-app-container]")).toHaveAttribute(
    "inert",
    "",
  );
  await expect(
    page.getByRole("separator", { name: "Resize assistant" }),
  ).toHaveAttribute("aria-valuenow", "520");
  await page
    .getByRole("button", { exact: true, name: "Close assistant" })
    .click();
  await expect(page.locator("[data-app-container]")).not.toHaveAttribute(
    "inert",
    "",
  );
  await page
    .getByRole("button", { exact: true, name: "Toggle Chat Sidebar" })
    .click();
  await expect(
    page.getByRole("separator", { name: "Resize assistant" }),
  ).toHaveAttribute("aria-valuenow", "520");
});

test("live pointer resize overlays before the center minimum and cancellation restores widths", async ({
  baseURL,
  page,
  context,
}, info) => {
  test.skip(info.project.name !== "desktop-chromium", "Desktop live resize");
  await page.setViewportSize({ height: 1000, width: 1440 });
  await context.addCookies([
    {
      name: "journl:preferences",
      url: baseURL,
      value: encodeURIComponent(
        JSON.stringify({
          appSidebarOpen: true,
          appSidebarWidthRem: 13.5,
          chatSidebarOpen: true,
          chatSidebarWidthRem: 32.5,
          journalTimelineView: "entries",
        }),
      ),
    },
  ]);
  await page.goto("/pages/00000000-0000-4000-8000-000000000025");
  const navigation = page.getByRole("separator", { name: "Resize navigation" });
  await expect(navigation).toHaveAttribute("aria-valuenow", "216");
  const handle = await navigation.boundingBox();
  if (!handle) throw new Error("Navigation resize handle unavailable");
  await page.mouse.move(
    handle.x + handle.width / 2,
    handle.y + handle.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    handle.x + handle.width / 2 + 100,
    handle.y + handle.height / 2,
    { steps: 5 },
  );
  await expect(page.locator("[data-app-container]")).toHaveAttribute(
    "inert",
    "",
  );
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(navigation).toHaveAttribute("aria-valuenow", "216");
  await expect(
    page.getByRole("separator", { name: "Resize assistant" }),
  ).toHaveAttribute("aria-valuenow", "520");
  await expect(page.locator("[data-app-container]")).not.toHaveAttribute(
    "inert",
    "",
  );
});
