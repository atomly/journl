import { fixtureId } from "~/testing/browser/data";
import { expect, test } from "~/testing/browser/fixtures";
import { populateShellConversation } from "~/testing/browser/shell-responses";
import { workspaceMessages } from "~/testing/browser/workspace-v2-data";

test.use({ workspaceReview: true });
test.skip(({ isMobile }) => isMobile, "Desktop assistant layout");

test("quota keeps the composer inside the panel and hides retry", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await populateShellConversation(page, workspaceMessages);
  await page.route("**/api/ai/journl-agent", (route) =>
    route.fulfill({
      json: {
        code: "USAGE_QUOTA_EXCEEDED",
        error: "Usage quota exceeded",
        usage: {
          canUse: false,
          currentUsageUsd: 5,
          periodEnd: "2099-01-01T00:00:00.000Z",
          quotaUsd: 5,
          remainingQuotaUsd: 0,
          subscriptionType: "pro",
          usagePeriodId: null,
        },
      },
      status: 429,
    }),
  );
  await page.goto(`/pages/${fixtureId(1610)}`);
  const panel = page
    .getByRole("region", { exact: true, name: "Chat" })
    .filter({ visible: true });
  const draft = panel.getByRole("textbox", { exact: true, name: "Message" });
  await draft.fill("> Ingredients");
  await draft.press("Enter");
  await expect(panel.getByRole("alert")).toHaveCount(1);
  await expect(panel.getByRole("alert")).toContainText(
    "AI usage limit reached",
  );
  await expect(
    panel.getByRole("button", { exact: true, name: "Retry response" }),
  ).toHaveCount(0);
  await expect(
    panel.locator('[data-chat-role="user"] blockquote').last(),
  ).toHaveText("Ingredients");
  const send = panel.getByRole("button", { exact: true, name: "Send message" });
  await expect(send).toBeDisabled();
  await expect(send).toBeInViewport({ ratio: 1 });
  await expect
    .poll(async () => {
      const composer = await panel
        .getByRole("form", { name: "Chat composer" })
        .boundingBox();
      const body = await panel.boundingBox();
      if (!composer || !body) return Number.POSITIVE_INFINITY;
      return Math.abs(composer.y + composer.height - body.y - body.height);
    })
    .toBeLessThanOrEqual(1);
});
