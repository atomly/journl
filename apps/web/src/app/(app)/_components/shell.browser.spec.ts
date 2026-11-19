import { expect, test } from "~/testing/browser/fixtures";

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
  await expect(navigation).toHaveAttribute("aria-valuenow", "280");
  await page.keyboard.press("ArrowLeft");
  await expect(navigation).toHaveAttribute("aria-valuenow", "264");
  await page.keyboard.press("Home");
  await expect(navigation).toHaveAttribute("aria-valuenow", "192");
  await expect(assistant).toHaveAttribute("aria-valuenow", "480");
  await assistant.focus();
  await page.keyboard.press("End");
  await expect(assistant).toHaveAttribute("aria-valuenow", "704");
  await page.keyboard.press("Home");
  await expect(assistant).toHaveAttribute("aria-valuenow", "400");
  await expect(navigation).toHaveAttribute("aria-valuenow", "192");
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => {
      document.documentElement.classList.toggle("dark", value === "dark");
    }, theme);
    await info.attach(`resize-boundaries--${theme}--desktop`, {
      body: await page.screenshot({ animations: "disabled", scale: "css" }),
      contentType: "image/png",
    });
  }
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
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => {
      document.documentElement.classList.toggle("dark", value === "dark");
    }, theme);
    await info.attach(`navigation-mobile--${theme}--mobile`, {
      body: await page.screenshot({ animations: "disabled", scale: "css" }),
      contentType: "image/png",
    });
  }
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
  expect(expanded?.y).toBe(96);
  expect(expanded?.height).toBe(888);
  await expect(
    page.locator('[data-side="right"] [data-slot="sidebar-container"]'),
  ).toHaveCSS("width", "704px");
  await page
    .getByRole("button", { exact: true, name: "Default assistant width" })
    .click();
  await expect(assistant).toHaveAttribute("aria-valuenow", "480");
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
  expect(main?.y).toBe(96);
  expect((main?.y ?? 0) + (main?.height ?? 0)).toBe(984);
  await expect(
    page.getByRole("separator", { name: "Resize navigation" }),
  ).toHaveAttribute("aria-valuenow", "216");
  await page
    .getByRole("button", { exact: true, name: "Toggle Chat Sidebar" })
    .click();
  await expect(assistant).toHaveAttribute("aria-valuenow", "480");
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
      expect(box?.x).toBe(96);
      expect(box?.y).toBe(96);
      await expect(
        page.locator('[data-side="right"] [data-slot="sidebar-container"]'),
      ).toHaveCSS("width", `${width - 112}px`);
      await page
        .getByRole("button", { exact: true, name: "Toggle Sidebar" })
        .click();
      await expect(navigation).toHaveAttribute("data-state", "expanded");
      await page
        .getByRole("button", { exact: true, name: "Close navigation" })
        .click();
      await expect(
        page.locator('header [data-sidebar="trigger"]'),
      ).toBeFocused();
    }
  }
  await expect(
    page.locator('[data-side="left"][data-slot="sidebar"]'),
  ).toHaveAttribute("data-state", "expanded");
});

