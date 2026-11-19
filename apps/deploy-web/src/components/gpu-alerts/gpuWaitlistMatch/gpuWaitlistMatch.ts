export type GpuWaitlistSetup = {
  vendor: string;
  model: string;
  memory?: string | null;
  interface?: string | null;
};

type WaitingEntry = GpuWaitlistSetup;

function samePart(entryPart: string | null | undefined, setupPart: string | null | undefined): boolean {
  return (entryPart?.toLowerCase() || undefined) === (setupPart?.toLowerCase() || undefined);
}

export function findWaitingEntry<T extends WaitingEntry>(entries: T[] | undefined, setup: GpuWaitlistSetup): T | undefined {
  return entries?.find(
    entry =>
      samePart(entry.vendor, setup.vendor) &&
      samePart(entry.model, setup.model) &&
      samePart(entry.memory, setup.memory) &&
      samePart(entry.interface, setup.interface)
  );
}
