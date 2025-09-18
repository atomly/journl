export function centsToDollars(
  cents: number,
  options: {
    includeSymbol?: boolean;
    decimals?: number;
  } = {},
): string {
  const { includeSymbol = true, decimals = 2 } = options;
  const dollars = cents / 100;
  const formatted = dollars.toFixed(decimals);
  return includeSymbol ? `$${formatted}` : formatted;
}

export function dollarsToCents(dollars: string | number): number {
  const amount =
    typeof dollars === "string" ? Number.parseFloat(dollars) : dollars;
  return Math.round(amount * 100);
}
