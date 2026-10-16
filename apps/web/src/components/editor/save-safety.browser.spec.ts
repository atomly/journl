import { readFile } from "node:fs/promises";
import { browserFixture, fixtureId } from "~/testing/browser/data";
import { expect, test } from "~/testing/browser/fixtures";

test("a failed page save retains title and writing across navigation and retries", async ({
  page,
}, info) => {
  const path = `/pages/${fixtureId(25)}`;
  await page.goto(path);
  await page.route("**/api/trpc/pages.saveTransactions**", (route) =>
    route.abort(),
  );
  const editor = page.locator('.bn-editor[contenteditable="true"]').first();
  await editor.fill(
    `Page draft kept after a network failure ${info.project.name}`,
  );
  const title = page.getByPlaceholder("New page");
  const draftTitle = `Title kept after a network failure ${info.project.name}`;
  await title.fill(draftTitle);
  await expect(page.locator("[data-save-status]")).toContainText(
    "Couldn’t save",
  );
  await expect(editor).toContainText("Page draft kept");
  await title.blur();
  await page.locator('a[href="/journal"]').first().click({ force: true });
  await expect(page).toHaveURL(/\/journal$/);
  await expect(page.locator("[data-save-status]")).toContainText(
    "Couldn’t save",
  );
  await expect(
    page.getByRole("button", { name: "Review drafts" }),
  ).toBeVisible();
  await page.goBack();
  await expect(editor).toContainText("Page draft kept");
  await expect(title).toHaveValue(draftTitle);
  await expect(page.locator("[data-save-status]")).toContainText(
    "Couldn’t save",
  );
  await page.unroute("**/api/trpc/pages.saveTransactions**");
  await page
    .getByRole("button", { exact: true, name: "Review drafts" })
    .click();
  await page.getByRole("button", { exact: true, name: "Retry save" }).click();
  await expect(page.locator("[data-save-status]")).toContainText("Saved");
  await page.reload();
  await expect(editor).toContainText("Page draft kept");
  await expect(title).toHaveValue(draftTitle);
});

test("a stale page tab keeps a complete draft while loading the winner", async ({
  page,
  context,
}, info) => {
  const path = `/pages/${fixtureId(26)}`;
  await page.goto(path);
  const other = await context.newPage();
  try {
    await other.goto(path);
    const winner = other.locator('.bn-editor[contenteditable="true"]').first();
    const stale = page.locator('.bn-editor[contenteditable="true"]').first();
    await expect(stale).toBeVisible();
    await expect(winner).toBeVisible();
    await other.getByPlaceholder("New page").fill("Winning page title");
    const response = other.waitForResponse(
      (res) => res.url().includes("pages.saveTransactions") && res.ok(),
    );
    await winner.fill(`Newer writing from another tab ${info.project.name}`);
    await response;
    await expect(other.locator("[data-save-status]")).toContainText("Saved");
    await stale.fill("Keep my conflicting local writing");
    await page.getByPlaceholder("New page").fill("Conflicting local title");
    await expect(page.locator("[data-save-status]")).toContainText(
      "Couldn’t save",
    );
    await page
      .getByRole("button", { exact: true, name: "Review drafts" })
      .click();
    await expect(page.getByRole("dialog")).toContainText(
      "newer version was saved elsewhere",
    );
    await expect(stale).toContainText("Keep my conflicting");
    await page
      .getByRole("button", { exact: true, name: "Keep both and load saved" })
      .click();
    await expect(stale).toContainText("Newer writing from another tab");
    await expect(page.getByPlaceholder("New page")).toHaveValue(
      "Winning page title",
    );
    await expect(page.locator("[data-save-status]")).toContainText(
      "1 kept draft in this tab",
    );
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { exact: true, name: "Download kept draft" })
      .click();
    const backup = await download;
    expect(backup.suggestedFilename()).toMatch(/draft.*\.json$/);
    const backupPath = await backup.path();
    expect(backupPath).not.toBeNull();
    const payload = JSON.parse(await readFile(backupPath as string, "utf8"));
    expect(payload).toMatchObject({ format: "journl-draft", version: 1 });
    expect(JSON.stringify(payload.blocks)).toContain(
      "Keep my conflicting local writing",
    );
    expect(payload.title).toBe("Conflicting local title");
  } finally {
    await other.close();
  }
});

