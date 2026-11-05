import type { Editor } from "@tiptap/core";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { expect, test } from "~/testing/browser/fixtures";

// Mock only the external model responses. Authentication, editor, and saves stay real.
for (const conflict of [false, true])
  test(
    conflict
      ? "typing in the AI target cancels, keeps human writing, and Retry uses that target"
      : "chat previews without saving, auto-applies to the selection, and keeps one Undo step",
    async ({ page }, info) => {
      test.skip(
        info.project.name !== "desktop-chromium",
        "Desktop chat and keyboard acceptance",
      );
      const date = conflict ? "1987-02-04" : "1987-02-03";
      await page.goto(`/journal/${date}`);
      const editor = page
        .locator('.better-editor-tiptap[contenteditable="true"]')
        .first();
      await editor.fill("Keep original ending");
      await expect(page.locator("[data-save-status]")).toContainText("Saved", {
        timeout: 60_000,
      });
      const toggle = page.getByRole("button", {
        exact: true,
        name: "Toggle Chat Sidebar",
      });
      if (await toggle.isVisible()) await toggle.click();
      await editor.evaluate((root) => {
        const instance = (root as HTMLElement & { editor: Editor }).editor;
        instance.commands.setTextSelection({ from: 7, to: 15 });
      });
      let finish: () => void = () => {};
      const gate = new Promise<void>((resolve) => {
        finish = resolve;
      });
      await page.route("**/api/ai/journl-agent", async (route) => {
        const body = route.request().postDataJSON();
        const hasResult = body.messages.some(
          (message: { parts: { type: string; state?: string }[] }) =>
            message.parts.some(
              (part) =>
                part.type === "tool-write" && part.state === "output-available",
            ),
        );
        const response = createUIMessageStreamResponse({
          stream: createUIMessageStream({
            execute: ({ writer }) => {
              writer.write({
                messageId: hasResult ? "done" : "edit",
                type: "start",
              });
              if (!hasResult)
                writer.write({
                  input: {
                    agentPrompt: "Replace the selected text with improved",
                    targetEditor: `journal-entry:${date}`,
                  },
                  toolCallId: "write-one",
                  toolName: "write",
                  type: "tool-input-available",
                });
              writer.write({
                finishReason: hasResult ? "stop" : "tool-calls",
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
        const body = route.request().postDataJSON();
        expect(body.blocks).toHaveLength(1);
        const operations = [
          {
            data: { content: "improved", type: "paragraph" },
            id: body.blocks[0].id,
            type: "update",
          },
        ];
        const response = createUIMessageStreamResponse({
          stream: createUIMessageStream({
            execute: ({ writer }) => {
              writer.write({ type: "start" });
              writer.write({
                data: { operations, status: "generating" },
                transient: true,
                type: "data-document-edit",
              });
            },
          }),
        });
        // Playwright fulfills complete responses, so hold before delivering the final batch.
        const partial = await response.text();
        await gate;
        const final = createUIMessageStreamResponse({
          stream: createUIMessageStream({
            execute: ({ writer }) => {
              writer.write({
                data: { operations, status: "generated" },
                type: "data-document-edit",
              });
              writer.write({ finishReason: "stop", type: "finish" });
            },
          }),
        });
        await route.fulfill({
          body: partial.replace("data: [DONE]\n\n", "") + (await final.text()),
          contentType: "text/event-stream",
          headers: { "x-vercel-ai-ui-message-stream": "v1" },
        });
      });
      const composer = page
        .getByPlaceholder("Ask anything...")
        .filter({ visible: true });
      await composer.fill("Improve the selected text");
      await composer.press("Enter");
      await expect(
        page.locator('[data-ai-edit-status="generating"]'),
      ).toBeVisible();
      await expect(editor.locator("[data-better-editor-body]")).toHaveText(
        "Keep original ending",
      );
      if (conflict) {
        await editor.evaluate((root) => {
          const instance = (root as HTMLElement & { editor: Editor }).editor;
          instance.view.dispatch(instance.state.tr.insertText("human ", 8));
        });
        await expect(
          page.locator('[data-ai-edit-status="conflict"]'),
        ).toBeVisible();
        await expect(editor.locator("[data-better-editor-body]")).toHaveText(
          "Keep ohuman riginal ending",
        );
        finish();
        await page
          .getByRole("button", { exact: true, name: "Retry AI edit" })
          .click();
      } else finish();
      await expect(editor.locator("[data-better-editor-body]")).toHaveText(
        "Keep improved ending",
      );
      await expect(page.locator("[data-save-status]")).toContainText("Saved", {
        timeout: 60_000,
      });
      await editor.focus();
      await editor.press("ControlOrMeta+z");
      await expect(editor.locator("[data-better-editor-body]")).toHaveText(
        conflict ? "Keep ohuman riginal ending" : "Keep original ending",
      );
      await expect(page.locator("[data-save-status]")).toContainText("Saved", {
        timeout: 60_000,
      });
      await page.reload();
      await expect(editor.locator("[data-better-editor-body]")).toHaveText(
        conflict ? "Keep ohuman riginal ending" : "Keep original ending",
      );
    },
  );
