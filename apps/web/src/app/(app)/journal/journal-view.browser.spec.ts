import { expect, test } from "~/testing/browser/fixtures";

test.use({ journalPagination: true });

test("a journal entry opens its date and keeps the saved writing visible", async ({
  page,
}) => {
  await page.goto("/journal");
  await expect(
    page.getByText("Pagination entry 1", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Friday, January 31, 2020" }).click();
  await expect(page).toHaveURL(/\/journal\/2020-01-31$/);
  await expect(
    page.getByText("Pagination entry 1", { exact: true }),
  ).toBeVisible();
});
