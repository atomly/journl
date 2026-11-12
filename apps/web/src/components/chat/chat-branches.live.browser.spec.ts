import type { Locator } from "@playwright/test";
import { expect, test } from "~/testing/browser/fixtures";

// Native Mastra storage and real model calls: intercepted chat streams cannot
// prove that edited text, earlier answers and tool history reach the right thread.
// biome-ignore lint/style/noProcessEnv: Explicit opt-in to paid provider acceptance.
const liveAI = Boolean(process.env.BROWSER_TEST_OPENAI_API_KEY);
test.skip(
  !liveAI,
  "Set BROWSER_TEST_OPENAI_API_KEY for real conversation branching acceptance",
);

test("Edit and Retry work without conversation switching and start fresh after reload", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "Real-provider desktop branching lifecycle",
  );
  test.setTimeout(300_000);
  await page.goto("/journal/1987-03-08");
  const toggle = page.getByRole("button", {
    exact: true,
    name: "Toggle Chat Sidebar",
  });
  if (await toggle.isVisible()) await toggle.click();
  const panel = page
    .getByRole("region", { exact: true, name: "Chat" })
    .filter({ visible: true });
  const first = "Reply with exactly BRANCH_ORIGINAL_CEDAR. Do not use tools.";
  const later = "Reply with exactly BRANCH_LATER_WILLOW. Do not use tools.";
  const revision = "Reply with exactly BRANCH_REVISED_MAPLE. Do not use tools.";
  await expect(
    panel.getByRole("textbox", { exact: true, name: "Message" }),
  ).toBeEnabled({ timeout: 60_000 });
  const baseUsers = await panel.locator('[data-chat-role="user"]').count();
  const baseAnswers = await panel
    .locator('[data-chat-role="assistant"]')
    .count();
  await ask(panel, first, "BRANCH_ORIGINAL_CEDAR");
  await ask(panel, later, "BRANCH_LATER_WILLOW");
  await panel
    .locator('[data-chat-role="user"]')
    .filter({ hasText: first })
    .getByRole("button", { exact: true, name: "Edit message" })
    .click();
  await panel
    .getByRole("textbox", { exact: true, name: "Edit message" })
    .fill(revision);
  await panel
    .getByRole("button", { exact: true, name: "Save and send" })
    .click();
  await answered(panel, "BRANCH_REVISED_MAPLE");
  await expect(panel.locator('[data-chat-role="user"]')).toHaveCount(
    baseUsers + 1,
  );
  await expect(panel.locator("[data-chat-role]")).not.toContainText([
    "BRANCH_LATER_WILLOW",
  ]);
  await panel
    .locator('[data-chat-role="assistant"]')
    .last()
    .getByRole("button", { exact: true, name: "Retry response" })
    .click();
  await answered(panel, "BRANCH_REVISED_MAPLE");
  await expect(
    panel.getByRole("combobox", { name: "Conversation branch" }),
  ).toHaveCount(0);
  await expect(panel.locator('[data-chat-role="user"]')).toHaveCount(
    baseUsers + 1,
  );
  await expect(panel.locator('[data-chat-role="assistant"]')).toHaveCount(
    baseAnswers + 1,
  );
  await page.reload();
  await expect(
    panel.getByRole("textbox", { exact: true, name: "Message" }),
  ).toBeEnabled();
  await expect(panel.locator("[data-chat-role]")).toHaveCount(0);
  await expect(
    panel.getByRole("combobox", { name: "Conversation branch" }),
  ).toHaveCount(0);
});

async function ask(panel: Locator, prompt: string, answer: string) {
  const input = panel.getByRole("textbox", { exact: true, name: "Message" });
  await expect(input).toBeEnabled({ timeout: 60_000 });
  await input.fill(prompt);
  await panel
    .getByRole("button", { exact: true, name: "Send message" })
    .click();
  await answered(panel, answer);
}
async function answered(panel: Locator, answer: string) {
  await expect(
    panel.locator('[data-chat-role="assistant"]').last(),
  ).toContainText(answer, { timeout: 90_000 });
  await expect(
    panel.getByRole("button", { exact: true, name: "Cancel" }),
  ).toHaveCount(0, { timeout: 90_000 });
  await expect(
    panel.getByRole("textbox", { exact: true, name: "Message" }),
  ).toBeEnabled({ timeout: 60_000 });
  await expect(panel.getByRole("alert")).toHaveCount(0);
}
test("Retry recovers a prompt after an HTTP failure before native memory saved it", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "Real-provider desktop retry recovery",
  );
  test.setTimeout(180_000);
  await page.goto("/journal/1987-03-09");
  const toggle = page.getByRole("button", {
    exact: true,
    name: "Toggle Chat Sidebar",
  });
  if (await toggle.isVisible()) await toggle.click();
  const panel = page
    .getByRole("region", { exact: true, name: "Chat" })
    .filter({ visible: true });
  await expect(
    panel.getByRole("textbox", { exact: true, name: "Message" }),
  ).toBeEnabled({ timeout: 60_000 });
  await page.route(
    "**/api/ai/journl-agent",
    (route) =>
      route.fulfill({
        body: JSON.stringify({
          error: "Temporary test failure before persistence",
        }),
        contentType: "application/json",
        status: 503,
      }),
    { times: 1 },
  );
  await panel
    .getByRole("textbox", { exact: true, name: "Message" })
    .fill("Reply with exactly RETRY_RECOVERED_ORCHID. Do not use tools.");
  await panel
    .getByRole("button", { exact: true, name: "Send message" })
    .click();
  await expect(panel.getByRole("alert")).toContainText(
    "Could not complete the response",
  );
  await panel
    .getByRole("alert")
    .getByRole("button", { exact: true, name: "Retry response" })
    .click();
  await answered(panel, "RETRY_RECOVERED_ORCHID");
  await expect(
    panel.getByRole("combobox", { name: "Conversation branch" }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    panel.getByRole("textbox", { exact: true, name: "Message" }),
  ).toBeEnabled();
  await expect(panel.locator("[data-chat-role]")).toHaveCount(0);
});
