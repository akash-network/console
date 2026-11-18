export type GpuSetup = { vendor: string; model: string; gpuCount: number; memory?: string | null; interface?: string | null };

export function gpuSetupDeployUrl(baseUrl: string, setup: GpuSetup): string {
  const params = new URLSearchParams({ gpuVendor: setup.vendor.toLowerCase(), gpuModel: setup.model.toLowerCase(), gpuCount: String(setup.gpuCount) });
  if (setup.memory) params.set("gpuMemory", setup.memory);
  if (setup.interface) params.set("gpuInterface", setup.interface.toLowerCase());

  return `${baseUrl}/new-deployment/configure?${params}`;
}

export function gpuAlertLeaveUrl(baseUrl: string, entryId: string): string {
  return `${baseUrl}/gpu-requests?leaveAlert=${encodeURIComponent(entryId)}`;
}

export function gpuAlertKeepUrl(baseUrl: string, entryId: string): string {
  return `${baseUrl}/gpu-requests?keepAlert=${encodeURIComponent(entryId)}`;
}

export function gpuSetupLabel(setup: GpuSetup): string {
  return [`${setup.gpuCount}×`, setup.model.toUpperCase(), setup.memory, setup.interface?.toUpperCase()].filter(Boolean).join(" ");
}
