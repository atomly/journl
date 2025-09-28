import { zUsageEventWebhook } from "@acme/db/schema";
import { NextResponse } from "next/server";
import { api } from "~/trpc/server";
import { handler } from "../_lib/webhook-handler";

/**
 * This webhook processes usage events when they are created or updated.
 *
 * Usage events are created when AI features are used (chat, embedding, etc.)
 * and this webhook processes them to update usage aggregates and billing.
 */
export const POST = handler(zUsageEventWebhook, async (payload) => {
  // Skip DELETE events for now
  if (payload.type === "DELETE") {
    return NextResponse.json({ success: true });
  }

  // Skip processing if the event is already processed
  if (payload.record?.status === "processed") {
    return NextResponse.json({ success: true });
  }

  try {
    // Get or create the usage period for this user
    const usagePeriod = await api.usage.getCurrentUsagePeriod({
      user_id: payload.record.user_id,
    });

    if (!usagePeriod) {
      throw new Error("Error getting/creating usage period");
    }

    // Process the usage event with the usage period
    const result = await api.usage.processUsageEvent({
      usage_event_id: payload.record.id,
      usage_period_id: usagePeriod.id,
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
