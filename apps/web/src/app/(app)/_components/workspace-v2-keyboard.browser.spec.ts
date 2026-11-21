import { fixtureId } from "~/testing/browser/data";
import { expect, test } from "~/testing/browser/fixtures";
import { populateShellConversation } from "~/testing/browser/shell-responses";

test.use({ workspaceReview: true });
test("phone sheet follows a simulated visual viewport and retains the draft", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "mobile-webkit",
    "Phone visual viewport adapter",
  );
  await page.setViewportSize({ height: 844, width: 390 });
  await populateShellConversation(page);
  await page.goto(`/pages/${fixtureId(1610)}`);
  const editor = page
    .locator('.better-editor-tiptap[contenteditable="true"]')
    .first();
  await expect(editor).toBeVisible();
  const retained = await editor.elementHandle();
  await page
    .getByRole("button", { exact: true, name: "Toggle Chat Drawer" })
    .click();
  const sheet = page.getByRole("dialog", { name: "Ask Journl" });
  const draft = sheet.getByRole("textbox", { exact: true, name: "Message" });
  await expect(draft).toBeEnabled();
  await draft.fill("Keep this draft while the keyboard opens.");
  const conversation = sheet.locator('[data-slot="message-scroller-viewport"]');
  await conversation.focus();
  await conversation.press("Home");
  await expect
    .poll(() => conversation.evaluate((node) => Math.round(node.scrollTop)))
    .toBe(0);
  await conversation.evaluate((node) => {
    node.scrollTop = 200;
  });
  await expect
    .poll(() => conversation.evaluate((node) => Math.round(node.scrollTop)))
    .toBe(200);
  const readAnchor = () =>
    conversation.evaluate((node) => {
      const box = node.getBoundingClientRect();
      const item = Array.from(
        node.querySelectorAll<HTMLElement>("[data-message-id]"),
      ).find((element) => element.getBoundingClientRect().bottom > box.top + 1);
      return {
        id: item?.dataset.messageId,
        offset: item ? item.getBoundingClientRect().top - box.top : 0,
        top: node.scrollTop,
      };
    });
  const originalAnchor = await readAnchor();
  try {
    await page.evaluate(() => {
      const viewport = window.visualViewport;
      if (!viewport) throw new Error("Visual viewport is unavailable");
      Object.defineProperty(viewport, "height", {
        configurable: true,
        value: 500,
      });
      Object.defineProperty(viewport, "offsetTop", {
        configurable: true,
        value: 0,
      });
      viewport.dispatchEvent(new Event("resize"));
    });
    await expect
      .poll(async () => Math.round((await sheet.boundingBox())?.y ?? -1))
      .toBe(68);
    await expect
      .poll(async () => {
        const box = await sheet.boundingBox();
        return Math.round((box?.y ?? 0) + (box?.height ?? 0));
      })
      .toBe(500);
    const composer = await draft.boundingBox();
    expect((composer?.y ?? 0) + (composer?.height ?? 0)).toBeLessThanOrEqual(
      500,
    );
    await expect(draft).toHaveValue(
      "Keep this draft while the keyboard opens.",
    );
    await page.screenshot({
      animations: "disabled",
      path: info.outputPath("simulated-keyboard.png"),
      scale: "css",
    });
  } finally {
    await page.evaluate(() => {
      if (window.visualViewport) {
        Reflect.deleteProperty(window.visualViewport, "height");
        Reflect.deleteProperty(window.visualViewport, "offsetTop");
        window.visualViewport.dispatchEvent(new Event("resize"));
      }
    });
  }
  await expect
    .poll(async () => {
      const box = await sheet.boundingBox();
      return Math.round((box?.y ?? 0) + (box?.height ?? 0));
    })
    .toBe(844);
  await sheet
    .getByRole("button", { exact: true, name: "Close assistant" })
    .click();
  await expect(
    page.getByRole("button", { exact: true, name: "Toggle Chat Drawer" }),
  ).toBeFocused();
  const launcher = await page
    .getByRole("button", { exact: true, name: "Toggle Chat Drawer" })
    .boundingBox();
  expect(Math.round((launcher?.y ?? 0) + (launcher?.height ?? 0))).toBe(822);
  expect(launcher?.height).toBe(44);
  await page.screenshot({
    animations: "disabled",
    path: info.outputPath("phone-launcher.png"),
    scale: "css",
  });
  await info.attach("phone-launcher-geometry", {
    body: JSON.stringify(launcher),
    contentType: "application/json",
  });
  expect(await retained?.evaluate((node) => node.isConnected)).toBe(true);
  await page
    .getByRole("button", { exact: true, name: "Toggle Chat Drawer" })
    .click();
  await expect(draft).toHaveValue("Keep this draft while the keyboard opens.");
  await expect
    .poll(async () => Math.abs((await readAnchor()).top - originalAnchor.top))
    .toBeLessThanOrEqual(1);
  const restoredAnchor = await readAnchor();
  expect(restoredAnchor.id).toBe(originalAnchor.id);
  expect(
    Math.abs(restoredAnchor.offset - originalAnchor.offset),
  ).toBeLessThanOrEqual(1);
  await info.attach("retained-message-anchor", {
    body: JSON.stringify({ originalAnchor, restoredAnchor }),
    contentType: "application/json",
  });
});
