import { expect, test } from "~/testing/browser/fixtures";

test("Safari standalone zoom guard covers nested targets without blocking taps", async ({
  page,
}, info) => {
  // Exercise Safari's installation signal; this is not a physical iOS installation.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "standalone", { value: true });
  });
  await page.goto("/explore");
  await expect(page.locator("html")).toHaveAttribute("data-pwa-standalone", "");
  const heading = page.getByRole("heading", {
    exact: true,
    name: "Pick up a thread",
  });
  await expect(heading).toHaveCSS("touch-action", "pan-x pan-y");
  const cancellation = await heading.evaluate((element) => {
    return ["gesturestart", "gesturechange"].map((type) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      element.dispatchEvent(event);
      return event.defaultPrevented;
    });
  });
  expect(cancellation).toEqual([true, true]);
  if (info.project.name === "mobile-webkit") {
    await heading.tap();
    await heading.tap();
    expect(await page.evaluate(() => window.visualViewport?.scale)).toBe(1);
    await page.getByRole("button", { name: "Toggle Sidebar" }).first().tap();
  }
  const folder = page.getByRole("button", {
    exact: true,
    name: "Expand Browser folder",
  });
  await expect(folder).toHaveCSS("touch-action", "pan-x pan-y");
  if (info.project.name === "mobile-webkit") await folder.tap();
  else await folder.click();
  await expect(
    page.getByRole("link", { exact: true, name: "Browser note 01" }),
  ).toBeVisible();
});
