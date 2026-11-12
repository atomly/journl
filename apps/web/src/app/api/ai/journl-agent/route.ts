import { streamJournlChat } from "~/ai/server/chat";
import {
  InvalidChatRequest,
  parseJournlChatRequest,
} from "~/ai/server/chat-request";
import { ChatThreadError } from "~/ai/server/chat-threads";
import { handler as corsHandler } from "~/app/api/_cors/cors";
import { withAuthGuard } from "~/auth/guards";
import { withUsageGuard } from "~/usage/guards";
import { buildUsageQuotaExceededPayload } from "~/usage/quota-error";

export const maxDuration = 30;

const handler = withAuthGuard(
  withUsageGuard(
    async ({ user }, req: Request) => {
      try {
        let body: unknown;
        try {
          body = await req.json();
        } catch {
          throw new InvalidChatRequest();
        }
        const request = await parseJournlChatRequest(body);
        return await streamJournlChat({ request, signal: req.signal, user });
      } catch (error) {
        if (error instanceof ChatThreadError) {
          return Response.json(
            { error: error.message },
            { status: error.code === "NOT_FOUND" ? 404 : 400 },
          );
        }
        if (error instanceof InvalidChatRequest) {
          return Response.json(
            { error: "Invalid chat request" },
            { status: 400 },
          );
        }
        if (req.signal.aborted) return new Response(null, { status: 499 });
        console.error("[ai.chat] request failed", error);
        return Response.json(
          { error: "The assistant is unavailable. Please retry." },
          { status: 500 },
        );
      }
    },
    {
      onUsageLimitExceeded: (error) =>
        Response.json(buildUsageQuotaExceededPayload(error.status), {
          status: 429,
        }),
    },
  ),
  {
    onUnauthorized: () => new Response("Unauthorized", { status: 401 }),
  },
);

export { corsHandler as OPTIONS, handler as POST };
