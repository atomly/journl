import { fixtureId } from "~/testing/browser/data";
import { expect, test } from "~/testing/browser/fixtures";

test.use({ journalPagination: true });
for (const theme of ["light", "dark"]) {
  test(`writing keeps the preserved typography and controls in ${theme}`, async ({
    page,
    context,
  }, info) => {
    await context.addInitScript(
      (value) => localStorage.setItem("theme", value),
      theme,
    );
    await page.goto(`/pages/${fixtureId(980)}`);
    const editor = page.locator(".better-editor-tiptap");
    await expect(editor).toContainText("Heading 6");
    await page.evaluate(() => document.fonts.ready);
    const font = await editor.evaluate((root) => {
      // CSS font-family matching ignores case; Next registers local Inter as inter.
      const clean = (family: string) =>
        family.trim().replaceAll('"', "").replaceAll("'", "").toLowerCase();
      const family = clean(
        getComputedStyle(root).fontFamily.split(",")[0] ?? "",
      );
      return {
        family,
        loaded: [...document.fonts].some(
          (face) => clean(face.family) === family && face.status === "loaded",
        ),
      };
    });
    expect(font.family.toLowerCase()).toContain("inter");
    expect(font.loaded).toBe(true);
    const card = editor.locator(".content-reference-card").first();
    await expect(card).toHaveCSS("display", "flex");
    await expect(card).toHaveCSS("border-top-width", "1px");
    await expect(editor).toHaveCSS("font-size", "16px");
    await expect(editor).toHaveCSS("line-height", "24px");
    await expect(editor).toHaveCSS(
      "color",
      theme === "dark" ? "rgb(207, 207, 207)" : "rgb(63, 63, 63)",
    );
    // These are the typography values preserved from the retired editor.
    for (const [index, size] of [48, 32, 20.8, 16, 14.4, 12.8].entries()) {
      const heading = editor
        .locator(
          `[data-better-editor-body="heading"][data-heading-level="${index + 1}"]`,
        )
        .first();
      expect(
        await heading.evaluate((node) =>
          Number.parseFloat(getComputedStyle(node).fontSize),
        ),
      ).toBeCloseTo(size, 3);
      await expect(heading).toHaveCSS("font-weight", "700");
    }
    await expect(
      page.getByRole("textbox", { exact: true, name: "Reference URL" }),
    ).toBeHidden();
    const toolbar = page.getByRole("toolbar", {
      exact: true,
      name: "Editor controls",
    });
    if (info.project.name === "desktop-chromium")
      await expect(toolbar).toBeHidden();
    else {
      await expect(toolbar).toBeVisible();
      await expect(toolbar).toHaveAttribute(
        "data-better-editor-toolbar-mode",
        "sticky",
      );
      await expect(toolbar).toHaveCSS("flex-wrap", "nowrap");
      // One row of 44px touch controls plus the toolbar's padding and borders.
      expect((await toolbar.boundingBox())?.height).toBeLessThanOrEqual(56);
      const boldTarget = await toolbar
        .getByRole("button", { exact: true, name: "Bold" })
        .boundingBox();
      expect(boldTarget?.width).toBeGreaterThanOrEqual(44);
      expect(boldTarget?.height).toBeGreaterThanOrEqual(44);
    }
    await page.keyboard.press("Escape");
    await editor.focus();
    await page.keyboard.press("Alt+F10");
    await expect(toolbar).toBeVisible();
    const toolbarSkin = await toolbar.evaluate((node) => {
      const probe = document.createElement("span");
      probe.style.borderTop = "1px solid var(--sidebar-border)";
      document.body.append(probe);
      const skin = getComputedStyle(probe).borderTopColor;
      probe.remove();
      const style = getComputedStyle(node);
      return {
        border: style.borderTopColor,
        radius: Number.parseFloat(style.borderTopLeftRadius),
        skin,
      };
    });
    expect(toolbarSkin.radius).toBeGreaterThan(10);
    // The approved workspace v2 joins the reading panel to the header and
    // drops the surface's top border, so the floating toolbar carries the
    // app's sidebar border color instead of matching a removed top edge.
    expect(toolbarSkin.border).toBe(toolbarSkin.skin);
    await page.keyboard.press("Escape");
    const paragraph = editor
      .locator('[data-better-editor-body="paragraph"]')
      .first();
    if (info.project.name === "mobile-webkit") await paragraph.tap();
    else await paragraph.hover();
    await expect(
      page.getByRole("button", { exact: true, name: "Block actions" }),
    ).toBeVisible();
    await page
      .getByRole("button", { exact: true, name: "Block actions" })
      .click();
    await expect(
      page.getByRole("menuitem", { exact: true, name: "Duplicate block" }),
    ).toBeVisible();
  });
}

test("editor styles do not adopt the host application's toolbar layout", async ({
  page,
}) => {
  await page.goto(`/pages/${fixtureId(980)}`);
  await expect(
    page.getByRole("textbox", { exact: true, name: "Document editor" }),
  ).toBeVisible();
  const styles = await page.evaluate(() => {
    const consumer = document.createElement("section");
    consumer.style.fontFamily = "monospace";
    consumer.style.setProperty("--app-header-offset", "800px");
    consumer.style.setProperty("--app-visual-viewport-offset-top", "400px");
    const content = document.createElement("div");
    content.className = "better-editor-tiptap";
    const toolbar = document.createElement("div");
    toolbar.className = "better-editor-formatting-toolbar";
    toolbar.dataset.betterEditorToolbarMode = "inline";
    const host = document.createElement("div");
    host.className = "better-editor-tiptap-host";
    consumer.append(content, toolbar, host);
    document.body.append(consumer);
    try {
      const toolbarStyle = getComputedStyle(toolbar);
      return {
        font: getComputedStyle(content).fontFamily,
        hostSpacing: getComputedStyle(host).marginTop,
        order: toolbarStyle.order,
        position: toolbarStyle.position,
        top: toolbarStyle.top,
      };
    } finally {
      consumer.remove();
    }
  });
  expect(styles).toEqual({
    font: "monospace",
    hostSpacing: "0px",
    order: "0",
    position: "static",
    top: "auto",
  });
});

test.describe("desktop editor gutter", () => {
  test.skip(
    ({ isMobile }) => isMobile,
    "Desktop has an Add block button and a drag handle",
  );

  test("aligns the Page title and contains both controls inside the workspace", async ({
    page,
  }) => {
    await page.goto(`/pages/${fixtureId(980)}`);
    const editor = page.getByRole("textbox", { name: "Document editor" });
    const block = editor.locator("[data-better-editor-body]").first();
    const title = page.getByPlaceholder("New page");
    await expect(block).toBeVisible();
    const titleStart = await title.evaluate((node) => {
      const style = getComputedStyle(node);
      return (
        node.getBoundingClientRect().left +
        Number.parseFloat(style.paddingLeft) +
        Number.parseFloat(style.borderLeftWidth)
      );
    });
    expect((await block.boundingBox())?.x).toBeCloseTo(titleStart, 0);
    await block.hover();
    const controls = page.locator("[data-tiptap-side-menu]");
    const workspace = page.locator("[data-app-container]");
    await expect(
      controls.getByRole("button", { name: "Add block" }),
    ).toBeVisible();
    await expect(
      controls.getByRole("button", { name: "Block actions" }),
    ).toBeVisible();
    await expect
      .poll(async () => {
        const bounds = await workspace.boundingBox();
        const menu = await controls.boundingBox();
        return bounds && menu ? menu.x - bounds.x : -1;
      })
      .toBeGreaterThan(0);
  });
});
