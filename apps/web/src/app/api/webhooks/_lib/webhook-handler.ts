import { type NextRequest, NextResponse } from "next/server";
import z from "zod/v4";
import { env } from "~/env";
import { validateSignature } from "./validate-signature";

function createPayloadSchema<T extends z.ZodTypeAny>(recordSchema: T) {
	return z.discriminatedUnion("type", [
		z.object({
			old_record: z.null(),
			record: recordSchema,
			schema: z.string(),
			table: z.string(),
			type: z.literal("INSERT"),
		}),
		z.object({
			old_record: recordSchema,
			record: recordSchema,
			schema: z.string(),
			table: z.string(),
			type: z.literal("UPDATE"),
		}),
		z.object({
			old_record: recordSchema,
			record: z.null(),
			schema: z.string(),
			table: z.string(),
			type: z.literal("DELETE"),
		}),
	]);
}

/**
 * Handles Supabase webhook payloads for journal entries
 */
export const handler =
	<T extends z.ZodTypeAny>(
		schema: T,
		handler: (
			payload: z.infer<ReturnType<typeof createPayloadSchema<T>>>,
		) => Promise<void>,
	) =>
	async (request: NextRequest) => {
		try {
			// Get the signature from headers
			const signature = request.headers.get("x-supabase-signature");

			if (!signature) {
				return NextResponse.json(
					{ error: "Missing webhook signature" },
					{ status: 401 },
				);
			}

			// Get the raw payload
			const text = await request.text();

			// Validate the signature
			if (!validateSignature(text, signature, env.SUPABASE_SECRET)) {
				return NextResponse.json(
					{ error: "Invalid webhook signature" },
					{ status: 401 },
				);
			}

			// Parse the payload
			const payload = createPayloadSchema(schema).parse(JSON.parse(text));

			await handler(payload);

			return NextResponse.json({ success: true });
		} catch (error) {
			console.error("Error processing webhook:", error);
			return NextResponse.json(
				{ error: "Internal server error" },
				{ status: 500 },
			);
		}
	};
