import { mkdir, writeFile } from "node:fs/promises";
import type { Editor } from "@tiptap/core";
import { fixtureId } from "~/testing/browser/data";
import { expect, test } from "~/testing/browser/fixtures";
import { renderedTextContrast } from "~/testing/browser/rendered-contrast";
import {
  captureSettledShell,
  settleShell,
} from "~/testing/browser/shell-capture";
import { measureShellControls } from "~/testing/browser/shell-metrics";

test.use({ workspaceReview: true });

const phrase = "direct sun from about 8 to 11 a.m.";

for (const theme of ["light", "dark"]) {
  test(`v2 formatting-states ${theme}`, async ({ page }, info) => {
    test.skip(
      info.project.name !== "desktop-chromium",
      "The formatting plate is a desktop Chromium state",
    );
    await page.setViewportSize({ height: 1000, width: 1440 });
    await page.addInitScript(
      (value) => localStorage.setItem("theme", value),
      theme,
    );
    await page.goto(`/pages/${fixtureId(1610)}`);
    const editor = page
      .locator('.better-editor-tiptap[contenteditable="true"]')
      .first();
    await expect(editor).toBeVisible();
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
    expect(shells.nav.width).toBe(216);
    expect(shells.center.x).toBe(248);
    expect(shells.center.width).toBe(760);
    expect(shells.agent.x).toBe(1024);
    expect(shells.agent.width).toBe(400);
    // Select the plate's phrase so the floating formatting toolbar opens on
    // the real selection geometry.
    const selected = editor.locator('[data-better-editor-body="paragraph"]', {
      hasText: phrase,
    });
    await expect(selected).toHaveCount(1);
    await editor.evaluate((root, text) => {
      // Browser context: select the phrase with a DOM range so ProseMirror
      // applies the selection from its selectionchange listener.
      const target = [
        ...root.querySelectorAll<HTMLElement>(
          '[data-better-editor-body="paragraph"]',
        ),
      ].find((element) => element.textContent?.includes(text));
      if (!target) throw new Error(`Paragraph not found: ${text}`);
      const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
      for (
        let node = walker.nextNode() as Text | null;
        node;
        node = walker.nextNode() as Text | null
      ) {
        const index = node.data.indexOf(text);
        if (index < 0) continue;
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + text.length);
        root.focus();
        const selection = getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        document.dispatchEvent(new Event("selectionchange"));
        return;
      }
      throw new Error(`Phrase not found: ${text}`);
    }, phrase);
    const toolbar = page.getByRole("toolbar", {
      exact: true,
      name: "Editor controls",
    });
    await expect(toolbar).toBeVisible();
    await expect(toolbar).toHaveAttribute(
      "data-better-editor-toolbar-mode",
      "floating",
    );
    // The selected text remains visible and stays the formatting target.
    expect(
      await editor.evaluate((root) => {
        const instance = (root as HTMLElement & { editor: Editor }).editor;
        return {
          empty: instance.state.selection.empty,
          selected: getSelection()?.toString(),
        };
      }),
    ).toEqual({ empty: false, selected: phrase });
    for (const name of ["Bold", "Italic", "Underline", "Insert link"]) {
      await expect(
        toolbar.getByRole("button", { exact: true, name }),
      ).toBeEnabled();
    }
    // The floating toolbar sits above the selection with its 8px offset and
    // stays inside the reading panel.
    const toolbarBox = await toolbar.boundingBox();
    const selectionRect = await selected.evaluate((node) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      const box = range.getBoundingClientRect();
      return { height: box.height, width: box.width, x: box.x, y: box.y };
    });
    expect(toolbarBox).toBeTruthy();
    expect(selectionRect.width).toBeGreaterThan(0);
    const toolbarBottom = (toolbarBox?.y ?? 0) + (toolbarBox?.height ?? 0);
    expect(toolbarBottom).toBeLessThanOrEqual(selectionRect.y + 1);
    expect(toolbarBottom).toBeGreaterThanOrEqual(selectionRect.y - 14);
    expect(toolbarBox?.x ?? 0).toBeGreaterThanOrEqual(shells.center.x);
    expect((toolbarBox?.x ?? 0) + (toolbarBox?.width ?? 0)).toBeLessThanOrEqual(
      shells.center.x + shells.center.width,
    );
    const bold = toolbar.getByRole("button", { exact: true, name: "Bold" });
    const boldContrast = await renderedTextContrast(bold, "icons");
    expect(
      boldContrast.ratio,
      `${theme} formatting toolbar icon`,
    ).toBeGreaterThanOrEqual(3);
    measurements.push({
      label: "Formatting toolbar Bold icon",
      ...boldContrast,
    });
    const selectedContrast = await renderedTextContrast(selected);
    expect(
      selectedContrast.ratio,
      `${theme} selected editor text`,
    ).toBeGreaterThanOrEqual(4.5);
    measurements.push({ label: "Selected editor text", ...selectedContrast });
    // Alt+F10 keeps the keyboard path to the same toolbar. Seat the caret on
    // the plate's first line — the band where the plate draws the selection,
    // the formatting toolbar and the block handle side by side. The
    // paragraph centre lands on the line boundary, where the floating
    // toolbar anchors above line two and covers the handle rail.
    await selected.click({ position: { x: 60, y: 8 } });
    await page.keyboard.press("Alt+F10");
    await expect(toolbar).toBeVisible();
    await expect(
      toolbar.locator("button:not(:disabled)").first(),
    ).toBeFocused();
    // The block menu opens from the hovered block beside the selection while
    // the formatting toolbar stays available.
    await selected.hover();
    const handle = page.getByRole("button", {
      exact: true,
      name: "Block actions",
    });
    await expect(handle).toBeVisible();
    const handleBox = await handle.boundingBox();
    await handle.click();
    const menu = page.getByRole("menu", { exact: true, name: "Block actions" });
    await expect(menu).toBeVisible();
    // The trigger stays visible while its menu is open.
    expect(handleBox).toBeTruthy();
    await expect(handle).toBeInViewport();
    for (const name of [
      "Indent",
      "Outdent",
      "Duplicate block",
      "Move block up",
      "Move block down",
      "Copy block link",
      "Delete block",
      "Undo",
      "Redo",
    ]) {
      await expect(
        menu.getByRole("menuitem", { exact: true, name }),
      ).toBeVisible();
    }
    const menuBox = await menu.boundingBox();
    expect(menuBox).toBeTruthy();
    expect(menuBox?.x ?? 0).toBeGreaterThan(0);
    expect((menuBox?.x ?? 0) + (menuBox?.width ?? 0)).toBeLessThanOrEqual(1440);
    expect(menuBox?.y ?? 0).toBeGreaterThanOrEqual(handleBox?.y ?? 0);
    expect(menuBox?.y ?? 0).toBeLessThanOrEqual(
      (handleBox?.y ?? 0) + (handleBox?.height ?? 0) + 8,
    );
    const duplicate = menu.getByRole("menuitem", {
      exact: true,
      name: "Duplicate block",
    });
    await duplicate.hover();
    const hoverContrast = await renderedTextContrast(duplicate);
    expect(
      hoverContrast.ratio,
      `${theme} block menu hover text`,
    ).toBeGreaterThanOrEqual(4.5);
    measurements.push({ label: "Block menu hover text", ...hoverContrast });
    // The block menu owns the complete block while it is open.
    expect(
      await editor.evaluate((root) =>
        Boolean(
          (
            root as HTMLElement & { editor: Editor }
          ).editor.view.dom.querySelector(".ProseMirror-selectednode"),
        ),
      ),
    ).toBe(true);
    await expect(toolbar).toBeVisible();
    await settleShell(page);
    const directory = info.outputPath("formatting-states");
    await mkdir(directory, { recursive: true });
    const frame = await captureSettledShell(page, `${directory}/current.png`);
    const controls = await measureShellControls(page);
    // Escape closes the menu and restores editor focus with the toolbar.
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(editor).toBeFocused();
    await expect(toolbar).toBeVisible();
    await writeFile(
      `${directory}/mapping.json`,
      JSON.stringify(
        {
          controls,
          exclusions: [
            "The plate highlights only the selected phrase while the block menu is open; the native block handle selects the complete block, so the whole-block selection replaces the phrase highlight while the menu is open.",
            "The plate shows a representative four-control toolbar; the app renders the complete native formatting toolbar with its source-backed controls.",
            "Native-schema synthetic garden workspace; the editor content is the fixture document.",
          ],
          frame,
          measurements,
          reference: `docs/design-handoff/approved-workspace-v2/review/screens/formatting-states-${theme}.png`,
          route: `/pages/${fixtureId(1610)}`,
          selection: selectionRect,
          stateId: "formatting-states",
          theme,
          toolbarBox,
          viewport: { height: 1000, width: 1440 },
        },
        null,
        2,
      ),
    );
  });
}
