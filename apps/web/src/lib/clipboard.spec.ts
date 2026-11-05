// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { copyTextToClipboard } from "./clipboard";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, "execCommand");
  document.body.replaceChildren();
});

test("native copy writes the full block URL", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  await copyTextToClipboard("http://lan:50000/pages/example#block=abc");
  expect(writeText).toHaveBeenCalledWith(
    "http://lan:50000/pages/example#block=abc",
  );
});

test("HTTP fallback preserves selection and focus and removes its temporary field", async () => {
  vi.stubGlobal("navigator", { clipboard: undefined });
  const input = document.createElement("input");
  document.body.append(input);
  input.focus();
  const copy = vi.fn(() => {
    expect((document.activeElement as HTMLTextAreaElement).value).toBe(
      "block-url",
    );
    return true;
  });
  Object.defineProperty(document, "execCommand", {
    configurable: true,
    value: copy,
  });
  await copyTextToClipboard("block-url");
  expect(copy).toHaveBeenCalledWith("copy");
  expect(document.activeElement).toBe(input);
  expect(document.querySelector("textarea")).toBeNull();
});
