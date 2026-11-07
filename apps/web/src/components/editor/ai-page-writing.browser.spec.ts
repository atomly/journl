import { randomUUID } from "node:crypto";
import type { DocumentOperation } from "@acme/document";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { expect, test } from "~/testing/browser/fixtures";

test("chat creates and writes a page, edits it unfocused, then opens it and writes again", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "Desktop page/editor navigation acceptance",
  );
  let pageId: string | undefined;
  let writes = 0;
  const bulletId = randomUUID();
  const contexts: {
    activeEditors: string[];
    view: { name: string; id?: string };
  }[] = [];
  await page.route("**/api/ai/journl-agent", async (route) => {
    const body = route.request().postDataJSON();
    contexts.push(body.context);
    const userIndex = body.messages.findLastIndex(
      (message: { role: string }) => message.role === "user",
    );
    const text = body.messages[userIndex].parts.find(
      (part: { type: string }) => part.type === "text",
    )?.text;
    const parts = body.messages.slice(userIndex + 1).flatMap(
      (message: {
        parts: {
          type: string;
          state?: string;
          output?: { page?: { id: string }; status?: string };
        }[];
      }) => message.parts,
    );
    const created = parts.find(
      (part: { type: string; state?: string }) =>
        part.type === "tool-createPage" && part.state === "output-available",
    );
    const opened = parts.find(
      (part: { type: string; state?: string }) =>
        part.type === "tool-navigatePage" && part.state === "output-available",
    );
    const written = parts.find(
      (part: { type: string; state?: string }) =>
        part.type === "tool-write" && part.state === "output-available",
    );
    if (created?.output?.page?.id) pageId = created.output.page.id;
    const response = createUIMessageStreamResponse({
      stream: createUIMessageStream({
        execute: ({ writer }) => {
          writer.write({ messageId: randomUUID(), type: "start" });
          writer.write({ type: "start-step" });
          if (text === "Create a page and write a recipe" && !created)
            writer.write({
              input: { title: "AI page lifecycle" },
              toolCallId: "create",
              toolName: "createPage",
              type: "tool-input-available",
            });
          else if (text === "Open the recipe and update it" && !opened)
            writer.write({
              input: { id: pageId },
              toolCallId: "open",
              toolName: "navigatePage",
              type: "tool-input-available",
            });
          else if (!written) {
            expect(pageId).toBeDefined();
            expect(body.context.activeEditors).toEqual([`page:${pageId}`]);
            expect(body.context.view).toMatchObject({
              id: pageId,
              name: "page",
            });
            writer.write({
              input: {
                agentPrompt: "Write or update the structured recipe",
              },
              toolCallId: `write-${writes}`,
              toolName: "write",
              type: "tool-input-available",
            });
          } else {
            expect(written.output?.status).toBe("applied");
            writer.write({ id: "done", type: "text-start" });
            writer.write({ delta: "Done.", id: "done", type: "text-delta" });
            writer.write({ id: "done", type: "text-end" });
          }
          writer.write({ type: "finish-step" });
          writer.write({
            finishReason: written ? "stop" : "tool-calls",
            type: "finish",
          });
        },
      }),
    });
    await route.fulfill({
      body: await response.text(),
      headers: Object.fromEntries(response.headers),
    });
  });
  await page.route("**/api/ai/document-writer", async (route) => {
    const request = route.request().postDataJSON();
    writes++;
    expect(request.targetEditor).toBe(`page:${pageId}`);
    const operations: DocumentOperation[] = [
      {
        data: {
          content: `Recipe revision ${writes}`,
          props: { level: 2 },
          type: "heading",
        },
        id: request.blocks[0].id,
        type: "update",
      },
    ];
    if (writes === 1)
      operations.push({
        afterId: request.blocks[0].id,
        block: {
          content: "Chipotle steak",
          id: bulletId,
          type: "bulletListItem",
        },
        parentId: null,
        type: "insert",
      });
    const response = createUIMessageStreamResponse({
      stream: createUIMessageStream({
        execute: ({ writer }) => {
          writer.write({ type: "start" });
          writer.write({
            data: { operations, status: "generating" },
            transient: true,
            type: "data-document-edit",
          });
          writer.write({
            data: { operations, status: "generated" },
            type: "data-document-edit",
          });
          writer.write({ finishReason: "stop", type: "finish" });
        },
      }),
    });
    await route.fulfill({
      body: await response.text(),
      headers: Object.fromEntries(response.headers),
    });
  });
  const openChat = async () => {
    const toggle = page.getByRole("button", {
      exact: true,
      name: "Toggle Chat Sidebar",
    });
    if (await toggle.isVisible()) await toggle.click();
  };
  const ask = async (text: string) => {
    const composer = page
      .getByPlaceholder("Ask anything...")
      .filter({ visible: true });
    await composer.fill(text);
    await composer.press("Enter");
  };
  await page.goto("/journal/1987-02-08");
  await openChat();
  await ask("Create a page and write a recipe");
  await expect(page).toHaveURL(/\/pages\/[^/]+$/);
  const content = page
    .locator(
      '.journl-document-editor .better-editor-tiptap[contenteditable="true"]',
    )
    .first();
  await expect(
    content.locator('[data-better-editor-body="heading"]'),
  ).toHaveText("Recipe revision 1");
  await expect(page.locator("[data-save-status]")).toContainText("Saved", {
    timeout: 60_000,
  });
  await ask("Update the current page");
  await expect(
    content.locator('[data-better-editor-body="heading"]'),
  ).toHaveText("Recipe revision 2");
  await expect(content.locator(`[data-block-id="${bulletId}"]`)).toContainText(
    "Chipotle steak",
  );
  await expect(page.locator("[data-save-status]")).toContainText("Saved", {
    timeout: 60_000,
  });
  await page.goto("/journal/1987-02-09");
  await openChat();
  await ask("Open the recipe and update it");
  await expect(
    content.locator('[data-better-editor-body="heading"]'),
  ).toHaveText("Recipe revision 3");
  await expect(page.locator("[data-save-status]")).toContainText("Saved", {
    timeout: 60_000,
  });
  await page.reload();
  await expect(
    content.locator('[data-better-editor-body="heading"]'),
  ).toHaveText("Recipe revision 3");
  expect(writes).toBe(3);
  expect(
    contexts.some(
      (context) =>
        context.view.id === pageId &&
        context.activeEditors[0] === `page:${pageId}`,
    ),
  ).toBe(true);
});
