import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  test(`approved marketing keeps the full ${theme} product frame and invitation entry points`, async ({
    page,
  }, info) => {
    const mobile = info.project.name === "mobile-webkit";
    await page.setViewportSize(
      mobile ? { height: 844, width: 390 } : { height: 1000, width: 1440 },
    );
    await page.addInitScript(
      (value) => localStorage.setItem("theme", value),
      theme,
    );
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Give yourknowledgea home.",
    );
    await expect(page.locator("html")).toHaveClass(new RegExp(theme));
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page
        .getByRole("heading", { level: 1 })
        .evaluate((element) => getComputedStyle(element).fontFamily),
    ).toMatch(/inter/i);
    const frame = page.locator(
      `#capture picture:${theme === "light" ? "first" : "last"}-child img`,
    );
    await expect(frame).toBeVisible();
    await expect
      .poll(() =>
        frame.evaluate((image) => (image as HTMLImageElement).complete),
      )
      .toBe(true);
    const image = await frame.evaluate((node) => {
      const image = node as HTMLImageElement;
      const bounds = image.getBoundingClientRect();
      return { ratio: bounds.width / bounds.height, source: image.currentSrc };
    });
    expect(image.source).toContain(
      `library-${theme}-${mobile ? "mobile" : "desktop"}.png`,
    );
    expect(image.ratio).toBeCloseTo(mobile ? 390 / 844 : 1440 / 1000, 2);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(mobile ? 390 : 1440);
    await info.attach(`marketing-${theme}-${mobile ? "mobile" : "desktop"}`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
    await page
      .getByRole("link", { name: "Get started with an invitation" })
      .click();
    await expect(page).toHaveURL(/\/invite/);
  });
}
