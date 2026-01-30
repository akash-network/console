export function formatUTCDate(d: Date): string {
  return d.toISOString().split("T")[0];
}
