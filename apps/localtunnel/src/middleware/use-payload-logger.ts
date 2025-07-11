import type express from "express";

/**
 * Logs the payload from the Supabase webhook to the console.
 */
export function usePayloadLogger(app: express.Application) {
	app.use((req, _res, next) => {
		console.debug("[Proxy] Supabase payload 👀", req.body);
		next();
	});
}
