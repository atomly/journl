import type { Page } from "@playwright/test";
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

test("Entries scrolls past an unreadable stored document to healthy older writing", async ({
  page,
}) => {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("journal.saveTransactions"))
      writes.push(request.url());
  });
  const scroller = await entriesView(page);
  await expect(async () => {
    await scroller.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect(
      page.getByText("Pagination entry 12", { exact: true }),
    ).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 30_000 });
  const unavailable = page.locator("[data-journal-content-unavailable]");
  await expect(unavailable).toContainText("Its saved content is unchanged");
  await expect(unavailable.locator('[contenteditable="true"]')).toHaveCount(0);
  await expect(
    page.getByText("Failed to fetch journal entries", { exact: false }),
  ).toHaveCount(0);
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
  await expect(async () => {
    await scroller.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect(
      page.getByText("Pagination entry 12", { exact: true }),
    ).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 30_000 });
});
