import { mastra } from "@acme/ai"; // Adjust the import path if necessary

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
	// Extract the messages from the request body
	const { messages } = await req.json();
	// Get the chefAgent instance from Mastra
	const agent = mastra.getAgent("weatherAgent");
	// Stream the response using the agent
	const result = await agent.stream(messages);
	// Return the result as a data stream response
	return result.toDataStreamResponse();
}
