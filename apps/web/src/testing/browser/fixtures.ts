import { test as base, expect, type Locator } from "@playwright/test";
import type { Editor } from "@tiptap/core";
import { browserFixture } from "./data";

export const test = base.extend<{
  otherOwner: boolean;
  journalPagination: boolean;
}>({
  journalPagination: [false, { option: true }],
  otherOwner: [false, { option: true }],
  page: async ({ page, otherOwner, journalPagination }, use) => {
    const response = await page.request.post("/api/auth/sign-in/email", {
      data: {
        email: journalPagination
          ? browserFixture.paginationEmail
          : otherOwner
            ? browserFixture.otherEmail
            : browserFixture.email,
        password: browserFixture.password,
      },
      headers: { Origin: "http://127.0.0.1:3100" },
    });
    expect(response.ok(), await response.text()).toBe(true);
    await use(page);
  },
});
export { expect };

/** Use real key events and wait for each split before typing into its new paragraph. */
export async function typeParagraphs(editor: Locator, paragraphs: string[]) {
  await editor.fill("");
  for (const [index, text] of paragraphs.entries()) {
    if (index) await editor.press("Enter");
    await expect(editor.locator('[data-better-editor-body="paragraph"]')).toHaveCount(
      index + 1,
    );
    await editor.pressSequentially(text, { delay: 20 });
  }
}

/** Linux-hosted iPhone emulation maps Ctrl+A to line-start in Tiptap's iOS keymap. */
export async function selectEditorText(editor: Locator) {
  const emulatedIOS = await editor.evaluate(() =>
    /iPhone|iPad|iPod/.test(navigator.userAgent),
  );
  if (!emulatedIOS) await editor.page().keyboard.press("ControlOrMeta+a");
  else
    await editor.evaluate(async (root) => {
      (root as HTMLElement).focus();
      const range = document.createRange();
      range.selectNodeContents(root);
      const selection = getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
    });
  await expect
    .poll(() =>
      editor.evaluate((root) => {
        const instance = (root as HTMLElement & { editor: Editor }).editor;
        return {
          dom: getSelection()?.toString(),
          empty: instance.state.selection.empty,
        };
      }),
    )
    .toMatchObject({ empty: false });
}
