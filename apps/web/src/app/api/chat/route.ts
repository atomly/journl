import { openai } from "@ai-sdk/openai";
import { frontendTools } from "@assistant-ui/react-ai-sdk";
import { streamText } from "ai";

export const runtime = "edge";
export const maxDuration = 30;

export async function POST(req: Request) {
	const { messages, system, tools } = await req.json();

	const result = streamText({
		messages,
		model: openai("gpt-4o"),
		system,
		toolCallStreaming: true,
		tools: {
			...frontendTools(tools),
			// add backend tools here
		},
	});

	return result.toDataStreamResponse();
}
