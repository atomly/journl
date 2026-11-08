import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import type { Editor, JSONContent } from "@tiptap/core";
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
  expect(Object.keys(calls[0] as object)).toEqual([]);
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
      `Create and open a new page titled "Mixed structures ${info.repeatEachIndex} ${Date.now()}". Write complex structured content there: a Complex Examples heading; a four-column table with a header and three data rows; a three-item ordered list with a nested bullet list under item two; a checklist with checked and unchecked tasks; a JavaScript code block; a quote; an image using https://example.com/image.png; a divider; and a second two-column table with Sidebar and Main Content headers. Use columnWidths: [] for the tables' automatic sizing. Put the content in the editor, not in chat.`,
    );
    const editor = page
      .locator(".better-editor-tiptap")
      .filter({ visible: true });
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
    const beforeExpansion = await editor.evaluate((element) =>
      (element as HTMLElement & { editor: Editor }).editor.getJSON(),
    );
    const retained = editorBlocks(beforeExpansion);
    const oldCode = retained.find(
      (block) => block.content?.[0]?.type === "codeBlock",
    );
    const checkboxes = await editor
      .locator('[data-better-editor-body="checkListItem"]')
      .count();
    const rows = await editor.locator("table tr").count();
    expect(
      retained
        .filter((block) => block.content?.[0]?.type === "table")
        .some((block) => block.content?.[0]?.attrs?.columnWidths?.length === 0),
    ).toBe(true);
    await ask(
      page,
      "Rewrite only the existing JavaScript code block to Rust. Keep the tables and all other blocks exactly unchanged.",
    );
    await expect(editor.locator('[aria-label="Code language"]')).toContainText(
      "rust",
      { timeout: 180_000 },
    );
    await expect(
      page.locator('[data-chat-role="assistant"]').last(),
    ).toContainText("Edit applied.", { timeout: 180_000 });
    await expect(editor).toHaveAttribute("contenteditable", "true");
    await expect(page.locator('[data-ai-edit-status="error"]')).toHaveCount(0);
    const rustOnly = editorBlocks(
      await editor.evaluate((element) =>
        (element as HTMLElement & { editor: Editor }).editor.getJSON(),
      ),
    );
    for (const block of retained.filter(
      (block) => block.attrs?.id !== oldCode?.attrs?.id,
    ))
      expect(
        rustOnly.find((current) => current.attrs?.id === block.attrs?.id),
      ).toEqual(block);
    expect(
      rustOnly.find((block) => block.attrs?.id === oldCode?.attrs?.id)
        ?.content?.[0],
    ).toMatchObject({
      attrs: { props: { language: "rust" } },
      type: "codeBlock",
    });
    await ask(
      page,
      "Add more complexity. Use checkboxes, more tables and rows, and expand the Rust code block. Preserve retained block IDs and unrelated content.",
    );
    await expect
      .poll(() => editor.locator("table").count(), { timeout: 180_000 })
      .toBeGreaterThan(2);
    await expect(editor).toHaveAttribute("contenteditable", "true", {
      timeout: 180_000,
    });
    await expect(page.locator('[data-ai-edit-status="error"]')).toHaveCount(0);
    await expect(page.locator("[data-save-status]")).toContainText("Saved", {
      timeout: 60_000,
    });
    await expect(
      page.locator('[data-chat-role="assistant"]').last(),
    ).toContainText("Edit applied.", { timeout: 60_000 });
    expect(
      await editor.locator('[data-better-editor-body="checkListItem"]').count(),
    ).toBeGreaterThan(checkboxes);
    expect(await editor.locator("table tr").count()).toBeGreaterThan(rows);
    const expanded = editorBlocks(
      await editor.evaluate((element) =>
        (element as HTMLElement & { editor: Editor }).editor.getJSON(),
      ),
    );
    for (const block of retained)
      expect(
        expanded.some((current) => current.attrs?.id === block.attrs?.id),
      ).toBe(true);
    expect(
      expanded.find((block) => block.attrs?.id === oldCode?.attrs?.id)
        ?.content?.[0],
    ).toMatchObject({
      attrs: { props: { language: "rust" } },
      type: "codeBlock",
    });
    const written = await editor.innerText();
    await page.reload();
    await expect(editor).toHaveText(written, { useInnerText: true });
    expect(await editor.locator("table").count()).toBeGreaterThan(2);
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

