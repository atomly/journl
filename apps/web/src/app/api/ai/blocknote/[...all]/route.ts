import type { NextRequest } from "next/server";
import z from "zod";
import { handler as corsHandler } from "~/app/api/_cors/cors";
import { getSession } from "~/auth/server";
import { env } from "~/env";
import { api } from "~/trpc/server";

const OPENAI_MESSAGE_PREFIX = "data: ";
const OPENAI_MESSAGE_DONE_TEXT = "[DONE]";
const OPENAI_MODEL_PROVIDER = "openai";

const zChatCompletionMessage = z.object({
  id: z.string(),
  model: z.string(),
  usage: z.object({
    completion_tokens: z.number(),
    completion_tokens_details: z.object({
      accepted_prediction_tokens: z.number(),
      audio_tokens: z.number(),
      reasoning_tokens: z.number(),
      rejected_prediction_tokens: z.number(),
    }),
    prompt_tokens: z.number(),
    prompt_tokens_details: z.object({
      audio_tokens: z.number(),
      cached_tokens: z.number(),
    }),
    total_tokens: z.number(),
  }),
});

function JSONSafeParse<T>(json: string, schema: z.ZodSchema<T>) {
  try {
    return schema.parse(JSON.parse(json));
  } catch {
    return null;
  }
}

async function handler(req: NextRequest) {
  const session = await getSession();

  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const requestBody = await req.json();

  const [, url] = req.url.split("/ai/blocknote/");

  if (!url) {
    return new Response("Not found", { status: 404 });
  }

  const openAIResponse = await fetch(new URL(url, env.OPENAI_API_URL), {
    body: JSON.stringify({
      ...requestBody,
      stream: true,
      stream_options: {
        ...requestBody.stream_options,
        include_usage: true,
      },
    }),
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const transformStream = new TransformStream({
    async transform(chunk, controller) {
      try {
        const text = new TextDecoder().decode(chunk);

        if (text === `${OPENAI_MESSAGE_PREFIX}${OPENAI_MESSAGE_DONE_TEXT}`) {
          return controller.enqueue(chunk);
        }

        // Parsing the messages from the openAI response by removing the newline characters and the prefix.
        const data = text
          .replace(/[\r\n]+/g, "")
          .trim()
          .split(OPENAI_MESSAGE_PREFIX)
          .filter((t) => t !== "" && t !== OPENAI_MESSAGE_DONE_TEXT);

        for (const serialized of data) {
          const message = JSONSafeParse(serialized, zChatCompletionMessage);
          if (!message) continue;
          await api.usage.trackModelUsage({
            metrics: [
              {
                quantity: message.usage.prompt_tokens,
                unit: "input_tokens",
              },
              {
                quantity: message.usage.completion_tokens,
                unit: "output_tokens",
              },
            ],
            model_id: message.model,
            model_provider: OPENAI_MODEL_PROVIDER,
            user_id: session.user.id,
          });
        }

        controller.enqueue(chunk);
      } catch (error) {
        console.error("Error tracking model usage", error);
      }
    },
  });

  return new Response(openAIResponse.body?.pipeThrough(transformStream), {
    headers: {
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
    },
  });
}

export { handler as GET, handler as POST, corsHandler as OPTIONS };
