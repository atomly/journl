// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { required } from "../engine/required";
import { blockBodyAtPointer } from "./block-hit-test";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

test("gutter hit testing uses one browser hit test without scanning block geometry", () => {
  const root = document.createElement("div");
  root.className = "better-editor-tiptap";
  root.style.paddingInline = "54px";
  root.style.paddingRight = "54px";
  root.innerHTML = Array.from(
    { length: 1000 },
    (_, id) => `<p data-better-editor-body="paragraph">${id}</p>`,
  ).join("");
  document.body.append(root);
  vi.spyOn(root, "getBoundingClientRect").mockReturnValue({
    left: 100,
    right: 500,
  } as DOMRect);
  const hit = vi.fn(() => [root.children[999]]);
  Object.defineProperty(document, "elementsFromPoint", {
    configurable: true,
    value: hit,
  });
  const scan = vi.spyOn(root, "querySelectorAll");
  const rects = [...root.children].map((body) =>
    vi.spyOn(body, "getBoundingClientRect"),
  );
  expect(blockBodyAtPointer(root, root, 300)).toBe(root.children[999]);
  expect(hit).toHaveBeenCalledExactlyOnceWith(445, 300);
  expect(scan).not.toHaveBeenCalled();
  expect(rects.every((rect) => rect.mock.calls.length === 0)).toBe(true);
});

test("direct content hits avoid geometry work and nested editor ownership stays separate", () => {
  const root = document.createElement("div");
  root.className = "better-editor-tiptap";
  root.innerHTML =
    '<p data-better-editor-body="paragraph"><span>Text</span></p><div class="better-editor-tiptap"><p data-better-editor-body="paragraph">Nested</p></div>';
  document.body.append(root);
  const hit = vi.fn(() => [
    required(required(root.children[1]).firstElementChild),
  ]);
  Object.defineProperty(document, "elementsFromPoint", {
    configurable: true,
    value: hit,
  });
  const bounds = vi.spyOn(root, "getBoundingClientRect");
  expect(
    blockBodyAtPointer(root, required(root.querySelector("span")), 1),
  ).toBe(root.firstElementChild);
  expect(bounds).not.toHaveBeenCalled();
  expect(
    blockBodyAtPointer(root, required(root.children[1]), 1),
  ).toBeUndefined();
});
