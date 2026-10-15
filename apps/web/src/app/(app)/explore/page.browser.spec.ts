import { browserFixture, fixtureId } from "~/testing/browser/data";
import { expect, test } from "~/testing/browser/fixtures";

test("Explore supports keyboard selection, search, thread navigation, and responsive context", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/explore");
  await expect(
    page.getByRole("heading", { name: "Pick up a thread" }),
  ).toBeVisible();
  await page.getByRole("button", { exact: true, name: "List view" }).click();
  const thread = page.getByRole("button", { name: /Browser thread/ }).first();
  await thread.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", {
      exact: true,
      name: "Where Browser thread leads",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Explore thread/ }).first(),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Find a thread" })
    .fill("no matching thread");
  await expect(page.getByText("No threads match that name")).toBeVisible();
  await page.getByRole("textbox", { name: "Find a thread" }).fill("");
  await page.goto(`/explore/clusters/${browserFixture.cluster}`);
  await expect(
    page.getByRole("heading", { exact: true, name: "Browser thread" }),
  ).toBeVisible();
  await expect(page.getByText("Browser note 01").first()).toBeVisible();
  const note = page.getByRole("button", {
    exact: true,
    name: "Preview Browser note 01",
  });
  await expect(note).toBeVisible();
  if (info.project.name === "mobile-webkit") await note.tap();
  else {
    await note.focus();
    await page.keyboard.press("Enter");
  }
  const preview = page.getByRole("region", {
    exact: true,
    name: "Note preview",
  });
  await expect(preview).toBeVisible();
  await expect(
    preview.getByRole("link", { name: /Read passage/ }).first(),
  ).toHaveAttribute("href", new RegExp(fixtureId(101)));

  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await info.attach("thread-layout", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
  expect(errors).toEqual([]);
});

test("a manual thread name survives a real database reload", async ({
  page,
}) => {
  await page.goto(`/explore/clusters/${browserFixture.cluster}`);
  const rename = async (name: string) => {
    await page
      .getByRole("button", { exact: true, name: "Rename thread" })
      .click();
    await page.getByRole("textbox", { name: "Thread name" }).fill(name);
    await page.getByRole("button", { exact: true, name: "Save name" }).click();
    await expect(
      page.getByRole("heading", { exact: true, name }),
    ).toBeVisible();
  };
  try {
    await rename("Browser thread renamed");
    await page.reload();
    await expect(
      page.getByRole("heading", {
        exact: true,
        name: "Browser thread renamed",
      }),
    ).toBeVisible();
  } finally {
    await rename("Browser thread");
  }
});

test.describe("owner isolation", () => {
  test.use({ otherOwner: true });
  test("another account cannot read a private thread", async ({ page }) => {
    await page.goto("/explore");
    await expect(
      page.getByText("Your next thread starts with a note"),
    ).toBeVisible();
    await expect(page.getByText("Browser thread", { exact: true })).toHaveCount(
      0,
    );
    await page.goto(`/explore/clusters/${browserFixture.cluster}`);
    await expect(
      page
        .getByRole("alert")
        .getByText("Could not load this exploration.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Browser note 01", { exact: true }),
    ).toHaveCount(0);
  });
});
