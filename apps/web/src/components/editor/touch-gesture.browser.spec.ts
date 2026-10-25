import type { CDPSession } from "@playwright/test";
import { expect, test } from "~/testing/browser/fixtures";

test.use({ journalPagination: true });
test.beforeEach(async ({ page }) => {
  await page.goto("/journal");
  const create = page.getByRole("button", { exact: true, name: "New page" });
  if (!(await create.isVisible()))
    await page
      .getByRole("button", { exact: true, name: "Toggle Sidebar" })
      .click();
  const previous = page.url();
  await create.click();
  await expect(page).not.toHaveURL(previous);
  await page.keyboard.press("Escape");
});

async function finger(
  session: CDPSession,
  type: "touchStart" | "touchMove" | "touchEnd" | "touchCancel",
  x = 0,
  y = 0,
) {
  await session.send("Input.dispatchTouchEvent", {
    touchPoints:
      type === "touchEnd" || type === "touchCancel" ? [] : [{ id: 1, x, y }],
    type,
  });
}

for (const width of [390, 1024]) {
  test(`trusted touch at ${width}px moves once, closes actions, and never creates a native copy`, async ({
    page,
    context,
  }, info) => {
    test.skip(
      info.project.name !== "desktop-chromium",
      "CDP provides trusted touch input; WebKit has separate touch acceptance",
    );
    await page.setViewportSize({ height: 720, width });
    const editor = page.locator(".better-editor-tiptap");
    await editor.fill("Alpha");
    await page.keyboard.press("Enter");
    await page.keyboard.insertText("Beta");
    await page.keyboard.press("Enter");
    await page.keyboard.insertText("Gamma");
    const rows = editor.locator('[data-better-editor-body="paragraph"]');
    await expect(rows).toHaveText(["Alpha", "Beta", "Gamma"]);
    const ids = await editor
      .locator("[data-block-id]")
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-block-id")),
      );
    const session = await context.newCDPSession(page);
    await session.send("Emulation.setTouchEmulationEnabled", {
      enabled: true,
      maxTouchPoints: 2,
    });
    // A second contact cancels the gesture regardless of which finger lifts first.
    for (const releaseOriginal of [false, true]) {
      await rows.first().scrollIntoViewIfNeeded();
      const row = await rows.first().boundingBox();
      if (!row) throw new Error("Missing touch source");
      await finger(session, "touchStart", row.x + 20, row.y + 12);
      await finger(session, "touchEnd");
      const grip = page.getByRole("button", {
        exact: true,
        name: "Block actions",
      });
      await expect(grip).toBeVisible();
      await grip.scrollIntoViewIfNeeded();
      const box = await grip.boundingBox();
      const last = await rows.last().boundingBox();
      if (!box || !last) throw new Error("Missing cancellation geometry");
      const first = {
        id: 1,
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
      };
      await session.send("Input.dispatchTouchEvent", {
        touchPoints: [first],
        type: "touchStart",
      });
      await finger(session, "touchMove", first.x + 16, first.y + 16);
      await expect(grip).toHaveAttribute("aria-pressed", "true");
      first.x = last.x + 30;
      first.y = last.y + last.height - 2;
      await finger(session, "touchMove", first.x, first.y);
      await expect(
        page.locator(".better-editor-block-drop-indicator"),
      ).toBeVisible();
      const second = { id: 2, x: first.x + 30, y: first.y };
      await session.send("Input.dispatchTouchEvent", {
        touchPoints: [first, second],
        type: "touchStart",
      });
      await expect(
        page.locator(".better-editor-block-drop-indicator"),
      ).toHaveCount(0);
      await session.send("Input.dispatchTouchEvent", {
        touchPoints: [releaseOriginal ? second : first],
        type: "touchEnd",
      });
      await finger(session, "touchEnd");
      await expect(rows).toHaveText(["Alpha", "Beta", "Gamma"]);
      expect(
        await editor
          .locator("[data-block-id]")
          .evaluateAll((nodes) =>
            nodes.map((node) => node.getAttribute("data-block-id")),
          ),
      ).toEqual(ids);
    }
    const source = await rows.first().boundingBox();
    if (!source) throw new Error("Missing source paragraph");
    await finger(session, "touchStart", source.x + 20, source.y + 12);
    await finger(session, "touchEnd");
    const handle = page.getByRole("button", {
      exact: true,
      name: "Block actions",
    });
    await expect(handle).toBeVisible();
    // Touch typing and viewport changes retain the selected block's controls.
    await editor.focus();
    await page.keyboard.insertText("!");
    await expect(
      page.getByRole("button", { exact: true, name: "Add block" }),
    ).toBeVisible();
    await page.keyboard.press("Backspace");
    await page.setViewportSize({ height: 520, width });
    await expect(
      page.getByRole("button", { exact: true, name: "Block actions" }),
    ).toBeVisible();
    await page.setViewportSize({ height: 720, width });

    await finger(session, "touchStart", source.x + 20, source.y + 12);
    await finger(session, "touchEnd");
    await handle.scrollIntoViewIfNeeded();
    let grip = await handle.boundingBox();
    if (!grip) throw new Error("Missing touch handle");
    await finger(
      session,
      "touchStart",
      grip.x + grip.width / 2,
      grip.y + grip.height / 2,
    );
    await finger(session, "touchEnd");
    const duplicate = page.getByRole("menuitem", {
      exact: true,
      name: "Duplicate block",
    });
    await expect(duplicate).toBeVisible();
    await handle.scrollIntoViewIfNeeded();
    grip = await handle.boundingBox();
    const target = await rows.last().boundingBox();
    if (!grip || !target) throw new Error("Missing touch drag geometry");
    const x = grip.x + grip.width / 2;
    const y = grip.y + grip.height / 2;
    await finger(session, "touchStart", x, y);
    await finger(session, "touchMove", x + 16, y + 16);
    await expect(handle).toHaveAttribute("aria-pressed", "true");
    await expect(duplicate).toBeHidden();
    // A native dragstart may precede the browser's cancellation notification.
    // It must be cancelled before it can leave a ProseMirror clipboard slice.
    expect(
      await handle.evaluate((element) => {
        const event = new DragEvent("dragstart", {
          bubbles: true,
          cancelable: true,
          dataTransfer: new DataTransfer(),
        });
        return element.dispatchEvent(event);
      }),
    ).toBe(false);
    expect(
      await editor.evaluate(
        (element) =>
          (element as HTMLElement & { editor: { view: { dragging: unknown } } })
            .editor.view.dragging,
      ),
    ).toBeNull();
    await finger(
      session,
      "touchMove",
      target.x + 30,
      target.y + target.height - 2,
    );
    await expect(
      page.locator(".better-editor-block-drop-indicator"),
    ).toBeVisible();
    await finger(session, "touchEnd");
    await expect(rows).toHaveText(["Beta", "Gamma", "Alpha"]);
    expect(
      await editor
        .locator("[data-block-id]")
        .evaluateAll((nodes) =>
          nodes.map((node) => node.getAttribute("data-block-id")),
        ),
    ).toEqual([ids[1], ids[2], ids[0]]);
    // A cancelled table-axis gesture must never fall through to clipboard copy.
    await editor.evaluate((element) => {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData(
        "application/x-better-editor-table-axis",
        JSON.stringify({ axis: "row", id: "removed-table", index: 0 }),
      );
      dataTransfer.setData("text/html", "<p>Unowned table copy</p>");
      dataTransfer.setData("text/plain", "Unowned table copy");
      const rect = element.getBoundingClientRect();
      element.dispatchEvent(
        new DragEvent("drop", {
          bubbles: true,
          cancelable: true,
          clientX: rect.left + 20,
          clientY: rect.top + 10,
          dataTransfer,
        }),
      );
    });
    await expect(rows).toHaveText(["Beta", "Gamma", "Alpha"]);
    // Exercise a late click after dnd-kit's own 50ms capture suppression ends.
    await page.waitForTimeout(75);
    await handle.dispatchEvent("click", { detail: 1 });
    await expect(duplicate).toBeHidden();
    // Click-only assistive activation is a new action, not a drag's trailing click.
    await handle.evaluate((element) => (element as HTMLButtonElement).click());
    await expect(duplicate).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(rows).toHaveCount(3);
    await editor.focus();
    await page.keyboard.press("ControlOrMeta+z");
    await expect(rows).toHaveText(["Alpha", "Beta", "Gamma"]);
    await page.keyboard.press("ControlOrMeta+Shift+z");
    await expect(rows).toHaveText(["Beta", "Gamma", "Alpha"]);
    await expect(page.locator("[data-save-status]")).toContainText("Saved");
    await page.reload();
    await expect(rows).toHaveText(["Beta", "Gamma", "Alpha"]);
    expect(
      await editor
        .locator("[data-block-id]")
        .evaluateAll((nodes) =>
          nodes.map((node) => node.getAttribute("data-block-id")),
        ),
    ).toEqual([ids[1], ids[2], ids[0]]);
  });
}

