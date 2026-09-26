export type PricePoint = [timestampMs: number, price: number];

/** CoinGecko returns one point per UTC day over a long range but several near the tail, so a day's close is its latest point. */
export function closePricesByDay(points: PricePoint[]): Map<string, number> {
  const latest = new Map<string, { at: number; price: number }>();
  for (const [at, price] of points) {
    const day = new Date(at).toISOString().slice(0, 10);
    const current = latest.get(day);
    if (!current || at > current.at) {
      latest.set(day, { at, price });
    }
  }

  return new Map([...latest.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([day, { price }]) => [day, price]));
}
