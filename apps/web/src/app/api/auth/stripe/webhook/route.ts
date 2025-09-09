import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import Stripe from "stripe";
import { env } from "~/env";

export const dynamic = "force-dynamic";

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

export async function POST(req: NextRequest) {
  try {
    // Get the raw body as a buffer to preserve the exact bytes for signature verification
    const body = await req.arrayBuffer();
    const rawBody = Buffer.from(body);

    const headersList = await headers();
    const sig = headersList.get("stripe-signature");
    const webhookSecret = env.STRIPE_WEBHOOK_SECRET;

    console.log("zzz variables", { sig, webhookSecret });

    if (!sig || !webhookSecret) {
      return NextResponse.json(
        { error: "Webhook secret not found." },
        { status: 400 },
      );
    }

    let event: Stripe.Event;
    try {
      // Use the raw buffer for signature verification
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      return NextResponse.json(
        { error: `Webhook Error: ${errorMessage}` },
        { status: 400 },
      );
    }

    console.log("zzz event", event);

    // Handle different event types
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        // TODO: Handle subscription events
        break;

      case "invoice.payment_succeeded":
      case "invoice.payment_failed":
        // TODO: Handle invoice events
        break;

      default:
        // Unhandled event type
        break;
    }

    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
