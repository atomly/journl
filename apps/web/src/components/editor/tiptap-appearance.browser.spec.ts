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
      const clean = (family: string) =>
        family.trim().replaceAll('"', "").replaceAll("'", "");
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
    await expect(editor).toHaveCSS("padding-left", "54px");
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
      await expect(toolbar).toHaveCSS("flex-wrap", "nowrap");
      expect((await toolbar.boundingBox())?.height).toBeLessThan(50);
    }
    await editor
      .locator('[data-better-editor-body="paragraph"]')
      .first()
      .hover();
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
