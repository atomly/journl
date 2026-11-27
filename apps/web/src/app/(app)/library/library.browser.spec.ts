import { expect, test } from "~/testing/browser/fixtures";

test.use({ workspaceReview: true });

test("Library filters pages and shows their folder counts", async ({
  page,
}) => {
  await page.goto("/library");
  const pages = page.getByRole("table", { name: "Pages" });
  const garden = pages.getByRole("link", { name: "Small balcony garden" });
  const lentils = pages.getByRole("link", { name: "Lemon & herb lentils" });
  await expect(lentils).toBeVisible();
  const search = page.getByRole("searchbox", { name: "Search by name" });
  await search.fill("garden");
  await expect(garden).toBeVisible();
  await expect(lentils).toHaveCount(0);
  await search.clear();
  await expect(lentils).toBeVisible();
  await page.getByRole("link", { exact: true, name: "Folders" }).click();
  const projects = page
    .getByRole("table", { name: "Folders" })
    .getByRole("row")
    .filter({ has: page.getByRole("link", { exact: true, name: "Projects" }) });
  await expect(projects).toContainText("2 pages");
});

test("Library lets users cancel a rename and a deletion", async ({ page }) => {
  await page.goto("/library");
  const row = page
    .getByRole("table", { name: "Pages" })
    .getByRole("row")
    .filter({
      has: page.getByRole("link", {
        exact: true,
        name: "Small balcony garden",
      }),
    });
  const garden = row.getByRole("link", { name: "Small balcony garden" });
  const actions = row.getByRole("button", { name: /actions/i });
  await garden.focus();
  await actions.click();
  await page.getByRole("menuitem", { name: "Rename" }).click();
  const title = page.getByLabel("Page title");
  await title.fill("Unsaved title");
  await title.press("Escape");
  await expect(garden).toBeVisible();

  await garden.focus();
  await actions.click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  const confirm = page.getByRole("dialog", { name: "Delete Page" });
  await expect(confirm).toContainText("Small balcony garden");
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(confirm).toBeHidden();
  await expect(garden).toBeVisible();
});