test("context menus preserve Journal date navigation and keep page identity", async ({
  page,
}) => {
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
  await page
    .getByRole("button", { exact: true, name: "Journal route menu" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
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
    .getByRole("button", { exact: true, name: "Route actions" })
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

test("search recovery retains its query and restores trigger focus", async ({
  page,
}) => {
  await page.goto("/explore");
  await page.route("**/api/trpc/notes.getSimilarNotes**", (route) =>
    route.abort(),
  );
  const trigger = page.getByRole("button", {
    exact: true,
    name: "Search notes",
  });
  await trigger.click();
  const viewportWidth = page.viewportSize()?.width ?? 1280;
  await expect(page.getByRole("dialog")).toHaveCSS(
    "width",
    `${Math.min(viewportWidth - 24, 560)}px`,
  );
  await expect(
    page.getByRole("dialog").locator('[data-slot="input-group"]'),
  ).toHaveCSS("height", "48px");
  await page.getByPlaceholder("Search notes...").fill("browser note");
  const retry = page.getByRole("button", { exact: true, name: "Try again" });
  await expect(retry).toBeVisible();
  await retry.click();
  await expect(retry).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(page.getByPlaceholder("Search notes...")).toHaveValue(
    "browser note",
  );
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

test.describe("Journal scroll clearance", () => {
  test.use({ journalPagination: true });
  test("the real Virtuoso footer keeps recovery above the floating assistant", async ({
    page,
  }, info) => {
    await page.setViewportSize(
      info.project.name === "desktop-chromium"
        ? { height: 1000, width: 1440 }
        : { height: 844, width: 390 },
    );
    await page.route("**/api/trpc/**", async (route) => {
      const url = new URL(route.request().url());
      const procedures = url.pathname.split("/").at(-1)?.split(",") ?? [];
      const index = procedures.indexOf("journal.getEntries");
      const input = JSON.parse(url.searchParams.get("input") ?? "{}");
      if (index >= 0 && typeof input[index]?.json?.cursor === "string")
        await route.abort();
      else await route.continue();
    });
    await page.goto("/journal");
    await page
      .getByRole("button", { exact: true, name: "Journal route menu" })
      .click();
    await page.getByRole("button", { exact: true, name: "Entries" }).click();
    if (info.project.name === "desktop-chromium")
      await page
        .getByRole("button", { exact: true, name: "Close assistant" })
        .click();
    const scroller = page.locator("[data-app-container]");
    const retry = page.getByRole("button", { exact: true, name: "Try again" });
    await expect(async () => {
      await scroller.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      await expect(retry).toBeInViewport({ timeout: 1000 });
    }).toPass({ timeout: 30_000 });
    await scroller.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    const main = await scroller.boundingBox();
    const button = await retry.boundingBox();
    const trailingClearance =
      (main?.y ?? 0) +
      (main?.height ?? 0) -
      (button?.y ?? 0) -
      (button?.height ?? 0);
    expect(trailingClearance).toBeGreaterThanOrEqual(112);
    expect(trailingClearance).toBeLessThanOrEqual(116);
    await info.attach("scroll-clearance", {
      body: JSON.stringify({
        main,
        retry: button,
        trailingClearance,
        viewport: page.viewportSize(),
      }),
      contentType: "application/json",
    });
    const nav = page.locator(
      '[data-side="left"] [data-slot="sidebar-container"]',
    );
    if (info.project.name === "desktop-chromium") {
      const navigation = await nav.boundingBox();
      expect((navigation?.y ?? 0) + (navigation?.height ?? 0)).toBe(
        (main?.y ?? 0) + (main?.height ?? 0),
      );
    }
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        (value) =>
          document.documentElement.classList.toggle("dark", value === "dark"),
        theme,
      );
      await page.screenshot({
        animations: "disabled",
        path: info.outputPath(`journal-scroll-end--${theme}.png`),
        scale: "css",
      });
    }
  });
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
  await expect(
    page.getByRole("button", { exact: true, name: "Search notes" }),
  ).toBeInViewport();
  await page
    .getByRole("button", { exact: true, name: "Close assistant" })
    .click();
  await expect(
    page.getByRole("button", { exact: true, name: "Toggle Chat Sidebar" }),
  ).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("desktop navigation dialog retains the floating navigation and returns focus", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "Desktop navigation dialog",
  );
  await page.setViewportSize({ height: 1000, width: 1440 });
  await page.goto("/explore");
  const trigger = page.getByRole("button", {
    exact: true,
    name: "Route actions",
  });
  await trigger.click();
  await page
    .getByRole("button", { exact: true, name: "Notebook navigation" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Notebook navigation" });
  await expect(dialog).toBeVisible();
  await expect.poll(async () => (await dialog.boundingBox())?.x).toBe(440);
  await expect(dialog).toHaveCSS("width", "560px");
  await expect(
    page.locator('[data-side="left"][data-slot="sidebar"]'),
  ).toHaveAttribute("data-state", "expanded");
  await dialog
    .getByRole("button", { exact: true, name: "Close navigation" })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});