test("live writing continues from atom-only pages and native gap input", async ({
  page,
  context,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "Desktop native input acceptance",
  );
  test.setTimeout(360_000);
  await page.goto("/journal/1987-02-16");
  await openChat(page);
  await expect(
    page.getByPlaceholder("Ask anything...").filter({ visible: true }),
  ).toBeEnabled({ timeout: 60_000 });
  await ask(
    page,
    `Create and open a new page titled "Atom-only writing ${info.repeatEachIndex} ${Date.now()}". Completely replace its empty starter with exactly two divider blocks, with no paragraphs, headings, or other blocks. Apply now.`,
  );
  const editor = page
    .locator(".better-editor-tiptap")
    .filter({ visible: true });
  await expect(
    editor.locator('[data-better-editor-body="divider"]'),
  ).toHaveCount(2, { timeout: 180_000 });
  await expect(editor).toHaveAttribute("contenteditable", "true", {
    timeout: 180_000,
  });
  await expect(page.locator("[data-save-status]")).toContainText("Saved", {
    timeout: 60_000,
  });
  const json = () =>
    editor.evaluate((element) =>
      (element as HTMLElement & { editor: Editor }).editor.getJSON(),
    );
  const original = await json();
  expect(original.content).toHaveLength(2);
  await page.reload();
  await expect(editor).toBeVisible();
  await expect
    .poll(() =>
      editor.evaluate(
        (element) =>
          (
            element as HTMLElement & { editor: Editor }
          ).editor.state.selection.toJSON().type,
      ),
    )
    .toBe("gapcursor");
  expect(await json()).toEqual(original);
  await editor.focus();
  await page.keyboard.type("Typed at the gap");
  await expect(editor).toContainText("Typed at the gap");
  await editor.press("ControlOrMeta+z");
  expect(await json()).toEqual(original);
  await editor.press("Enter");
  await expect(
    editor.locator('[data-better-editor-body="paragraph"]'),
  ).toHaveCount(1);
  await editor.press("ControlOrMeta+z");
  expect(await json()).toEqual(original);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.evaluate(() =>
    navigator.clipboard.writeText("Pasted at the gap\n\n- First\n- Second"),
  );
  await editor.press("ControlOrMeta+v");
  await expect(editor).toContainText("Pasted at the gap");
  await expect(
    editor.locator('[data-better-editor-body="bulletListItem"]'),
  ).toHaveCount(2);
  await editor.press("ControlOrMeta+z");
  expect(await json()).toEqual(original);
  await expect(page.locator("[data-save-status]")).toContainText("Saved", {
    timeout: 60_000,
  });
  await ask(
    page,
    'Add a heading "Continued writing", a two-column Name/Status table with Alpha/Ready and Beta/Planned rows, and a Rust code block. Keep the original two dividers unchanged.',
  );
  await expect(editor.locator("table")).toHaveCount(1, { timeout: 180_000 });
  await expect(editor).toHaveAttribute("contenteditable", "true", {
    timeout: 180_000,
  });
  await expect(
    page.locator('[data-chat-role="assistant"]').last(),
  ).toContainText("Edit applied.", { timeout: 60_000 });
  await expect(page.locator('[data-ai-edit-status="error"]')).toHaveCount(0);
  await expect(page.locator("[data-save-status]")).toContainText("Saved", {
    timeout: 60_000,
  });
  const after = await json();
  for (const block of original.content ?? [])
    expect(
      after.content?.find((current) => current.attrs?.id === block.attrs?.id),
    ).toEqual(block);
  await page.reload();
  await expect(editor.locator("table")).toHaveCount(1);
  expect(await json()).toEqual(after);
});

