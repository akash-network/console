import type { ProviderConfigGpusType } from "@src/types/gpu";

export type GpuCatalogEntry = {
  vendor: string;
  model: string;
  memorySize: string;
  interface: string;
};

/** The catalog keyed every way a card can identify itself: by both pci ids, by the device id alone, and by the model name the sdl uses. */
export type GpuCatalogIndex = {
  byPciId: Map<string, GpuCatalogEntry>;
  /** Null for a device id two vendors both claim, so a bare id resolves only where it is unambiguous. */
  byDeviceId: Map<string, GpuCatalogEntry | null>;
  byModel: Map<string, GpuCatalogEntry>;
};

export type DetectedGpuIdentity = {
  rawName: string;
  pciDeviceId: string | null;
};

export type ResolvedGpuModel = {
  vendor: string | null;
  model: string | null;
  interface: string | null;
};

const UNRESOLVED: ResolvedGpuModel = { vendor: null, model: null, interface: null };

/** Brand words a driver prints that no sdl model key carries. */
const BRAND_TOKENS = /\b(nvidia|tesla|geforce|quadro|amd|radeon|instinct|advanced micro devices)\b/g;

/** Words a vendor adds to a product name that name an architecture or a packaging rather than the model. */
const MARKETING_TOKENS = /\b(blackwell|hopper|ampere|ada|lovelace|server|edition|graphics|generation)\b/g;

const MEMORY_TOKENS = /\b(\d+\s?gb|hbm\d*e?|gddr\d*x?)\b/g;

/** `nvl` names a pcie board bridged with nvlink rather than a packaging of its own, and the catalog lists only some of those cards. */
const FORM_FACTORS = [
  { matcher: /\bsxm\d*\b/, name: "sxm" },
  { matcher: /\boam\b/, name: "oam" },
  { matcher: /\bpcie\b/, name: "pcie" },
  { matcher: /\bnvl\b/, name: "pcie" }
] as const;

/** Product names that carry a suffix or a word order the catalog keys do not. */
const MODEL_ALIASES: Record<string, string> = {
  rtxpro6000: "pro6000",
  rtxpro6000se: "pro6000se"
};

export function buildGpuCatalogIndex(config: ProviderConfigGpusType): GpuCatalogIndex {
  const byPciId = new Map<string, GpuCatalogEntry>();
  const byDeviceId = new Map<string, GpuCatalogEntry | null>();
  const byModel = new Map<string, GpuCatalogEntry>();

  for (const [vendorId, vendor] of Object.entries(config)) {
    for (const [deviceId, device] of Object.entries(vendor.devices)) {
      const entry: GpuCatalogEntry = {
        vendor: vendor.name,
        model: device.name,
        memorySize: device.memory_size,
        interface: normalizeInterface(device.interface)
      };

      const deviceKey = hexKey(deviceId);
      byPciId.set(`${hexKey(vendorId)}:${deviceKey}`, entry);
      byDeviceId.set(deviceKey, byDeviceId.has(deviceKey) && byDeviceId.get(deviceKey)?.vendor !== entry.vendor ? null : entry);
      if (!byModel.has(entry.model)) byModel.set(entry.model, entry);
    }
  }

  return { byPciId, byDeviceId, byModel };
}

/** Prefers the pci ids a card reports over the name it prints, because those identify a model whoever made it. */
export function resolveGpuModel(identity: DetectedGpuIdentity, index: GpuCatalogIndex | null): ResolvedGpuModel {
  if (!index) return UNRESOLVED;

  const byPciId = identity.pciDeviceId && findByPciId(identity.pciDeviceId, index);
  if (byPciId) return toResolved(byPciId, null);

  const { key, formFactor } = toModelKey(identity.rawName);
  const entry = findByModelKey(key, index);

  return entry ? toResolved(entry, formFactor) : UNRESOLVED;
}

function findByModelKey(key: string, index: GpuCatalogIndex): GpuCatalogEntry | undefined {
  if (!key) return undefined;

  return (
    index.byModel.get(key) ??
    index.byModel.get(MODEL_ALIASES[key]) ??
    index.byModel.get(key.replace(/[a-z]{2,}$/, "")) ??
    index.byModel.get(key.replace(/[a-z]$/, ""))
  );
}

function toResolved(entry: GpuCatalogEntry, formFactor: string | null): ResolvedGpuModel {
  return { vendor: entry.vendor, model: entry.model, interface: formFactor ?? entry.interface };
}

/** A reported name is reduced to what the catalog keys on: the family and its number, with brand, memory and packaging words removed. */
function toModelKey(rawName: string): { key: string; formFactor: string | null } {
  const spaced = rawName.toLowerCase().replace(/[-_/]/g, " ");
  const formFactor = FORM_FACTORS.find(({ matcher }) => matcher.test(spaced))?.name ?? null;

  const key = spaced
    .replace(BRAND_TOKENS, " ")
    .replace(MARKETING_TOKENS, " ")
    .replace(MEMORY_TOKENS, " ")
    .replace(/\bsxm\d*\b|\boam\b|\bpcie\b/g, " ")
    .replace(/[^a-z0-9]/g, "");

  return { key, formFactor };
}

/** `nvidia-smi` packs device then vendor into one word as `0x233010DE`, while `rocm-smi` reports the device on its own. */
function findByPciId(pciDeviceId: string, index: GpuCatalogIndex): GpuCatalogEntry | undefined {
  const digits = hexKey(pciDeviceId);
  if (digits.length === 8) return index.byPciId.get(`${digits.slice(4)}:${digits.slice(0, 4)}`);

  return index.byDeviceId.get(digits.padStart(4, "0")) ?? undefined;
}

function hexKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/^0x/, "")
    .replace(/[^0-9a-f]/g, "");
}

function normalizeInterface(gpuInterface: string): string {
  const formatted = gpuInterface.toLowerCase();
  return formatted.startsWith("sxm") ? "sxm" : formatted;
}
