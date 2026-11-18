import { expect, test } from "~/testing/browser/fixtures";

test("panel keyboard resizing is bounded and independent of route identity", async ({
  page,
}, info) => {
  test.skip(info.project.name === "mobile-webkit", "Desktop resize separators");
  await page.setViewportSize({ height: 1000, width: 1440 });
  await page.goto("/explore");
  await expect(page.locator("header[data-hidden]")).toContainText("Explore");
  await expect(
    page
      .locator("header[data-hidden]")
      .getByRole("button", { exact: true, name: "Entries" }),
  ).toHaveCount(0);
  const navigation = page.getByRole("separator", { name: "Resize navigation" });
  const assistant = page.getByRole("separator", { name: "Resize assistant" });
  await expect(navigation).toHaveAttribute("aria-valuenow", "216");
  await navigation.focus();
  await page.keyboard.press("End");
  await expect(navigation).toHaveAttribute("aria-valuenow", "280");
  await page.keyboard.press("ArrowLeft");
  await expect(navigation).toHaveAttribute("aria-valuenow", "264");
  await page.keyboard.press("Home");
  await expect(navigation).toHaveAttribute("aria-valuenow", "192");
  await expect(assistant).toHaveAttribute("aria-valuenow", "480");
  await assistant.focus();
  await page.keyboard.press("End");
  await expect(assistant).toHaveAttribute("aria-valuenow", "704");
  await page.keyboard.press("Home");
  await expect(assistant).toHaveAttribute("aria-valuenow", "400");
  await expect(navigation).toHaveAttribute("aria-valuenow", "192");
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => {
      document.documentElement.classList.toggle("dark", value === "dark");
    }, theme);
    await info.attach(`resize-boundaries--${theme}--desktop`, {
      body: await page.screenshot({ animations: "disabled", scale: "css" }),
      contentType: "image/png",
    });
  }
});

test("mobile navigation sheet restores focus", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile-webkit", "Mobile sheet");
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/journal");
  const trigger = page
    .getByRole("button", { exact: true, name: "Toggle Sidebar" })
    .first();
  await trigger.click();
  const sheet = page.getByRole("dialog", { name: "Notebook navigation" });
  await expect(sheet).toBeVisible();
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => {
      document.documentElement.classList.toggle("dark", value === "dark");
    }, theme);
    await info.attach(`navigation-mobile--${theme}--mobile`, {
      body: await page.screenshot({ animations: "disabled", scale: "css" }),
      contentType: "image/png",
    });
  }
  await page.keyboard.press("Escape");
  await expect(sheet).not.toBeVisible();
  await expect(trigger).toBeFocused();
});
