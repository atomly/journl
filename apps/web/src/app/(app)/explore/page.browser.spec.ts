import { browserFixture } from "~/testing/browser/data";
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
      page.getByRole("heading", { name: "This thread has changed" }),
    ).toBeVisible();
    await expect(
      page.getByText("Browser note 01", { exact: true }),
    ).toHaveCount(0);
  });
});
