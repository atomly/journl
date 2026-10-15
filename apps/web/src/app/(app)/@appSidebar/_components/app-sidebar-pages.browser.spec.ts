import { browserFixture, fixtureId } from "~/testing/browser/data";
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
    body: JSON.stringify({ childRequests, milliseconds: Date.now() - started }),
    contentType: "application/json",
  });
  await info.attach("library-layout", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
});

test("explicit expansion survives navigation/reload and stays scoped to its owner", async ({
  page,
}, info) => {
  const showSidebar = async () => {
    if (info.project.name === "mobile-webkit")
      await page
        .getByRole("button", { name: "Toggle Sidebar" })
        .first()
        .click();
  };
  await page.goto("/explore");
  await showSidebar();
  await page
    .getByRole("button", { exact: true, name: "Expand Browser folder" })
    .click();
  await expect(
    page.getByRole("link", { exact: true, name: "Browser note 01" }),
  ).toBeVisible();
  await page.reload();
  await showSidebar();
  await expect(
    page.getByRole("button", { exact: true, name: "Collapse Browser folder" }),
  ).toBeVisible();
  await page.goto(`/explore/clusters/${browserFixture.cluster}`);
  await showSidebar();
  await expect(
    page.getByRole("button", { exact: true, name: "Collapse Browser folder" }),
  ).toBeVisible();
  const signedOut = await page.request.post("/api/auth/sign-out", {
    data: {},
    headers: { Origin: "http://127.0.0.1:3100" },
  });
  expect(signedOut.ok()).toBe(true);
  const signedIn = await page.request.post("/api/auth/sign-in/email", {
    data: {
      email: browserFixture.otherEmail,
      password: browserFixture.password,
    },
    headers: { Origin: "http://127.0.0.1:3100" },
  });
  expect(signedIn.ok()).toBe(true);
  await page.goto("/explore");
  await showSidebar();
  await expect(
    page.getByText("Your next thread starts with a note"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Browser folder/ }),
  ).toHaveCount(0);
});

test("active ancestors reopen on a new target while manual collapse wins on the same target", async ({
  page,
}, info) => {
  const showSidebar = async () => {
    if (info.project.name === "mobile-webkit")
      await page
        .getByRole("button", { name: "Toggle Sidebar" })
        .first()
        .click();
  };
  await page.goto(`/pages/${fixtureId(1)}`);
  await showSidebar();
  await expect(
    page.getByRole("button", { exact: true, name: "Collapse Browser folder" }),
  ).toBeVisible();
  await page
    .getByRole("button", { exact: true, name: "Collapse Browser folder" })
    .click();
  await expect(
    page.getByRole("button", { exact: true, name: "Expand Browser folder" }),
  ).toBeVisible();
  await page.goto(`/pages/${fixtureId(2)}`);
  await showSidebar();
  await expect(
    page.getByRole("button", { exact: true, name: "Collapse Browser folder" }),
  ).toBeVisible();
});
