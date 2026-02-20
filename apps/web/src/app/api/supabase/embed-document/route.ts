import { NextResponse } from "next/server";

/**
 * Document embedding is now handled by workflow runs started from block transactions.
 * Supabase cron/webhook processing is deprecated.
 */
export async function POST() {
  return NextResponse.json({
    message: "Document embedding webhook is no longer used",
    success: true,
  });
}
