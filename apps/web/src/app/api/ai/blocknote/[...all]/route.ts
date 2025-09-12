import type { NextRequest } from "next/server";
import { handler as corsHandler } from "~/app/api/_cors/cors";
import { getSession } from "~/auth/server";
import { env } from "~/env";

// import { api } from "~/trpc/server";

const OPENAI_API_URL = "https://api.openai.com/v1/";

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

  const openAIResponse = await fetch(new URL(url, OPENAI_API_URL), {
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
      const text = new TextDecoder().decode(chunk);

      // TODO: Parse chunk and determine if it's a usage chunk.
      console.log("Intercepted chunk:", text);

      // ! TODO: Track usage.
      // api.usage.trackModelUsage({
      //   model: requestBody.model,
      //   provider: requestBody.provider,
      //   user_id: session.user.id,
      //   quantity: requestBody.stream_options.include_usage ? 1 : 0,
      //   unit: "output_tokens",
      // });

      // TODO: Do not forward the usage chunk.
      controller.enqueue(chunk);
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
