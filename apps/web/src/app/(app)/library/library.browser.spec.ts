import { expect, test } from "~/testing/browser/fixtures";

test.use({ workspaceReview: true });

test("Library filters pages and shows their folder counts", async ({
  page,
  isMobile,
}) => {
  if (!isMobile) await page.setViewportSize({ height: 1080, width: 1920 });
  await page.goto("/library");
  const header = page.locator("header[data-hidden]");
  await expect(header.getByText("All pages", { exact: true })).toBeVisible();
  await expect(
    header.getByRole("button", { name: "All pages route menu" }),
  ).toHaveCount(0);
  const pages = page.getByRole("table", { name: "Pages" });
  const garden = pages.getByRole("link", { name: "Small balcony garden" });
  const lentils = pages.getByRole("link", { name: "Lemon & herb lentils" });
  await expect(lentils).toBeVisible();
  const search = page.getByRole("searchbox", { name: "Search by name" });
  await search.fill("garden");
  await expect(garden).toBeVisible();
  const gardenUrl = await garden.getAttribute("href");
  if (!gardenUrl) throw new Error("The Library page link is missing a URL");
  await expect(lentils).toHaveCount(0);
  await search.clear();
  await expect(lentils).toBeVisible();
  await page.getByRole("link", { exact: true, name: "Folders" }).click();
  const folders = page.getByRole("table", { name: "Folders" });
  const projects = folders.getByRole("link", {
    exact: true,
    name: "Projects",
  });
  await expect(
    folders.getByRole("row").filter({
      has: page.getByRole("link", { exact: true, name: "Projects" }),
    }),
  ).toContainText("2 pages");
  const table = await folders.boundingBox();
  await projects.click();
  const title = page.getByPlaceholder("New folder");
  await expect(title).toHaveValue("Projects");
  const input = await title.boundingBox();
  expect(input?.x).toBeCloseTo(table?.x ?? 0, 0);
  expect(input?.width).toBeCloseTo(table?.width ?? 0, 0);
  await page.goto(gardenUrl);
  await expect(page).toHaveURL(/\/pages\//);
  const identity = header.getByRole("button", { name: "Library route menu" });
  await expect(identity).toContainText("Small balcony garden");
  if (isMobile) {
    await expect(
      identity.getByText("Projects /", { exact: true }),
    ).toBeHidden();
  } else {
    await expect(
      identity.getByText("Projects /", { exact: true }),
    ).toBeVisible();
  }
  const save = header.getByRole("button", { name: "Save details" });
  await expect(save).toBeVisible();
  await expect(save).toHaveText("");
  await expect(
    header.getByRole("button", { name: "Search notes" }),
  ).toBeVisible();
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
