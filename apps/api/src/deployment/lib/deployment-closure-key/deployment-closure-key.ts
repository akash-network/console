/** Stripped as text rather than through `Number`, which a dseq above 2^53 would not survive intact. */
export function normalizeDseq(dseq: string): string {
  return dseq.replace(/^0+(?=\d)/, "");
}

export function closureKey({ owner, dseq }: { owner: string; dseq: string }): string {
  return `${owner}/${normalizeDseq(dseq)}`;
}
