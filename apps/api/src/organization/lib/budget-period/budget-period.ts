/** A budget runs per calendar month in UTC; `key` is the month's first day as stored on the budget. */
export type BudgetPeriod = { from: Date; to: Date; key: string };

export function budgetPeriodOf(at: Date): BudgetPeriod {
  const from = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
  const to = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1));

  return { from, to, key: from.toISOString().slice(0, 10) };
}
