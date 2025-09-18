/**
 * Convert cents to dollars with proper formatting
 * @param cents - Amount in cents (integer)
 * @param options - Formatting options
 * @returns Formatted dollar amount as string
 */
export function centsToDollars(
  cents: number,
  options: {
    /** Include currency symbol (default: true) */
    includeSymbol?: boolean;
    /** Number of decimal places (default: 2) */
    decimals?: number;
  } = {},
): string {
  const { includeSymbol = true, decimals = 2 } = options;

  const dollars = cents / 100;
  const formatted = dollars.toFixed(decimals);

  return includeSymbol ? `$${formatted}` : formatted;
}

/**
 * Convert dollars to cents
 * @param dollars - Amount in dollars (can be string or number)
 * @returns Amount in cents as integer
 */
export function dollarsToCents(dollars: string | number): number {
  const amount =
    typeof dollars === "string" ? Number.parseFloat(dollars) : dollars;
  return Math.round(amount * 100);
}
