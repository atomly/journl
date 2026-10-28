import { fixtureId } from "~/testing/browser/data";
import { expect, test } from "~/testing/browser/fixtures";

test.use({ journalPagination: true });
for (const theme of ["light", "dark"]) {
  test(`writing appearance matches the current editor in ${theme}`, async ({
    page,
    context,
  }, info) => {
    await context.addInitScript(
      (value) => localStorage.setItem("theme", value),
      theme,
    );
    const snapshots = [];
    for (const frontend of ["blocknote", "tiptap"]) {
      await context.addCookies([
        {
          name: "journl-editor",
          url: "http://127.0.0.1:3100",
          value: frontend,
        },
      ]);
      await page.goto(`/pages/${fixtureId(980)}`);
      const editor = page.locator(
        frontend === "blocknote" ? ".bn-editor" : ".open-editor-tiptap",
      );
      await expect(editor).toContainText("Heading 6");
      await page.evaluate(() => document.fonts.ready);
      snapshots.push(
        await editor.evaluate((root) => {
          const s = getComputedStyle(root);
          return {
            font: s.fontFamily,
            headings: [...root.querySelectorAll("h1,h2,h3,h4,h5,h6")].map(
              (node) => {
                const style = getComputedStyle(node);
                return {
                  lineHeight: style.lineHeight,
                  size: style.fontSize,
                  text: node.textContent,
                  weight: style.fontWeight,
                  whiteSpace: style.whiteSpaceCollapse,
                };
              },
            ),
            padding: s.paddingLeft,
          };
        }),
      );
      if (frontend === "tiptap") {
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
          .locator('[data-open-editor-body="paragraph"]')
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
      }
    }
    expect(snapshots[1]).toEqual(snapshots[0]);
  });
}
