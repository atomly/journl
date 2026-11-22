import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Page, Route } from "@playwright/test";
import { initTRPC, TRPCError } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { UIMessage } from "ai";
import superjson from "superjson";
import { z } from "zod/v4";
import type { RouterOutputs } from "~/trpc";
import { fixtureId } from "./data";

/** Controlled browser-test responses. Never imported by application code. */
export const shellSearchResults: RouterOutputs["notes"]["getSimilarNotes"] = [
  {
    content: "Synthetic writing about making room for a quieter day.",
    created_at: "2026-01-01T12:00:00Z",
    header: "Controlled result: Browser note 25",
    id: fixtureId(25),
    similarity: 0.95,
    type: "page",
    updated_at: "2026-01-02T12:00:00Z",
  },
  {
    content: "Synthetic journal result about noticing ordinary details.",
    created_at: "2026-01-01T12:00:00Z",
    date: "2000-01-01",
    id: fixtureId(700),
    similarity: 0.9,
    type: "journal",
    updated_at: "2026-01-02T12:00:00Z",
  },
];
export const shellMessages: UIMessage[] = Array.from(
  { length: 16 },
  (_, index) => ({
    id: `shell-synthetic-message-${index}`,
    parts: [
      {
        text:
          index === 15
            ? "Synthetic conversation end. Keep one small observation for tomorrow."
            : `Synthetic ${index % 2 ? "answer" : "question"} ${index + 1}.\n\n${"This controlled conversation checks native scrolling and reachable message actions. ".repeat(4)}`,
        type: "text",
      },
    ],
    role: index % 2 ? "assistant" : "user",
  }),
);

const t = initTRPC.create({ transformer: superjson });
async function respond(
  route: Route,
  router: Parameters<typeof fetchRequestHandler>[0]["router"],
) {
  const request = route.request();
  const response = await fetchRequestHandler({
    createContext: () => ({}),
    endpoint: "/api/trpc",
    req: new Request(request.url(), {
      body: request.postData() ?? undefined,
      headers: request.headers(),
      method: request.method(),
    }),
    router,
  });
  await route.fulfill({
    body: await response.text(),
    headers: Object.fromEntries(response.headers),
    status: response.status,
  });
}

export async function controlShellSearch(page: Page) {
  let state: "results" | "empty" | "error" | "loading" = "results";
  let release: (() => void) | undefined;
  let gate: Promise<void> | undefined;
  await page.route("**/api/trpc/notes.getSimilarNotes**", async (route) => {
    const mode = state;
    if (mode === "loading") await gate;
    await respond(
      route,
      t.router({
        notes: t.router({
          getSimilarNotes: t.procedure
            .input(
              z.object({
                limit: z.number(),
                query: z.string(),
                threshold: z.number(),
              }),
            )
            .query(() => {
              if (mode === "error")
                throw new TRPCError({
                  code: "INTERNAL_SERVER_ERROR",
                  message: "Controlled search provider unavailable",
                });
              return mode === "empty" ? [] : shellSearchResults;
            }),
        }),
      }),
    );
  });
  return {
    release() {
      release?.();
    },
    set(next: typeof state) {
      release?.();
      state = next;
      if (next === "loading")
        gate = new Promise<void>((resolve) => {
          release = resolve;
        });
    },
  };
}

export async function populateShellConversation(
  page: Page,
  messages: UIMessage[] = shellMessages,
) {
  await page.route("**/api/trpc/chat.create**", async (route) => {
    const response = await route.fetch({
      headers: {
        ...route.request().headers(),
        "trpc-accept": "application/json",
      },
    });
    const data = await response.json();
    const entries = Array.isArray(data) ? data : [data];
    const entry = entries[0];
    const history = superjson.deserialize<RouterOutputs["chat"]["create"]>(
      entry.result.data,
    );
    if (!history.threadId || !Array.isArray(history.messages))
      throw new Error("Unexpected chat.create response schema");
    await respond(
      route,
      t.router({
        chat: t.router({
          create: t.procedure.mutation(() => ({
            ...history,
            hasMore: false,
            messages,
          })),
        }),
      }),
    );
  });
}

const chatStreamHeaders = {
  "cache-control": "no-cache",
  connection: "keep-alive",
  "content-type": "text/event-stream",
  "x-accel-buffering": "no",
  "x-vercel-ai-ui-message-stream": "v1",
};

/** The partial answer shown in the approved composer-streaming plate. */
export const shellStreamSentence =
  "Start with two shallow rail planters, matching saucers, and parsley and loose-leaf lettuce seeds.";

const sse = (chunk: Record<string, unknown>) =>
  `data: ${JSON.stringify(chunk)}\n\n`;

function chatStreamBody(id: string, finish: boolean) {
  return [
    sse({ messageId: id, type: "start" }),
    sse({ id, type: "text-start" }),
    sse({ delta: shellStreamSentence, id, type: "text-delta" }),
    // A held stream leaves the text part open so the response stays in its
    // streaming state until release appends the closing chunks.
    ...(finish
      ? [
          sse({ id, type: "text-end" }),
          sse({ finishReason: "stop", type: "finish" }),
          "data: [DONE]\n\n",
        ]
      : []),
  ].join("");
}

export type ShellChatMode = "complete" | "error" | "pending" | "streaming";

/** Controlled assistant sends for composer state coverage. The AI SDK holds
 * its pending and streaming statuses only while the HTTP response stays
 * unsettled, so the pending mode gates the intercepted route and the
 * streaming mode bridges to a local SSE server that keeps the socket open
 * until release. Never imported by application code. */
export async function controlShellChatSend(page: Page) {
  let mode: ShellChatMode = "complete";
  let release: (() => void) | undefined;
  let gate: Promise<void> | undefined;
  let finishStream: (() => void) | undefined;
  const server: Server = createServer((request, response) => {
    if (request.method !== "POST") {
      response.statusCode = 405;
      response.end();
      return;
    }
    response.writeHead(200, chatStreamHeaders);
    response.write(chatStreamBody("shell-streaming-message", false));
    finishStream = () => {
      response.write(sse({ id: "shell-streaming-message", type: "text-end" }));
      response.write(sse({ finishReason: "stop", type: "finish" }));
      response.write("data: [DONE]\n\n");
      response.end();
    };
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const bridge = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  await page.route("**/api/ai/journl-agent", async (route) => {
    if (mode === "error") {
      await route.abort("failed");
      return;
    }
    if (mode === "streaming") {
      await route.continue({ url: `${bridge}/api/ai/journl-agent` });
      return;
    }
    if (mode === "pending" && gate) await gate;
    await route.fulfill({
      body: chatStreamBody("shell-complete-message", true),
      contentType: "text/event-stream",
      headers: chatStreamHeaders,
    });
  });
  return {
    close() {
      finishStream?.();
      finishStream = undefined;
      server.close();
      server.closeAllConnections();
      release?.();
    },
    set(next: ShellChatMode) {
      release?.();
      mode = next;
      gate = new Promise<void>((resolve) => {
        release = resolve;
      });
    },
  };
}
