const MISSING_PART = "*";

export function toPoolKey(gpu: { vendor: string; model: string; memory?: string | null; interface?: string | null }): string {
  return [gpu.vendor, gpu.model, gpu.memory, gpu.interface].map(part => part?.toLowerCase() || MISSING_PART).join("/");
}