test("a journal draft survives virtualized row unmounts while its save fails", async ({
  page,
}, info) => {
  await page.goto("/journal");
  await expect(
    page.getByRole("button", { name: /^(Entries|Timeline)$/ }),
  ).toBeVisible();
  const entriesToggle = page.getByRole("button", {
    exact: true,
    name: "Entries",
  });
  if (await entriesToggle.isVisible()) await entriesToggle.click();
  await page.route("**/api/trpc/journal.saveTransactions**", (route) =>
    route.abort(),
  );
  const today = page.locator('[data-item-index="0"]');
  const editor = today.locator('.bn-editor[contenteditable="true"]').first();
  const draftText = `Journal draft survives virtualized unmount ${info.project.name}`;
  await editor.fill(draftText);
  const scroller = page
    .locator("div.overflow-auto")
    .filter({ has: page.locator("[data-viewport-type]") });
  await expect(page.locator("[data-save-status]")).toContainText(
    "Couldn’t save",
  );
  await scroller.evaluate((element) => {
    element.scrollTop = 3500;
  });
  await expect(
    page.getByText(draftText, {
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(page.locator("[data-save-status]")).toContainText(
    "Couldn’t save",
  );
  await expect(
    page.getByRole("button", { name: "Review drafts" }),
  ).toBeVisible();
  await scroller.evaluate((element) => {
    element.scrollTop = 0;
  });
  await expect(editor).toContainText(
    "Journal draft survives virtualized unmount",
  );
  await expect(page.locator("[data-save-status]")).toContainText(
    "Couldn’t save",
  );
  await page.unroute("**/api/trpc/journal.saveTransactions**");
  await page
    .getByRole("button", { exact: true, name: "Review drafts" })
    .click();
  await page.getByRole("button", { exact: true, name: "Retry save" }).click();
  await expect(page.locator("[data-save-status]")).toContainText("Saved");
});

test("retry reconciles a committed page save after its response is lost", async ({
  page,
}, info) => {
  await page.goto(`/pages/${fixtureId(27)}`);
  let writes = 0;
  await page.route("**/api/trpc/pages.saveTransactions**", async (route) => {
    writes++;
    await route.fetch();
    await route.abort();
  });
  const editor = page.locator('.bn-editor[contenteditable="true"]').first();
  await editor.fill(
    `Committed writing with a lost response ${info.project.name}`,
  );
  await expect(page.locator("[data-save-status]")).toContainText(
    "Couldn’t save",
  );
  await page
    .getByRole("button", { exact: true, name: "Review drafts" })
    .click();
  await page.getByRole("button", { exact: true, name: "Retry save" }).click();
  await expect(page.locator("[data-save-status]")).toContainText("Saved");
  expect(writes).toBe(1);
  await page.reload();
  await expect(editor).toContainText("Committed writing with a lost response");
});

test("competing first journal saves keep the losing tab’s draft", async ({
  page,
  context,
}, info) => {
  // A reserved future date keeps this independent of the timeline fixture.
  const path = `/journal/2099-10-${info.project.name === "desktop-chromium" ? "16" : "17"}`;
  await page.goto(path);
  const other = await context.newPage();
  try {
    await other.goto(path);
    const stale = page.locator('.bn-editor[contenteditable="true"]').first();
    const winner = other.locator('.bn-editor[contenteditable="true"]').first();
    await expect(stale).toBeVisible();
    await expect(winner).toBeVisible();
    const saved = other.waitForResponse(
      (response) =>
        response.url().includes("journal.saveTransactions") && response.ok(),
    );
    await winner.fill("Winning first journal save");
    await saved;
    await stale.fill("Losing journal draft remains available");
    await expect(page.locator("[data-save-status]")).toContainText(
      "Couldn’t save",
    );
    await page
      .getByRole("button", { exact: true, name: "Review drafts" })
      .click();
    await expect(page.getByRole("dialog")).toContainText(
      "newer version was saved elsewhere",
    );
    await expect(stale).toContainText("Losing journal draft remains available");
    await expect(
      page.getByRole("button", {
        exact: true,
        name: "Keep both and load saved",
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { exact: true, name: "Keep both and load saved" })
      .click();
    await expect(stale).toContainText("Winning first journal save");
    await expect(page.locator("[data-save-status]")).toContainText(
      "1 kept draft in this tab",
    );
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { exact: true, name: "Download kept draft" })
      .click();
    const backup = await download;
    expect(backup.suggestedFilename()).toMatch(/draft.*\.json$/);
    const backupPath = await backup.path();
    expect(backupPath).not.toBeNull();
    const payload = JSON.parse(await readFile(backupPath as string, "utf8"));
    expect(payload).toMatchObject({ format: "journl-draft", version: 1 });
    expect(JSON.stringify(payload.blocks)).toContain(
      "Losing journal draft remains available",
    );
  } finally {
    await other.close();
  }
});

test("journal autosave uses the header and failures remain visible through a long document", async ({
  page,
  context,
}, info) => {
  await page.goto(`/journal/${browserFixture.longJournalDate}`);
  const editor = page.locator('.bn-editor[contenteditable="true"]').first();
  await expect(editor).toBeVisible();
  const status = page.locator("[data-save-status]");
  await expect(page.locator("header [data-save-status]")).toBeVisible();
  const scroller = page.locator("div.overflow-auto").filter({ has: editor });
  let release!: () => void;
  let started!: () => void;
  const startedSaving = new Promise<void>((resolve) => {
    started = resolve;
  });
  const proceed = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/trpc/journal.saveTransactions**", async (route) => {
    started();
    await proceed;
    await route.continue();
  });
  await expect(editor).toContainText("Paragraph 60:");
  const firstParagraph = editor.getByText(/^Paragraph 1:/);
  await firstParagraph.click();
  await page.keyboard.press("End");
  await page.keyboard.insertText(` Saved edit ${info.project.name}.`);
  await expect(editor).toContainText("Paragraph 60:");
  await expect
    .poll(() => editor.locator(".bn-block-outer").count())
    .toBeGreaterThanOrEqual(60);
  expect(
    await scroller.evaluate(
      (element) => element.scrollHeight - element.clientHeight,
    ),
  ).toBeGreaterThan(1000);
  await editor.blur();
  await scroller.evaluate((element) => {
    element.scrollTop = 0;
  });
  await expect(editor.getByText(/^Paragraph 1:/)).toBeInViewport();
  await expect(page.locator("header [data-save-status]")).toBeInViewport();
  await startedSaving;
  await expect(status).toContainText("Saving…");
  await expect(page.locator("[data-save-notice]")).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("journal-saving.png") });
  release();
  await expect(status).toContainText("Saved");
  await page.unroute("**/api/trpc/journal.saveTransactions**");
  await page.screenshot({ path: info.outputPath("journal-saved.png") });
  await context.setOffline(true);
  await editor.press("ControlOrMeta+End");
  await editor.pressSequentially(" Still writing during a connection failure.");
  const notice = page.locator("[data-save-notice]");
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("Offline");
  await editor.blur();

  await scroller.evaluate((element) => {
    element.scrollTop = 0;
  });
  await expect(editor.getByText(/^Paragraph 1:/)).toBeInViewport();
  await expect(notice).toBeInViewport();
  await page.screenshot({ path: info.outputPath("journal-failed-at-top.png") });
  await scroller.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  expect(
    await scroller.evaluate((element) => element.scrollTop),
  ).toBeGreaterThan(1000);
  await expect(editor.getByText(/^Paragraph 60:/)).toBeInViewport();
  await expect(notice).toBeInViewport();
  await page.screenshot({
    path: info.outputPath("journal-failed-at-bottom.png"),
  });
  // Restoring the browser connection triggers the real online event.
  await context.setOffline(false);
  await expect(notice).toHaveCount(0);
  await expect(status).toContainText("Saved");
  await page.reload();
  await expect(editor).toContainText("Paragraph 60:");
  await expect(editor).toContainText(
    "Still writing during a connection failure.",
  );
});

