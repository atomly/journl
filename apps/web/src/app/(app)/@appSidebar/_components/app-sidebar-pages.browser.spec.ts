import { expect, test } from "~/testing/browser/fixtures";

test("Library expansion reveals a paginated folder and keyboard actions remain available", async ({
  page,
}, info) => {
  await page.goto("/explore");
  if (info.project.name === "mobile-webkit")
    await page.getByRole("button", { name: "Toggle Sidebar" }).first().click();
  const folder = page.getByRole("button", {
    exact: true,
    name: "Expand Browser folder",
  });
  await folder.focus();
  const started = Date.now();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("link", { exact: true, name: "Browser note 01" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { exact: true, name: "Collapse Browser folder" }),
  ).toBeVisible();
  await info.attach("folder-reveal", {
    body: JSON.stringify({ milliseconds: Date.now() - started }),
    contentType: "application/json",
  });
  await info.attach("library-layout", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
});
