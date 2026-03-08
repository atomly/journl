import { handleStripeWebhookEvent } from "@acme/auth";
import type Stripe from "stripe";
import { FatalError } from "workflow";
import { start } from "workflow/api";
import { z } from "zod/v4";

const zStripeEvent = z
  .object({
    created: z.number().int(),
    id: z.string().min(1),
    type: z.string().min(1),
  })
  .loose();

type StripeWorkflowEvent = Stripe.Event & z.infer<typeof zStripeEvent>;

export async function enqueueStripeEvent(event: Stripe.Event) {
  const payload = zStripeEvent.parse(event) as StripeWorkflowEvent;

  await start(processStripeEvent, [payload]);
}

export async function processStripeEvent(
  event: StripeWorkflowEvent,
): Promise<void> {
  "use workflow";

  const payload = await validateStripeEvent(event);
  await processStripeEventStep(payload);
}

async function validateStripeEvent(
  event: StripeWorkflowEvent,
): Promise<StripeWorkflowEvent> {
  "use step";

  try {
    return zStripeEvent.parse(event) as StripeWorkflowEvent;
  } catch (error) {
    throw new FatalError(
      error instanceof Error
        ? error.message
        : "Invalid Stripe workflow event payload",
    );
  }
}

async function processStripeEventStep(
  event: StripeWorkflowEvent,
): Promise<void> {
  "use step";

  await handleStripeWebhookEvent(event);
}
processStripeEventStep.maxRetries = 5;