test("page navigation drains body and title edits queued during a real save", async ({
  page,
}, info) => {
  const path = `/pages/${fixtureId(28)}`;
  await page.goto(path);
  const editor = page.locator('.bn-editor[contenteditable="true"]').first();
  let release!: () => void;
  let started!: () => void;
  const saving = new Promise<void>((resolve) => {
    started = resolve;
  });
  const proceed = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requests = 0;
  await page.route("**/api/trpc/pages.saveTransactions**", async (route) => {
    requests++;
    if (requests === 1) {
      started();
      await proceed;
    }
    await route.continue();
  });
  await editor.fill(`First batch ${info.project.name}`);
  await saving;
  const body = `Writing added while the first save is pending ${info.project.name}`;
  const title = `Title queued during a save ${info.project.name}`;
  await editor.fill(body);
  await page.getByPlaceholder("New page").fill(title);
  await page.locator('a[href="/journal"]').first().click({ force: true });
  await expect(page).toHaveURL(/\/journal$/);
  release();
  await expect(page.locator("[data-save-status]")).toContainText("Saved");
  expect(requests).toBeGreaterThanOrEqual(2);
  await page.goto(path);
  await expect(editor).toContainText(body);
  await expect(page.getByPlaceholder("New page")).toHaveValue(title);
  await page.reload();
  await expect(editor).toContainText(body);
  await expect(page.getByPlaceholder("New page")).toHaveValue(title);
});

test("offline page drafts remain downloadable and protect navigation until reconnected", async ({
  page,
  context,
}, info) => {
  await page.goto(`/pages/${fixtureId(27)}`);
  const editor = page.locator('.bn-editor[contenteditable="true"]').first();
  await expect(editor).toBeVisible();
  await context.setOffline(true);
  const writing = `Writing while completely offline ${info.project.name}`;
  await editor.fill(writing);
  await expect(page.locator("[data-save-notice]")).toContainText("Offline");
  const unloadPrevented = () =>
    page.evaluate(() => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    });
  expect(await unloadPrevented()).toBe(true);
  await page
    .getByRole("button", { exact: true, name: "Review drafts" })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { exact: true, name: "Retry save" }),
  ).toHaveCount(0);
  const downloaded = page.waitForEvent("download");
  await dialog
    .getByRole("button", { exact: true, name: "Download full draft" })
    .click();
  const download = await downloaded;
  const path = await download.path();
  expect(path).not.toBeNull();
  const backup = JSON.parse(await readFile(path as string, "utf8"));
  expect(JSON.stringify(backup.blocks)).toContain(writing);
  await context.setOffline(false);
  await expect(page.locator("[data-save-status]")).toContainText("Saved");
  expect(await unloadPrevented()).toBe(false);
  await page.reload();
  await expect(editor).toContainText(writing);
});
