import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { parseJsonEventStream, uiMessageChunkSchema } from "ai";
import { fixtureId } from "~/testing/browser/data";
import { expect, test } from "~/testing/browser/fixtures";

// Explicit opt-in: the ordinary browser suite uses no paid provider credentials.
// Auth, chat, generation, streaming, editor transactions and persistence are real.
// biome-ignore lint/style/noProcessEnv: Explicit opt-in to paid provider acceptance.
const liveAI = Boolean(process.env.BROWSER_TEST_OPENAI_API_KEY);
test.skip(
  !liveAI,
  "Set BROWSER_TEST_OPENAI_API_KEY to run real-provider writing acceptance",
);

test("live chat creates, edits, selects, reopens and persists structured writing", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "Desktop writing lifecycle",
  );
  test.setTimeout(600_000);
  const responses: { url: string; status: number; body: string }[] = [];
  const pending: Promise<void>[] = [];
  page.on("response", (response) => {
    if (!response.url().includes("/api/ai/")) return;
    const captured = {
      body: "",
      status: response.status(),
      url: response.url(),
    };
    responses.push(captured);
    pending.push(
      response
        .text()
        .then((body) => {
          captured.body = body;
        })
        .catch(() => {
          // The native transport cancels its reader at the terminal finish,
          // before the HTTP usage-accounting tail closes.
          captured.body = "Response reader closed before HTTP completion";
        }),
    );
  });
  const content = page
    .locator(
      '.journl-document-editor .better-editor-tiptap[contenteditable="true"]',
    )
    .first();
  const saved = async () => {
    await expect(page.locator("[data-save-status]")).toContainText("Saved", {
      timeout: 60_000,
    });
    await expect(
      page.getByRole("button", { exact: true, name: "Cancel" }),
    ).toHaveCount(0, {
      timeout: 60_000,
    });
    await expect(page.locator('[data-ai-edit-status="error"]')).toHaveCount(0);
  };
  try {
    await page.goto("/journal/1987-02-08");
    await openChat(page);
    // Repeat the reported create -> write action, with an explicit marker so
    // assertions verify editor content rather than an assistant's success claim.
    await ask(
      page,
      'Create a new page titled "Live writing acceptance", then add two separate lorem ipsum paragraphs to it. Start the first paragraph with "Lorem ipsum".',
    );
    await expect(page).toHaveURL(/\/pages\/[^/]+$/, { timeout: 120_000 });
    const url = page.url();
    await expect(content).toContainText("Lorem ipsum", { timeout: 120_000 });
    await expect(
      content.locator('[data-better-editor-body="paragraph"]'),
    ).toHaveCount(2);
    await saved();

    // The composer has focus throughout: writing must not require editor focus.
    await ask(
      page,
      "Replace the current page body with exactly three separate paragraphs: Cedar trees shelter the garden. / Rain gathers beside the old stone wall. / Tomorrow we will plant sunflowers. Do not include the slash separators.",
    );
    await expect(
      content.locator('[data-better-editor-body="paragraph"]'),
    ).toHaveText(
      [
        "Cedar trees shelter the garden.",
        "Rain gathers beside the old stone wall.",
        "Tomorrow we will plant sunflowers.",
      ],
      { timeout: 120_000 },
    );
    await saved();

    const selected = content
      .locator('[data-better-editor-body="paragraph"]')
      .nth(1);
    await selected.evaluate((element) => {
      const root = element.closest<HTMLElement>("[contenteditable]");
      root?.focus();
      const range = document.createRange();
      range.selectNodeContents(element);
      const selection = getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
    });
    await ask(
      page,
      "Replace only the highlighted text with: Mist settles beside the old stone wall.",
    );
    await expect(
      content.locator('[data-better-editor-body="paragraph"]'),
    ).toHaveText(
      [
        "Cedar trees shelter the garden.",
        "Mist settles beside the old stone wall.",
        "Tomorrow we will plant sunflowers.",
      ],
      { timeout: 120_000 },
    );
    await saved();
    await page.reload();
    await expect(content).toContainText(
      "Mist settles beside the old stone wall.",
    );

    await page.goto("/journal/1987-02-09");
    await openChat(page);
    await ask(
      page,
      `Open the page at ${new URL(url).pathname}, then replace its entire body with a chipotle steak sandwich recipe for two people. Include an introduction, heading sections for Ingredients and Method, at least six ingredient bullets, and at least four numbered method steps. Write it in the editor, not in chat.`,
    );
    await expect(page).toHaveURL(url, { timeout: 120_000 });
    await expect(
      content.locator('[data-better-editor-body="heading"]'),
    ).not.toHaveCount(0, { timeout: 120_000 });
    await saved();
    expect(
      await content
        .locator('[data-better-editor-body="bulletListItem"]')
        .count(),
    ).toBeGreaterThanOrEqual(6);
    expect(
      await content
        .locator('[data-better-editor-body="numberedListItem"]')
        .count(),
    ).toBeGreaterThanOrEqual(4);
    const ordinals = await content
      .locator('[data-better-editor-body="numberedListItem"]')
      .evaluateAll((rows) =>
        rows.map((row) => Number(row.getAttribute("data-start"))),
      );
    expect(ordinals).toEqual(ordinals.map((_, index) => index + 1));
    const written = await content.innerText();
    await page.reload();
    await expect(content).toHaveText(written, { useInnerText: true });
    await Promise.all(pending);
    const generations = responses.filter((response) =>
      response.url.endsWith("/document-writer"),
    );
    expect(generations).toHaveLength(4);
    for (const response of generations) {
      expect(response.status).toBe(200);
    }
  } finally {
    await Promise.all(pending);
    await info.attach("live-ai-responses", {
      body: JSON.stringify(responses, null, 2),
      contentType: "application/json",
    });
  }
});

