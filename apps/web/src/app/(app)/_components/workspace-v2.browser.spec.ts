import { mkdir, writeFile } from "node:fs/promises";
import { fixtureId } from "~/testing/browser/data";
import { expect, test } from "~/testing/browser/fixtures";
import { captureSettledShell } from "~/testing/browser/shell-capture";
import { populateShellConversation } from "~/testing/browser/shell-responses";

// Synthetic panel preferences reproduce the approved sizes without changing
// saved defaults or resetting a real user's independent panel preferences.
for (const theme of ["light", "dark"]) {
  for (const width of [1440, 1920]) {
    test(`approved workspace shell ${width} ${theme}`, async ({
      page,
      context,
    }, info) => {
      const height = width === 1440 ? 1000 : 1080;
      await page.setViewportSize({ height, width });
      await page.addInitScript(
        (value) => localStorage.setItem("theme", value),
        theme,
      );
      await context.addCookies([
        {
          name: "journl:preferences",
          url: "http://127.0.0.1:3100",
          value: encodeURIComponent(
            JSON.stringify({
              appSidebarOpen: true,
              appSidebarWidthRem: width === 1440 ? 13.5 : 15,
              chatSidebarOpen: true,
              chatSidebarWidthRem: width === 1440 ? 25 : 26.5,
              journalTimelineView: "entries",
            }),
          ),
        },
      ]);
      await populateShellConversation(page);
      await page.goto(`/pages/${fixtureId(25)}`);
      await expect(
        page.locator('.better-editor-tiptap[contenteditable="true"]').first(),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { exact: true, name: "Close assistant" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", {
          name: /^(Expand|Collapse) Browser folder$/,
        }),
      ).toBeVisible();
      await expect(page.locator("[data-chat-role]")).toHaveCount(16);
      await expect(page.locator('[data-slot="skeleton"]:visible')).toHaveCount(
        0,
      );
      const composer = page
        .getByRole("textbox", { exact: true, name: "Message" })
        .filter({ visible: true });
      await expect(composer).toBeEnabled();
      await composer.fill("Can you make a short shopping list?");
      const directory = info.outputPath("workspace-v2");
      await mkdir(directory, { recursive: true });
      const frame = await captureSettledShell(page, `${directory}/current.png`);
      const search = page.getByRole("button", {
        exact: true,
        name: "Search workspace",
      });
      await search.hover();
      await captureSettledShell(page, `${directory}/nav-hover.png`);
      await search.focus();
      await captureSettledShell(page, `${directory}/nav-focus.png`);
      const nav = await page
        .locator('[data-side="left"] [data-slot="sidebar-container"]')
        .boundingBox();
      const agent = await page
        .locator('[data-side="right"] [data-slot="sidebar-container"]')
        .boundingBox();
      const header = await page.locator("header[data-hidden]").boundingBox();
      expect(nav?.y).toBe(16);
      expect(agent?.y).toBe(16);
      expect(nav?.height).toBe(height - 32);
      expect(agent?.height).toBe(height - 32);
      expect(nav?.width).toBe(width === 1440 ? 216 : 240);
      expect(agent?.width).toBe(width === 1440 ? 400 : 424);
      expect(header?.width).toBe(width === 1440 ? 760 : 1192);
      await writeFile(
        `${directory}/mapping.json`,
        JSON.stringify(
          {
            content:
              "Existing disposable Browser note 25; route and chat interiors deferred. Content differs from approved garden fixture.",
            frame,
            reference: `docs/design-handoff/approved-workspace-v2/review/screens/garden-${width}-${theme}.png`,
            route: `/pages/${fixtureId(25)}`,
            theme,
            viewport: { height, width },
          },
          null,
          2,
        ),
      );
    });
  }
}
