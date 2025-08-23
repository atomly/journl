import { zPage } from "@acme/db/schema";
import { NextResponse } from "next/server";
import { handler } from "../_lib/webhook-handler";

export const POST = handler(zPage, async () => {
  // TODO: Refactor the PageEmbedding logic.
  return NextResponse.json({ success: true });
});
