/**
 * Formats a USD amount using K (thousands) and M (millions) abbreviations.
 * @param amount The amount to format in cents (integer)
 * @param decimals The number of decimal places to show (default: 2)
 * @returns Formatted USD string
 */
export function formatUUsd(amount: number, decimals: number = 2): string {
  const dollars = amount / 1000000; // Convert cents to dollars

  if (dollars >= 1000000) {
    return `$${(dollars / 1000000).toFixed(decimals)}M`;
  } else if (dollars >= 1000) {
    return `$${(dollars / 1000).toFixed(decimals)}K`;
  } else {
    return `$${dollars.toFixed(2)}`;
  }
}

