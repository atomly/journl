import { expect, test } from "~/testing/browser/fixtures";
import { settleShell } from "~/testing/browser/shell-capture";
import {
  controlShellSearch,
  populateShellConversation,
} from "~/testing/browser/shell-responses";

for (const theme of ["light", "dark"])
  for (const viewport of [
    { height: 1000, width: 1440 },
    { height: 1112, width: 834 },
    { height: 844, width: 390 },
  ]) {
    test.describe(`${theme} ${viewport.width}`, () => {
      test.beforeEach(async ({ page }, info) => {
        test.skip(
          (info.project.name === "mobile-webkit") !== viewport.width <= 700,
          "Viewport belongs to the other browser project",
        );
        await page.setViewportSize(viewport);
        await page.addInitScript(
          (value) => localStorage.setItem("theme", value),
          theme,
        );
      });
      test("controlled search supports loading, results, empty, retry and keyboard navigation", async ({
        page,
      }) => {
        const control = await controlShellSearch(page);
        await page.goto("/explore");
        const trigger = page.getByRole("button", {
          exact: true,
          name: "Search notes",
        });
        await trigger.click();
        const dialog = page.getByRole("dialog");
        const input = page.getByPlaceholder("Search notes...");
        control.set("loading");
        await input.fill("synthetic search");
        await expect(
          dialog.locator('[data-slot="skeleton"]').first(),
        ).toBeVisible();
        control.set("results");
        await expect(
          dialog.getByText("Controlled result: Browser note 25"),
        ).toBeVisible();
        await expect(dialog.locator('[data-slot="skeleton"]')).toHaveCount(0);
        const field = dialog.locator('[data-slot="input-group"]');
        await expect(field).toHaveCSS(
          "background-color",
          theme === "light" ? "rgb(233, 239, 251)" : "rgb(16, 27, 48)",
        );
        await expect(field).toHaveCSS("border-radius", "12px");
        await expect(dialog).toHaveCSS(
          "border-top-left-radius",
          viewport.width <= 700 ? "24px" : "20px",
        );
        await expect(dialog.locator("[cmdk-item]").first()).toHaveCSS(
          "border-radius",
          "0px",
        );
        await expect(dialog.locator("[cmdk-item]").first()).toHaveCSS(
          "background-color",
          "rgba(0, 0, 0, 0)",
        );
        await expect(dialog.getByText("Results", { exact: true })).toHaveCount(
          0,
        );
        await expect(
          page
            .locator('[data-slot="dialog-overlay"]')
            .filter({ visible: true }),
        ).toHaveCSS("background-color", "rgba(5, 15, 32, 0.45)");

        const contrast = await dialog
          .locator("[cmdk-item] .line-clamp-2")
          .first()
          .evaluate((element) => {
            const canvas = document.createElement("canvas");
            canvas.width = canvas.height = 1;
            const context = canvas.getContext("2d");
            if (!context) throw new Error("Color sampling unavailable");
            const color = (css: string) => {
              context.clearRect(0, 0, 1, 1);
              context.fillStyle = css;
              context.fillRect(0, 0, 1, 1);
              return Array.from(context.getImageData(0, 0, 1, 1).data);
            };
            const surface = element.closest('[role="dialog"]');
            if (!surface) throw new Error("Search dialog missing");
            const background = color(getComputedStyle(surface).backgroundColor);
            const foreground = color(getComputedStyle(element).color);
            const blend = foreground
              .slice(0, 3)
              .map(
                (channel, index) =>
                  channel * ((foreground[3] ?? Number.NaN) / 255) +
                  (background[index] ?? Number.NaN) *
                    (1 - (foreground[3] ?? Number.NaN) / 255),
              );
            const luminance = (rgb: number[]) =>
              rgb.slice(0, 3).reduce((total, channel, index) => {
                const value = channel / 255;
                return (
                  total +
                  ([0.2126, 0.7152, 0.0722][index] ?? Number.NaN) *
                    (value <= 0.04045
                      ? value / 12.92
                      : ((value + 0.055) / 1.055) ** 2.4)
                );
              }, 0);
            const a = luminance(blend);
            const b = luminance(background);
            return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
          });
        expect(contrast).toBeGreaterThanOrEqual(4.5);
        await input.press("ArrowDown");
        const selected = dialog.locator('[cmdk-item][data-selected="true"]');
        await expect(selected).toHaveCount(1);
        const href = await selected.evaluate((node) =>
          node.closest("a")?.getAttribute("href"),
        );
        expect(href).toBeTruthy();
        await input.press("Enter");
        await expect(dialog).not.toBeVisible();
        await expect(page).toHaveURL(new RegExp(`${href}$`));
        await trigger.click();
        control.set("empty");
        await input.fill("synthetic empty");
        await expect(
          dialog.getByText("No results found.", { exact: true }),
        ).toBeVisible();
        await expect(dialog.locator("[cmdk-item]")).toHaveCount(0);
        control.set("error");
        await input.fill("synthetic retry");
        const retry = dialog.getByRole("button", {
          exact: true,
          name: "Try again",
        });
        await expect(retry).toBeEnabled();
        await expect(dialog.getByText("Search couldn’t load")).toBeVisible();
        control.set("results");
        await retry.click();
        await expect(
          dialog.getByText("Controlled result: Browser note 25"),
        ).toBeVisible();
        await expect(retry).toHaveCount(0);
        await page.keyboard.press("Escape");
        await expect(trigger).toBeFocused();
      });
      test("controlled populated assistant retains draft and reading position across collapse", async ({
        page,
      }) => {
        await populateShellConversation(page);
        await page.goto("/journal/2000-01-01");
        const mobile = viewport.width <= 700;
        const trigger = page.getByRole("button", {
          exact: true,
          name: mobile ? "Toggle Chat Drawer" : "Toggle Chat Sidebar",
        });
        if (await trigger.isVisible()) await trigger.click();
        const panel = page
          .getByRole("region", { exact: true, name: "Chat" })
          .filter({ visible: true });
        await expect(panel.locator("[data-chat-role]")).toHaveCount(16);
        const composer = panel.getByRole("textbox", {
          exact: true,
          name: "Message",
        });
        await expect(composer).toBeEnabled();
        await composer.fill("Retained controlled draft");
        const scroll = panel.locator('[data-slot="message-scroller-viewport"]');
        await settleShell(page);
        await scroll.evaluate((node) => {
          node.scrollTop = node.scrollHeight;
        });
        await expect(
          panel.getByText(
            "Synthetic conversation end. Keep one small observation for tomorrow.",
            { exact: true },
          ),
        ).toBeInViewport();
        await expect(
          panel
            .getByRole("button", { exact: true, name: "Copy response" })
            .last(),
        ).toBeEnabled();
        await scroll.evaluate((node) => {
          node.scrollTop = Math.floor(
            (node.scrollHeight - node.clientHeight) / 2,
          );
        });
        await expect
          .poll(() => scroll.evaluate((node) => node.scrollTop))
          .toBeGreaterThan(0);
        await settleShell(page);
        const readingPosition = async () =>
          scroll.evaluate((node) => {
            const viewport = node.getBoundingClientRect();
            const item = Array.from(
              node.querySelectorAll<HTMLElement>("[data-message-id]"),
            ).find(
              (item) => item.getBoundingClientRect().bottom > viewport.top + 1,
            );
            return item
              ? {
                  id: item.dataset.messageId,
                  offset: item.getBoundingClientRect().top - viewport.top,
                }
              : null;
          });
        const position = await readingPosition();
        expect(position).not.toBeNull();
        await page
          .getByRole("button", { exact: true, name: "Close assistant" })
          .click();
        await expect(trigger).toBeFocused();
        await trigger.click();
        await settleShell(page);
        await expect(composer).toHaveValue("Retained controlled draft");
        await expect
          .poll(async () => (await readingPosition())?.id)
          .toBe(position?.id);
        await expect
          .poll(async () =>
            Math.abs(
              ((await readingPosition())?.offset ?? Number.POSITIVE_INFINITY) -
                (position?.offset ?? 0),
            ),
          )
          .toBeLessThanOrEqual(2);
        await expect(panel.locator("[data-chat-role]")).toHaveCount(16);
      });
    });
  }
