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
  await expect(
    page.getByRole("main").getByRole("link", { name: "Back to home" }),
  ).toBeVisible();

  await page.goto("/journal");
  await expect(page).toHaveURL(/\/auth\/sign-in$/);
  await expect(
    page.getByRole("main").getByRole("link", { name: "Back to home" }),
  ).toBeVisible();
});

publicTest("public navigation opens the invite form", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Public navigation" })
    .getByRole("link", { name: "Get started" })
    .click();
  await expect(page.getByText("Join Journl", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/invite$/);
  const authPage = page.getByRole("main");
  await expect(
    authPage.getByRole("link", { name: "Back to home" }),
  ).toBeVisible();

  await authPage.getByRole("link", { exact: true, name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/auth\/sign-in$/);
  await page.goBack();
  await expect(
    authPage.getByRole("textbox", { name: "Invite code" }),
  ).toBeVisible();
});

publicTest(
  "the color toggle preserves the selected theme",
  async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await page.goto("/");
    const root = page.locator("html");
    const toggle = page.getByRole("button", { name: "Toggle color theme" });
    await expect(root).toHaveClass(/\bdark\b/);
    await toggle.press("Enter");
    await expect(root).toHaveClass(/\blight\b/);
    await page.reload();
    await expect(root).toHaveClass(/\blight\b/);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await toggle.click();
    await expect(root).toHaveClass(/\bdark\b/);
    await expect(root).not.toHaveAttribute("data-theme-reveal", "");
  },
);

publicTest(
  "the closing copy and actions share a center line",
  async ({ page }) => {
    await page.goto("/");
    const section = page.locator(".marketing-end");
    const heading = section.getByRole("heading");
    await expect(heading).toBeVisible();
    const offset = await section
      .getByText("Have an invitation?", { exact: false })
      .evaluate((copy) => {
        const section = copy.closest("section");
        const heading = section?.querySelector("h2");
        const actions = section?.querySelector(".public-actions");
        if (!heading || !actions)
          throw new Error("Closing section is incomplete");
        const center = (node: Element) => {
          const range = document.createRange();
          range.selectNodeContents(node);
          const bounds = range.getBoundingClientRect();
          return bounds.x + bounds.width / 2;
        };
        return Math.max(
          Math.abs(center(copy) - center(heading)),
          Math.abs(center(copy) - center(actions)),
        );
      });
    expect(offset).toBeLessThan(3);
  },
);
