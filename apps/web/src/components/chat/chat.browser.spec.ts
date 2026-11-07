import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { expect, test } from "~/testing/browser/fixtures";

async function responseBody() {
  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute: ({ writer }) => {
        writer.write({ messageId: "ui-elements-response", type: "start" });
        writer.write({ id: "reasoning", type: "reasoning-start" });
        writer.write({
          delta: "I checked the requested note.",
          id: "reasoning",
          type: "reasoning-delta",
        });
        writer.write({ id: "reasoning", type: "reasoning-end" });
        writer.write({
          dynamic: true,
          input: { query: "example" },
          providerExecuted: true,
          toolCallId: "search",
          toolName: "webSearch",
          type: "tool-input-available",
        });
        writer.write({
          dynamic: true,
          output: { message: "Found one source" },
          providerExecuted: true,
          toolCallId: "search",
          type: "tool-output-available",
        });
        writer.write({ id: "answer", type: "text-start" });
        writer.write({
          delta:
            "## Useful answer\n\n- First item\n- Second item\n\n[Open journal](/journal)\n\n```typescript\nconst answer = 42;\n```",
          id: "answer",
          type: "text-delta",
        });
        writer.write({ id: "answer", type: "text-end" });
        writer.write({
          sourceId: "source",
          title: "Source reference",
          type: "source-url",
          url: "https://example.invalid/reference",
        });
        writer.write({ finishReason: "stop", type: "finish" });
      },
    }),
  }).text();
}

test("AI Elements render messages, reasoning, tools, markdown and sources in desktop and mobile chat", async ({
  page,
  context,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/ai/journl-agent", async (route) =>
    route.fulfill({
      body: await responseBody(),
      contentType: "text/event-stream",
      headers: { "x-vercel-ai-ui-message-stream": "v1" },
    }),
  );
  if (info.project.name === "desktop-chromium")
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/journal/1987-03-06");
  const mobile = info.project.name === "mobile-webkit";
  const toggle = page.getByRole("button", {
    exact: true,
    name: mobile ? "Toggle Chat Drawer" : "Toggle Chat Sidebar",
  });
  if (await toggle.isVisible()) await toggle.click();
  const panel = page
    .getByRole("region", { exact: true, name: "Chat" })
    .filter({ visible: true });
  const composer = panel.getByPlaceholder("Ask anything...");
  await composer.fill("Find a useful answer");
  await panel
    .getByRole("button", { exact: true, name: "Send message" })
    .click();
  await expect(panel.locator('[data-chat-role="user"]').last()).toContainText(
    "Find a useful answer",
  );
  const response = panel.locator('[data-chat-role="assistant"]').last();
  await expect(
    response.getByRole("heading", { exact: true, name: "Useful answer" }),
  ).toBeVisible();
  await expect(response.getByRole("listitem")).toHaveCount(2);
  await expect(
    response.getByRole("button", { exact: true, name: "Thought" }),
  ).toBeVisible();
  await response.getByRole("button", { exact: true, name: "Thought" }).click();
  await expect(response).toContainText("I checked the requested note.");
  await response
    .getByRole("button", { exact: true, name: "Search web Complete" })
    .click();
  await expect(response).toContainText("Found one source");
  await expect(
    response.getByRole("link", { name: /Source reference/ }),
  ).toHaveAttribute("href", "https://example.invalid/reference");
  await expect(response.locator('[data-slot="code-block"]')).toContainText(
    "const answer = 42;",
  );
  if (!mobile) {
    await response.locator('[data-slot="code-block-copy-button"]').click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      "const answer = 42;",
    );
    await response
      .getByRole("button", { exact: true, name: "Copy response" })
      .click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
      "## Useful answer",
    );
  }
  await panel
    .getByRole("combobox", { exact: true, name: "Reasoning mode" })
    .click();
  await page.getByRole("option", { exact: true, name: "Thinking" }).click();
  await expect(
    panel.getByRole("combobox", { exact: true, name: "Reasoning mode" }),
  ).toContainText("Thinking");
  await response
    .getByRole("link", { exact: true, name: "Open journal" })
    .click();
  await expect(page).toHaveURL(/\/journal$/);
  if (mobile) await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("chat cancellation stops the native request and leaves the composer usable", async ({
  page,
}, info) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/ai/journl-agent", async (route) => {
    await gate;
    await route
      .fulfill({
        body: await responseBody(),
        contentType: "text/event-stream",
        headers: { "x-vercel-ai-ui-message-stream": "v1" },
      })
      .catch(() => {});
  });
  try {
    await page.goto("/journal/1987-03-07");
    const mobile = info.project.name === "mobile-webkit";
    const toggle = page.getByRole("button", {
      exact: true,
      name: mobile ? "Toggle Chat Drawer" : "Toggle Chat Sidebar",
    });
    if (await toggle.isVisible()) await toggle.click();
    const panel = page
      .getByRole("region", { exact: true, name: "Chat" })
      .filter({ visible: true });
    const composer = panel.getByPlaceholder("Ask anything...");
    await composer.fill("A request to cancel");
    await panel
      .getByRole("button", { exact: true, name: "Send message" })
      .click();
    await panel.getByRole("button", { exact: true, name: "Cancel" }).click();
    await expect(
      panel.getByRole("button", { exact: true, name: "Send message" }),
    ).toBeVisible();
    release();
    await composer.fill("Next request");
    await expect(composer).toHaveValue("Next request");
    await expect(
      panel.getByRole("heading", { exact: true, name: "Useful answer" }),
    ).toHaveCount(0);
  } finally {
    release();
  }
});
