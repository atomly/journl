import { expect, test } from "~/testing/browser/fixtures";

// biome-ignore lint/style/noProcessEnv: Explicit opt-in to paid provider acceptance.
const liveAI = Boolean(process.env.BROWSER_TEST_OPENAI_API_KEY);
test.skip(
  !liveAI,
  "Set BROWSER_TEST_OPENAI_API_KEY for real history acceptance",
);

test("fresh chats do not restore historical messages and requests send only new input", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "Real-provider desktop history lifecycle",
  );
  test.setTimeout(180_000);
  const requestSizes: number[] = [];
  page.on("request", (request) => {
    if (
      request.url().includes("/api/ai/journl-agent") &&
      request.method() === "POST"
    )
      requestSizes.push(request.postDataJSON().messages.length);
  });
  await page.addInitScript(() =>
    sessionStorage.setItem(
      "journl:active-chat:browser-owner",
      "journl:browser-owner",
    ),
  );
  await page.goto("/journal/1987-03-11");
  const toggle = page.getByRole("button", {
    exact: true,
    name: "Toggle Chat Sidebar",
  });
  if (await toggle.isVisible()) await toggle.click();
  const panel = page
    .getByRole("region", { exact: true, name: "Chat" })
    .filter({ visible: true });
  const input = panel.getByRole("textbox", { exact: true, name: "Message" });
  await expect(input).toBeEnabled({ timeout: 60_000 });
  await expect(panel.locator("[data-chat-role]")).toHaveCount(0);
  await expect(
    panel.getByRole("button", { name: "Load earlier messages" }),
  ).toHaveCount(0);
  await expect(
    panel.getByRole("combobox", { name: "Conversation branch" }),
  ).toHaveCount(0);
  await expect(
    panel.getByRole("button", { exact: true, name: "New chat" }),
  ).toHaveCount(0);
  await input.fill(
    "Reply with exactly HISTORY_REQUEST_RECOVERED. Do not use tools.",
  );
  await panel
    .getByRole("button", { exact: true, name: "Send message" })
    .click();
  await expect(
    panel.locator('[data-chat-role="assistant"]').last(),
  ).toContainText("HISTORY_REQUEST_RECOVERED", { timeout: 90_000 });
  await expect(
    panel.getByRole("button", { exact: true, name: "Cancel" }),
  ).toHaveCount(0, { timeout: 60_000 });
  expect(requestSizes.length).toBeGreaterThan(0);
  expect(requestSizes.every((size) => size === 1)).toBe(true);
  await expect(panel.getByRole("alert")).toHaveCount(0);
  await page.reload();
  await expect(input).toBeEnabled();
  await expect(panel.locator("[data-chat-role]")).toHaveCount(0);
});