test("touch auto-scroll keeps the destination under the finger and preserves every block", async ({
  page,
  context,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "CDP trusted touch input",
  );
  await page.setViewportSize({ height: 720, width: 390 });
  const editor = page.locator(".better-editor-tiptap");
  await editor.fill("Line 0");
  for (let i = 1; i < 30; i++) {
    await page.keyboard.press("Enter");
    await page.keyboard.insertText(`Line ${i}`);
  }
  const rows = editor.locator('[data-better-editor-body="paragraph"]');
  await expect(rows).toHaveCount(30);
  const ids = await editor
    .locator("[data-block-id]")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-block-id")),
    );
  await rows.first().scrollIntoViewIfNeeded();
  const session = await context.newCDPSession(page);
  await session.send("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 1,
  });
  const first = await rows.first().boundingBox();
  if (!first) throw new Error("Missing first row");
  await finger(session, "touchStart", first.x + 20, first.y + 12);
  await finger(session, "touchEnd");
  const handle = page.getByRole("button", {
    exact: true,
    name: "Block actions",
  });
  await handle.scrollIntoViewIfNeeded();
  const grip = await handle.boundingBox();
  if (!grip) throw new Error("Missing drag handle");
  const scroller = await editor.evaluateHandle((element) => {
    for (
      let parent = element.parentElement;
      parent;
      parent = parent.parentElement
    ) {
      if (
        parent.scrollHeight > parent.clientHeight &&
        /auto|scroll/.test(getComputedStyle(parent).overflowY)
      )
        return parent;
    }
    throw new Error("Missing editor scroll container");
  });
  const initial = await scroller.evaluate((element) => element.scrollTop);
  const bounds = await scroller.evaluate((element) =>
    element.getBoundingClientRect().toJSON(),
  );
  await finger(
    session,
    "touchStart",
    grip.x + grip.width / 2,
    grip.y + grip.height / 2,
  );
  await finger(
    session,
    "touchMove",
    grip.x + grip.width / 2 + 16,
    grip.y + grip.height / 2 + 16,
  );
  await expect(handle).toHaveAttribute("aria-pressed", "true");
  await finger(
    session,
    "touchMove",
    first.x + 30,
    Math.min(700, bounds.bottom - 12),
  );
  await expect
    .poll(() => scroller.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(initial + 80);
  const y = Math.max(
    bounds.top + 40,
    (bounds.top + Math.min(bounds.bottom, 720)) / 2,
  );
  await finger(session, "touchMove", first.x + 30, y);
  const guide = page.locator(".better-editor-block-drop-indicator");
  await expect(guide).toBeVisible();
  await expect
    .poll(async () =>
      Math.abs(
        ((await guide.boundingBox())?.y ?? Number.POSITIVE_INFINITY) - y,
      ),
    )
    .toBeLessThan(35);
  const destination = await rows.evaluateAll((nodes, y) => {
    for (const node of nodes) {
      const rect = node.getBoundingClientRect();
      if (y >= rect.top && y <= rect.bottom)
        return {
          after: y >= rect.top + rect.height / 2,
          id: node.closest("[data-block-id]")?.getAttribute("data-block-id"),
        };
    }
    return null;
  }, y);
  if (!destination?.id) throw new Error("Missing row under touch destination");
  const expected = ids.slice(1);
  expected.splice(
    expected.indexOf(destination.id) + Number(destination.after),
    0,
    ids[0] ?? null,
  );
  await finger(session, "touchEnd");
  await expect(rows).toHaveCount(30);
  const moved = await editor
    .locator("[data-block-id]")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-block-id")),
    );
  expect([...moved].sort()).toEqual([...ids].sort());
  expect(moved).toEqual(expected);
  await editor.focus();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(rows.first()).toHaveText("Line 0");
  expect(
    await editor
      .locator("[data-block-id]")
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-block-id")),
      ),
  ).toEqual(ids);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(page.locator("[data-save-status]")).toContainText("Saved");
  await page.reload();
  await expect(rows).toHaveCount(30);
  expect(
    await editor
      .locator("[data-block-id]")
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-block-id")),
      ),
  ).toEqual(moved);
});

