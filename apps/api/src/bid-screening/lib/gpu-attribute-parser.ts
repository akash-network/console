import type { ResourceAttribute } from "../types/inventory.types";

export interface ParsedGPUAttributes {
  vendor: string;
  model: string;
  ram: string | null;
  interface: string | null;
}

const SXM_PATTERN = /^sxm\d*$/i;

export function normalizeGPUInterface(iface: string): string {
  if (SXM_PATTERN.test(iface)) {
    return "sxm";
  }
  return iface.toLowerCase();
}

export function parseGPUAttributes(attributes: ResourceAttribute[]): ParsedGPUAttributes[] {
  const results: ParsedGPUAttributes[] = [];

  for (const attr of attributes) {
    if (attr.value !== "true") continue;

    const parts = attr.key.split("/");
    if (parts.length < 2) continue;

    let vendor = "";
    let model = "";
    let ram: string | null = null;
    let iface: string | null = null;

    for (let i = 0; i < parts.length - 1; i += 2) {
      const key = parts[i];
      const value = parts[i + 1];

      switch (key) {
        case "vendor":
          vendor = value;
          break;
        case "model":
          model = value;
          break;
        case "ram":
          ram = value;
          break;
        case "interface":
          iface = value;
          break;
      }
    }

    if (!vendor) {
      throw new Error(`GPU attribute key "${attr.key}" is missing vendor`);
    }

    results.push({ vendor, model: model || "*", ram, interface: iface });
  }

  return results;
}

export function matchesGPU(requested: ParsedGPUAttributes, available: { vendor: string; name: string; memorySize: string; interface: string }): boolean {
  if (requested.vendor.toLowerCase() !== available.vendor.toLowerCase()) {
    return false;
  }

  if (requested.model !== "*" && requested.model.toLowerCase() !== available.name.toLowerCase()) {
    return false;
  }

  if (requested.ram && requested.ram.toLowerCase() !== available.memorySize.toLowerCase()) {
    return false;
  }

  if (requested.interface) {
    const normalizedRequested = normalizeGPUInterface(requested.interface);
    const normalizedAvailable = normalizeGPUInterface(available.interface);
    if (normalizedRequested !== normalizedAvailable) {
      return false;
    }
  }

  return true;
}
