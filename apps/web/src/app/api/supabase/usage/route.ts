import { zUsageEventWebhook } from "@acme/db/schema";
import { NextResponse } from "next/server";
import { api } from "~/trpc/server";
import { handler } from "../_lib/webhook-handler";

/**
 * This webhook processes usage events when they are created or updated.
 * Usage events are created when AI features are used (chat, embedding, etc.)
 */
export const POST = handler(zUsageEventWebhook, async (payload) => {
  // Skip DELETE events
  if (payload.type === "DELETE") {
    return NextResponse.json({ success: true });
  }

  // Skip processing if the event is already processed
  if (payload.record?.status === "processed") {
    return NextResponse.json({ success: true });
  }

  try {
    // Process the usage event with the usage period
    const result = await api.usage.processUsageEvent({
      usage_event_id: payload.record.id,
      user_id: payload.record.user_id,
    });

    return NextResponse.json({ result, success: true });
  } catch (error) {
    return NextResponse.json(
      {
        details: error instanceof Error ? error.message : "Unknown error",
        error: "Processing failed",
        success: false,
      },
      { status: 500 },
    );
  }
});
