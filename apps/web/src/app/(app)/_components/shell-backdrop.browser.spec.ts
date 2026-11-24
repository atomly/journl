import { writeFile } from "node:fs/promises";
import { pixelDifference } from "~/testing/browser/backdrop-pixels";
import { fixtureId } from "~/testing/browser/data";
import { expect, test } from "~/testing/browser/fixtures";
import { settleShell } from "~/testing/browser/shell-capture";
import { controlShellSearch } from "~/testing/browser/shell-responses";

for (const theme of ["light", "dark"])
  for (const kind of ["search", "menu", "navigation"]) {
    test(`${theme} ${kind} shell backdrop uses the approved scrim and measures rendered blur`, async ({
      page,
      browserName,
    }, info) => {
      await page.setViewportSize({ height: 844, width: 390 });
      await page.addInitScript(
        (value) => localStorage.setItem("theme", value),
        theme,
      );
      const search = await controlShellSearch(page);
      await page.goto(`/pages/${fixtureId(25)}`);
      const editor = page.locator(".better-editor-tiptap").first();
      await expect(editor).toBeVisible();
      const before = await editor.evaluate((root) =>
        JSON.stringify(
          (
            root as HTMLElement & { editor: { getJSON(): unknown } }
          ).editor.getJSON(),
        ),
      );
      const trigger = page.getByRole("button", {
        exact: true,
        name:
          kind === "search"
            ? "Search notes"
            : kind === "menu"
              ? "Route actions"
              : "Toggle Sidebar",
      });
      await trigger.click();
      if (kind === "search") {
        await page.getByPlaceholder("Search notes...").fill("synthetic search");
        await expect(
          page.getByRole("dialog").locator("[cmdk-item]"),
        ).toHaveCount(2);
      }
      const overlay = page
        .locator(
          kind === "navigation"
            ? '[data-slot="sheet-overlay"]'
            : '[data-slot="dialog-overlay"]',
        )
        .filter({ visible: true });
      await expect(overlay).toHaveCSS(
        "background-color",
        "rgba(5, 15, 32, 0.45)",
      );
      await expect(overlay).toHaveCSS("backdrop-filter", "blur(3px)");
      await settleShell(page);
      await page.screenshot({
        path: info.outputPath(`V03-${kind}-${theme}-${browserName}-390.png`),
        scale: "css",
      });
      const blurred = await page.screenshot({
        clip: { height: 84, width: 390, x: 0, y: 0 },
        scale: "css",
      });
      const originalStyle = await overlay.getAttribute("style");
      await overlay.evaluate((node) => {
        node.style.backdropFilter = "none";
        node.style.setProperty("-webkit-backdrop-filter", "none");
      });
      await settleShell(page);
      const sharp = await page.screenshot({
        clip: { height: 84, width: 390, x: 0, y: 0 },
        scale: "css",
      });
      const difference = await pixelDifference(page, blurred, sharp);
      await overlay.evaluate((node, style) => {
        if (style === null) node.removeAttribute("style");
        else node.setAttribute("style", style);
      }, originalStyle);
      if (browserName === "chromium") expect(difference).toBeGreaterThan(0.5);
      else if (difference < 0.1)
        info.annotations.push({
          description:
            "Linux WebKit screenshots omit backdrop blur in the independent minimal reproduction too. The 45% scrim remains visible; app content is never filtered. Real Safari rendering remains unverified.",
          type: "renderer-limitation",
        });
      await page.evaluate(() =>
        document.documentElement.classList.add("opaque-mode"),
      );
      await expect(overlay).toHaveCSS("backdrop-filter", "none");
      await page.evaluate(() =>
        document.documentElement.classList.remove("opaque-mode"),
      );
      await expect(overlay).toHaveCSS("backdrop-filter", "blur(3px)");
      if (browserName === "chromium") {
        const session = await page.context().newCDPSession(page);
        await session.send("Emulation.setEmulatedMedia", {
          features: [{ name: "prefers-reduced-transparency", value: "reduce" }],
        });
        await expect(overlay).toHaveCSS("backdrop-filter", "none");
        await session.send("Emulation.setEmulatedMedia", { features: [] });
        await page.emulateMedia({ forcedColors: "active" });
        await expect(overlay).toHaveCSS("backdrop-filter", "none");
        await page.emulateMedia({ forcedColors: "none" });
        await session.detach();
      }
      await page.keyboard.press("Escape");
      await expect(trigger).toBeFocused();
      expect(
        await editor.evaluate((root) =>
          JSON.stringify(
            (
              root as HTMLElement & { editor: { getJSON(): unknown } }
            ).editor.getJSON(),
          ),
        ),
      ).toBe(before);
      await writeFile(
        info.outputPath("backdrop-rendering.json"),
        JSON.stringify(
          {
            browserName,
            capturesBackdropBlur: difference > 0.5,
            difference,
            kind,
            theme,
          },
          null,
          2,
        ),
      );
      search.release();
    });
  }
