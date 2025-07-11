import crypto from "node:crypto";

/**
 * Validates the Supabase webhook signature using HMAC-SHA256.
 */
export function validateSignature(
	payload: string,
	signature: string,
	secret: string,
): boolean {
	const hmac = crypto.createHmac("sha256", secret);
	hmac.update(payload);
	const expectedSignature = hmac.digest("hex");

	// Use timingSafeEqual to prevent timing attacks
	return crypto.timingSafeEqual(
		Buffer.from(signature, "hex"),
		Buffer.from(expectedSignature, "hex"),
	);
}
