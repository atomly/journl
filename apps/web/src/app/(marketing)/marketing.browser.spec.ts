import { test as publicTest } from "@playwright/test";
import { expect, test } from "~/testing/browser/fixtures";

test("signed-in visitors land in the journal", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/journal$/);
});

for (const theme of ["light", "dark"]) {
  publicTest(
    `the ${theme} marketing hero loads at the current viewport`,
    async ({ page, isMobile }) => {
      await page.addInitScript(
        (value) => localStorage.setItem("theme", value),
        theme,
      );
      await page.goto("/");
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: /give your knowledge a home/i,
        }),
      ).toBeVisible();
      const hero = page.getByRole("img", {
        name: "Journl All pages workspace with sample notes",
      });
      await expect(hero).toHaveCount(1);
      await expect(hero).toHaveAttribute(
        "src",
        `/marketing/library-${theme}${isMobile ? "-mobile" : ""}.png`,
      );
      // Native image loading can be deferred until the hero reaches the viewport.
      await hero.scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          hero.evaluate((image) => (image as HTMLImageElement).naturalWidth),
        )
        .toBeGreaterThan(0);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
    },
  );
}

publicTest("public navigation opens sign-in", async ({ page }) => {
  await page.goto("/");
  const signIn = page
    .getByRole("navigation", { name: "Public navigation" })
    .getByRole("link", { name: "Sign in" });
  await expect(signIn).toHaveCSS("text-decoration-line", "underline");
  await signIn.click();
  await expect(page).toHaveURL(/\/auth\/sign-in$/);
});

publicTest("public navigation opens the invite form", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Public navigation" })
    .getByRole("link", { name: "Get started" })
    .click();
  await expect(page.getByText("Join Journl", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/invite$/);
});
