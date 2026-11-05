import { afterEach, expect, test, vi } from "vitest";
import { createEditorId } from "./id";

afterEach(() => vi.unstubAllGlobals());

test("UUID identities work without secure-context randomUUID", () => {
  const getRandomValues = globalThis.crypto.getRandomValues.bind(
    globalThis.crypto,
  );
  vi.stubGlobal("crypto", { getRandomValues });
  const ids = Array.from({ length: 100 }, createEditorId);
  expect(new Set(ids).size).toBe(100);
  for (const id of ids)
    expect(id).toMatch(
      /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/,
    );
});
