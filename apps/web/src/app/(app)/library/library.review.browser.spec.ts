import { mkdir, writeFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { fixtureId } from "~/testing/browser/data";
import { expect, test } from "~/testing/browser/fixtures";
import { renderedTextContrast } from "~/testing/browser/rendered-contrast";
import {
  captureSettledShell,
  settleShell,
} from "~/testing/browser/shell-capture";
import { measureShellControls } from "~/testing/browser/shell-metrics";
import { populateShellConversation } from "~/testing/browser/shell-responses";
import { workspaceMessages } from "~/testing/browser/workspace-v2-data";

test.use({
  workspaceReview: true,
});
test.setTimeout(300_000);

/** The All pages plates keep Projects expanded beside the selected route row. */
async function openLibraryWorkspace(page: Page, theme: string) {
  await page.setViewportSize({ height: 1000, width: 1440 });
  await page.addInitScript(
    ({ expansionFolder, value }) => {
      localStorage.setItem("theme", value);
      localStorage.setItem(
        "journl:sidebar-expansion:v1:workspace-review",
        JSON.stringify({ [expansionFolder]: Date.now() }),
      );
    },
    { expansionFolder: fixtureId(1601), value: theme },
  );
  await page.context().addCookies([
    {
      name: "journl:preferences",
      url: "http://127.0.0.1:3100",
      value: encodeURIComponent(
        JSON.stringify({
          appSidebarOpen: true,
          appSidebarWidthRem: 13.5,
          chatSidebarOpen: true,
          chatSidebarWidthRem: 25,
          journalTimelineView: "entries",
        }),
      ),
    },
  ]);
  await populateShellConversation(page, workspaceMessages);
  await page.goto("/library", { timeout: 90_000 });
  await expect(page.getByRole("heading", { name: "All pages" })).toBeVisible();
}

function libraryRows(page: Page) {
  return page
    .locator('[role="table"][aria-label="Pages"] [role="row"]:has(a)')
    .filter({ visible: true });
}

async function openRowActions(row: ReturnType<Page["locator"]>) {
  await row.hover();
  const trigger = row.locator(".journl-library-actions");
  await trigger.click();
  return trigger;
}

const expectedRows: Array<[name: string, folder: string, tone: string]> = [
  ["Small balcony garden", "Projects", "mint"],
  ["Lemon & herb lentils", "Recipes", "peach"],
  ["Useful growing notes", "References", ""],
  ["Kitchen shelf build", "Projects", "mint"],
  ["Weekend market list", "Random notes", ""],
  ["Pantry shortcuts", "Recipes", "peach"],
  ["Seed packet notes", "References", ""],
];

for (const theme of ["light", "dark"]) {
  test(`library all pages ${theme}`, async ({ page }, info) => {
    test.skip(
      info.project.name === "mobile-webkit",
      "The All pages plates are desktop Chromium captures.",
    );
    await openLibraryWorkspace(page, theme);

    const rows = libraryRows(page);
    await expect(rows).toHaveCount(expectedRows.length);
    for (const [index, [name, folder, tone]] of expectedRows.entries()) {
      const row = rows.nth(index);
      await expect(row.getByRole("link", { exact: true, name })).toBeVisible();
      const badge = row.locator(".journl-library-badge");
      await expect(badge).toHaveText(folder);
      if (tone)
        await expect(badge).toHaveClass(new RegExp(`(^| )${tone}( |$)`));
    }

    // Approved shell geometry: navigation 216px, center 760px, assistant 400px.
    const nav = await page
      .locator('[data-side="left"] [data-slot="sidebar-container"]')
      .boundingBox();
    const agent = await page
      .locator('[data-side="right"] [data-slot="sidebar-container"]')
      .boundingBox();
    const header = await page.locator("header[data-hidden]").boundingBox();
    const reading = await page.locator("[data-app-container]").boundingBox();
    expect(nav).toMatchObject({ height: 968, width: 216, x: 16, y: 16 });
    expect(agent).toMatchObject({ height: 968, width: 400, x: 1024, y: 16 });
    expect(header).toMatchObject({ height: 62, width: 760, x: 248 });
    expect(reading?.x).toBe(header?.x);
    expect(reading?.width).toBe(760);
    expect(reading?.y).toBe((header?.y ?? 0) + 62);
    expect((reading?.y ?? 0) + (reading?.height ?? 0)).toBe(984);

    // Search, tabs and index row geometry.
    const searchPill = page.locator(".journl-library-search");
    const searchBox = await searchPill.boundingBox();
    expect(searchBox?.height).toBe(32);
    expect((searchBox?.width ?? 0) >= 145).toBe(true);
    const search = page.locator(".journl-library-search input");
    const newPageBox = await page
      .getByRole("main")
      .getByRole("button", { exact: true, name: "New page" })
      .boundingBox();
    expect(newPageBox?.height).toBe(32);
    const tabs = page.locator(".journl-library-tab");
    const activeTab = page.locator('.journl-library-tab[aria-current="page"]');
    await expect(activeTab).toHaveText("All pages");
    await expect(activeTab).toHaveCount(1);
    for (const tab of await tabs.all())
      expect((await tab.boundingBox())?.height).toBe(37);
    const table = await page
      .locator('[role="table"][aria-label="Pages"]')
      .boundingBox();
    const head = await page
      .locator('[role="table"][aria-label="Pages"] .journl-library-grid-head')
      .boundingBox();
    expect(head?.height).toBe(34);
    // The plate's table frame is a 1px border plus 6px horizontal padding
    // (review/workspace.css `.table`), so the head and every data row start
    // 7px inside the table's border box, aligned with each other.
    const rowInset = (table?.x ?? 0) + 7;
    expect(head?.x).toBe(rowInset);
    for (const row of await rows.all()) {
      const box = await row.boundingBox();
      expect(box?.height).toBe(48);
      expect(box?.x).toBe(rowInset);
    }
    const actionsBox = await rows
      .nth(0)
      .locator(".journl-library-actions")
      .boundingBox();
    expect(Math.round(actionsBox?.width ?? 0)).toBe(32);

    // The route header and navigation mark the current route.
    await expect(
      page.getByRole("button", { exact: true, name: "All pages route menu" }),
    ).toBeVisible();
    const navAllPages = page
      .locator('[data-side="left"]')
      .getByRole("link", { exact: true, name: "All pages" });
    await expect(navAllPages).toHaveAttribute("aria-current", "page");
    await expect(navAllPages).toHaveAttribute("data-active", "true");

    const measurements: unknown[] = [];
    for (const [label, target, minimum] of [
      ["active tab", activeTab, 4.5],
      ["inactive tab", tabs.filter({ hasText: "Folders" }), 4.5],
      [
        "column header",
        page.locator('[role="columnheader"]', { hasText: "Name" }),
        4.5,
      ],
      ["selected navigation row", navAllPages, 4.5],
      ["first row name", rows.nth(0).getByRole("link"), 4.5],
      ["second row name", rows.nth(1).getByRole("link"), 4.5],
      ["mint badge", rows.nth(0).locator(".journl-library-badge"), 4.5],
      ["peach badge", rows.nth(1).locator(".journl-library-badge"), 4.5],
      ["neutral badge", rows.nth(2).locator(".journl-library-badge"), 4.5],
    ] as const) {
      const contrast = await renderedTextContrast(target);
      expect(
        contrast.ratio,
        `${label} ${theme} rendered text`,
      ).toBeGreaterThanOrEqual(minimum);
      measurements.push({ label, state: "initial", ...contrast });
    }
    const rowIcon = await renderedTextContrast(
      rows.nth(0).getByRole("link"),
      "icons",
    );
    expect(rowIcon.ratio).toBeGreaterThanOrEqual(3);
    measurements.push({ label: "row page icon", ...rowIcon });

    await expect(page.locator('[data-slot="skeleton"]:visible')).toHaveCount(0);
    await expect(page.locator("[data-chat-role]")).toHaveCount(4);
    await settleShell(page);
    const controls = await measureShellControls(page);
    const directory = info.outputPath("library");
    await mkdir(directory, { recursive: true });
    const frame = await captureSettledShell(page, `${directory}/current.png`);

    // Name search narrows the flat index without losing other rows on return.
    await search.fill("garden");
    await expect(rows).toHaveCount(1);
    await expect(rows.nth(0).getByRole("link")).toHaveText(
      "Small balcony garden",
    );
    await search.fill("");
    await expect(rows).toHaveCount(expectedRows.length);

    // Rename stays inline; Escape restores the stored title without saving.
    await openRowActions(rows.nth(0));
    await page.getByRole("menuitem", { name: "Rename" }).click();
    const titleInput = page.getByLabel("Page title");
    await expect(titleInput).toHaveValue("Small balcony garden");
    await titleInput.press("Escape");
    await expect(titleInput).toBeHidden();
    await expect(rows.nth(0).getByRole("link")).toHaveText(
      "Small balcony garden",
    );

    // Deletion is a named confirmation, never one menu click away.
    await openRowActions(rows.nth(0));
    await page.getByRole("menuitem", { name: "Delete" }).click();
    const confirm = page.getByRole("dialog", { name: "Delete Page" });
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText("Small balcony garden");
    await confirm.getByRole("button", { name: "Cancel" }).click();
    await expect(confirm).toBeHidden();

    // Folders tab keeps every folder reachable with its direct page count.
    await page.locator(".journl-library-tab", { hasText: "Folders" }).click();
    const foldersTable = page.getByRole("table", { name: "Folders" });
    await expect(foldersTable).toBeVisible();
    await expect(page.getByRole("heading", { name: "Folders" })).toBeVisible();
    const projectsRow = foldersTable.locator('[role="row"]:has(a)', {
      hasText: "Projects",
    });
    await expect(projectsRow.getByRole("link")).toHaveText("Projects");
    await expect(projectsRow).toContainText("2 pages");

    await writeFile(
      `${directory}/mapping.json`,
      JSON.stringify(
        {
          controls,
          exclusions: [
            "Document and chat interiors use the application's bundled Inter face; the plates use system-ui. Font deltas are expected.",
            "The sidebar keeps the production Library tree control; the plates draw a Folders label with expanded roots.",
          ],
          frame,
          measurements,
          reference:
            "docs/design-handoff/approved-workspace-v2/review/screens/all-pages",
          route: "/library",
          theme,
          viewport: { height: 1000, width: 1440 },
        },
        null,
        2,
      ),
    );
  });

  test(`library table states ${theme}`, async ({ page }, info) => {
    test.skip(
      info.project.name === "mobile-webkit",
      "The table-states plate is a desktop Chromium capture.",
    );
    await openLibraryWorkspace(page, theme);
    const rows = libraryRows(page);
    await expect(rows).toHaveCount(expectedRows.length);

    // At rest the row ellipses are invisible and unreachable on fine pointers.
    const firstTrigger = rows.nth(0).locator(".journl-library-actions");
    await page.mouse.move(1400, 990);
    expect(
      await firstTrigger.evaluate((node) => getComputedStyle(node).opacity),
    ).toBe("0");
    expect(
      await firstTrigger.evaluate(
        (node) => getComputedStyle(node).pointerEvents,
      ),
    ).toBe("none");

    // Hovering the first row reveals its actions and the approved hover fill.
    await rows.nth(0).hover();
    expect(
      await firstTrigger.evaluate((node) => getComputedStyle(node).opacity),
    ).toBe("1");
    expect(
      await firstTrigger.evaluate(
        (node) => getComputedStyle(node).pointerEvents,
      ),
    ).toBe("auto");
    const hoverFill = await rows
      .nth(0)
      .evaluate((node) => getComputedStyle(node).backgroundColor);
    expect(hoverFill).not.toBe("rgba(0, 0, 0, 0)");

    // The third row opens its overflow exactly per the plate: the trigger
    // stays visible, Move to folder is highlighted, Delete stays destructive.
    const thirdTrigger = await openRowActions(rows.nth(2));
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    await expect(thirdTrigger).toBeVisible();
    const moveItem = page.getByRole("menuitem", { name: "Move to folder" });
    for (let step = 0; step < 4; step++) {
      if (await moveItem.evaluate((node) => node === document.activeElement))
        break;
      await page.keyboard.press("ArrowDown");
    }
    await expect(moveItem).toBeFocused();
    for (const name of ["Rename", "Duplicate", "Delete"]) {
      await expect(page.getByRole("menuitem", { name })).toBeVisible();
    }

    // Keep the plate's first-row hover while the overflow stays open.
    await rows.nth(0).hover();
    await expect(menu).toBeVisible();

    const measurements: unknown[] = [];
    for (const [label, target] of [
      ["Rename item", page.getByRole("menuitem", { name: "Rename" })],
      ["Move to folder item", moveItem],
      ["Duplicate item", page.getByRole("menuitem", { name: "Duplicate" })],
      ["Delete item", page.getByRole("menuitem", { name: "Delete" })],
    ] as const) {
      const contrast = await renderedTextContrast(target);
      expect(
        contrast.ratio,
        `${label} ${theme} rendered text`,
      ).toBeGreaterThanOrEqual(4.5);
      measurements.push({ label, state: "menu-open", ...contrast });
    }

    await expect(page.locator('[data-slot="skeleton"]:visible')).toHaveCount(0);
    await settleShell(page);
    const directory = info.outputPath("library-table-states");
    await mkdir(directory, { recursive: true });
    await captureSettledShell(page, `${directory}/current.png`);

    // Escape closes the overflow and returns focus to its trigger.
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(thirdTrigger).toBeFocused();

    await writeFile(
      `${directory}/mapping.json`,
      JSON.stringify(
        {
          measurements,
          reference:
            "docs/design-handoff/approved-workspace-v2/review/screens/table-states",
          route: "/library",
          state: "Hovered first row, open overflow on third row",
          theme,
          viewport: { height: 1000, width: 1440 },
        },
        null,
        2,
      ),
    );
  });
}
