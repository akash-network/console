import { useMemo } from "react";

/**
 * Hook that provides a currency formatter function for USD.
 * Uses Intl.NumberFormat to format numbers as currency with 2 decimal places.
 *
 * @returns A function that formats a number as USD currency string
 *
 * @example
 * ```tsx
 * const formatCurrency = useCurrencyFormatter();
 * const formatted = formatCurrency(1234.56); // "$1,234.56"
 * ```
 */
export function useCurrencyFormatter(): (value: number) => string {
  const formatter = useMemo(() => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }), []);

  return useMemo(() => (value: number) => formatter.format(value), [formatter]);
}
