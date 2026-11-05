import { and, eq } from "@acme/db";
import { db } from "@acme/db/client";
import { Page } from "@acme/db/schema";
import { streamDocumentWriter } from "~/ai/server/document-writer";
import {
  InvalidDocumentWriterRequest,
  parseDocumentWriterRequest,
} from "~/ai/server/document-writer-request";
import { handler as corsHandler } from "~/app/api/_cors/cors";
import { withAuthGuard } from "~/auth/guards";
import { withUsageGuard } from "~/usage/guards";
import { buildUsageQuotaExceededPayload } from "~/usage/quota-error";

export const maxDuration = 300;

const handler = withAuthGuard(
  withUsageGuard(
    async ({ user }, req: Request) => {
      try {
        req.signal.throwIfAborted();
        let body: unknown;
        try {
          body = await req.json();
        } catch {
          throw new InvalidDocumentWriterRequest();
        }
        const request = parseDocumentWriterRequest(body);
        if (request.targetEditor.startsWith("page:")) {
          const page = await db.query.Page.findFirst({
            columns: { id: true },
            where: and(
              eq(Page.id, request.targetEditor.slice(5)),
              eq(Page.user_id, user.id),
            ),
          });
          if (!page)
            return Response.json({ error: "Page not found" }, { status: 404 });
        }
        // A journal target is the authenticated user's date, including an empty
        // day that has no saved row yet. Generation does not create that row.
        req.signal.throwIfAborted();
        return await streamDocumentWriter({
          request,
          signal: req.signal,
          user,
        });
      } catch (error) {
        if (req.signal.aborted) return new Response(null, { status: 499 });
        if (error instanceof InvalidDocumentWriterRequest)
          return Response.json({ error: error.message }, { status: 400 });
        console.error("[ai.document-writer] request failed", error);
        return Response.json(
          { error: "The writing assistant is unavailable. Please retry." },
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
  { onUnauthorized: () => new Response("Unauthorized", { status: 401 }) },
);

export { corsHandler as OPTIONS, handler as POST };