test("a quick closed-menu drag and cancellation leave no popup or stuck handle", async ({
  page,
  context,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "CDP trusted touch input",
  );
  await page.setViewportSize({ height: 720, width: 390 });
  const editor = page.locator(".journl-tiptap");
  await expect(page.locator(".bn-editor")).toHaveCount(0);
  await editor.fill("Alpha");
  for (const text of ["Beta", "Gamma"]) {
    await page.keyboard.press("Enter");
    await page.keyboard.insertText(text);
  }
  const rows = editor.locator('[data-journl-body="paragraph"]');
  const ids = await editor
    .locator("[data-block-id]")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-block-id")),
    );
  const session = await context.newCDPSession(page);
  await session.send("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 1,
  });
  const source = await rows.first().boundingBox();
  if (!source) throw new Error("Missing source");
  await finger(session, "touchStart", source.x + 20, source.y + 12);
  await finger(session, "touchEnd");
  const handle = page.getByRole("button", {
    exact: true,
    name: "Block actions",
  });
  await handle.scrollIntoViewIfNeeded();
  let grip = await handle.boundingBox();
  const last = await rows.last().boundingBox();
  if (!grip || !last) throw new Error("Missing drag geometry");
  await expect(
    page.getByRole("menuitem", { exact: true, name: "Duplicate block" }),
  ).toHaveCount(0);
  await finger(
    session,
    "touchStart",
    grip.x + grip.width / 2,
    grip.y + grip.height / 2,
  );
  // One delivered move, immediate release: no activation/frame/guide wait.
  await finger(session, "touchMove", last.x + 30, last.y + last.height - 2);
  await finger(session, "touchEnd");
  await expect(rows).toHaveText(["Beta", "Gamma", "Alpha"]);
  await expect(
    page.getByRole("menuitem", { exact: true, name: "Duplicate block" }),
  ).toHaveCount(0);
  expect(
    await editor
      .locator("[data-block-id]")
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-block-id")),
      ),
  ).toEqual([ids[1], ids[2], ids[0]]);
  await editor.focus();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(rows).toHaveText(["Alpha", "Beta", "Gamma"]);
  await handle.scrollIntoViewIfNeeded();
  grip = await handle.boundingBox();
  if (!grip) throw new Error("Missing cancellation grip");
  const x = grip.x + grip.width / 2,
    y = grip.y + grip.height / 2;
  await finger(session, "touchStart", x, y);
  await finger(session, "touchMove", x + 16, y + 16);
  await finger(session, "touchCancel");
  await expect(rows).toHaveText(["Alpha", "Beta", "Gamma"]);
  await expect(handle).not.toHaveAttribute("aria-pressed", "true");
  await handle.scrollIntoViewIfNeeded();
  grip = await handle.boundingBox();
  if (!grip) throw new Error("Missing menu grip after cancellation");
  await finger(
    session,
    "touchStart",
    grip.x + grip.width / 2,
    grip.y + grip.height / 2,
  );
  await finger(session, "touchEnd");
  await expect(
    page.getByRole("menuitem", { exact: true, name: "Duplicate block" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-save-status]")).toContainText("Saved");
  await page.reload();
  await expect(rows).toHaveText(["Alpha", "Beta", "Gamma"]);
  expect(
    await editor
      .locator("[data-block-id]")
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-block-id")),
      ),
  ).toEqual(ids);
});
