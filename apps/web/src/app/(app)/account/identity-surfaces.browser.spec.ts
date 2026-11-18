import { expect, test } from "~/testing/browser/fixtures";

test("account keeps profile and security routes and exposes the existing appearance controls", async ({
  page,
}, info) => {
  await page.goto("/account/settings");
  await expect(
    page.getByRole("heading", { exact: true, name: "Your account" }),
  ).toBeVisible();
  await page.getByRole("tab", { exact: true, name: "Security" }).click();
  await expect(page).toHaveURL(/\/account\/security/);
  await page.getByRole("tab", { exact: true, name: "Appearance" }).click();
  await expect(page).toHaveURL(/\/account\/appearance/);
  await page.getByRole("radio", { name: /Dark/ }).check();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await info.attach("account-appearance", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
});

test("standalone authentication retains invitation and home navigation", async ({
  page,
}, info) => {
  await page.context().clearCookies();
  await page.goto("/auth/sign-in");
  await expect(
    page.getByRole("link", { exact: true, name: "Back to home" }),
  ).toBeVisible();
  await expect(page.locator(".auth-reading-surface")).toBeVisible();
  await info.attach("standalone-auth", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
  await page
    .getByRole("link", { name: /invitation/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/invite/);
});