test("live tools keep the current write contract despite obsolete calls in history", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "Desktop writing lifecycle",
  );
  test.setTimeout(120_000);
  const target = fixtureId(1);
  const response = await page.request.post("/api/ai/journl-agent", {
    data: {
      context: {
        activeEditors: [`page:${target}`],
        currentDate: "2026-11-06",
        highlightedText: [],
        reasoning: "instant",
        view: { id: target, name: "page", title: "Browser note 01" },
      },
      messages: [
        {
          id: randomUUID(),
          parts: [
            { text: "Add lorem ipsum to the current page.", type: "text" },
          ],
          role: "user",
        },
        {
          id: randomUUID(),
          parts: [
            {
              input: {
                agentPrompt: "Add lorem ipsum",
                reasoningEffort: "minimal",
                targetEditor: `page:${target}`,
              },
              output: {
                message: "This action could not complete. Please retry.",
                status: "error",
              },
              state: "output-available",
              toolCallId: randomUUID(),
              type: "tool-write",
            },
          ],
          role: "assistant",
        },
        {
          id: randomUUID(),
          parts: [
            {
              text: "Try again: write one lorem ipsum paragraph in the current page.",
              type: "text",
            },
          ],
          role: "user",
        },
      ],
    },
    timeout: 120_000,
  });
  const body = await response.text();
  await info.attach("live-contract-response", {
    body,
    contentType: "text/event-stream",
  });
  expect(response.ok()).toBe(true);
  const calls = [];
  const stream = new Response(body).body;
  if (!stream) throw new Error("Missing chat response body");
  const native = parseJsonEventStream({
    schema: uiMessageChunkSchema,
    stream,
  });
  for await (const chunk of native) {
    if (!chunk.success) throw chunk.error;
    if (
      chunk.value.type === "tool-input-available" &&
      chunk.value.toolName === "write"
    )
      calls.push(chunk.value.input);
    expect(chunk.value.type).not.toBe("error");
  }
  expect(calls).toHaveLength(1);
  expect(Object.keys(calls[0] as object)).toEqual(["agentPrompt"]);
});

test("live writer appends mixed structured content including tables", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "Real-provider desktop mixed content",
  );
  test.setTimeout(360_000);
  const responses: Promise<string>[] = [];
  page.on("response", (response) => {
    if (response.url().endsWith("/api/ai/document-writer"))
      responses.push(response.text().catch(() => "Writer stream closed"));
  });
  try {
    await page.goto(`/pages/${fixtureId(1)}`);
    await openChat(page);
    await expect(
      page.getByPlaceholder("Ask anything...").filter({ visible: true }),
    ).toBeEnabled({ timeout: 60_000 });
    await ask(
      page,
      "Append complex structured content to this page: a Complex Examples heading; a four-column table with a header and three data rows; a three-item ordered list with a nested bullet list under item two; a checklist with checked and unchecked tasks; a JavaScript code block; a quote; an image using https://example.com/image.png; a divider; and a second two-column table with Sidebar and Main Content headers. Keep existing writing. Put the content in the editor, not in chat.",
    );
    const editor = page.locator(".better-editor-tiptap");
    await expect(editor.locator("table")).toHaveCount(2, { timeout: 180_000 });
    await expect(
      page.getByRole("button", { exact: true, name: "Cancel" }),
    ).toHaveCount(0, { timeout: 180_000 });
    await expect(editor).toHaveAttribute("contenteditable", "true");
    await expect(editor.locator("table")).toHaveCount(2);
    await expect(page.locator("[data-save-status]")).toContainText("Saved", {
      timeout: 60_000,
    });
    await expect(
      editor.locator('[data-better-editor-body="codeBlock"]'),
    ).toHaveCount(1);
    await expect(
      editor.locator('[data-better-editor-body="checkListItem"]'),
    ).not.toHaveCount(0);
    await expect(page.locator('[data-ai-edit-status="error"]')).toHaveCount(0);
    const written = await editor.innerText();
    await page.reload();
    await expect(editor).toHaveText(written, { useInnerText: true });
    await expect(editor.locator("table")).toHaveCount(2);
    await expect(
      editor.locator('[data-better-editor-body="codeBlock"]'),
    ).toHaveCount(1);
  } finally {
    await info.attach("mixed-writer-responses", {
      body: JSON.stringify(await Promise.all(responses)),
      contentType: "application/json",
    });
  }
});

async function openChat(page: Page) {
  const toggle = page.getByRole("button", {
    exact: true,
    name: "Toggle Chat Sidebar",
  });
  if (await toggle.isVisible()) await toggle.click();
}

async function ask(page: Page, text: string) {
  const composer = page
    .getByPlaceholder("Ask anything...")
    .filter({ visible: true });
  await composer.fill(text);
  await composer.press("Enter");
}
