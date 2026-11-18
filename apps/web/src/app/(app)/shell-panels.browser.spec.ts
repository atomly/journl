import { expect, test } from "~/testing/browser/fixtures";

test("panel resizing supports keyboard input, bounds and gesture cancellation independently", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "Desktop panels use sheets on mobile",
  );
  await page.setViewportSize({ height: 1000, width: 1440 });
  await page.goto("/explore");
  const nav = page.getByRole("separator", { name: "Resize navigation" });
  await expect(nav).toHaveAttribute("aria-valuenow", "216");
  await nav.focus();
  await page.keyboard.press("ArrowRight");
  await expect(nav).toHaveAttribute("aria-valuenow", "232");
  await page.getByRole("button", { name: "Ask Journl" }).click();
  const assistant = page.getByRole("separator", { name: "Resize assistant" });
  await expect(assistant).toHaveAttribute("aria-valuenow", "480");
  await page
    .getByRole("button", { exact: true, name: "Expand assistant" })
    .click();
  await expect(assistant).toHaveAttribute("aria-valuenow", "704");
  await expect(nav).toHaveAttribute("aria-valuenow", "232");
  await page.getByRole("button", { name: "Restore assistant width" }).click();
  const bounds = await nav.boundingBox();
  if (!bounds) throw new Error("Navigation resize handle is missing");
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 40);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 100, bounds.y + 40);
  await expect(nav).toHaveAttribute("aria-valuenow", "280");
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(nav).toHaveAttribute("aria-valuenow", "232");
  await page.getByRole("button", { name: "Close assistant" }).click();
  await expect(page.getByRole("button", { name: "Ask Journl" })).toBeFocused();
  await page.keyboard.press("Control+Shift+B");
  await expect(
    page.locator('[data-slot="sidebar"][data-side="left"]'),
  ).toHaveAttribute("data-state", "collapsed");
  await expect(page.getByRole("button", { name: "Ask Journl" })).toBeVisible();
});
