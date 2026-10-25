import { expect, test } from "~/testing/browser/fixtures";

test("shipped account dropdown hosts the shipped theme control and signs out", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/journal");
  await expect(page.getByRole("button", { name: "Toggle theme" })).toHaveCount(
    0,
  );
  const openAccountMenu = async () => {
    if (info.project.name === "mobile-webkit")
      await page
        .getByRole("button", { name: "Toggle Sidebar" })
        .first()
        .click();
    await page
      .locator('[data-sidebar="header"] button[aria-haspopup="menu"]')
      .click();
    await expect(
      page.getByRole("menuitem", { exact: true, name: "Settings" }),
    ).toBeVisible();
    await expect(
      page.getByRole("tab", { exact: true, name: "System" }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  };
  await openAccountMenu();
  const menu = page.getByRole("menu");
  const colors = await menu.evaluate((element) => {
    const divider = element.querySelector(
      '[data-slot="dropdown-menu-separator"]',
    );
    const header = document.querySelector("header .border-sidebar-border");
    const sidebarDivider = document.querySelector(
      '[data-slot="sidebar"] [data-slot="separator"]',
    );
    return {
      border: getComputedStyle(element).borderTopColor,
      divider: divider ? getComputedStyle(divider).backgroundColor : null,
      header: header ? getComputedStyle(header).borderTopColor : null,
      sidebarDivider: sidebarDivider
        ? getComputedStyle(sidebarDivider).backgroundColor
        : null,
      width: getComputedStyle(element).borderTopWidth,
    };
  });
  expect(colors.width).toBe("1px");
  expect(colors.border).toBe(colors.header);
  expect(colors.divider).toBe(colors.sidebarDivider);
  await page.getByRole("tab", { exact: true, name: "Light" }).click();
  await expect(page.locator("html")).toHaveClass(/\blight\b/);
  await expect(menu).toBeVisible();
  await page.screenshot({
    animations: "disabled",
    path: info.outputPath("account-light.png"),
  });
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/\blight\b/);
  await openAccountMenu();
  await expect(
    page.getByRole("tab", { exact: true, name: "Light" }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { exact: true, name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await page.screenshot({
    animations: "disabled",
    path: info.outputPath("account-dark.png"),
  });
  const themeRow = menu
    .getByRole("menuitem")
    .filter({ has: page.getByRole("tablist") });
  await themeRow.focus();
  await expect(
    page.getByRole("tab", { exact: true, name: "Dark" }),
  ).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Enter");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("theme")))
    .toBe("system");
  // The shipped control forwards Up/Down back to neighboring menu items.
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("menuitem", { name: /^sign out$/i }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/auth\/sign-in(?:[?#].*)?$/);
  const session = await page.request.get("/api/auth/get-session");
  expect(await session.json()).toBeNull();
  expect(errors).toEqual([]);
});

test("shipped Appearance card and account dropdown share the persisted theme", async ({
  page,
}, info) => {
  await page.goto("/auth/sign-in");
  await expect(page).toHaveURL("/account/settings");
  await expect(
    page.getByRole("heading", { exact: true, name: "Appearance" }),
  ).toBeVisible();
  await page.getByRole("radio", { name: /^Light\b/ }).click();
  await expect(page.locator("html")).toHaveClass(/\blight\b/);
  await page.goto("/journal");
  if (info.project.name === "mobile-webkit")
    await page.getByRole("button", { name: "Toggle Sidebar" }).first().click();
  await page
    .locator('[data-sidebar="header"] button[aria-haspopup="menu"]')
    .click();
  await expect(
    page.getByRole("tab", { exact: true, name: "Light" }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { exact: true, name: "Dark" }).click();
  await page.getByRole("menuitem", { exact: true, name: "Settings" }).click();
  await expect(page.getByRole("radio", { name: /^Dark\b/ })).toBeChecked();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
});

test("shipped account dropdown works in the collapsed desktop sidebar", async ({
  page,
}, info) => {
  test.skip(
    info.project.name === "mobile-webkit",
    "Mobile uses the sidebar sheet rather than the desktop rail",
  );
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/journal");
  const sidebar = page.locator('[data-slot="sidebar"][data-side="left"]');
  await expect(sidebar).toBeVisible();
  if ((await sidebar.getAttribute("data-state")) === "expanded")
    await page.getByRole("button", { name: "Toggle Sidebar" }).first().click();
  await expect(sidebar).toHaveAttribute("data-state", "collapsed");
  await page.getByRole("button", { exact: true, name: "Account" }).click();
  await expect(
    page.getByRole("tab", { exact: true, name: "Light" }),
  ).toBeVisible();
  await page.getByRole("tab", { exact: true, name: "Light" }).click();
  await expect(page.locator("html")).toHaveClass(/\blight\b/);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { exact: true, name: "Search notes" }).click();
  const search = page.getByRole("dialog", {
    name: "Search pages and journal entries",
  });
  await expect(search).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(search).toBeHidden();
  await page.keyboard.press("ControlOrMeta+k");
  await expect(search).toBeVisible();
  await page.keyboard.press("Escape");
  expect(errors).toEqual([]);
});
