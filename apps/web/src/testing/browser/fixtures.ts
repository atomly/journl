import {
  test as base,
  expect,
  type Locator,
  type Page,
} from "@playwright/test";
import type { Editor } from "@tiptap/core";
import { browserFixture, fixtureId } from "./data";

let warmedWorkflowRoute: Promise<void> | undefined;
/**
 * The local workflow queue delivers by fetching the app's own workflow
 * route, which a cold dev server compiles on demand. On slow runners the
 * first delivery outlives its attempt and stalls the first
 * workflow-starting mutation (the runner sees an in-flight create that
 * never settles). Compile the route once per worker before the first
 * test; any response counts, and a warm failure must not fail tests.
 */
function warmWorkflowDeliveryRoute(page: Page) {
  warmedWorkflowRoute ??= page.request
    .get("/.well-known/workflow/v1/flow")
    .then(
      () => undefined,
      () => undefined,
    );
  return warmedWorkflowRoute;
}

let warmedSoftRoutes: Promise<void> | undefined;
/**
 * Soft navigations race the dev server's on-demand route compilation: on
 * a cold, slow runner the first router.push to an uncompiled route can
 * outlive an assertion's timeout. Compile the routes tests navigate to
 * once per worker, after the session is established; any response counts
 * and a warm failure must not fail tests.
 */
function warmSoftNavigationRoutes(page: Page) {
  warmedSoftRoutes ??= Promise.all([
    page.request.get(`/pages/${fixtureId(25)}`),
    page.request.get("/account/settings"),
    page.request.get("/journal"),
    page.request.get("/explore"),
  ]).then(
    () => undefined,
    () => undefined,
  );
  return warmedSoftRoutes;
}

export const test = base.extend<{
  workspaceReview: boolean;
  otherOwner: boolean;
  journalPagination: boolean;
}>({
  journalPagination: [false, { option: true }],
  otherOwner: [false, { option: true }],
  page: async (
    { page, otherOwner, journalPagination, workspaceReview },
    use,
    testInfo,
  ) => {
    await warmWorkflowDeliveryRoute(page);
    // The origin must match the running server's trusted origins. Derive it
    // from the configured base URL so worktree runners on other ports work.
    const origin = new URL(
      testInfo.project.use.baseURL ?? "http://127.0.0.1:3100",
    ).origin;
    const response = await page.request.post("/api/auth/sign-in/email", {
      data: {
        email: workspaceReview
          ? browserFixture.workspaceEmail
          : journalPagination
            ? browserFixture.paginationEmail
            : otherOwner
              ? browserFixture.otherEmail
              : browserFixture.email,
        password: browserFixture.password,
      },
      headers: { Origin: origin },
    });
    expect(response.ok(), await response.text()).toBe(true);
    await warmSoftNavigationRoutes(page);
    await use(page);
  },
  workspaceReview: [false, { option: true }],
});
export { expect };

/** Use real key events and wait for each split before typing into its new paragraph. */
export async function selectJournalView(
  page: Page,
  name: "Entries" | "Timeline",
) {
  const menu = page.getByRole("button", {
    exact: true,
    name: "Journal route menu",
  });
  const mode = page.getByRole("button", { exact: true, name });
  await expect(menu.or(mode)).toBeVisible();
  const compact = await menu.isVisible();
  if (compact) await menu.click();
  if ((await mode.getAttribute("aria-pressed")) !== "true") await mode.click();
  else if (compact) await page.keyboard.press("Escape");
}

export async function typeParagraphs(editor: Locator, paragraphs: string[]) {
  await editor.fill("");
  for (const [index, text] of paragraphs.entries()) {
    if (index) await editor.press("Enter");
    await expect(
      editor.locator('[data-better-editor-body="paragraph"]'),
    ).toHaveCount(index + 1);
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

/** Observe uncaught page JS across navigation. WebKit also emits native loader
 * diagnostics as pageerror (playwright#43120); those are not DOM exceptions.
 * Worker-only errors remain outside this page-specific assertion. */
export async function observePageErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  await page.exposeFunction("__journlReportPageError", (message: string) => {
    errors.push(message);
  });
  await page.addInitScript(() => {
    const report = (reason: unknown) => {
      let message: string;
      if (reason instanceof Error) message = reason.message;
      else if (typeof reason === "string") message = reason;
      else {
        try {
          message = JSON.stringify(reason) ?? String(reason);
        } catch {
          message = String(reason);
        }
      }
      const bridge = (
        window as unknown as {
          __journlReportPageError: (message: string) => Promise<void>;
        }
      ).__journlReportPageError;
      // Only the test bridge can disappear while its document is being torn down.
      void bridge(message).catch(() => {});
    };
    addEventListener("error", (event) => {
      if (event instanceof ErrorEvent) report(event.error ?? event.message);
    });
    addEventListener("unhandledrejection", (event) => report(event.reason));
  });
  return errors;
}
