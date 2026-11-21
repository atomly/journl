import { browserFixture, fixtureId } from "~/testing/browser/data";
import { expect, test } from "~/testing/browser/fixtures";

test("Library expansion reveals a paginated folder and keyboard actions remain available", async ({
  page,
}, info) => {
  let childRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("tree.getChildrenPaginated")) childRequests++;
  });
  await page.goto("/explore");
  if (info.project.name === "mobile-webkit")
    await page.getByRole("button", { name: "Toggle Sidebar" }).first().click();
  const folder = page.getByRole("button", {
    exact: true,
    name: "Expand Browser folder",
  });
  const started = Date.now();
  if (info.project.name === "mobile-webkit") await folder.tap();
  else {
    await folder.focus();
    await page.keyboard.press("Enter");
  }
  await expect(
    page.getByRole("link", { exact: true, name: "Browser note 01" }),
  ).toBeVisible();
  const reveal = { childRequests, milliseconds: Date.now() - started };
  await expect(
    page.getByRole("button", { exact: true, name: "Collapse Browser folder" }),
  ).toBeVisible();
  const actions = page.getByRole("button", {
    exact: true,
    name: "Actions for Browser note 01",
  });
  if (info.project.name === "mobile-webkit") await actions.tap();
  else {
    await actions.focus();
    await page.keyboard.press("Enter");
  }
  await expect(
    page.getByRole("menuitem", { exact: true, name: "Move down" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("menuitem", { exact: true, name: "Move to…" }),
  ).toBeEnabled();
  await page.keyboard.press("Escape");
  await info.attach("folder-reveal", {
    body: JSON.stringify(reveal),
    contentType: "application/json",
  });
  await info.attach("library-layout", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
});

test("explicit expansion survives navigation/reload and stays scoped to its owner", async ({
  page,
}, info) => {
  const showSidebar = async () => {
    if (info.project.name === "mobile-webkit")
      await page
        .getByRole("button", { name: "Toggle Sidebar" })
        .first()
        .click();
  };
  await page.goto("/explore");
  await showSidebar();
  await page
    .getByRole("button", { exact: true, name: "Expand Browser folder" })
    .click();
  await expect(
    page.getByRole("link", { exact: true, name: "Browser note 01" }),
  ).toBeVisible();
  const reloadStarted = Date.now();
  await page.reload();
  await showSidebar();
  await expect(
    page.getByRole("button", { exact: true, name: "Collapse Browser folder" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { exact: true, name: "Browser note 01" }),
  ).toBeVisible();
  await info.attach("sidebar-restoration", {
    body: JSON.stringify({ reloadMilliseconds: Date.now() - reloadStarted }),
    contentType: "application/json",
  });
  await page.goto(`/explore/clusters/${browserFixture.cluster}`);
  await showSidebar();
  await expect(
    page.getByRole("button", { exact: true, name: "Collapse Browser folder" }),
  ).toBeVisible();
  const signedOut = await page.request.post("/api/auth/sign-out", {
    data: {},
    headers: { Origin: "http://127.0.0.1:3100" },
  });
  expect(signedOut.ok()).toBe(true);
  const signedIn = await page.request.post("/api/auth/sign-in/email", {
    data: {
      email: browserFixture.otherEmail,
      password: browserFixture.password,
    },
    headers: { Origin: "http://127.0.0.1:3100" },
  });
  expect(signedIn.ok()).toBe(true);
  await page.goto("/explore");
  await showSidebar();
  await expect(
    page.getByText("Your next thread starts with a note"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Browser folder/ }),
  ).toHaveCount(0);
});

test("active ancestors reopen on a new target while manual collapse wins on the same target", async ({
  page,
}, info) => {
  const showSidebar = async () => {
    if (info.project.name === "mobile-webkit")
      await page
        .getByRole("button", { name: "Toggle Sidebar" })
        .first()
        .click();
  };
  await page.goto(`/pages/${fixtureId(1)}`);
  await showSidebar();
  await expect(
    page.getByRole("button", { exact: true, name: "Collapse Browser folder" }),
  ).toBeVisible();
  await page
    .getByRole("button", { exact: true, name: "Collapse Browser folder" })
    .click();
  await expect(
    page.getByRole("button", { exact: true, name: "Expand Browser folder" }),
  ).toBeVisible();
  await page.goto(`/pages/${fixtureId(2)}`);
  await showSidebar();
  await expect(
    page.getByRole("button", { exact: true, name: "Collapse Browser folder" }),
  ).toBeVisible();
});

test("page actions appear on hover or focus and delete stays inside the menu", async ({
  page,
}, info) => {
  await page.goto("/explore");
  if (info.project.name === "mobile-webkit")
    await page.getByRole("button", { name: "Toggle Sidebar" }).first().click();
  await page
    .getByRole("button", { exact: true, name: "Expand Browser folder" })
    .click();
  const link = page.getByRole("link", { exact: true, name: "Browser note 01" });
  await expect(link).toBeVisible();
  const row = link.locator("xpath=ancestor::li[1]");
  const actions = row.getByRole("button", {
    exact: true,
    name: "Actions for Browser note 01",
  });
  if (info.project.name === "desktop-chromium") {
    // Touch retains the existing swipe-to-delete affordance.
    await expect(
      row.getByRole("button", { exact: true, name: "Delete page" }),
    ).toHaveCount(0);
    await page.mouse.move(1, 1);
    await expect(actions).toHaveCSS("opacity", "0");
    await row.hover();
    await expect(actions).toHaveCSS("opacity", "1");
    await page.mouse.move(1, 1);
    await expect(actions).toHaveCSS("opacity", "0");
    await actions.focus();
    await expect(actions).toHaveCSS("opacity", "1");
    await page.keyboard.press("Enter");
  } else await actions.tap();
  const remove = page.getByRole("menuitem", {
    exact: true,
    name: "Delete page",
  });
  await expect(remove).toBeVisible();
  await expect(
    page.getByRole("menuitem", { exact: true, name: "Move to…" }),
  ).toBeVisible();
  await remove.click();
  const dialog = page.getByRole("dialog", { name: "Delete Page" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Browser note 01");
  await dialog.getByRole("button", { exact: true, name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await expect(link).toBeVisible();
  await expect(actions).toBeFocused();
});

test.describe("wide touchscreens", () => {
  test.use({ hasTouch: true, viewport: { height: 900, width: 1024 } });
  test("page actions remain available without hover", async ({ page }) => {
    await page.goto("/explore");
    await page
      .getByRole("button", { exact: true, name: "Toggle Sidebar" })
      .tap();
    await page
      .getByRole("button", { exact: true, name: "Expand Browser folder" })
      .tap();
    const actions = page.getByRole("button", {
      exact: true,
      name: "Actions for Browser note 01",
    });
    expect(
      await page.evaluate(
        () => matchMedia("(hover: hover) and (pointer: fine)").matches,
      ),
    ).toBe(false);
    await expect(actions).toHaveCSS("opacity", "1");
    await actions.tap();
    await expect(
      page.getByRole("menuitem", { exact: true, name: "Delete page" }),
    ).toBeVisible();
  });
});

test.describe("native touch swipe", () => {
  test.use({ hasTouch: true });
  test("touch swipe reveals Delete and the next tap closes without navigation", async ({
    page,
    context,
  }, info) => {
    test.skip(
      info.project.name !== "desktop-chromium",
      "Native touch drag uses Chromium's input protocol; WebKit exposes taps only",
    );
    await page.setViewportSize({ height: 844, width: 390 });
    const input = await context.newCDPSession(page);
    await page.goto("/explore");
    await page
      .getByRole("button", { exact: true, name: "Toggle Sidebar" })
      .click();
    await page
      .getByRole("button", { exact: true, name: "Expand Browser folder" })
      .click();
    const link = page.getByRole("link", {
      exact: true,
      name: "Browser note 01",
    });
    const swipe = link
      .locator("xpath=ancestor::li[1]")
      .locator('[data-slot="swipe-action"]');
    const reveal = swipe.locator('[data-slot="swipe-action-reveal"]');
    await expect(reveal).toBeHidden();
    const box = await swipe.boundingBox();
    if (!box) throw new Error("Missing swipe bounds");
    const x = box.x + box.width - 100;
    const y = box.y + box.height / 2;
    await input.send("Input.dispatchTouchEvent", {
      touchPoints: [{ x, y }],
      type: "touchStart",
    });
    for (let step = 1; step <= 6; step++) {
      await input.send("Input.dispatchTouchEvent", {
        touchPoints: [{ x: x - step * 10, y }],
        type: "touchMove",
      });
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve()),
          ),
      );
    }
    await input.send("Input.dispatchTouchEvent", {
      touchPoints: [],
      type: "touchEnd",
    });
    await expect(
      reveal.getByRole("button", { exact: true, name: "Delete page" }),
    ).toBeVisible();
    const url = page.url();
    // Playwright's own tap synthesis instead of a raw CDP pair: the input
    // pipeline occasionally drops an immediate touch pair after a drag on slow
    // runners, leaving the reveal open with no click reaching the page.
    await page.touchscreen.tap(box.x + 100, y);
    await expect(reveal).toBeHidden();
    await expect(page).toHaveURL(url);
    await expect(page.getByRole("dialog", { name: "Delete Page" })).toHaveCount(
      0,
    );
  });
});
