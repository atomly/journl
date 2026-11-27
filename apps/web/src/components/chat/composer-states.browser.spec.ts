import { mkdir, writeFile } from "node:fs/promises";
import { fixtureId } from "~/testing/browser/data";
import { expect, test } from "~/testing/browser/fixtures";
import { renderedTextContrast } from "~/testing/browser/rendered-contrast";
import {
  captureSettledShell,
  settleShell,
} from "~/testing/browser/shell-capture";
import {
  measureConversationAnchor,
  measureShellControls,
} from "~/testing/browser/shell-metrics";
import {
  controlShellChatSend,
  populateShellConversation,
  type ShellChatMode,
} from "~/testing/browser/shell-responses";
import { workspaceMessages } from "~/testing/browser/workspace-v2-data";

test.use({ workspaceReview: true });

const states: { mode: ShellChatMode; prompt: string; stateId: string }[] = [
  {
    mode: "error",
    prompt: "Can you make a short shopping list?",
    stateId: "composer-error",
  },
  {
    mode: "pending",
    prompt: "Can you summarize the plan?",
    stateId: "composer-loading",
  },
  {
    mode: "streaming",
    prompt: "Can you make a short shopping list?",
    stateId: "composer-streaming",
  },
];

for (const theme of ["light", "dark"]) {
  for (const { mode, prompt, stateId } of states) {
    test(`v2 ${stateId} ${theme}`, async ({ page }, info) => {
      test.skip(
        info.project.name !== "desktop-chromium",
        "Composer plates are desktop Chromium states",
      );
      await page.setViewportSize({ height: 1000, width: 1440 });
      await page.addInitScript(
        (value) => localStorage.setItem("theme", value),
        theme,
      );
      await populateShellConversation(page, workspaceMessages);
      const control = await controlShellChatSend(page);
      try {
        control.set(mode);
        await page.goto(`/pages/${fixtureId(1610)}`);
        await expect(
          page.locator('.better-editor-tiptap[contenteditable="true"]').first(),
        ).toBeVisible();
        const panel = page
          .getByRole("region", { exact: true, name: "Chat" })
          .filter({ visible: true });
        await expect(panel.locator("[data-chat-role]")).toHaveCount(4);
        const measurements: unknown[] = [];
        // The plate seats the panels at Nav 216 × 968 at 16,16, Center 760 at
        // 248,16 and Agent 400 × 968 at 1024,16 for a 1440 × 1000 viewport.
        const shells = await page.evaluate(() =>
          Object.fromEntries(
            Object.entries({
              agent: '[data-side="right"] [data-slot="sidebar-container"]',
              center: "[data-app-container]",
              nav: '[data-side="left"] [data-slot="sidebar-container"]',
            }).map(([name, selector]) => [
              name,
              document
                .querySelector<HTMLElement>(selector)
                ?.getBoundingClientRect()
                .toJSON(),
            ]),
          ),
        );
        expect(shells.nav.x).toBe(16);
        expect(shells.nav.y).toBe(16);
        expect(shells.nav.width).toBe(216);
        expect(shells.nav.height).toBe(968);
        expect(shells.center.x).toBe(248);
        expect(shells.center.width).toBe(760);
        expect(shells.agent.x).toBe(1024);
        expect(shells.agent.width).toBe(400);
        expect(shells.agent.y).toBe(16);
        expect(shells.agent.height).toBe(968);
        const draft = panel.getByRole("textbox", {
          exact: true,
          name: "Message",
        });
        await expect(draft).toBeEnabled();
        const send = panel.getByRole("button", {
          exact: true,
          name: "Send message",
        });
        const cancel = panel.getByRole("button", {
          exact: true,
          name: "Cancel",
        });
        await draft.fill(prompt);
        // With a draft present the send control keeps the plate's 34px
        // primary geometry.
        await expect(send).toBeEnabled();
        const sendBox = await send.boundingBox();
        expect(sendBox?.width).toBe(34);
        expect(sendBox?.height).toBe(34);
        await send.click();
        await expect(
          panel.locator('[data-chat-role="user"]').last(),
        ).toContainText(prompt);
        if (mode === "error") {
          // Send disabled after failure; the failed turn keeps its Retry.
          const alert = panel.getByRole("alert");
          await expect(alert).toBeVisible();
          await expect(alert).toContainText("Could not complete the response");
          // The populated assistant turns each keep their own footer Retry
          // action, so the failed turn's control must be scoped to the
          // failure alert that offers it.
          const retry = alert.getByRole("button", {
            exact: true,
            name: "Retry response",
          });
          await expect(retry).toBeEnabled();
          await expect(send).toBeVisible();
          await expect(send).toBeDisabled();
          await expect(cancel).toHaveCount(0);
          await expect(draft).toBeEnabled();
          await expect(draft).toHaveValue("");
          const model = panel.getByRole("combobox", {
            exact: true,
            name: "Reasoning mode",
          });
          await expect(model).toBeEnabled();
          const modelContrast = await renderedTextContrast(model);
          expect(modelContrast.ratio).toBeGreaterThanOrEqual(4.5);
          measurements.push({
            label: "Model selector while failed",
            ...modelContrast,
          });
          const message = await renderedTextContrast(alert);
          expect(
            message.ratio,
            `${theme} failure alert text`,
          ).toBeGreaterThanOrEqual(4.5);
          measurements.push({ label: "Failure alert", ...message });
          // The disabled send icon is exempt from a contrast minimum.
          const disabledSend = await renderedTextContrast(send, "icons");
          measurements.push({ label: "Disabled send icon", ...disabledSend });
        }
        if (mode === "pending") {
          // Response pending: the native thinking status shows, send is
          // replaced by the cancel control, and the composer stays usable.
          const thinking = panel.getByRole("status", {
            exact: true,
            name: "Thinking",
          });
          await expect(thinking).toBeVisible();
          await expect(panel.locator("[data-chat-role]")).toHaveCount(6);
          await expect(cancel).toBeVisible();
          await expect(cancel).toBeEnabled();
          await expect(send).toHaveCount(0);
          await expect(draft).toBeEnabled();
          await expect(draft).toHaveValue("");
          const statusContrast = await renderedTextContrast(thinking);
          measurements.push({
            label: "Pending thinking status",
            ...statusContrast,
          });
          const cancelBox = await cancel.boundingBox();
          expect(cancelBox?.width).toBe(34);
          expect(cancelBox?.height).toBe(34);
          const cancelContrast = await renderedTextContrast(cancel, "icons");
          expect(
            cancelContrast.ratio,
            `${theme} pending cancel icon`,
          ).toBeGreaterThanOrEqual(3);
          measurements.push({
            label: "Pending cancel icon",
            ...cancelContrast,
          });
        }
        if (mode === "streaming") {
          // Partial response visible with the stop control available.
          const response = panel.locator('[data-chat-role="assistant"]').last();
          await expect(response).toContainText(
            "Start with two shallow rail planters, matching saucers",
          );
          await expect(panel.locator("[data-chat-role]")).toHaveCount(6);
          await expect(cancel).toBeVisible();
          await expect(cancel).toBeEnabled();
          await expect(send).toHaveCount(0);
          await expect(draft).toBeEnabled();
          await expect(draft).toHaveValue("");
          const answer = await renderedTextContrast(response);
          expect(
            answer.ratio,
            `${theme} streaming answer text`,
          ).toBeGreaterThanOrEqual(4.5);
          measurements.push({ label: "Streaming answer", ...answer });
          const cancelBox = await cancel.boundingBox();
          expect(cancelBox?.width).toBe(34);
          expect(cancelBox?.height).toBe(34);
          const cancelContrast = await renderedTextContrast(cancel, "icons");
          expect(
            cancelContrast.ratio,
            `${theme} streaming stop icon`,
          ).toBeGreaterThanOrEqual(3);
          measurements.push({
            label: "Streaming stop icon",
            ...cancelContrast,
          });
        }
        const composer = await panel
          .locator('[aria-label="Chat composer"]')
          .boundingBox();
        // The composer is the chat region's footer and seats flush with the
        // region's bottom edge. The sidebar composes its inner surface
        // around the region, so measure the region live instead of
        // hardcoding the viewport edge: the seat stays exact while the
        // panel's inner chrome composition evolves.
        const region = await panel.boundingBox();
        expect((composer?.y ?? 0) + (composer?.height ?? 0)).toBe(
          (region?.y ?? 0) + (region?.height ?? 0),
        );
        await settleShell(page);
        const conversationAnchor = await measureConversationAnchor(page);
        expect(conversationAnchor?.atEnd).toBe(true);
        const directory = info.outputPath("composer-states");
        await mkdir(directory, { recursive: true });
        const frame = await captureSettledShell(
          page,
          `${directory}/current.png`,
        );
        const controls = await measureShellControls(page);
        await writeFile(
          `${directory}/mapping.json`,
          JSON.stringify(
            {
              controls,
              conversationAnchor,
              exclusions: [
                "The plate keeps the failed or in-flight draft in the composer; the native composer clears the draft on submit, so the driven prompt appears as the last user bubble and the composer is empty.",
                "The plate previews static states; the app renders native AI SDK state surfaces, so the pending turn shows the Trace thinking status and the stop control is the composer's icon button.",
                "Controlled native chat history; the thread is the controlled garden conversation plus the driven turn.",
              ],
              frame,
              measurements,
              mode,
              reference: `docs/design-handoff/approved-workspace-v2/review/screens/${stateId}-${theme}.png`,
              route: `/pages/${fixtureId(1610)}`,
              stateId,
              theme,
              viewport: { height: 1000, width: 1440 },
            },
            null,
            2,
          ),
        );
      } finally {
        control.close();
      }
    });
  }
}

test("quota keeps the composer inside the panel and hides retry", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "Desktop assistant layout",
  );
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
