import { singleton } from "tsyringe";

import type { GpuModel, GpuVendor, ProviderConfigGpusType } from "@src/types/gpu";

/** Vendor keys (lowercase) mapped to their branded display name; unknown vendors fall back to uppercase. */
const GPU_VENDOR_LABELS: Record<string, string> = {
  nvidia: "NVIDIA",
  amd: "AMD",
  intel: "Intel"
};

/**
 * Marketing-correct display names for models whose casing/spacing the heuristic cannot infer: families
 * that need an "RTX" brand prefix (`pro6000`), suffixes that must not be expanded as "Super" (`l40s`),
 * and the prioritized set we want to guarantee regardless of future heuristic tweaks.
 */
const GPU_MODEL_LABELS: Record<string, string> = {
  h100: "H100",
  a100: "A100",
  h200: "H200",
  v100: "V100",
  t4: "T4",
  l4: "L4",
  l40: "L40",
  l40s: "L40S",
  a10: "A10",
  a16: "A16",
  a30: "A30",
  a40: "A40",
  gh200: "GH200",
  b200: "B200",
  rtx3090: "RTX 3090",
  rtx4090: "RTX 4090",
  rtx5090: "RTX 5090",
  rtxa4000: "RTX A4000",
  rtxa5000: "RTX A5000",
  rtxa6000: "RTX A6000",
  pro6000: "RTX PRO 6000",
  pro6000se: "RTX PRO 6000 SE"
};

/** GeForce/consumer families whose alpha prefix is separated from the model number by a space (e.g. `rtx4090` → `RTX 4090`). */
const SPACED_FAMILIES = ["rtx", "gtx", "gt", "mx"] as const;

/**
 * Turns the raw provider-config GPU catalog into the presentation-ready vendor list served by
 * `/v1/gpu-models`: reshapes the payload (collapse repeated model names, collect their distinct memory
 * sizes and interfaces, normalize the interface) and attaches marketing-correct display names to the
 * vendor and each model. The raw `name` on both stays the canonical SDL/attribute value.
 */
@singleton()
export class GpuFormattingService {
  /** Reshapes the upstream payload into the served vendor list, attaching vendor and model display names. */
  mapProviderConfig(config: ProviderConfigGpusType): GpuVendor[] {
    return Object.values(config).map(vendorValue => {
      const models: GpuModel[] = [];

      for (const device of Object.values(vendorValue.devices)) {
        const gpuInterface = this.#normalizeInterface(device.interface);
        const existing = models.find(model => model.name === device.name);

        if (existing) {
          if (!existing.memory.includes(device.memory_size)) existing.memory.push(device.memory_size);
          if (!existing.interface.includes(gpuInterface)) existing.interface.push(gpuInterface);
        } else {
          models.push({
            name: device.name,
            displayName: this.formatModelName(device.name),
            memory: [device.memory_size],
            interface: [gpuInterface]
          });
        }
      }

      return { name: vendorValue.name, displayName: this.formatVendorName(vendorValue.name), models };
    });
  }

  /**
   * Turns a raw GPU model name (lowercase, no separators — e.g. `rtx4090`, `h100`, `gtx1080ti`) into a
   * marketing-correct display label. Curated overrides win; otherwise a heuristic spaces multi-letter
   * consumer families from their number, keeps single-letter datacenter names glued, and formats known
   * suffixes. The raw name stays the canonical SDL/attribute value everywhere else.
   */
  formatModelName(name: string): string {
    const key = this.#normalize(name);

    const curated = GPU_MODEL_LABELS[key];
    if (curated) return curated;

    const aSeries = key.match(/^rtx(a\d+)([a-z]*)$/);
    if (aSeries) return `RTX ${aSeries[1].toUpperCase()}${this.#formatSuffix(aSeries[2])}`;

    for (const family of SPACED_FAMILIES) {
      if (key.startsWith(family)) {
        const rest = key.slice(family.length).match(/^(\d+)([a-z]*)$/);
        if (rest) return `${family.toUpperCase()} ${rest[1]}${this.#formatSuffix(rest[2])}`;
      }
    }

    const datacenter = key.match(/^([a-z]+\d+)([a-z]*)$/);
    if (datacenter) return `${datacenter[1].toUpperCase()}${this.#formatSuffix(datacenter[2])}`;

    return name.toUpperCase();
  }

  /** Turns a raw vendor name (e.g. `nvidia`) into its branded label (`NVIDIA`), falling back to uppercase. */
  formatVendorName(name: string): string {
    return GPU_VENDOR_LABELS[this.#normalize(name)] ?? name.toUpperCase();
  }

  /** Lowercases and strips every non-alphanumeric character so `RTX-4090` and `RTX 4090` share one key. */
  #normalize(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  /** Formats a model-name suffix: `ti` → ` Ti`, `s`/`super` → ` SUPER`, anything else uppercased (e.g. ` NVL`). */
  #formatSuffix(suffix: string): string {
    if (!suffix) return "";
    if (suffix === "ti") return " Ti";
    if (suffix === "s" || suffix === "super") return " SUPER";
    return ` ${suffix.toUpperCase()}`;
  }

  /** Collapses every SXM revision (`SXM4`, `SXM5`, …) to the canonical `sxm`; other interfaces are lowercased. */
  #normalizeInterface(gpuInterface: string): string {
    const formatted = gpuInterface.toLowerCase();
    return formatted.startsWith("sxm") ? "sxm" : formatted;
  }
}
