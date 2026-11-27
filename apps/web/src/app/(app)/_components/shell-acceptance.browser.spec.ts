import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { browserFixture, fixtureId } from "~/testing/browser/data";
import { expect, test } from "~/testing/browser/fixtures";
import {
  captureSettledShell,
  settleShell,
} from "~/testing/browser/shell-capture";
import {
  controlShellSearch,
  populateShellConversation,
} from "~/testing/browser/shell-responses";
import groups from "~/testing/browser/shell-state-mappings.json" with {
  type: "json",
};

// State ownership comes from handoff 8093f79c; geometry follows approved workspace v2.
// Old canonical plates preserve state inventory, not superseded layout bounds.
// Controlled responses are browser-test data, never a claim of live-provider integration.
for (const group of groups)
  for (const [index, mapping] of group.images.entries()) {
    const id = `${group.stateId}--${mapping.theme}--${mapping.viewport.width}--${mapping.variant}--${index}`;
    test(id, async ({ baseURL, page, context }, info) => {
      test.skip(
        (info.project.name === "mobile-webkit") !==
          mapping.viewport.width <= 700,
        "Capture matrix uses explicit viewports; WebKit interaction checks run separately",
      );
      const root = path.join(info.project.outputDir, "shell-captures");
      await mkdir(root, { recursive: true });
      const search = await controlShellSearch(page);
      const chatState = ["chat-expanded", "chat-mobile-sheet"].includes(
        group.stateId,
      );
      if (chatState) await populateShellConversation(page);
      const status = {
        canonical: mapping.image,
        capture: "",
        gap: "",
        geometry: {} as Record<string, unknown>,
        geometryBeforeScreenshot: {} as Record<string, unknown>,
        geometryScreenshotConsistent: false,
        providerMode: chatState
          ? "controlled chat.create messages; real disposable thread creation"
          : group.stateId.startsWith("search-")
            ? "controlled search response"
            : "real disposable app data",
        stateId: group.stateId,
        status: "pending",
        terminalAssertions: [] as string[],
        theme: mapping.theme,
        variant: mapping.variant,
        viewport: mapping.viewport,
      };
      const record = () =>
        writeFile(
          `${root}/${id}.capture.json`,
          JSON.stringify(status, null, 2),
        );
      try {
        await page.setViewportSize(mapping.viewport);
        await page.addInitScript(
          (theme) => localStorage.setItem("theme", theme),
          mapping.theme,
        );
        await context.addCookies([
          {
            name: "journl:preferences",
            url: baseURL,
            value: encodeURIComponent(
              JSON.stringify({
                appSidebarOpen: true,
                appSidebarWidthRem: 13.5,
                chatSidebarOpen: false,
                // Approved assistant baseline is 400px (424 at 1920); the old
                // 704/480 expanded widths survive only as the compatibility
                // capability noted in workspace-v2-responsive's mapping.
                chatSidebarWidthRem: 25,
                journalTimelineView: "entries",
              }),
            ),
          },
        ]);
        const mobile = mapping.viewport.width <= 700;
        const route =
          group.stateId === "context-explore"
            ? "/explore"
            : group.stateId === "context-page" ||
                group.stateId === "mobile-header-recovery"
              ? `/pages/${fixtureId(25)}`
              : `/journal/${browserFixture.longJournalDate}`;
        await page.goto(route);
        if (route === "/explore")
          await expect(
            page.getByRole("heading", { name: "Pick up a thread" }),
          ).toBeVisible();
        else
          await expect(
            page
              .locator('.better-editor-tiptap[contenteditable="true"]')
              .first(),
          ).toBeVisible();
        await expect(
          page.getByRole("button", { exact: true, name: "Search notes" }),
        ).toBeVisible();
        const header = page.locator("header[data-hidden]");
        if (route.startsWith("/pages/"))
          await expect(header).toContainText("Browser folder");
        if (!mobile && mapping.viewport.width > 1100)
          await expect(
            page.getByRole("button", {
              name: /^(Expand|Collapse) Browser folder$/,
            }),
          ).toBeVisible();
        if (group.stateId.startsWith("search-")) {
          await page
            .getByRole("button", { exact: true, name: "Search notes" })
            .click();
          await expect(page.getByRole("dialog")).toBeVisible();
          if (["search-results", "search-empty"].includes(group.stateId)) {
            search.set(group.stateId === "search-empty" ? "empty" : "results");
            await page
              .getByPlaceholder("Search notes...")
              .fill("synthetic search");
            if (group.stateId === "search-results") {
              await expect(
                page
                  .getByRole("dialog")
                  .locator("[cmdk-item]")
                  .filter({ hasText: "Controlled result: Browser note 25" }),
              ).toBeVisible();
              await expect(
                page.getByRole("dialog").locator("[cmdk-item]"),
              ).toHaveCount(2);
            } else {
              await expect(
                page.getByText("No results found.", { exact: true }),
              ).toBeVisible();
              await expect(
                page.getByRole("dialog").locator("[cmdk-item]"),
              ).toHaveCount(0);
            }
            await expect(
              page.getByRole("dialog").locator('[data-slot="skeleton"]'),
            ).toHaveCount(0);
            await expect(
              page.getByRole("button", { exact: true, name: "Try again" }),
            ).toHaveCount(0);
          }
          if (group.stateId === "search-error") {
            search.set("error");
            await page.getByPlaceholder("Search notes...").fill("browser note");
            await expect(
              page.getByRole("button", { exact: true, name: "Try again" }),
            ).toBeVisible();
          }
          if (group.stateId === "search-loading") {
            search.set("loading");
            await page.getByPlaceholder("Search notes...").fill("browser note");
            await expect(
              page
                .locator('[data-slot="command-list"] [data-slot="skeleton"]')
                .first(),
            ).toBeVisible();
          }
        }
        if (["chat-expanded", "chat-mobile-sheet"].includes(group.stateId)) {
          await page
            .getByRole("button", {
              exact: true,
              name: mobile ? "Toggle Chat Drawer" : "Toggle Chat Sidebar",
            })
            .click();
          await expect(
            page.getByRole("button", { exact: true, name: "Close assistant" }),
          ).toBeVisible();
          await expect(
            page
              .getByRole("textbox", { exact: true, name: "Message" })
              .filter({ visible: true }),
          ).toBeEnabled();
        }
        if (
          group.stateId === "navigation-compact" &&
          !mobile &&
          mapping.viewport.width > 1100
        )
          await page
            .getByRole("button", { exact: true, name: "Toggle Sidebar" })
            .click();
        if (group.stateId === "navigation-mobile") {
          if (mobile)
            await page
              .getByRole("button", { exact: true, name: "Toggle Sidebar" })
              .click();
          else {
            await page
              .getByRole("button", { exact: true, name: "Route actions" })
              .click();
            await page
              .getByRole("button", { exact: true, name: "Notebook navigation" })
              .click();
          }
          await expect(
            page.getByRole("dialog", { name: "Notebook navigation" }),
          ).toBeVisible();
          await page
            .getByRole("dialog", { name: "Notebook navigation" })
            .getByRole("button", {
              exact: true,
              name: "Expand Browser folder",
            })
            .click();
          await expect(
            page.getByRole("link", { exact: true, name: "Browser note 01" }),
          ).toBeVisible();
        }
        if (group.stateId === "resize-boundaries" && !mobile) {
          await page
            .getByRole("separator", { name: "Resize navigation" })
            .focus();
          await page.keyboard.press("End");
        }
        if (group.stateId === "narrow-route-actions") {
          await page
            .getByRole("button", { exact: true, name: "Route actions" })
            .click();
          await expect(page.getByRole("dialog")).toBeVisible();
        }
        if (group.stateId === "journal-route-menu") {
          await page
            .getByRole("button", { exact: true, name: "Journal route menu" })
            .click();
          await expect(
            page.getByRole("button", {
              exact: true,
              name: "Browse dates / history",
            }),
          ).toBeVisible();
        }
        if (group.stateId.startsWith("mobile-header-") && mobile) {
          const scroller = page.locator("[data-app-container]");
          await scroller.evaluate((node) => {
            node.scrollTop = 600;
          });
          await expect(header).toHaveAttribute("data-hidden", "true");
          if (group.stateId === "mobile-header-focus") {
            await page.keyboard.press("Tab");
            await header
              .getByRole("button", { exact: true, name: "Search notes" })
              .focus();
            await expect
              .poll(async () => (await header.boundingBox())?.y)
              .toBe(0);
          }
          if (group.stateId === "mobile-header-revealed") {
            await scroller.evaluate((node) => {
              node.scrollTop = 400;
            });
            await expect(header).toHaveAttribute("data-hidden", "false");
          }
        }
        if (group.stateId === "mobile-header-recovery") {
          await page.route("**/api/trpc/pages.saveTransactions**", (route) =>
            route.abort(),
          );
          await page
            .locator('.better-editor-tiptap[contenteditable="true"]')
            .first()
            .fill("Synthetic unsaved shell recovery capture");
          await expect(
            page.getByRole("button", { name: "Review drafts" }),
          ).toBeVisible();
        }
        if (
          group.stateId === "navigation-mobile" &&
          mapping.variant !== "initial"
        ) {
          const sheet = page.getByRole("dialog", {
            name: "Notebook navigation",
          });
          for (let attempt = 0; attempt < 8; attempt++) {
            await sheet.evaluate((node) => {
              for (const element of [
                node,
                ...Array.from(node.querySelectorAll("*")),
              ])
                if (
                  element.scrollHeight > element.clientHeight &&
                  /auto|scroll/.test(getComputedStyle(element).overflowY)
                )
                  element.scrollTop = element.scrollHeight;
            });
            if (
              await sheet
                .locator(
                  `a[data-sidebar="menu-sub-button"][href="/pages/${fixtureId(28)}"]`,
                )
                .count()
            )
              break;
            await page.waitForTimeout(150);
          }
          await sheet
            .locator(
              `a[data-sidebar="menu-sub-button"][href="/pages/${fixtureId(28)}"]`,
            )
            .scrollIntoViewIfNeeded();
          await sheet
            .locator("[data-shell-navigation-body]")
            .evaluate((node) => {
              node.scrollTop = node.scrollHeight;
            });
          await expect(
            sheet
              .locator('[data-sidebar="footer"] button[aria-haspopup="menu"]')
              .last(),
          ).toBeInViewport();
        }
        if (
          mapping.variant !== "initial" &&
          group.stateId !== "navigation-mobile"
        ) {
          await page
            .locator(
              '[role="dialog"] [data-sidebar="content"], [data-app-container]',
            )
            .last()
            .evaluate((node) => {
              for (const element of [
                node,
                ...Array.from(node.querySelectorAll("*")),
              ])
                if (
                  element.scrollHeight > element.clientHeight &&
                  /auto|scroll/.test(getComputedStyle(element).overflowY)
                )
                  element.scrollTop = element.scrollHeight;
            });
        }
        if (!mobile || group.stateId === "navigation-mobile")
          await expect(
            page
              .locator('[data-sidebar="footer"] button[aria-haspopup="menu"]')
              .first(),
          ).toBeVisible();
        // Terminal assertions run before animation settling and are checked again by
        // the unchanged before/after screenshot geometry contract.
        if (chatState) {
          const panel = page
            .getByRole("region", { exact: true, name: "Chat" })
            .filter({ visible: true });
          await expect(panel.locator("[data-chat-role]")).toHaveCount(16);
          await expect(
            panel.getByRole("textbox", { exact: true, name: "Message" }),
          ).toBeEnabled();
          const composer = panel.getByRole("textbox", {
            exact: true,
            name: "Message",
          });
          await composer.fill("Synthetic draft: help me keep one observation.");
          await expect(composer).toHaveValue(
            "Synthetic draft: help me keep one observation.",
          );
          await expect(
            panel.getByRole("button", { exact: true, name: "Send message" }),
          ).toBeEnabled();
          const scroll = panel.locator(
            '[data-slot="message-scroller-viewport"]',
          );
          await settleShell(page);
          await scroll.evaluate((node, end) => {
            node.scrollTop = end ? node.scrollHeight : 0;
          }, mapping.variant === "content-end");
          const marker =
            mapping.variant === "content-end"
              ? "Synthetic conversation end. Keep one small observation for tomorrow."
              : "Synthetic question 1.";
          await expect(
            panel.getByText(marker, { exact: false }).first(),
          ).toBeInViewport();
          if (mapping.variant === "content-end")
            await expect(
              panel
                .getByRole("button", { exact: true, name: "Copy response" })
                .last(),
            ).toBeInViewport();
          if (mobile)
            await expect
              .poll(async () =>
                Math.round(
                  (await page.getByRole("dialog").boundingBox())?.y ?? -1,
                ),
              )
              .toBe(68);
          status.terminalAssertions.push(
            "16 populated native messages; synthetic composer draft and enabled Send; intended conversation scroll endpoint visible",
          );
        } else if (!group.stateId.startsWith("search-")) {
          await expect(
            page
              .getByRole("region", { exact: true, name: "Chat" })
              .filter({ visible: true }),
          ).toHaveCount(0);
          if (!(await page.getByRole("dialog").count()))
            await expect(
              page.getByRole("button", {
                exact: true,
                name: mobile ? "Toggle Chat Drawer" : "Toggle Chat Sidebar",
              }),
            ).toBeVisible();
          status.terminalAssertions.push(
            "assistant closed; floating control visible when no modal is active",
          );
        }
        if (group.stateId === "search-initial") {
          await expect(
            page.getByText("Write something to search.", { exact: true }),
          ).toBeVisible();
          await expect(page.getByPlaceholder("Search notes...")).toBeEmpty();
        }
        if (group.stateId.startsWith("search-")) {
          await expect(page.getByPlaceholder("Search notes...")).toBeEnabled();
          status.terminalAssertions.push(
            `actual ${group.stateId} branch asserted; input enabled`,
          );
        }
        if (group.stateId === "context-page") {
          // Save-safety acceptance can rename this shared synthetic page.
          // The breadcrumb must reflect its current title, not its seed title.
          const title = page.getByPlaceholder("New page");
          await expect(title).not.toHaveValue("");
          await expect(header).toContainText(
            `Browser folder / ${await title.inputValue()}`,
          );
        }
        if (group.stateId === "context-explore")
          await expect(header).toContainText("Explore");
        if (group.stateId === "context-journal")
          await expect(header).toContainText("January 1, 2000");
        if (group.stateId === "navigation-mobile") {
          await expect(
            page.getByRole("dialog", { name: "Notebook navigation" }),
          ).toBeVisible();
          if (mapping.variant === "scroll-end")
            await expect(
              page
                .getByRole("dialog")
                .locator('[data-sidebar="footer"] button[aria-haspopup="menu"]')
                .last(),
            ).toBeInViewport();
          status.terminalAssertions.push(
            `navigation ${mapping.variant} controls visible inside bounded overlay`,
          );
        }
        if (group.stateId === "navigation-compact" && !mobile)
          await expect(
            page.locator('[data-side="left"] [data-slot="sidebar-container"]'),
          ).toHaveCSS("width", "64px");
        if (group.stateId === "resize-boundaries" && !mobile)
          await expect(
            page.getByRole("separator", { name: "Resize navigation" }),
          ).toHaveAttribute("aria-valuenow", "320");
        if (
          ["narrow-route-actions", "journal-route-menu"].includes(group.stateId)
        )
          await expect(
            page.getByRole("button", { exact: true, name: "Today" }),
          ).toBeVisible();
        if (group.stateId === "mobile-header-recovery")
          await expect(
            page.getByRole("button", { name: "Review drafts" }),
          ).toBeInViewport();
        status.terminalAssertions.push(
          `runtime shell counterpart for ${group.stateId} at ${mapping.viewport.width}px; native route contents retained`,
        );
        await expect(
          page.locator('[data-slot="skeleton"]:visible'),
        ).toHaveCount(group.stateId === "search-loading" ? 3 : 0);
        status.terminalAssertions.push(
          "no unexpected visible loading placeholders",
        );
        const frame = await captureSettledShell(page, `${root}/${id}.png`);
        const geometry = frame.after;
        status.geometryBeforeScreenshot = frame.before;
        const bounds = geometry as Record<
          string,
          {
            box: {
              x: number;
              y: number;
              width: number;
              height: number;
              right: number;
              bottom: number;
            };
          } | null
        >;
        const navWidth =
          mapping.viewport.width <= 1100 ||
          group.stateId === "navigation-compact"
            ? 64
            : group.stateId === "resize-boundaries"
              ? 320
              : 216;
        const inset = mapping.viewport.width <= 1100 ? 12 : 16;
        expect(bounds.header?.box.x).toBe(mobile ? 0 : navWidth + inset * 2);
        expect(bounds.header?.box.width).toBe(
          mobile
            ? mapping.viewport.width
            : mapping.viewport.width > 1100
              ? bounds.main?.box.width
              : mapping.viewport.width - navWidth - inset * 3,
        );
        expect(bounds.header?.box.height).toBe(mobile ? 60 : 62);
        expect(bounds.main?.box.x).toBe(bounds.header?.box.x);
        const hiddenHeader = await header.evaluate(
          (node) =>
            node.getAttribute("data-hidden") === "true" &&
            !node.querySelector(":focus-visible"),
        );
        expect(bounds.main?.box.y).toBe(
          mobile ? (hiddenHeader ? 0 : 60) : inset + 62,
        );
        expect(bounds.main?.box.bottom).toBe(
          mapping.viewport.height - (mobile ? 0 : inset),
        );
        if (
          bounds.dialog &&
          mobile &&
          (chatState || group.stateId === "navigation-mobile")
        ) {
          expect(bounds.dialog.box.x).toBe(0);
          expect(bounds.dialog.box.y).toBe(chatState ? 68 : 72);
          expect(bounds.dialog.box.width).toBe(mapping.viewport.width);
          expect(bounds.dialog.box.bottom).toBe(mapping.viewport.height);
        } else if (bounds.dialog) {
          expect(bounds.dialog.box.x).toBeGreaterThanOrEqual(12);
          expect(bounds.dialog.box.y).toBeGreaterThanOrEqual(12);
          expect(bounds.dialog.box.right).toBeLessThanOrEqual(
            mapping.viewport.width - 12,
          );
          expect(bounds.dialog.box.bottom).toBeLessThanOrEqual(
            mapping.viewport.height - 12 + 0.1,
          );
        }
        if (chatState && !mobile) {
          expect(bounds.assistant?.box.y).toBe(
            mapping.viewport.width > 1100 ? 16 : 86,
          );
          // Desktop chat states assert the approved 400px baseline. The
          // tablet branch measures the legacy overlay capability, not an
          // approved plate (the tablet plate keeps the assistant closed).
          expect(bounds.assistant?.box.width).toBe(
            mapping.viewport.width <= 1100 ? mapping.viewport.width - 100 : 400,
          );
        }
        status.terminalAssertions.push(
          "approved viewport-specific shell bounds; before/after screenshot geometry identical",
        );
        status.geometry = geometry;
        status.geometryScreenshotConsistent = true;
        status.capture = `${root}/${id}.png`;
        status.status = "terminal-state-and-geometry-asserted";
        status.gap =
          "Controlled-response shell presentation acceptance; live provider integration and full route styling are outside these assertions.";
        await record();
      } catch (error) {
        status.status = "failed";
        status.gap = String(error);
        await record();
        throw error;
      } finally {
        search.release();
      }
    });
  }
