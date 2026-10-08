import { start } from "workflow/api";
import { env } from "~/env";
import { runExploreOutboxRecovery } from "~/workflows/explore-refresh";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (
    !env.CRON_SECRET ||
    request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`
  )
    return new Response("Unauthorized", { status: 401 });
  const run = await start(runExploreOutboxRecovery);
  return Response.json({ runId: run.runId }, { status: 202 });
}
