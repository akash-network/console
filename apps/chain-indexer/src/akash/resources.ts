import type { NormalizedGroup, NormalizedResource, ProviderAttribute } from "@src/akash/akash-changes";
import { asRecord } from "@src/akash/json";

/**
 * Normalizes the GroupSpec list of any deployment proto era to one shape. The differences are
 * structural rather than semantic, so detection is shape-driven instead of version-driven:
 * v1beta1/2 nest quantities under `resources`, v1beta3+ under `resource`; v1beta1 has a single
 * storage object, later versions an array; the chain SDK decodes `ResourceValue.val` to a digit
 * string while the legacy package leaves a Uint8Array of ASCII digits that canonical JSON stores
 * as base64. GPU exists from v1beta3 and carries vendor/model as a `vendor/<v>/model/<m>` attribute.
 */
export function normalizeGroups(groups: unknown): NormalizedGroup[] {
  if (!Array.isArray(groups)) {
    return [];
  }
  return groups.map((group, index) => ({
    gseq: index + 1,
    resources: normalizeResources(asRecord(group)?.resources)
  }));
}

function normalizeResources(units: unknown): NormalizedResource[] {
  if (!Array.isArray(units)) {
    return [];
  }
  return units.map(unit => {
    const unitRecord = asRecord(unit) ?? {};
    const quantities = asRecord(unitRecord.resource) ?? asRecord(unitRecord.resources) ?? {};
    const gpu = asRecord(quantities.gpu);
    const { vendor, model } = gpuAttributes(gpu);
    const price = asRecord(unitRecord.price);
    const storage = storageEntries(quantities.storage);

    return {
      count: typeof unitRecord.count === "number" ? unitRecord.count : 0,
      cpuUnits: resourceValue(asRecord(quantities.cpu)?.units),
      gpuUnits: resourceValue(gpu?.units),
      gpuVendor: vendor,
      gpuModel: model,
      memoryBytes: resourceValue(asRecord(quantities.memory)?.quantity),
      ephemeralStorageBytes: sumStorage(storage, entry => !isPersistentStorage(entry)),
      persistentStorageBytes: sumStorage(storage, isPersistentStorage),
      price: typeof price?.amount === "string" && price.amount.length > 0 ? price.amount : "0",
      priceDenom: typeof price?.denom === "string" ? price.denom : ""
    };
  });
}

function storageEntries(storage: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(storage)) {
    return storage.map(entry => asRecord(entry) ?? {});
  }
  const single = asRecord(storage);
  return single ? [single] : [];
}

function sumStorage(entries: Array<Record<string, unknown>>, predicate: (entry: Record<string, unknown>) => boolean): number {
  return entries.filter(predicate).reduce((sum, entry) => sum + resourceValue(asRecord(entry.quantity)), 0);
}

function isPersistentStorage(storage: Record<string, unknown>): boolean {
  return attributeList(storage.attributes).some(attribute => attribute.key === "persistent" && attribute.value === "true");
}

/** GPU vendor/model come from a single `vendor/<v>/model/<m>` attribute; a `*` model means any (mirrors the legacy parser). */
function gpuAttributes(gpu: Record<string, unknown> | null): { vendor: string | null; model: string | null } {
  const attributes = attributeList(gpu?.attributes);
  if (attributes.length !== 1 || attributes[0].value !== "true") {
    return { vendor: null, model: null };
  }
  const match = /^vendor\/(.*)\/model\/(.*)$/.exec(attributes[0].key);
  if (!match) {
    return { vendor: null, model: null };
  }
  return { vendor: match[1], model: match[2] !== "*" ? match[2] : null };
}

export function attributeList(attributes: unknown): ProviderAttribute[] {
  if (!Array.isArray(attributes)) {
    return [];
  }
  return attributes.flatMap(attribute => {
    const record = asRecord(attribute);
    return typeof record?.key === "string" && typeof record?.value === "string" ? [{ key: record.key, value: record.value }] : [];
  });
}

function resourceValue(container: unknown): number {
  const val = asRecord(container)?.val;
  if (typeof val !== "string" || val.length === 0) {
    return 0;
  }
  const digits = /^\d+$/.test(val) ? val : Buffer.from(val, "base64").toString("ascii");
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : 0;
}
