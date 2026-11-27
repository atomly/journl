import { mkdir, writeFile } from "node:fs/promises";
import { fixtureId } from "~/testing/browser/data";
import { expect, test } from "~/testing/browser/fixtures";
import { renderedTextContrast } from "~/testing/browser/rendered-contrast";
import {
  captureSettledShell,
  settleShell,
} from "~/testing/browser/shell-capture";
import {
  measureConversationAnchor,
  measureShellControls,
} from "~/testing/browser/shell-metrics";
import { populateShellConversation } from "~/testing/browser/shell-responses";
import { workspaceMessages } from "~/testing/browser/workspace-v2-data";

test.use({ workspaceReview: true });

for (const theme of ["light", "dark"]) {
  for (const mode of [
    "tablet",
    "nav-compact",
    "agent-closed",
    "agent-expanded",
    "mobile-nav",
    "mobile-agent",
    "tree-states",
  ]) {
    test(`v2 ${mode} ${theme}`, async ({ baseURL, page, context }, info) => {
      const mobile = mode.startsWith("mobile");
      test.skip(
        (info.project.name === "mobile-webkit") !== mobile,
        "Phone states use WebKit; desktop and tablet use Chromium",
      );
      const viewport = mobile
        ? { height: 844, width: 390 }
        : mode === "tablet"
          ? { height: 1112, width: 834 }
          : { height: 1000, width: 1440 };
      await page.setViewportSize(viewport);
      await page.addInitScript(
        (value) => localStorage.setItem("theme", value),
        theme,
      );
      await context.addCookies([
        {
          name: "journl:preferences",
          url: baseURL,
          value: encodeURIComponent(
            JSON.stringify({
              appSidebarOpen: mode !== "nav-compact",
              appSidebarWidthRem: 13.5,
              chatSidebarOpen:
                mode === "nav-compact" ||
                mode === "tree-states" ||
                mode === "agent-expanded",
              chatSidebarWidthRem: mode === "agent-expanded" ? 44 : 25,
              journalTimelineView: "entries",
            }),
          ),
        },
      ]);
      await populateShellConversation(page, workspaceMessages);
      await page.goto(`/pages/${fixtureId(1610)}`);
      await expect(
        page.locator('.better-editor-tiptap[contenteditable="true"]').first(),
      ).toBeVisible();
      const directory = info.outputPath("workspace-v2");
      await mkdir(directory, { recursive: true });
      if (mode === "mobile-nav")
        await page
          .getByRole("button", { exact: true, name: "Toggle Sidebar" })
          .click();
      if (mode === "mobile-nav")
        await expect(
          page
            .getByRole("dialog")
            .locator('[data-sidebar="footer"] button[aria-haspopup="menu"]')
            .last(),
        ).toBeInViewport();
      if (mode === "mobile-agent")
        await page
          .getByRole("button", { exact: true, name: "Toggle Chat Drawer" })
          .click();
      if (mode === "tree-states" || mode === "mobile-nav") {
        await expect(
          page
            .getByRole("button", { name: /^(Expand|Collapse) Projects$/ })
            .filter({ visible: true }),
        ).toBeVisible();
        await expect(
          page
            .getByRole("link", { exact: true, name: "Small balcony garden" })
            .filter({ visible: true }),
        ).toBeVisible();
      }
      if (
        mode === "mobile-agent" ||
        mode === "nav-compact" ||
        mode === "tree-states" ||
        mode === "agent-expanded"
      ) {
        const panel = page
          .getByRole("region", { exact: true, name: "Chat" })
          .filter({ visible: true });
        await expect(panel.locator("[data-chat-role]")).toHaveCount(4);
        const draft = panel.getByRole("textbox", {
          exact: true,
          name: "Message",
        });
        await expect(draft).toBeEnabled();
        await draft.fill("Can you make a short shopping list?");
        await draft.blur();
        const conversation = panel.locator(
          '[data-slot="message-scroller-viewport"]',
        );
        await conversation.dispatchEvent("wheel", { deltaY: mobile ? 1 : -1 });
        await conversation.evaluate((node, end) => {
          node.scrollTop = end ? node.scrollHeight : 0;
        }, mobile);
        await expect(
          panel.locator(
            `[data-message-id="${mobile ? "garden-a2" : "garden-q1"}"]`,
          ),
        ).toBeInViewport();
      }
      const measurements: unknown[] = [];
      const rowCaptures: unknown[] = [];
      if (mode === "tree-states") {
        const title = page
          .getByRole("link", { exact: true, name: "Small balcony garden" })
          .filter({ visible: true })
          .locator("span.truncate");
        // Row geometry is authored and asserted below (198px rows); whether
        // the fixture title fits depends on the host system font (the v2
        // system-ui stack, like the assistant launcher), so assert the
        // truncation mechanism and record the measured fit for review
        // instead of asserting host font metrics.
        const { available, content, ...truncation } = await title.evaluate(
          (node) => {
            const style = getComputedStyle(node);
            return {
              available: node.clientWidth,
              content: node.scrollWidth,
              overflow: style.overflow,
              textOverflow: style.textOverflow,
              whiteSpace: style.whiteSpace,
            };
          },
        );
        expect(truncation.overflow).toBe("hidden");
        expect(truncation.whiteSpace).toBe("nowrap");
        expect(truncation.textOverflow).toBe("ellipsis");
        measurements.push({
          available,
          content,
          fits: content <= available,
          label: "Small balcony garden",
          state: "fixture-title-fit",
        });
      }
      await expect(page.locator('[data-slot="skeleton"]:visible')).toHaveCount(
        0,
      );
      if (mode === "mobile-nav") {
        const closedActions = page
          .getByRole("dialog")
          .locator('[data-slot="swipe-action-reveal"][data-state="closed"]');
        expect(await closedActions.count()).toBeGreaterThan(0);
        for (const reveal of await closedActions.all())
          await expect(reveal).toBeHidden();
      }
      await settleShell(page);
      const controls = await measureShellControls(page);
      const frame = await captureSettledShell(page, `${directory}/current.png`);
      const conversationAnchor = await measureConversationAnchor(page);
      if (mode === "mobile-agent") {
        expect(conversationAnchor?.atEnd).toBe(true);
        expect(conversationAnchor?.lastVisible?.id).toBe("garden-a2");
      }
      if (
        mode === "nav-compact" ||
        mode === "tree-states" ||
        mode === "agent-expanded"
      ) {
        expect(conversationAnchor?.atStart).toBe(true);
        expect(conversationAnchor?.firstVisible?.id).toBe("garden-q1");
      }
      const header = await page.locator("header[data-hidden]").boundingBox();
      if (mobile) {
        expect(header?.x).toBe(0);
        expect(header?.y).toBe(0);
        expect(header?.width).toBe(390);
        expect(header?.height).toBe(60);
        const box = await page.getByRole("dialog").boundingBox();
        expect(box?.x).toBe(0);
        expect(box?.y).toBe(mode === "mobile-nav" ? 72 : 68);
        expect(box?.width).toBe(390);
        expect((box?.y ?? 0) + (box?.height ?? 0)).toBe(844);
      } else {
        const nav = await page
          .locator('[data-side="left"] [data-slot="sidebar-container"]')
          .boundingBox();
        expect(nav?.x).toBe(mode === "tablet" ? 12 : 16);
        if (mode === "tablet" || mode === "nav-compact") {
          expect(nav?.width).toBe(64);
          const rail = page.locator('[data-side="left"]');
          for (const name of [
            "Search workspace",
            "Journal",
            "Explore",
            "Library",
          ]) {
            const control = rail.getByRole(
              name === "Journal" || name === "Explore" ? "link" : "button",
              { exact: true, name },
            );
            await expect(control).toBeVisible();
            const bounds = await control.boundingBox();
            expect(bounds?.width, `${name} rail width`).toBe(40);
            expect(bounds?.height, `${name} rail height`).toBe(40);
            const label = control
              .locator("span")
              .filter({
                hasText: name === "Search workspace" ? "Search" : name,
              })
              .first();
            expect(
              await label.evaluate((node) => getComputedStyle(node).position),
            ).toBe("absolute");
            expect((await label.boundingBox())?.width).toBe(1);
          }
        }
        if (mode === "tablet") {
          expect(nav?.y).toBe(12);
          expect(header?.x).toBe(88);
          expect(header?.width).toBe(734);
        }
      }
      if (mode === "agent-expanded") {
        await expect(page.locator("[data-assistant-overlay]")).toHaveAttribute(
          "data-assistant-overlay",
          "true",
        );
        expect(
          (
            await page
              .locator('[data-side="right"] [data-slot="sidebar-container"]')
              .boundingBox()
          )?.width,
        ).toBe(704);
      }
      const metrics = await page.evaluate(() =>
        Object.fromEntries(
          Object.entries({
            brand: ".journl-navigation-header .journl-brand",
            header: "header[data-hidden]",
            newPage: ".journl-navigation-create > button",
            reading: "[data-app-container]",
          }).map(([key, selector]) => {
            const node = Array.from(
              document.querySelectorAll<HTMLElement>(selector),
            ).find((element) => element.getClientRects().length);
            if (!node) return [key, null];
            const style = getComputedStyle(node);
            return [
              key,
              {
                background: style.backgroundColor,
                borderRadius: style.borderRadius,
                box: node.getBoundingClientRect().toJSON(),
                color: style.color,
                font: style.font,
                padding: style.padding,
              },
            ];
          }),
        ),
      );
      if (mode === "tree-states") {
        const nav = page.locator('[data-side="left"]');
        for (const label of [
          "Projects",
          "Small balcony garden",
          "Kitchen shelf build",
          "Random notes",
        ]) {
          const nested =
            label === "Small balcony garden" || label === "Kitchen shelf build";
          const link = nested
            ? nav.getByRole("link", { exact: true, name: label })
            : nav.getByRole("button", {
                name: new RegExp(`^(Expand|Collapse) ${label}$`),
              });
          await link.scrollIntoViewIfNeeded();
          if (label === "Small balcony garden") {
            const { available, content } = await link
              .locator("span.truncate")
              .evaluate((node) => ({
                available: node.clientWidth,
                content: node.scrollWidth,
              }));
            measurements.push({
              available,
              content,
              fits: content <= available,
              label,
              state: "fixture-title-fit",
            });
          }
          await page.mouse.move(1400, 990);
          const normalContrast = await renderedTextContrast(link);
          expect(
            normalContrast.ratio,
            `${label} default text`,
          ).toBeGreaterThanOrEqual(4.5);
          measurements.push({
            label,
            state: label === "Small balcony garden" ? "selected" : "default",
            ...normalContrast,
          });
          await link.hover();
          await captureSettledShell(
            page,
            `${directory}/${label.replaceAll(" ", "-")}-hover.png`,
          );
          rowCaptures.push({
            image: `${directory}/${label.replaceAll(" ", "-")}-hover.png`,
            label,
            nesting: nested ? "Projects child" : "root folder",
            reference: "tree-states",
            scroll: await link.evaluate(
              (el) => el.closest("[data-sidebar=menu-sub]")?.scrollTop,
            ),
            state:
              label === "Small balcony garden" ? "selected-hover" : "hover",
          });
          const contrast = await renderedTextContrast(link);
          expect(
            contrast.ratio,
            `${label} ${theme} rendered text`,
          ).toBeGreaterThanOrEqual(4.5);
          measurements.push({ label, state: "hover", ...contrast });
          await page.mouse.move(1400, 990);
          await page.keyboard.press("Tab");
          await link.focus();
          expect(
            await link.evaluate((element) => element.matches(":focus-visible")),
          ).toBe(true);
          await expect(link).toBeFocused();
          const outline = await link.evaluate((element) => {
            const row =
              element.closest(
                '[data-sidebar="menu-sub-button"], [data-sidebar="menu-button"]',
              ) ?? element;
            const style = getComputedStyle(row);
            return {
              box: row.getBoundingClientRect().toJSON(),
              offset: style.outlineOffset,
              padding: style.padding,
              width: style.outlineWidth,
            };
          });
          expect(outline.box.x).toBe(25);
          expect(outline.box.width).toBe(198);
          expect(outline.width).toBe("2px");
          expect(outline.offset).toBe("1px");
          measurements.push({ label, outline, state: "focus" });
          const focusedContrast = await renderedTextContrast(link);
          expect(
            focusedContrast.ratio,
            `${label} focus text`,
          ).toBeGreaterThanOrEqual(4.5);
          measurements.push({ label, state: "focus", ...focusedContrast });
          await captureSettledShell(
            page,
            `${directory}/${label.replaceAll(" ", "-")}-focus.png`,
          );
          rowCaptures.push({
            image: `${directory}/${label.replaceAll(" ", "-")}-focus.png`,
            label,
            nesting: nested ? "Projects child" : "root folder",
            reference: "tree-states",
            state:
              label === "Small balcony garden" ? "selected-focus" : "focus",
          });
        }
        // Focus keeps a separate row's current-route fill visible.
        const selected = nav
          .locator('[data-active="true"]')
          .filter({ hasText: "Small balcony garden", visible: true })
          .first();
        await expect(selected).toBeVisible();
        const search = page.getByRole("button", {
          exact: true,
          name: "Search workspace",
        });
        const searchContrast = await renderedTextContrast(search);
        expect(searchContrast.ratio).toBeGreaterThanOrEqual(4.5);
        measurements.push({ label: "Search", ...searchContrast });
        const iconContrast = await renderedTextContrast(search, "icons");
        expect(
          iconContrast.ratio,
          "Search icon rendered contrast",
        ).toBeGreaterThanOrEqual(3);
        measurements.push({ label: "Search icon", ...iconContrast });
        const panel = page
          .getByRole("region", { exact: true, name: "Chat" })
          .filter({ visible: true });
        const modelContrast = await renderedTextContrast(
          panel.getByRole("combobox", { name: "Reasoning mode" }),
        );
        expect(modelContrast.ratio).toBeGreaterThanOrEqual(4.5);
        measurements.push({ label: "Model selector", ...modelContrast });
        const sendContrast = await renderedTextContrast(
          panel.getByRole("button", { exact: true, name: "Send message" }),
          "icons",
        );
        expect(sendContrast.ratio).toBeGreaterThanOrEqual(3);
        measurements.push({ label: "Enabled send icon", ...sendContrast });
      }
      if (mode === "mobile-nav") {
        const last = page
          .getByRole("dialog")
          .getByRole("button", { name: /^(Expand|Collapse) Random notes$/ });
        await last.scrollIntoViewIfNeeded();
        await expect(last).toBeInViewport();
        await expect(
          page
            .getByRole("dialog")
            .locator('[data-sidebar="footer"] button[aria-haspopup="menu"]')
            .last(),
        ).toBeInViewport();
        await captureSettledShell(page, `${directory}/scroll-end.png`);
        rowCaptures.push({
          image: `${directory}/scroll-end.png`,
          note: "Reachability capture; approved reference is at scroll start.",
          reference: "mobile-nav",
          state: "navigation-scroll-end",
        });
      }
      await writeFile(
        `${directory}/mapping.json`,
        JSON.stringify(
          {
            controls,
            conversationAnchor,
            exclusions: [
              "Document/editor interior and controlled chat history differ; downstream styling.",
              "Native-schema synthetic garden workspace; Library remains the existing tree control. No shell pixels masked.",
            ],
            frame,
            measurements,
            metrics,
            mode,
            reference: `docs/design-handoff/approved-workspace-v2/review/screens/${mode === "agent-expanded" ? "garden-1440" : mode}-${theme}.png`,
            referenceNote:
              mode === "agent-expanded"
                ? "Compatibility capability at 704px with overlay; reference is the 400px baseline, not an approved expanded plate."
                : undefined,
            route: `/pages/${fixtureId(1610)}`,
            rowCaptures,
            theme,
            viewport,
          },
          null,
          2,
        ),
      );
    });
  }
}
