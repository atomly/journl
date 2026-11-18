import { expect, test } from "@playwright/test";

for (const [device, width, height] of [
  ["desktop", 1440, 1000],
  ["tablet", 834, 1112],
  ["mobile", 390, 844],
] as const) {
  for (const theme of ["light", "dark"] as const) {
    test(`${device} ${theme}: material, selection and brand`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ height, width });
      await page.goto(
        `/iframe.html?id=button--variants&viewMode=story&globals=theme:${theme}`,
      );
      const selected = page.getByRole("button", {
        exact: true,
        name: "selected",
      });
      await expect(selected).toHaveAttribute("aria-pressed", "true");
      await selected.focus();
      await expect(selected).toBeFocused();
      if (testInfo.project.name === "forced-colors") {
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
      }
      await page.screenshot({ path: testInfo.outputPath("buttons.png") });
      await page.goto(
        `/iframe.html?id=input--editable&viewMode=story&globals=theme:${theme}`,
      );
      const input = page.getByRole("textbox");
      await expect(input).toBeVisible();
      await expect(input).toHaveCSS("height", "50px");
      await expect(input).toHaveCSS("border-radius", "12px");
      await page.screenshot({ path: testInfo.outputPath("fields.png") });
      await page.goto(
        `/iframe.html?id=surface--opaque&viewMode=story&globals=theme:${theme};transparency:opaque`,
      );
      await expect(page.locator('[data-slot="surface"]')).toHaveCSS(
        "backdrop-filter",
        "none",
      );
      await page.screenshot({
        path: testInfo.outputPath("transparency-reduced.png"),
      });
      await page.goto(`/iframe.html?id=brand--${theme}&viewMode=story`);
      await expect(
        page.getByRole("img", { exact: true, name: "Journl" }),
      ).toBeVisible();
      if (testInfo.project.name === "forced-colors") {
        await expect(page.locator(".brand-system")).toBeVisible();
        expect(
          await page
            .locator(".brand-system")
            .evaluate((el) => getComputedStyle(el).maskImage),
        ).toContain("lockup-mono-ink.svg");
      }
      await page.screenshot({ path: testInfo.outputPath("brand.png") });
    });
  }
}
