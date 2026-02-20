import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { NextRequest } from "next/server";
import { handler as corsHandler, setCorsHeaders } from "~/app/api/_cors/cors";
import { auth } from "~/auth/server";
import { apiRouter, createTRPCContext } from "~/trpc";

async function handler(req: NextRequest) {
  const response = await fetchRequestHandler({
    createContext: () =>
      createTRPCContext({
        auth: auth,
        headers: req.headers,
      }),
    endpoint: "/api/trpc",
    onError({ error, path }) {
      console.error(`>>> tRPC Error on '${path}'`, error);
    },
    req,
    router: apiRouter,
  });

  setCorsHeaders(response);
  return response;
}

export { handler as GET, handler as POST, corsHandler as OPTIONS };
