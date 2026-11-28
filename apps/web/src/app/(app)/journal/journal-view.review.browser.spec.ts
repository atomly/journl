import { mkdir, writeFile } from "node:fs/promises";
import { expect, test } from "~/testing/browser/fixtures";
import { renderedTextContrast } from "~/testing/browser/rendered-contrast";
import {
  captureSettledShell,
  settleShell,
} from "~/testing/browser/shell-capture";
import { measureShellControls } from "~/testing/browser/shell-metrics";
import {
  populateShellConversation,
  shellMessages,
} from "~/testing/browser/shell-responses";

test.use({ journalPagination: true });

// The pagination fixture seeds twelve journal days ending 2020-01-31; the
// approved plate composes the same view around November 20. Both are the
// newest day with stored writing, so the spec selects the seeded date and
// records the substitution next to the capture instead of changing seed data.
const SELECTED_DATE = "2020-01-31";
const SELECTED_HEADING = "Friday, January 31, 2020";

for (const theme of ["light", "dark"]) {
  test(`journal Entries view ${theme} matches the approved plate`, async ({
    page,
  }, info) => {
    test.skip(
      info.project.name !== "desktop-chromium",
      "Journal plates are 1440 desktop views",
    );
    const viewport = { height: 1000, width: 1440 };
    await page.setViewportSize(viewport);
    await page.addInitScript(
      (value) => localStorage.setItem("theme", value),
      theme,
    );
    await populateShellConversation(page, shellMessages);
    await page.goto("/journal");
    await expect(
      page.getByText("Pagination entry 1", { exact: true }),
    ).toBeVisible();

    const measurements: unknown[] = [];
    const rowCaptures: unknown[] = [];
    const directory = info.outputPath("journal-view");
    await mkdir(directory, { recursive: true });

    // Panel geometry: the approved journal plate is the 1440 workspace with
    // navigation 216px, a 760px reading column under a 62px route bar, and a
    // 400px assistant, all inset 16px and ending at y=984.
    const navigation = await page
      .locator('[data-side="left"] [data-slot="sidebar-container"]')
      .boundingBox();
    expect(navigation?.x).toBe(16);
    expect(navigation?.y).toBe(16);
    expect(navigation?.width).toBe(216);
    expect(navigation?.height).toBe(968);
    const assistant = await page
      .locator('[data-side="right"] [data-slot="sidebar-container"]')
      .boundingBox();
    expect(assistant?.x).toBe(1024);
    expect(assistant?.y).toBe(16);
    expect(assistant?.width).toBe(400);
    expect(assistant?.height).toBe(968);
    const reading = await page.locator("[data-app-container]").boundingBox();
    expect(reading?.x).toBe(248);
    expect(reading?.y).toBe(78);
    expect(reading?.width).toBe(760);
    expect(reading?.height).toBe(906);

    // Navigation: the Journal row carries the plate's selected-route state.
    const selected = page
      .locator('[data-sidebar="menu-button"][data-active="true"]')
      .filter({ hasText: "Journal" });
    await expect(selected).toBeVisible();
    const ink = theme === "dark" ? "rgb(196, 206, 255)" : "rgb(39, 63, 157)";
    const fill = theme === "dark" ? "rgb(48, 63, 114)" : "rgb(217, 223, 255)";
    const hoverFill =
      theme === "dark" ? "rgb(58, 77, 137)" : "rgb(203, 212, 255)";
    await expect(selected).toHaveCSS("background-color", fill);
    await expect(selected).toHaveCSS("color", ink);
    await expect(selected).toHaveCSS("font-weight", "650");
    await expect(selected).toHaveCSS("height", "36px");
    await expect(selected).toHaveCSS("border-radius", "7px");
    const selectedBox = await selected.boundingBox();
    expect(selectedBox?.x).toBe(25);
    expect(selectedBox?.width).toBe(198);
    const selectedContrast = await renderedTextContrast(selected);
    expect(
      selectedContrast.ratio,
      `${theme} selected Journal route text`,
    ).toBeGreaterThanOrEqual(4.5);
    await selected.hover();
    await expect(selected).toHaveCSS("background-color", hoverFill);
    const selectedHoverContrast = await renderedTextContrast(selected);
    expect(
      selectedHoverContrast.ratio,
      `${theme} selected Journal route hover text`,
    ).toBeGreaterThanOrEqual(4.5);
    measurements.push(
      { label: "Journal route", state: "selected", ...selectedContrast },
      {
        label: "Journal route",
        state: "selected-hover",
        ...selectedHoverContrast,
      },
    );
    await page.mouse.move(1400, 990);

    const headerModes = page
      .locator("header[data-hidden]")
      .getByRole("group", { name: "Journal view" });
    const entriesTab = headerModes.getByRole("button", {
      exact: true,
      name: "Entries",
    });
    const timelineTab = headerModes.getByRole("button", {
      exact: true,
      name: "Timeline",
    });
    await expect(entriesTab).toHaveAttribute("aria-pressed", "true");
    await expect(timelineTab).toHaveAttribute("aria-pressed", "false");
    const inactiveFill = await timelineTab.evaluate(
      (tab) => getComputedStyle(tab).backgroundColor,
    );
    await expect(entriesTab).not.toHaveCSS("background-color", inactiveFill);
    const entriesContrast = await renderedTextContrast(entriesTab);
    expect(
      entriesContrast.ratio,
      `${theme} selected Entries tab text`,
    ).toBeGreaterThanOrEqual(4.5);
    measurements.push({
      label: "Entries tab",
      state: "selected",
      ...entriesContrast,
    });
    await timelineTab.hover();
    const timelineHoverContrast = await renderedTextContrast(timelineTab);
    expect(
      timelineHoverContrast.ratio,
      `${theme} Timeline tab hover text`,
    ).toBeGreaterThanOrEqual(4.5);
    measurements.push({
      label: "Timeline tab",
      state: "hover",
      ...timelineHoverContrast,
    });
    const dateTrigger = page.getByRole("button", {
      exact: true,
      name: "Browse journal dates",
    });
    await dateTrigger.click();
    const popover = page.getByRole("dialog", { name: "Journal dates" });
    await expect(popover.getByRole("grid")).toBeVisible();
    await expect(popover.getByRole("button", { name: "Today" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(popover).toBeHidden();

    // Entries rows: the plate's journal-entry rows map to day blocks in the
    // reading stage, separated by the approved workspace hairline.
    const rows = page.locator("[data-journal-entry]");
    await expect(rows.nth(1)).toContainText(SELECTED_HEADING);
    const row = rows.nth(1);
    const rowBox = await row.boundingBox();
    expect(rowBox?.x).toBe(248);
    expect(rowBox?.width).toBe(760);
    const rowStyles = await row.evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        borderBottomColor: style.borderBottomColor,
        borderBottomWidth: style.borderBottomWidth,
        paddingBottom: style.paddingBottom,
        paddingTop: style.paddingTop,
      };
    });
    expect(rowStyles.borderBottomWidth).toBe("1px");
    expect(rowStyles.borderBottomColor).toBe(
      theme === "dark" ? "rgb(44, 44, 48)" : "rgb(217, 218, 222)",
    );
    expect(rowStyles.paddingTop).toBe("32px");
    expect(rowStyles.paddingBottom).toBe("80px");
    // The day title sits in the approved content column (the plate aligns the
    // day heading with the entry text), in title ink at the approved size.
    const heading = row.locator("h2");
    const headingLink = heading.getByRole("link");
    await expect(headingLink).toHaveAttribute(
      "href",
      `/journal/${SELECTED_DATE}`,
    );
    const headingBox = await heading.boundingBox();
    expect(headingBox?.x).toBe(320);
    const headingStyles = await heading.evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        color: style.color,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
      };
    });
    expect(headingStyles.fontSize).toBe("48px");
    expect(headingStyles.fontWeight).toBe("700");
    expect(headingStyles.color).toBe(
      theme === "dark" ? "rgb(242, 242, 243)" : "rgb(32, 33, 36)",
    );
    const headingContrast = await renderedTextContrast(heading);
    expect(
      headingContrast.ratio,
      `${theme} journal day heading`,
    ).toBeGreaterThanOrEqual(4.5);
    measurements.push({
      label: SELECTED_HEADING,
      state: "list-row-heading",
      ...headingContrast,
    });

    // Select the first seeded day: the plate's November 20 selected-entry
    // state, substituted with the seeded 2020-01-31 fixture date.
    await headingLink.click();
    await page.waitForURL(`**/journal/${SELECTED_DATE}`);
    await expect(
      page.getByText("Pagination entry 1", { exact: true }),
    ).toBeVisible();
    await expect(dateTrigger).toHaveText("Jan 31");
    const day = page.locator("[data-journal-entry]").first();
    const dayBox = await day.boundingBox();
    expect(dayBox?.x).toBe(248);
    expect(dayBox?.width).toBe(760);
    const dayHeading = day.locator("h2");
    await expect(dayHeading).toHaveText(SELECTED_HEADING);
    await dayHeading.scrollIntoViewIfNeeded();
    await settleShell(page);
    const dayHeadingBox = await dayHeading.boundingBox();
    expect(dayHeadingBox?.x).toBe(320);
    const dayHeadingStyles = await dayHeading.evaluate((node) => {
      const style = getComputedStyle(node);
      return { color: style.color, fontWeight: style.fontWeight };
    });
    expect(dayHeadingStyles.fontWeight).toBe("700");
    expect(dayHeadingStyles.color).toBe(
      theme === "dark" ? "rgb(242, 242, 243)" : "rgb(32, 33, 36)",
    );
    await expect(async () => {
      const contrast = await renderedTextContrast(
        dayHeading.getByRole("link", { name: SELECTED_HEADING }),
      );
      expect(
        contrast.ratio,
        `${theme} selected day heading`,
      ).toBeGreaterThanOrEqual(4.5);
      measurements.push({
        label: SELECTED_HEADING,
        state: "selected-day-heading",
        ...contrast,
      });
    }).toPass({ timeout: 15_000 });

    await settleShell(page);
    const controls = await measureShellControls(page);
    const frame = await captureSettledShell(page, `${directory}/current.png`);
    rowCaptures.push({
      image: `${directory}/current.png`,
      label: "Selected day",
      reference: "journal",
      state: `selected-day-${theme}`,
    });
    await selected.hover();
    await captureSettledShell(page, `${directory}/journal-route-hover.png`);
    rowCaptures.push({
      image: `${directory}/journal-route-hover.png`,
      label: "Journal route",
      reference: "journal",
      state: `selected-route-hover-${theme}`,
    });
    await page.mouse.move(1400, 990);

    await writeFile(
      `${directory}/mapping.json`,
      JSON.stringify(
        {
          controls,
          exclusions: [
            "Editor interior uses BetterEditor's own type scale; plate paragraphs are scene text.",
            "The plate's 8:35 AM/12:10 PM intra-day time labels have no app equivalent: app rows are day documents, and the plate's per-entry titles map to the day headings.",
            "The plate's New entry pill maps to inline writing in the day block (behavior), and its bar pills and date picker stay visible in the wide Journal header.",
            "Assistant conversation text is the shared synthetic shell history, not the plate's journal Q&A.",
          ],
          frame,
          measurements,
          reference: `docs/design-handoff/approved-workspace-v2/review/screens/journal-${theme}.png`,
          referenceNote: `Plate composes November 20; this capture selects the seeded ${SELECTED_DATE} (the fixture's newest stored day) instead of changing seed data.`,
          route: `/journal/${SELECTED_DATE}`,
          rowCaptures,
          selectedDate: SELECTED_DATE,
          theme,
          viewport,
        },
        null,
        2,
      ),
    );
  });
}
