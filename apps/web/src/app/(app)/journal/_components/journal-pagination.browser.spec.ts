import type { Locator, Page } from "@playwright/test";
import { expect, test } from "~/testing/browser/fixtures";

test.use({ journalPagination: true });

async function entriesView(page: Page) {
  await page.goto("/journal");
  const toggle = page.getByRole("button", { name: /^(Entries|Timeline)$/ });
  await expect(toggle).toBeVisible();
  if ((await toggle.getAttribute("aria-pressed")) !== "true")
    await toggle.click();
  await expect(
    page.getByText("Pagination entry 1", { exact: true }),
  ).toBeVisible();
  return page
    .locator("div.overflow-auto")
    .filter({ has: page.locator("[data-viewport-type]") });
}

// Virtualized rows may unmount as soon as they leave a narrow viewport. Visit
// each assertion target instead of assuming previously loaded rows stay in DOM.
async function scrollToOlder(scroller: Locator, target: Locator) {
  await expect(async () => {
    if (await target.count())
      await target.scrollIntoViewIfNeeded({ timeout: 1000 });
    else
      await scroller.evaluate((element) => {
        element.scrollTop += Math.max(1, element.clientHeight * 0.5);
      });
    await expect(target).toBeInViewport({ timeout: 1000 });
  }).toPass({ timeout: 30_000 });
}

test("Entries scrolls past an unreadable stored document to healthy older writing", async ({
  page,
}) => {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("journal.saveTransactions"))
      writes.push(request.url());
  });
  const scroller = await entriesView(page);
  const unavailable = page.locator("[data-journal-content-unavailable]");
  await scrollToOlder(scroller, unavailable);
  await expect(unavailable).toContainText("Its saved content is unchanged");
  await expect(unavailable.locator('[contenteditable="true"]')).toHaveCount(0);
  await expect(
    page.getByText("Failed to fetch journal entries", { exact: false }),
  ).toHaveCount(0);
  await scrollToOlder(
    scroller,
    page.getByText("Pagination entry 12", { exact: true }),
  );
  await scroller.evaluate((element) => {
    element.scrollTop = 0;
  });
  await expect(
    page.getByText("Pagination entry 1", { exact: true }),
  ).toBeVisible();
  expect(writes).toEqual([]);
});

test("a failed next-page request preserves loaded entries and Retry resumes pagination", async ({
  page,
}) => {
  const pattern = "**/api/trpc/journal.getEntries**";
  await page.route(pattern, async (route) => {
    const input =
      new URL(route.request().url()).searchParams.get("input") ?? "";
    if (/"cursor":"/.test(input)) await route.abort();
    else await route.continue();
  });
  const scroller = await entriesView(page);
  await expect(async () => {
    await scroller.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect(
      page.getByText(
        "Couldn’t load older entries. Your loaded entries are still here.",
      ),
    ).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 30_000 });
  await expect(page.getByText("Sorry, something went wrong.")).toHaveCount(0);
  await scroller.evaluate((element) => {
    element.scrollTop = 0;
  });
  await expect(
    page.getByText("Pagination entry 1", { exact: true }),
  ).toBeVisible();
  await page.unroute(pattern);
  await scroller.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await page.getByRole("button", { exact: true, name: "Try again" }).click();
  await scrollToOlder(
    scroller,
    page.getByText("Pagination entry 12", { exact: true }),
  );
});
