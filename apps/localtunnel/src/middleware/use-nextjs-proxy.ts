import type express from "express";
import { env } from "~/env.ts";
import { signPayload } from "../lib/sign-payload.ts";

/**
 * Proxies the Supabase webhook requests to the Next.js server with proper signature.
 * The triggers look like this:
 * ```sql
 * drop trigger if exists "journal_entry_trigger" on "public"."journal_entry";
 * create trigger "journal_entry_trigger"
 * after insert or update or delete on "public"."journal_entry"
 * for each row
 * execute function "supabase_functions"."http_request"(
 *   'https://journl-dev-8647.loca.lt/api/webhooks/journal_entry/',
 *   'POST',
 *   '{"Content-Type":"application/json"}',
 *   '{}',
 *   '30000'
 * );
 * ```
 */
export function useNextjsProxy(app: express.Application) {
	app.use(async (req, res) => {
		try {
			const { table } = req.body;
			const payload = JSON.stringify(req.body);
			const signature = signPayload(payload, env.SUPABASE_SECRET);
			let webhookEndpoint = `${env.NEXT_JS_URL}/api/webhooks/journal-entries`;
			switch (table) {
				case "journal_entry": {
					webhookEndpoint = `${env.NEXT_JS_URL}/api/webhooks/journal-entries`;
					break;
				}
				case "block": {
					webhookEndpoint = `${env.NEXT_JS_URL}/api/webhooks/block`;
					break;
				}
				default:
					break;
			}
			// Forward the request to Next.js server
			const response = await fetch(webhookEndpoint, {
				body: payload,
				headers: {
					"Content-Type": "application/json",
					"x-supabase-signature": signature,
				},
				method: req.method,
			});

			// Forward the response back to the client
			const responseBody = await response.text();
			res.status(response.status);

			// Forward response headers
			response.headers.forEach((value, key) => {
				res.setHeader(key, value);
			});

			return res.send(responseBody);
		} catch (error) {
			console.error("Error proxying webhook:", error);
			res.status(500).json({ error: "Failed to proxy webhook" });
		}
	});
}
