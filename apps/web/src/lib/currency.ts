export function centsToDollars(
  cents: number,
  options: {
    includeSymbol?: boolean;
    decimals?: number;
    locale?: string;
    currency?: string;
  } = {},
): string {
  const {
    includeSymbol = true,
    decimals = 2,
    locale = "en-US",
    currency = "USD",
  } = options;

  const dollars = cents / 100;

  if (includeSymbol) {
    return new Intl.NumberFormat(locale, {
      currency: currency,
      maximumFractionDigits: decimals,
      minimumFractionDigits: decimals,
      style: "currency",
    }).format(dollars);
  } else {
    return new Intl.NumberFormat(locale, {
      maximumFractionDigits: decimals,
      minimumFractionDigits: decimals,
    }).format(dollars);
  }
}

export function dollarsToCents(dollars: string | number): number {
  let amount: number;

  if (typeof dollars === "string") {
    // Remove currency symbols and formatting for parsing
    // This handles various currency formats by removing non-digit characters except decimal points
    const cleanedString = dollars.replace(/[^\d.-]/g, "");
    amount = Number.parseFloat(cleanedString);
  } else {
    amount = dollars;
  }

  if (Number.isNaN(amount)) {
    throw new Error(`Invalid currency value: ${dollars}`);
  }

  return Math.round(amount * 100);
}
