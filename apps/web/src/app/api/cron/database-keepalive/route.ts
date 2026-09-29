import { start } from "workflow/api";

import { env } from "~/env";
import { runDatabaseKeepalive } from "~/workflows/database-keepalive";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Only the scheduler's server-side secret grants access. Application sessions
  // and scheduler-identifying headers must never authorize this endpoint.
  if (
    !env.CRON_SECRET ||
    request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  const run = await start(runDatabaseKeepalive);

  return Response.json({ runId: run.runId }, { status: 202 });
}
