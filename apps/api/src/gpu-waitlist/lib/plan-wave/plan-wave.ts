export type WaveCandidate = { id: string; gpuCount: number; isEligible: boolean };

export function planWave({ nodeFreeUnits, entries, multiplier }: { nodeFreeUnits: number[]; entries: WaveCandidate[]; multiplier: number }): string[] {
  const eligible = entries.filter(entry => entry.isEligible);
  const largestNode = Math.max(0, ...nodeFreeUnits);
  const slots = countSlots(nodeFreeUnits, eligible);

  return eligible
    .filter(entry => entry.gpuCount <= largestNode)
    .slice(0, multiplier * slots)
    .map(entry => entry.id);
}

export function countSlots(nodeFreeUnits: number[], eligible: WaveCandidate[]): number {
  const remaining = [...nodeFreeUnits];
  let placed = 0;

  for (const entry of eligible) {
    const node = remaining.findIndex(units => units >= entry.gpuCount);

    if (node === -1) continue;

    remaining[node] -= entry.gpuCount;
    placed++;
  }

  return placed;
}