test("live structural edits preserve identities, rich content, Undo and cancellation", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "Desktop structural stress test",
  );
  test.setTimeout(600_000);
  const responses: Promise<string>[] = [];
  page.on("response", (response) => {
    if (response.url().endsWith("/api/ai/document-writer"))
      responses.push(response.text().catch(() => "Writer reader closed"));
  });
  // Streaming temporarily hides the accepted editor behind the visible draft.
  const editor = page
    .locator(".better-editor-tiptap")
    .filter({ visible: true });
  const document = () =>
    editor.evaluate((element) =>
      (element as HTMLElement & { editor: Editor }).editor.getJSON(),
    );
  const idle = async () => {
    await expect(
      page.getByRole("button", { exact: true, name: "Send message" }),
    ).toBeVisible({ timeout: 180_000 });
    await expect(editor).toHaveAttribute("contenteditable", "true");
    await expect(page.locator('[data-ai-edit-status="error"]')).toHaveCount(0);
    await expect(page.locator("[data-save-status]")).toContainText("Saved", {
      timeout: 60_000,
    });
  };
  try {
    await page.goto("/journal/1987-02-10");
    await openChat(page);
    await expect(
      page.getByPlaceholder("Ask anything...").filter({ visible: true }),
    ).toBeEnabled({ timeout: 60_000 });
    await ask(
      page,
      `Create and open a new page titled "Structural stress ${info.repeatEachIndex}". Its body must have exactly one heading, "Runbook", and no repeated page title. Add a paragraph exactly "Sentinel stays unchanged."; a table with Task/Owner/Status/Estimate header and API/Ada/Ready/2h, UI/Lin/Blocked/3h, QA/Sam/Planned/4h rows; three numbered steps named Plan, Verify, Deploy; under Verify two bullets named Check and Observe, and under Check one nested bullet named Subcheck. Add one checked and one unchecked task; a TypeScript code block with a multiline async function using actual source line breaks; a quote exactly "Proceed carefully."; a divider; and a closing paragraph with bold "Release approved" and a real link to https://example.com/spec. Use native editor blocks and write it now.`,
    );
    await expect(editor.locator("table")).toHaveCount(1, { timeout: 180_000 });
    await idle();
    await expect(
      editor.locator('[data-better-editor-body="heading"]'),
    ).toHaveText(["Runbook"]);
    await expect(editor.locator("table tr")).toHaveCount(4);
    await expect(editor.locator("strong")).toContainText("Release approved");
    await expect(
      editor.locator('a[href="https://example.com/spec"]'),
    ).toHaveCount(1);
    await expect(
      editor.locator(
        '[data-better-editor-body="checkListItem"][data-checked="true"]',
      ),
    ).toHaveCount(1);
    await expect(
      editor.locator(
        '[data-better-editor-body="checkListItem"][data-checked="false"]',
      ),
    ).toHaveCount(1);
    const code = await editor.locator("pre").textContent();
    expect(code).toContain("\n");
    expect(code).not.toContain("\\n");
    const before = await document();
    const beforeBlocks = editorBlocks(before);
    const named = (text: string) => {
      const block = beforeBlocks.find(
        (block) => nodeText(block.content?.[0]) === text,
      );
      expect(block, `Missing block: ${text}`).toBeDefined();
      if (!block) throw new Error(`Missing block: ${text}`);
      return block;
    };
    const check = named("Check");
    const verify = named("Verify");
    const deploy = named("Deploy");
    const quote = named("Proceed carefully.");
    const table = beforeBlocks.find(
      (block) => block.content?.[0]?.type === "table",
    );
    expect(table).toBeDefined();

    await ask(
      page,
      'Update this page in place. In the table change UI status to Ready and estimate to 5h, remove the QA row, and append Docs/Ari/Planned/1h. Move Check with its complete Subcheck subtree to the root immediately after Deploy, rename Check to "Validation checks", and leave Observe under Verify. Move the quote immediately above the table. Preserve every retained block ID, all other blocks, the Sentinel paragraph, code, checklist, bold text and clickable link. Do not duplicate blocks. Apply now and briefly acknowledge the result.',
    );
    await expect(editor).toContainText("Validation checks", {
      timeout: 180_000,
    });
    await idle();
    await expect(
      editor
        .locator('[data-better-editor-body="bulletListItem"]')
        .filter({ hasText: /^Validation checks$/ }),
    ).toHaveCount(1);
    const after = await document();
    const afterBlocks = editorBlocks(after);
    expect(afterBlocks.map((block) => block.attrs?.id).sort()).toEqual(
      beforeBlocks.map((block) => block.attrs?.id).sort(),
    );
    const changedIds = [check.attrs?.id, verify.attrs?.id, table?.attrs?.id];
    for (const block of beforeBlocks.filter(
      (block) => !changedIds.includes(block.attrs?.id),
    )) {
      expect(
        afterBlocks.find((current) => current.attrs?.id === block.attrs?.id),
      ).toEqual(block);
    }
    const roots = after.content ?? [];
    const rootIds = roots.map((block) => block.attrs?.id);
    expect(rootIds.indexOf(check.attrs?.id)).toBe(
      rootIds.indexOf(deploy.attrs?.id) + 1,
    );
    expect(rootIds.indexOf(quote.attrs?.id)).toBe(
      rootIds.indexOf(table?.attrs?.id) - 1,
    );
    expect(
      editorBlocks(
        roots.find((block) => block.attrs?.id === check.attrs?.id) ?? {},
      ).map((block) => nodeText(block.content?.[0])),
    ).toEqual(["Validation checks", "Subcheck"]);
    await expect(editor.locator("table tr")).toHaveText([
      /Task.*Owner.*Status.*Estimate/s,
      /API.*Ada.*Ready.*2h/s,
      /UI.*Lin.*Ready.*5h/s,
      /Docs.*Ari.*Planned.*1h/s,
    ]);
    const summary = page.locator('[data-chat-role="assistant"]').last();
    await expect(summary).not.toContainText(
      /session restriction|cannot perform|can’t perform|copy.paste|next turn/i,
    );
    await expect(summary).not.toContainText(
      /\{\s*"memory"\s*:|updateWorkingMemory|WORKING_MEMORY_SYSTEM_INSTRUCTION/,
    );

    await editor
      .locator('[data-better-editor-body="paragraph"]')
      .first()
      .click();
    await page.keyboard.press("ControlOrMeta+z");
    await expect.poll(document).toEqual(before);
    await page.keyboard.press("ControlOrMeta+Shift+z");
    await expect.poll(document).toEqual(after);
    await expect(page.locator("[data-save-status]")).toContainText("Saved", {
      timeout: 60_000,
    });

    await ask(
      page,
      'Append 60 detailed numbered steps to the end of this page. Each must begin "Cancellation probe" and contain two sentences. Keep all existing blocks unchanged. Write directly into the editor.',
    );
    await expect(editor).toContainText("Cancellation probe", {
      timeout: 180_000,
    });
    await expect(editor).toHaveAttribute("contenteditable", "false");
    await page
      .getByRole("button", { exact: true, name: "Stop AI writing" })
      .click();
    await idle();
    expect(await document()).toEqual(after);
    await expect(
      page.locator('[data-chat-role="assistant"]').last(),
    ).toContainText(/cancel|stopp/i);
    await expect(
      page.locator('[data-chat-role="assistant"]').last(),
    ).not.toContainText(/restriction|permission|quota|paste/i);
    await page.reload();
    await expect.poll(document).toEqual(after);
  } finally {
    await info.attach("structural-writer-responses", {
      body: JSON.stringify(await Promise.all(responses)),
      contentType: "application/json",
    });
  }
});

function editorBlocks(node: JSONContent): JSONContent[] {
  return [
    ...(node.type === "betterEditorBlock" ? [node] : []),
    ...(node.content ?? []).flatMap(editorBlocks),
  ];
}

function nodeText(node: JSONContent | undefined): string {
  return node?.text ?? (node?.content ?? []).map(nodeText).join("");
}

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
