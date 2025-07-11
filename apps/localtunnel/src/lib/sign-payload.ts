import crypto from "node:crypto";

/**
 * Creates a Supabase-compatible webhook signature using HMAC-SHA256.
 */
export function signPayload(payload: string, secret: string): string {
	const hmac = crypto.createHmac("sha256", secret);
	hmac.update(payload);
	return hmac.digest("hex");
}
