import { writeFile } from "node:fs/promises";
import { fixtureId } from "~/testing/browser/data";
import { expect, test } from "~/testing/browser/fixtures";
import { settleShell } from "~/testing/browser/shell-capture";

test.use({ journalPagination: true });

test("hidden mobile header releases its inset without moving document content", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "mobile-webkit",
    "Mobile WebKit scroll and focus composition",
  );
  await page.setViewportSize({ height: 844, width: 390 });
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
  await expect.poll(async () => (await scroller.boundingBox())?.y).toBe(0);
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
    .toBeCloseTo(0, 0);
  await page.keyboard.press("Tab");
  await header
    .getByRole("button", { exact: true, name: "Search notes" })
    .focus();
  await settleShell(page);
  await expect.poll(async () => (await header.boundingBox())?.y).toBe(0);
  await expect.poll(async () => (await scroller.boundingBox())?.y).toBe(60);
  expect(await scroller.evaluate((node) => node.scrollTop)).toBe(
    before.scrollTop,
  );
  expect((await editor.boundingBox())?.y).toBeCloseTo(before.editorTop, 0);
});

test("assistant launcher stays inside the route surface while content scrolls", async ({
  page,
}, info) => {
  const mobile = info.project.name === "mobile-webkit";
  await page.setViewportSize(
    mobile ? { height: 844, width: 390 } : { height: 1000, width: 1440 },
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
  await settleShell(page);
  const before = await launcher.boundingBox();
  const stage = await surface.boundingBox();
  if (!before || !stage) throw new Error("Missing surface or launcher bounds");
  // The approved launcher is content-sized. System-font advances vary by
  // platform; keep authored dimensions exact and measure the label itself.
  const intrinsic = await launcher.evaluate((button) => {
    const style = getComputedStyle(button);
    const children = Array.from(button.children).filter((child) => {
      const css = getComputedStyle(child);
      return (
        css.display !== "none" &&
        css.position !== "absolute" &&
        css.position !== "fixed"
      );
    });
    const label = children.find((child) => child.tagName === "SPAN");
    if (!label) throw new Error("Missing launcher label");
    const range = document.createRange();
    range.selectNodeContents(label);
    return {
      borderLeft: Number.parseFloat(style.borderLeftWidth),
      borderRight: Number.parseFloat(style.borderRightWidth),
      children: children.map((child) => child.tagName.toLowerCase()),
      gap: Number.parseFloat(style.columnGap),
      labelFontSize: getComputedStyle(label).fontSize,
      labelFontWeight: getComputedStyle(label).fontWeight,
      labelWidth: range.getBoundingClientRect().width,
      paddingLeft: Number.parseFloat(style.paddingLeft),
      paddingRight: Number.parseFloat(style.paddingRight),
    };
  });
  expect(intrinsic.children).toEqual(["svg", "span"]);
  expect(intrinsic.labelFontSize).toBe("14px");
  expect(intrinsic.labelFontWeight).toBe("700");
  expect(intrinsic.paddingLeft).toBe(15);
  expect(intrinsic.paddingRight).toBe(15);
  expect(intrinsic.gap).toBe(6);
  expect(intrinsic.borderLeft + intrinsic.borderRight).toBe(0);
  expect(before.width).toBeCloseTo(15 + 16 + 6 + intrinsic.labelWidth + 15, 1);
  await writeFile(
    info.outputPath("launcher-intrinsic-size.json"),
    JSON.stringify({ box: before, ...intrinsic }, null, 2),
  );
  const rightInset = stage.x + stage.width - before.x - before.width;
  const bottomInset = stage.y + stage.height - before.y - before.height;
  expect(rightInset).toBeCloseTo(mobile ? 12 : 16, 0);
  expect(bottomInset).toBeCloseTo(mobile ? 22 : 16, 0);
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

test("desktop sidebars animate without reflowing text", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop-chromium", "Desktop sidebar motion");
  await page.setViewportSize({ height: 1000, width: 1440 });
  await page.goto("/library");
  const close = page.getByRole("button", { name: "Close assistant" });
  await expect(close).toBeVisible();
  const assistant = await close.evaluate(async (button) => {
    const panel = button.closest('[data-slot="sidebar-container"]');
    const heading = panel?.querySelector("h2");
    if (!panel || !heading || !(button instanceof HTMLElement))
      throw new Error("Missing assistant controls");
    const initial = panel.getBoundingClientRect();
    const initialHeading = heading.getBoundingClientRect();
    button.click();
    await new Promise(requestAnimationFrame);
    const animation = panel
      .getAnimations()
      .find(
        (candidate) =>
          candidate instanceof CSSTransition &&
          candidate.transitionProperty === "translate",
      );
    if (!animation) throw new Error("Assistant did not slide out");
    animation.pause();
    animation.currentTime = 100;
    const middle = panel.getBoundingClientRect();
    const middleHeading = heading.getBoundingClientRect();
    animation.finish();
    return {
      end: panel.getBoundingClientRect().left,
      headingHeight: [initialHeading.height, middleHeading.height],
      middle: middle.left,
      start: initial.left,
      widths: [initial.width, middle.width],
    };
  });
  expect(assistant.middle).toBeGreaterThan(assistant.start);
  expect(assistant.end).toBeGreaterThanOrEqual(1440);
  expect(assistant.middle).toBeLessThan(assistant.end);
  expect(assistant.widths[1]).toBe(assistant.widths[0]);
  expect(assistant.headingHeight[1]).toBe(assistant.headingHeight[0]);

  const nav = await page
    .getByRole("button", { name: "Toggle Sidebar" })
    .evaluate(async (button) => {
      const panel = button.closest('[data-slot="sidebar-container"]');
      const icon = panel?.querySelector(
        '.journl-navigation-primary [data-sidebar="menu-button"] > svg',
      );
      if (!panel || !icon || !(button instanceof HTMLElement))
        throw new Error("Missing navigation controls");
      const start = panel.getBoundingClientRect().width;
      const startIcon = icon.getBoundingClientRect();
      button.click();
      await new Promise(requestAnimationFrame);
      const animation = panel
        .getAnimations()
        .find(
          (candidate) =>
            candidate instanceof CSSTransition &&
            candidate.transitionProperty === "width",
        );
      if (!animation) throw new Error("Navigation width did not animate");
      const transitions = panel
        .getAnimations({ subtree: true })
        .filter((candidate) => candidate instanceof CSSTransition);
      for (const transition of transitions) {
        transition.pause();
        transition.currentTime = 100;
      }
      const middle = panel.getBoundingClientRect().width;
      const midIcon = icon.getBoundingClientRect();
      for (const transition of transitions) transition.finish();
      const end = panel.getBoundingClientRect().width;
      const endIcon = icon.getBoundingClientRect();
      return {
        end,
        endIconY: endIcon.y,
        middle,
        midIconY: midIcon.y,
        start,
        startIconY: startIcon.y,
      };
    });
  expect(nav.middle).toBeLessThan(nav.start);
  expect(nav.middle).toBeGreaterThan(nav.end);
  expect(nav.midIconY).toBeGreaterThan(Math.min(nav.startIconY, nav.endIconY));
  expect(nav.midIconY).toBeLessThan(Math.max(nav.startIconY, nav.endIconY));
});
