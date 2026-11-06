// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ChatComposer } from "./composer";
import { safeChatLink } from "./links";
import { ChatMessageParts, messageSegments } from "./message-parts";

const fixture = vi.hoisted(() => ({
  busy: false,
  quota: false,
  send: vi.fn(),
  stop: vi.fn(),
}));
vi.mock("./chat-presentation", () => ({
  useChatActions: () => {
    const [draft, setDraft] = useState("Draft writing");
    return {
      draft,
      exceeded: fixture.quota
        ? { usage: { periodEnd: "2099-01-01", subscriptionType: "free" } }
        : null,
      sendMessage: fixture.send,
      setDraft,
      status: fixture.busy ? "streaming" : "ready",
      stop: fixture.stop,
    };
  },
  useComposerDraft: () => {
    const [draft, setDraft] = useState("Draft writing");
    return { draft, setDraft };
  },
}));
vi.mock("./composer-context", () => ({
  ComposerReasoning: ({ children }: { children: React.ReactNode }) => children,
  ComposerReasoningContent: () => null,
  ComposerReasoningTrigger: () => <button type="button">Reasoning mode</button>,
}));
vi.mock("./composer-selection", () => ({ ComposerSources: () => null }));
vi.mock("@acme/ui/drawer", () => ({
  useDrawer: () => ({ closeDrawer: vi.fn() }),
}));
vi.mock("@acme/ui/use-highlighted-code", () => ({
  useHighlightedCode: (value: string) => value.split("\n"),
}));
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  fixture.send.mockReset().mockResolvedValue(undefined);
  fixture.stop.mockReset().mockResolvedValue(undefined);
  fixture.busy = false;
  fixture.quota = false;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

test("IME confirmation and Shift+Enter do not submit; Enter sends the current draft once", async () => {
  await act(async () => root.render(<ChatComposer />));
  const input = host.querySelector("textarea");
  if (!input) throw new Error("Missing composer");
  await act(async () => {
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        isComposing: true,
        key: "Enter",
      }),
    );
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        key: "Enter",
        shiftKey: true,
      }),
    );
  });
  expect(fixture.send).not.toHaveBeenCalled();
  await act(async () =>
    input.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }),
    ),
  );
  expect(fixture.send).toHaveBeenCalledExactlyOnceWith({
    text: "Draft writing",
  });
  expect(input.value).toBe("");
});
test("busy chat offers native cancellation and does not submit more messages", async () => {
  fixture.busy = true;
  await act(async () => root.render(<ChatComposer />));
  const stop = host.querySelector<HTMLButtonElement>('[aria-label="Cancel"]');
  await act(async () => stop?.click());
  expect(fixture.stop).toHaveBeenCalledTimes(1);
  expect(host.querySelector('[aria-label="Send message"]')).toBeNull();
});
test("quota notices disable input and sending", async () => {
  fixture.quota = true;
  await act(async () => root.render(<ChatComposer />));
  expect(host.querySelector("textarea")?.disabled).toBe(true);
  expect(
    host.querySelector<HTMLButtonElement>('[aria-label="Send message"]')
      ?.disabled,
  ).toBe(true);
  expect(host.textContent).toContain("AI usage limit reached");
});
test("reasoning, tools and sources retain order within consecutive activity runs", () => {
  const segments = messageSegments([
    { state: "done", text: "Thought", type: "reasoning" },
    {
      input: {},
      output: { message: "Edit applied" },
      state: "output-available",
      toolCallId: "call",
      type: "tool-write",
    },
    { state: "done", text: "Answer", type: "text" },
    {
      sourceId: "one",
      title: "Source",
      type: "source-url",
      url: "https://example.invalid",
    },
  ]);
  expect(segments.map((part) => part.kind)).toEqual([
    "activity",
    "text",
    "activity",
  ]);
  expect(segments[0]?.kind === "activity" && segments[0].parts).toHaveLength(2);
});
test("tool failures remain visible and unsafe citation URLs do not render", async () => {
  await act(async () =>
    root.render(
      <ChatMessageParts
        parts={[
          {
            errorText: "Provider failed",
            input: {},
            state: "output-error",
            toolCallId: "failed",
            type: "tool-write",
          },
          {
            sourceId: "unsafe",
            title: "Unsafe",
            type: "source-url",
            url: "javascript:alert(1)",
          },
        ]}
      />,
    ),
  );
  expect(host.textContent).toContain("Failed");
  expect(host.querySelector("a")).toBeNull();
});
test.each([
  "javascript:alert(1)",
  "data:text/html,secret",
  "//untrusted.invalid",
  "\\\\untrusted.invalid",
  "file:///etc/passwd",
])("unsafe chat link is rejected: %s", (value) =>
  expect(safeChatLink(value)).toBeUndefined(),
);
test("safe links retain readable navigation targets", () => {
  expect(safeChatLink("/pages/one")).toBe("/pages/one");
  expect(safeChatLink("https://example.invalid/path")).toBe(
    "https://example.invalid/path",
  );
});

test("streaming text after a fenced block retains its code and copy button DOM", async () => {
  const { ChatMarkdown } = await import("./markdown");
  const text = "```typescript\nconst value = 1;\n```";
  await act(async () => root.render(<ChatMarkdown text={text} />));
  const code = host.querySelector('[data-slot="code-block"]');
  const copy = host.querySelector('[data-slot="code-block-copy-button"]');
  expect(code).not.toBeNull();
  await act(async () =>
    root.render(<ChatMarkdown text={`${text}\n\nMore streamed text`} />),
  );
  expect(host.querySelector('[data-slot="code-block"]')).toBe(code);
  expect(host.querySelector('[data-slot="code-block-copy-button"]')).toBe(copy);
});

test.each(["missing", "rejected"])(
  "copy buttons report %s clipboard support without an uncaught error",
  async (mode) => {
    const { CodeBlockCopyButton } = await import("@acme/ui/code-block");
    const { ChatMessage } = await import("./message");
    const clipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    const execCommand = Object.getOwnPropertyDescriptor(
      document,
      "execCommand",
    );
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value:
        mode === "missing"
          ? undefined
          : { writeText: vi.fn().mockRejectedValue(new Error("Denied")) },
    });
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn(() => false),
    });
    try {
      await act(async () =>
        root.render(
          <>
            <CodeBlockCopyButton value="Code" />
            <ChatMessage
              message={{
                id: "copy",
                parts: [{ state: "done", text: "Response", type: "text" }],
                role: "assistant",
              }}
            />
          </>,
        ),
      );
      await act(async () => {
        host
          .querySelector<HTMLButtonElement>(
            '[data-slot="code-block-copy-button"]',
          )
          ?.click();
        host
          .querySelector<HTMLButtonElement>('[aria-label="Copy response"]')
          ?.click();
      });
      expect(host.textContent).toContain("Could not copy. Select the code");
      expect(host.textContent).toContain("Could not copy. Please retry.");
    } finally {
      if (clipboard) Object.defineProperty(navigator, "clipboard", clipboard);
      else Reflect.deleteProperty(navigator, "clipboard");
      if (execCommand)
        Object.defineProperty(document, "execCommand", execCommand);
      else Reflect.deleteProperty(document, "execCommand");
    }
  },
);
