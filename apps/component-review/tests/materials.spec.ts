import { expect, test } from "@playwright/test";

test.describe("system colors", () => {
  test.skip(
    ({ forcedColors }) => forcedColors !== "active",
    "Requires forced colors",
  );

  test("the selected button uses the system highlight colors", async ({
    page,
  }) => {
    await page.goto("/iframe.html?id=button--variants&viewMode=story", {
      waitUntil: "domcontentloaded",
    });
    const selected = page.getByRole("button", {
      exact: true,
      name: "selected",
    });
    await expect(selected).toBeVisible();
    const colors = await selected.evaluate((element) => {
      const probe = document.createElement("span");
      probe.style.cssText = "background:Highlight;color:HighlightText";
      document.body.append(probe);
      const expected = getComputedStyle(probe);
      const actual = getComputedStyle(element);
      const result = {
        actualBackground: actual.backgroundColor,
        actualInk: actual.color,
        expectedBackground: expected.backgroundColor,
        expectedInk: expected.color,
      };
      probe.remove();
      return result;
    });
    expect(colors.actualBackground).toBe(colors.expectedBackground);
    expect(colors.actualInk).toBe(colors.expectedInk);
  });

  test("the brand uses its high-contrast mark", async ({ page }) => {
    await page.goto("/iframe.html?id=brand--dark&viewMode=story", {
      waitUntil: "domcontentloaded",
    });
    const brand = page.getByRole("img", { exact: true, name: "Journl" });
    await expect(brand).toBeVisible();
    await expect(brand).toHaveCSS("mask-image", /lockup-mono-ink\.svg/);
  });
});

test.describe("ordinary colors", () => {
  test.skip(
    ({ forcedColors }) => forcedColors === "active",
    "Requires ordinary colors",
  );

  test("opaque surfaces remove backdrop blur", async ({ page }) => {
    await page.goto(
      "/iframe.html?id=surface--opaque&viewMode=story&globals=transparency:opaque",
      {
        waitUntil: "domcontentloaded",
      },
    );
    const surface = page.locator('[data-slot="surface"]');
    await expect(surface).toBeVisible();
    await expect(surface).toHaveCSS("backdrop-filter", "none");
  });
});
