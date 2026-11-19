import { writeFile } from "node:fs/promises";
import { fixtureId } from "~/testing/browser/data";
import { expect, test } from "~/testing/browser/fixtures";
import { settleShell } from "~/testing/browser/shell-capture";

test.use({ journalPagination: true });

for (const theme of ["light", "dark"]) {
  test(`${theme} primary navigation uses approved pastel ink and dimensions`, async ({
    page,
  }, info) => {
    test.skip(
      info.project.name !== "desktop-chromium",
      "Desktop navigation geometry and forced colors",
    );
    await page.setViewportSize({ height: 1000, width: 1440 });
    await page.addInitScript(
      (value) => localStorage.setItem("theme", value),
      theme,
    );
    await page.goto("/explore");
    const selected = page
      .locator('[data-sidebar="menu-button"][data-active="true"]')
      .filter({ hasText: "Explore" });
    await expect(selected).toHaveCSS("background-color", "rgb(196, 203, 255)");
    await expect(selected).toHaveCSS("color", "rgb(33, 48, 74)");
    await expect(selected).toHaveCSS("height", "44px");
    await expect(selected).toHaveCSS("border-radius", "12px");
    await expect(page.locator("header[data-hidden] > div")).toHaveCSS(
      "border-radius",
      "20px",
    );
    await expect(selected).toHaveCSS("font-weight", "600");
    await expect(selected).toHaveCSS("border-width", "0px");
    await expect(selected.locator("svg").first()).toHaveCSS("width", "20px");
    await selected.hover();
    await expect(selected).toHaveCSS("background-color", "rgb(196, 203, 255)");
    await expect(selected).toHaveCSS("color", "rgb(33, 48, 74)");
    await selected.focus();
    await expect(selected).toHaveCSS("color", "rgb(33, 48, 74)");
    const measurement = await selected.evaluate((node) => {
      const rgb = (value: string) =>
        (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      const luminance = (color: number[]) =>
        color.reduce((sum, channel, i) => {
          const c = channel / 255;
          return (
            sum +
            ([0.2126, 0.7152, 0.0722][i] ?? 0) *
              (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
          );
        }, 0);
      const style = getComputedStyle(node);
      const a = luminance(rgb(style.color));
      const b = luminance(rgb(style.backgroundColor));
      return {
        background: style.backgroundColor,
        box: node.getBoundingClientRect().toJSON(),
        contrast: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
        foreground: style.color,
      };
    });
    expect(measurement.contrast).toBeGreaterThanOrEqual(4.5);
    expect(measurement.box.x).toBe(29);
    expect(measurement.box.width).toBe(190);
    await writeFile(
      info.outputPath("selected-navigation-contrast.json"),
      JSON.stringify(measurement, null, 2),
    );
    await info.attach("selected-navigation-contrast", {
      body: JSON.stringify(measurement),
      contentType: "application/json",
    });
    const account = page.locator(".journl-navigation-account");
    await expect(account.locator('[data-slot="avatar"]')).toBeVisible();
    const avatar = await account.locator('[data-slot="avatar"]').boundingBox();
    if (!avatar) throw new Error("Missing navigation account avatar");
    expect(avatar.x).toBeCloseTo(29, 0);
    expect(avatar.y).toBeCloseTo(921, 0);
    await account.hover();
    await expect(
      account.locator("span.text-foreground:not([data-slot])"),
    ).toHaveCSS("color", "rgb(33, 48, 74)");
    await writeFile(
      info.outputPath("navigation-account-placement.json"),
      JSON.stringify(avatar, null, 2),
    );
    await page
      .getByRole("button", { exact: true, name: "Toggle Sidebar" })
      .click();
    await expect(
      page.locator('[data-side="left"][data-state="collapsed"]'),
    ).toBeVisible();
    await expect(selected).toHaveCSS("color", "rgb(33, 48, 74)");
    await expect(selected.locator("svg").first()).toHaveCSS("width", "20px");
    await page.emulateMedia({ forcedColors: "active" });
    await expect(selected).toHaveCSS("forced-color-adjust", "none");
    await expect(selected).not.toHaveCSS("color", "rgb(33, 48, 74)");
  });

  test(`${theme} hidden mobile header releases its inset without moving document content`, async ({
    page,
  }, info) => {
    test.skip(
      info.project.name !== "mobile-webkit",
      "Mobile WebKit scroll and focus composition",
    );
    await page.setViewportSize({ height: 844, width: 390 });
    await page.addInitScript(
      (value) => localStorage.setItem("theme", value),
      theme,
    );
    await page.goto(`/pages/${fixtureId(980)}`);
    const scroller = page.locator("[data-app-container]");
    const header = page.locator("header[data-hidden]");
    const editor = page.locator(".better-editor-tiptap").first();
    await expect(editor).toBeVisible();
    const before = await scroller.evaluate((node) => {
      const editor = node.querySelector(".better-editor-tiptap");
      if (!editor) throw new Error("Missing editor");
      // Sample synchronously before the header handles this scroll event.
      node.scrollTop = 300;
      return {
        editorTop: editor.getBoundingClientRect().top,
        scrollTop: node.scrollTop,
      };
    });
    await expect(header).toHaveAttribute("data-hidden", "true");
    await settleShell(page);
    await expect.poll(async () => (await scroller.boundingBox())?.y).toBe(12);
    const hidden = await scroller.evaluate((node) => ({
      anchor: getComputedStyle(node).overflowAnchor,
      editorTop: node
        .querySelector(".better-editor-tiptap")
        ?.getBoundingClientRect().top,
      paddingTop: getComputedStyle(node).paddingTop,
      scrollTop: node.scrollTop,
    }));
    await writeFile(
      info.outputPath("mobile-header-scroll-placement.json"),
      JSON.stringify({ before, hidden }, null, 2),
    );
    expect(await scroller.evaluate((node) => node.scrollTop)).toBe(
      before.scrollTop,
    );
    expect((await editor.boundingBox())?.y).toBeCloseTo(before.editorTop, 0);
    const toolbar = page.locator('[data-better-editor-toolbar-mode="sticky"]');
    await expect
      .poll(async () => (await toolbar.boundingBox())?.y)
      .toBeCloseTo(13, 0);
    await page.keyboard.press("Tab");
    await header
      .getByRole("button", { exact: true, name: "Search notes" })
      .focus();
    await settleShell(page);
    await expect.poll(async () => (await header.boundingBox())?.y).toBe(12);
    await expect.poll(async () => (await scroller.boundingBox())?.y).toBe(88);
    expect(await scroller.evaluate((node) => node.scrollTop)).toBe(
      before.scrollTop,
    );
    expect((await editor.boundingBox())?.y).toBeCloseTo(before.editorTop, 0);
  });

  test(`${theme} assistant launcher stays inside the route surface while content scrolls`, async ({
    page,
  }, info) => {
    const mobile = info.project.name === "mobile-webkit";
    await page.setViewportSize(
      mobile ? { height: 844, width: 390 } : { height: 1000, width: 1440 },
    );
    await page.addInitScript(
      (value) => localStorage.setItem("theme", value),
      theme,
    );
    await page.goto("/journal");
    if (!mobile)
      await page
        .getByRole("button", { exact: true, name: "Close assistant" })
        .click();
    const launcher = page.getByRole("button", {
      exact: true,
      name: mobile ? "Toggle Chat Drawer" : "Toggle Chat Sidebar",
    });
    const surface = page.locator("[data-app-container]");
    await expect(launcher).toBeVisible();
    await expect(
      page.getByText("Pagination entry 1", { exact: true }),
    ).toBeVisible();
    await expect(page.locator(".better-editor-tiptap").first()).toBeVisible();
    await expect(launcher).toHaveCSS("height", "48px");
    await expect(launcher.locator("svg")).toHaveCSS("width", "20px");
    await settleShell(page);
    const before = await launcher.boundingBox();
    const stage = await surface.boundingBox();
    if (!before || !stage)
      throw new Error("Missing surface or launcher bounds");
    expect(before.width).toBe(156);
    const rightInset = stage.x + stage.width - before.x - before.width;
    const bottomInset = stage.y + stage.height - before.y - before.height;
    expect(rightInset).toBeCloseTo(mobile ? 17 : 25, 0);
    expect(bottomInset).toBeCloseTo(mobile ? 17 : 25, 0);
    // Journal's Virtuoso uses this shell element as its customScrollParent.
    const scroller = surface;
    await expect
      .poll(() =>
        scroller.evaluate((node) => node.scrollHeight - node.clientHeight),
      )
      .toBeGreaterThan(800);
    const scrolling = await scroller.evaluate(async (node) => {
      node.scrollTop = 800;
      const immediate = node.scrollTop;
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      return {
        clientHeight: node.clientHeight,
        immediate,
        scrollHeight: node.scrollHeight,
        settled: node.scrollTop,
      };
    });
    await writeFile(
      info.outputPath("launcher-scroll-owner.json"),
      JSON.stringify(scrolling, null, 2),
    );
    await expect
      .poll(() => scroller.evaluate((node) => node.scrollTop))
      .toBeGreaterThan(0);
    await settleShell(page);
    expect(await launcher.boundingBox()).toEqual(before);
    await writeFile(
      info.outputPath("launcher-surface-placement.json"),
      JSON.stringify(
        { bottomInset, launcher: before, rightInset, surface: stage },
        null,
        2,
      ),
    );
    await info.attach("launcher-surface-placement", {
      body: JSON.stringify({
        bottomInset,
        launcher: before,
        rightInset,
        surface: stage,
      }),
      contentType: "application/json",
    });
  });
}
