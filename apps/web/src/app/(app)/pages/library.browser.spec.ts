import { expect, test } from "~/testing/browser/fixtures";

test("All pages searches actual names, exposes folder membership, and retains page actions", async ({
  page,
}) => {
  await page.goto("/pages");
  const library = page.locator(".journl-library");
  await expect(
    library.getByRole("heading", { exact: true, name: "All pages" }),
  ).toBeVisible();
  await library
    .getByRole("textbox", { name: "Find a page by name" })
    .fill("Browser note 01");
  await expect(library.locator(".library-page-row")).toHaveCount(1);
  await expect(
    library.getByRole("link", { name: "Browser note 01" }),
  ).toBeVisible();
  await expect(
    library
      .getByText("Browser folder", { exact: true })
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  const actions = library.getByRole("button", {
    name: "Actions for Browser note 01",
  });
  await actions.focus();
  await actions.press("Enter");
  await expect(
    page.getByRole("menuitem", { exact: true, name: "Move to…" }),
  ).toBeVisible();
  await expect(
    page.getByRole("menuitem", { exact: true, name: "Delete page" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await library
    .getByRole("textbox", { name: "Find a page by name" })
    .fill("does not exist 038491");
  await expect(
    library.getByRole("heading", { name: "No pages found" }),
  ).toBeVisible();
  await library.getByRole("tab", { exact: true, name: "Folders" }).click();
  await expect(
    library.getByRole("link", { name: /^Browser folder/ }),
  ).toBeVisible();
});

test.describe("Library owner isolation", () => {
  test.use({ otherOwner: true });
  test("another owner cannot find the primary fixture's pages", async ({
    page,
  }) => {
    await page.goto("/pages");
    const library = page.locator(".journl-library");
    await library
      .getByRole("textbox", { name: "Find a page by name" })
      .fill("Browser note 01");
    await expect(
      library.getByRole("heading", { name: "No pages found" }),
    ).toBeVisible();
    await expect(library.locator(".library-page-row")).toHaveCount(0);
  });
});

test.describe("folder organization", () => {
  test.use({ otherOwner: true });
  test("folder search and inline rename retain failed input across tabs and save after retry", async ({
    page,
  }, info) => {
    await page.goto("/pages");
    const library = page.locator(".journl-library");
    await library.getByRole("tab", { exact: true, name: "Folders" }).click();
    await expect(
      library.getByRole("heading", { exact: true, name: "Folders" }),
    ).toBeVisible();
    await library
      .getByRole("button", { exact: true, name: "New folder" })
      .click();
    await library
      .getByRole("button", { exact: true, name: "Rename New folder" })
      .click();
    const input = library.getByRole("textbox", {
      exact: true,
      name: "Rename New folder",
    });
    const name = `Retained folder ${info.project.name}`;
    await input.fill(name);
    await page.route("**/api/trpc/folders.rename**", (route) => route.abort());
    await library
      .getByRole("button", { exact: true, name: "Save name" })
      .click();
    await expect(library.getByRole("alert")).toContainText("Your name is kept");
    await library.getByRole("tab", { exact: true, name: "All pages" }).click();
    await library.getByRole("tab", { exact: true, name: "Folders" }).click();
    await expect(input).toHaveValue(name);
    await page.unroute("**/api/trpc/folders.rename**");
    await library
      .getByRole("button", { exact: true, name: "Save name" })
      .click();
    await expect(library.getByRole("link", { name })).toBeVisible();
    await library
      .getByRole("textbox", { name: "Find a folder by name" })
      .fill("nothing matches this folder 23894");
    await expect(
      library.getByRole("heading", { name: "No folders found" }),
    ).toBeVisible();
    await library
      .getByRole("textbox", { name: "Find a folder by name" })
      .fill(name);
    await expect(library.locator(".library-folder-row")).toHaveCount(1);
    await page.reload();
    await library.getByRole("tab", { exact: true, name: "Folders" }).click();
    await expect(library.getByRole("link", { name })).toBeVisible();
  });
});
