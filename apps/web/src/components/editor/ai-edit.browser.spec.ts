import type { DocumentOperation } from "@acme/document";
import type { Editor } from "@tiptap/core";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { expect, test } from "~/testing/browser/fixtures";

declare global {
  interface Window {
    aiWriterFixture: {
      request?: { blocks: { id: string }[] };
      controller?: ReadableStreamDefaultController<Uint8Array>;
    };
  }
}

// Only model responses are replaced. Authentication, editor, and saves stay real.
for (const mode of ["complete", "cancel", "blocks"] as const)
  test(`AI inline writing: ${mode}, editor locking, and persistent Undo`, async ({
    page,
  }, info) => {
    test.skip(
      info.project.name !== "desktop-chromium",
      "Desktop chat and keyboard acceptance",
    );
    const date =
      mode === "complete"
        ? "1987-02-03"
        : mode === "cancel"
          ? "1987-02-04"
          : "1987-02-05";
    await page.addInitScript(() => {
      const fetch = window.fetch.bind(window);
      window.aiWriterFixture = {};
      window.fetch = async (...args) => {
        if (
          typeof args[0] !== "string" ||
          !args[0].endsWith("/api/ai/document-writer")
        )
          return fetch(...args);
        window.aiWriterFixture.request = JSON.parse(String(args[1]?.body));
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              window.aiWriterFixture.controller = controller;
              args[1]?.signal?.addEventListener(
                "abort",
                () => {
                  try {
                    controller.close();
                  } catch {
                    /* Already completed. */
                  }
                },
                { once: true },
              );
            },
          }),
          {
            headers: {
              "content-type": "text/event-stream",
              "x-vercel-ai-ui-message-stream": "v1",
            },
          },
        );
      };
    });
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
    if (mode !== "blocks")
      await editor.evaluate((root) => {
        (
          root as HTMLElement & { editor: Editor }
        ).editor.commands.setTextSelection({ from: 7, to: 15 });
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
                input: {},
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
    const composer = page
      .getByPlaceholder("Ask anything...")
      .filter({ visible: true });
    await composer.fill("Improve this writing");
    await composer.press("Enter");
    await page.waitForFunction(() =>
      Boolean(window.aiWriterFixture.controller),
    );
    const id = await page.evaluate(
      () => window.aiWriterFixture.request?.blocks[0]?.id,
    );
    if (!id) throw new Error("Missing writer target");
    const operations: DocumentOperation[] =
      mode === "blocks"
        ? [
            {
              data: {
                content: "Ingredients",
                props: { level: 2 },
                type: "heading",
              },
              id,
              type: "update",
            },
            {
              afterId: id,
              block: {
                content: "Chicken",
                id: "8cce33a2-d8d9-4b09-a2bc-000000000001",
                type: "bulletListItem",
              },
              parentId: null,
              type: "insert",
            },
            {
              afterId: "8cce33a2-d8d9-4b09-a2bc-000000000001",
              block: {
                content: "Chipotle",
                id: "8cce33a2-d8d9-4b09-a2bc-000000000002",
                type: "bulletListItem",
              },
              parentId: null,
              type: "insert",
            },
            {
              afterId: "8cce33a2-d8d9-4b09-a2bc-000000000002",
              block: {
                content: "cook()",
                id: "8cce33a2-d8d9-4b09-a2bc-000000000003",
                props: { language: "text" },
                type: "codeBlock",
              },
              parentId: null,
              type: "insert",
            },
          ]
        : [
            {
              data: { content: "improved", type: "paragraph" },
              id,
              type: "update",
            },
          ];
    const send = async (value: object) =>
      page.evaluate((chunk) => {
        window.aiWriterFixture.controller?.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`),
        );
      }, value);
    await send({
      data: { operations, status: "generating" },
      transient: true,
      type: "data-document-edit",
    });
    const draft = page.locator("[data-ai-inline-draft]");
    await expect(draft).toBeVisible();
    await expect(
      draft.getByRole("textbox", { name: "Document editor" }),
    ).toHaveAttribute("aria-readonly", "true");
    await expect(
      page.locator('[data-ai-edit-status="generating"]'),
    ).toBeVisible();
    if (mode === "blocks") {
      await expect(
        draft.getByRole("heading", { name: "Ingredients" }),
      ).toBeVisible();
      await expect(
        draft.locator('[data-better-editor-body="bulletListItem"]'),
      ).toHaveCount(2);
      await expect(
        draft.locator('[data-better-editor-body="codeBlock"]'),
      ).toContainText("cook()");
      // Follow a long generated tail, yield to a real wheel gesture, then resume.
      let previousId = "8cce33a2-d8d9-4b09-a2bc-000000000003";
      for (let index = 0; index < 35; index++) {
        const lineId = `8cce33a2-d8d9-4b09-a2bc-${String(index + 100).padStart(12, "0")}`;
        operations.push({
          afterId: previousId,
          block: {
            content: `Generated paragraph ${index}`,
            id: lineId,
            type: "paragraph",
          },
          parentId: null,
          type: "insert",
        });
        previousId = lineId;
      }
      await send({
        data: { operations, status: "generating" },
        transient: true,
        type: "data-document-edit",
      });
      await expect(
        draft.locator(`[data-block-id="${previousId}"]`),
      ).toBeInViewport();
      await draft.evaluate((root) => {
        let viewport = root.parentElement;
        while (
          viewport &&
          !/auto|scroll/.test(getComputedStyle(viewport).overflowY)
        )
          viewport = viewport.parentElement;
        viewport?.setAttribute("data-test-writing-viewport", "");
      });
      const viewport = page.locator("[data-test-writing-viewport]");
      await viewport.hover({ position: { x: 120, y: 100 } });
      await page.mouse.wheel(0, -800);
      const follow = page.getByRole("button", {
        exact: true,
        name: "Follow writing",
      });
      await expect(follow).toBeVisible();
      await expect
        .poll(() => viewport.evaluate((node) => node.scrollTop))
        .toBeLessThan(500);
      const top = await viewport.evaluate((node) => node.scrollTop);
      const lastId = "8cce33a2-d8d9-4b09-a2bc-000000000999";
      operations.push({
        afterId: previousId,
        block: {
          content: "Final generated paragraph",
          id: lastId,
          type: "paragraph",
        },
        parentId: null,
        type: "insert",
      });
      await send({
        data: { operations, status: "generating" },
        transient: true,
        type: "data-document-edit",
      });
      await expect(draft.locator(`[data-block-id="${lastId}"]`)).toContainText(
        "Final generated paragraph",
      );
      expect(await viewport.evaluate((node) => node.scrollTop)).toBeCloseTo(
        top,
        0,
      );
      await follow.click();
      await expect(
        draft.locator(`[data-block-id="${lastId}"]`),
      ).toBeInViewport();
    } else await expect(draft).toContainText("Keep improved ending");
    // The hidden accepted document is immutable, including retained command calls.
    const accepted = page
      .locator(
        '.journl-document-editor .better-editor-tiptap[aria-hidden="true"]',
      )
      .first();
    await accepted.evaluate((root) => {
      const instance = (root as HTMLElement & { editor: Editor }).editor;
      instance.view.dispatch(
        instance.state.tr.insertText("MUST NOT APPEAR", 3),
      );
    });
    await expect(accepted).toContainText("Keep original ending");
    await expect(accepted).not.toContainText("MUST NOT APPEAR");
    await expect(page.locator("[data-save-status]")).toContainText("Saved");
    if (mode === "cancel") {
      await page
        .getByRole("button", { exact: true, name: "Stop AI writing" })
        .click();
      await expect(draft).toHaveCount(0);
      await expect(editor.locator("[data-better-editor-body]")).toHaveText(
        "Keep original ending",
      );
    } else {
      await send({
        data: { operations, status: "generated" },
        type: "data-document-edit",
      });
      // A terminal finish must apply even if the server keeps the stream open for usage accounting.
      await send({ finishReason: "stop", type: "finish" });
      await expect(draft).toHaveCount(0);
      if (mode === "blocks")
        await expect(
          editor.locator('[data-better-editor-body="bulletListItem"]'),
        ).toHaveCount(2);
      else
        await expect(editor.locator("[data-better-editor-body]")).toHaveText(
          "Keep improved ending",
        );
      await expect(
        page.getByRole("button", { exact: true, name: "Cancel generation" }),
      ).toHaveCount(0);
      await expect(page.getByText("Running", { exact: true })).toHaveCount(0);
      await expect(page.locator("[data-save-status]")).toContainText("Saved", {
        timeout: 60_000,
      });
      await editor.focus();
      await editor.press("ControlOrMeta+z");
      await expect(editor.locator("[data-better-editor-body]")).toHaveText(
        "Keep original ending",
      );
    }
    await expect(page.locator("[data-save-status]")).toContainText("Saved", {
      timeout: 60_000,
    });
    await page.reload();
    await expect(editor.locator("[data-better-editor-body]")).toHaveText(
      "Keep original ending",
    );
  });
