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
  console.log("zzz [USAGE] received payload:", payload);
  // Skip DELETE events for now
  if (payload.type === "DELETE") {
    return NextResponse.json({ success: true });
  }

  // Skip processing if the event is already processed
  if (payload.record?.status === "processed") {
    return NextResponse.json({ success: true });
  }

  // TODO: Implement usage processing logic
  // 1. Get or create usage period for the user

  const usagePeriod = await api.usage.getCurrentUsagePeriod({
    user_id: payload.record.user_id,
  });
  console.log("zzz [USAGE] usagePeriod:", usagePeriod);
  // 2. Calculate cost based on model and metrics
  // 3. Update usage aggregate
  // 4. Mark usage event as processed

  return NextResponse.json({ success: true });
});
