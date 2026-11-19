export type GpuWaitlistSetup = {
  vendor: string;
  model: string;
  memory?: string | null;
  interface?: string | null;
};

type WaitingEntry = GpuWaitlistSetup;

function matchesPart(entryPart: string | null | undefined, setupPart: string | null | undefined): boolean {
  return !entryPart || entryPart.toLowerCase() === setupPart?.toLowerCase();
}

export function findWaitingEntry<T extends WaitingEntry>(entries: T[] | undefined, setup: GpuWaitlistSetup): T | undefined {
  return entries?.find(
    entry =>
      matchesPart(entry.vendor, setup.vendor) &&
      matchesPart(entry.model, setup.model) &&
      matchesPart(entry.memory, setup.memory) &&
      matchesPart(entry.interface, setup.interface)
  );
}
