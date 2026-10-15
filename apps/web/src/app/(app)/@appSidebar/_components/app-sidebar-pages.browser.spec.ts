import { expect, test } from "~/testing/browser/fixtures";

test("Library expansion reveals a paginated folder and keyboard actions remain available", async ({
  page,
}, info) => {
  let childRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("tree.getChildrenPaginated")) childRequests++;
  });
  await page.goto("/explore");
  if (info.project.name === "mobile-webkit")
    await page.getByRole("button", { name: "Toggle Sidebar" }).first().click();
  const folder = page.getByRole("button", {
    exact: true,
    name: "Expand Browser folder",
  });
  const started = Date.now();
  if (info.project.name === "mobile-webkit") await folder.tap();
  else {
    await folder.focus();
    await page.keyboard.press("Enter");
  }
  await expect(
    page.getByRole("link", { exact: true, name: "Browser note 01" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { exact: true, name: "Collapse Browser folder" }),
  ).toBeVisible();
  const actions = page.getByRole("button", {
    exact: true,
    name: "Actions for Browser note 01",
  });
  if (info.project.name === "mobile-webkit") await actions.tap();
  else {
    await actions.focus();
    await page.keyboard.press("Enter");
  }
  await expect(
    page.getByRole("menuitem", { exact: true, name: "Move down" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("menuitem", { exact: true, name: "Move to…" }),
  ).toBeEnabled();
  await page.keyboard.press("Escape");
  await info.attach("folder-reveal", {
    body: JSON.stringify({ childRequests, milliseconds: Date.now() - started }),
    contentType: "application/json",
  });
  await info.attach("library-layout", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
});
