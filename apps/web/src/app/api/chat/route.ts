import { journalAgent } from "~/ai/mastra/journal/journal-agent";
import { getSession } from "~/auth/server";

export const maxDuration = 30; // Allow streaming responses up to 30 seconds

export async function POST(req: Request) {
	try {
		const { messages } = await req.json();

		const session = await getSession();

		if (!session) {
			return new Response("Unauthorized", { status: 401 });
		}

		const result = await journalAgent.stream(messages);

		// // Temporary workaround to handle errors until assistant-ui fixes the error handling client-side.
		// for await (const chunk of result.fullStream) {
		// 	if (chunk.type === "error") {
		// 		console.error("[api.chat.route] chunk.error 👀", chunk.error);
		// 		return new Response(
		// 			"An error occurred while processing your request.",
		// 			{
		// 				status: 500,
		// 			},
		// 		);
		// 	}
		// }

		return result.toDataStreamResponse({
			getErrorMessage(error) {
				return `An error occurred while processing your request. ${error instanceof Error ? error.message : JSON.stringify(error)}`;
			},
		});
	} catch (error) {
		console.error("[api.chat.route] error 👀", error);
		return new Response("Internal Server Error", { status: 500 });
	}
}
