import { expect, test } from "~/testing/browser/fixtures";
import { settleShell } from "~/testing/browser/shell-capture";
import {
  controlShellSearch,
  populateShellConversation,
} from "~/testing/browser/shell-responses";

test("controlled search supports loading, results, empty, retry and keyboard navigation", async ({
  page,
}) => {
  const control = await controlShellSearch(page);
  await page.goto("/journal");
  const trigger = page.getByRole("button", {
    exact: true,
    name: "Search notes",
  });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  const input = page.getByPlaceholder("Search notes...");
  control.set("loading");
  await input.fill("synthetic search");
  await expect(dialog.locator('[data-slot="skeleton"]').first()).toBeVisible();
  control.set("results");
  await expect(
    dialog.getByText("Controlled result: Browser note 25"),
  ).toBeVisible();
  await expect(dialog.locator('[data-slot="skeleton"]')).toHaveCount(0);
  await input.press("ArrowDown");
  const selected = dialog.locator('[cmdk-item][data-selected="true"]');
  await expect(selected).toHaveCount(1);
  const href = await selected.evaluate((node) =>
    node.closest("a")?.getAttribute("href"),
  );
  expect(href).toMatch(/^\/(pages|journal)\//);
  await input.press("Enter");
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(new URL(href ?? "", page.url()).href);
  await trigger.click();
  control.set("empty");
  await input.fill("synthetic empty");
  await expect(
    dialog.getByText("No results found.", { exact: true }),
  ).toBeVisible();
  await expect(dialog.locator("[cmdk-item]")).toHaveCount(0);
  control.set("error");
  await input.fill("synthetic retry");
  const retry = dialog.getByRole("button", {
    exact: true,
    name: "Try again",
  });
  await expect(retry).toBeEnabled();
  await expect(dialog.getByText("Search couldn’t load")).toBeVisible();
  control.set("results");
  await retry.click();
  await expect(
    dialog.getByText("Controlled result: Browser note 25"),
  ).toBeVisible();
  await expect(retry).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(input).toHaveValue("synthetic retry");
});
test("controlled populated assistant retains draft and reading position across collapse", async ({
  page,
  isMobile,
}) => {
  await populateShellConversation(page);
  await page.goto("/journal/2000-01-01");
  const trigger = page.getByRole("button", {
    exact: true,
    name: isMobile ? "Toggle Chat Drawer" : "Toggle Chat Sidebar",
  });
  if (await trigger.isVisible()) await trigger.click();
  const panel = page
    .getByRole("region", { exact: true, name: "Chat" })
    .filter({ visible: true });
  await expect(panel.locator("[data-chat-role]")).toHaveCount(16);
  const composer = panel.getByRole("textbox", {
    exact: true,
    name: "Message",
  });
  await expect(composer).toBeEnabled();
  await composer.fill("Retained controlled draft");
  const scroll = panel.locator('[data-slot="message-scroller-viewport"]');
  await settleShell(page);
  await scroll.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await expect(
    panel.getByText(
      "Synthetic conversation end. Keep one small observation for tomorrow.",
      { exact: true },
    ),
  ).toBeInViewport();
  await expect(
    panel.getByRole("button", { exact: true, name: "Copy response" }).last(),
  ).toBeEnabled();
  await scroll.evaluate((node) => {
    node.scrollTop = Math.floor((node.scrollHeight - node.clientHeight) / 2);
  });
  await expect
    .poll(() => scroll.evaluate((node) => node.scrollTop))
    .toBeGreaterThan(0);
  await settleShell(page);
  const readingPosition = async () =>
    scroll.evaluate((node) => {
      const viewport = node.getBoundingClientRect();
      const item = Array.from(
        node.querySelectorAll<HTMLElement>("[data-message-id]"),
      ).find((item) => item.getBoundingClientRect().bottom > viewport.top + 1);
      return item
        ? {
            id: item.dataset.messageId,
            offset: item.getBoundingClientRect().top - viewport.top,
          }
        : null;
    });
  const position = await readingPosition();
  expect(position).not.toBeNull();
  await page
    .getByRole("button", { exact: true, name: "Close assistant" })
    .click();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await settleShell(page);
  await expect(composer).toHaveValue("Retained controlled draft");
  await expect
    .poll(async () => (await readingPosition())?.id)
    .toBe(position?.id);
  await expect
    .poll(async () =>
      Math.abs(
        ((await readingPosition())?.offset ?? Number.POSITIVE_INFINITY) -
          (position?.offset ?? 0),
      ),
    )
    .toBeLessThanOrEqual(2);
  await expect(panel.locator("[data-chat-role]")).toHaveCount(16);
});
