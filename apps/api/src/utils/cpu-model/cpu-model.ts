import type { ProviderSnapshotNode } from "@akashnetwork/database/dbSchemas/akash";

export type CpuVendor = "AMD" | "Intel";

export type CpuProfile = "uniform" | "mixed" | "virtual" | "unknown";

export interface CpuDescription {
  vendor: CpuVendor | null;
  model: string;
  generation: string | null;
  baseFrequencyMhz: number | null;
  isVirtual: boolean;
}

export interface ProviderCpuModel extends CpuDescription {
  threads: number;
  nodeCount: number;
}

const BASE_FREQUENCY = /@\s*(\d+(?:\.\d+)?)\s*(GHz|MHz)/i;

const VIRTUAL_CPU_NAME = /\b(QEMU|KVM|Virtual)\b|Processor \(|\bEPYC-|\d+x{2,}|\bClass\b|^AMD EPYC Processor$/i;

/** QEMU names its emulated CPU "QEMU Virtual CPU version 2.5+", so CPU stays after Virtual. */
const BRAND_WORDS = /\b(Processor|Intel|AMD)\b|(?<!\bVirtual )\bCPU\b/gi;

const MODEL_NAME_NOISE = [/\(.*?\)/g, /@.*$/, /\b(with|w\/)\s.*$/i, /\b\d+(st|nd|rd|th) Gen\b/i, /\b\w+-Cores?\b/i, BRAND_WORDS, /,/g];

const KERNEL_MODEL_NAME_FOR_A_NAMELESS_CPU = "unknown";

/** Emerald Rapids prints its brand string in capitals: INTEL(R) XEON(R) PLATINUM 8592+. */
const SHOUTED_XEON_WORD = /\b(?:XEON|PLATINUM|GOLD|SILVER|BRONZE)\b/g;

/** Sold as 5th Gen but built on the Sapphire Rapids die. */
const XEON_5TH_GEN_ON_SAPPHIRE_RAPIDS = new Set(["Xeon Silver 4509Y", "Xeon Silver 4510", "Xeon Silver 4510T", "Xeon Bronze 3508U"]);

/** Sandy Bridge-E to Broadwell-E parts without an X: Intel lists them as Core X-series, a generation behind their number. */
const CORE_X_SERIES_WITHOUT_X = new Set(["3820", "3930K", "4820K", "4930K", "5820K", "5930K", "6800K", "6850K", "6900K"].map(number => `Core i7-${number}`));

const EPYC_GENERATIONS: Record<string, string> = {
  "7xx1": "Naples",
  "7xx2": "Rome",
  "7xx3": "Milan",
  "8xx4": "Siena",
  "9xx4": "Genoa",
  "9xx5": "Turin"
};

const XEON_SCALABLE_GENERATIONS: Record<string, string> = {
  "1": "Skylake",
  "2": "Cascade Lake",
  "3": "Ice Lake",
  "4": "Sapphire Rapids",
  "5": "Emerald Rapids"
};

/** The 6300P series is left out: it shares the Xeon 6 name but is a Raptor Lake part. */
const XEON_6_GENERATIONS: Record<string, string> = {
  "5P": "Granite Rapids",
  "7P": "Granite Rapids",
  "9P": "Granite Rapids",
  "7E": "Sierra Forest",
  "9E": "Sierra Forest"
};

const XEON_E_GENERATIONS: Record<string, string> = {
  "1": "Sandy Bridge",
  "2": "Ivy Bridge",
  "3": "Haswell",
  "4": "Broadwell",
  "5": "Skylake",
  "6": "Kaby Lake"
};

/** The 1000 series is left out because the Zen+ Ryzen 5 1600 AF reports the same name as the Zen Ryzen 5 1600. */
const RYZEN_DESKTOP_GENERATIONS: Record<string, string> = {
  "2": "Zen+",
  "3": "Zen 2",
  "5": "Zen 3",
  "7": "Zen 4",
  "9": "Zen 5"
};

const GENERATION_READERS: ((model: string) => string | null | undefined)[] = [
  readEpycGeneration,
  readXeonScalableGeneration,
  readXeon6Generation,
  readXeonEGeneration,
  readCoreGeneration,
  readRyzenDesktopGeneration
];

export function normalizeCpuVendor(vendor: string | null | undefined, model: string | null | undefined): CpuVendor | null {
  const reported = [vendor, model].join(" ");
  if (/intel/i.test(reported)) return "Intel";
  if (/amd/i.test(reported)) return "AMD";

  return null;
}

export function parseBaseFrequencyMhz(model: string): number | null {
  const match = BASE_FREQUENCY.exec(model);
  if (!match) return null;

  const value = Number(match[1]);
  return match[2].toLowerCase() === "ghz" ? Math.round(value * 1000) : Math.round(value);
}

export function cleanCpuModelName(model: string): string {
  return MODEL_NAME_NOISE.reduce((name, noise) => name.replace(noise, " "), model)
    .replace(/\s+/g, " ")
    .replace(SHOUTED_XEON_WORD, word => word[0] + word.slice(1).toLowerCase())
    .trim();
}

export function recognizeCpuGeneration(cleanModel: string): string | null {
  for (const readGeneration of GENERATION_READERS) {
    const generation = readGeneration(cleanModel);
    if (generation) return generation;
  }

  return null;
}

export function describeCpu(vendor: string | null | undefined, model: string | null | undefined): CpuDescription | null {
  const reportedModel = model?.trim();
  if (!reportedModel || reportedModel === KERNEL_MODEL_NAME_FOR_A_NAMELESS_CPU) return null;

  const isVirtual = VIRTUAL_CPU_NAME.test(reportedModel);
  const vendorIdUnlessEmulated = isVirtual ? null : vendor;
  const cleanModel = cleanCpuModelName(reportedModel);

  return {
    vendor: normalizeCpuVendor(vendorIdUnlessEmulated, reportedModel),
    model: cleanModel || reportedModel,
    generation: isVirtual ? null : recognizeCpuGeneration(cleanModel),
    baseFrequencyMhz: parseBaseFrequencyMhz(reportedModel),
    isVirtual
  };
}

export function getProviderCpuModels(nodes: ProviderSnapshotNode[]): ProviderCpuModel[] {
  const modelsByKey = new Map<string, ProviderCpuModel>();

  for (const node of nodes) {
    const keysOnNode = new Set<string>();

    for (const cpu of node.cpus ?? []) {
      const description = describeCpu(cpu.vendor, cpu.model);
      if (!description) continue;

      const key = JSON.stringify([description.vendor, description.model, description.baseFrequencyMhz, description.isVirtual]);
      const cpuModel = modelsByKey.get(key) ?? { ...description, threads: 0, nodeCount: 0 };

      cpuModel.threads += cpu.vcores ?? 0;
      if (!keysOnNode.has(key)) cpuModel.nodeCount += 1;

      keysOnNode.add(key);
      modelsByKey.set(key, cpuModel);
    }
  }

  return Array.from(modelsByKey.values()).sort((a, b) => b.threads - a.threads || a.model.localeCompare(b.model));
}

export interface ProviderCpus {
  cpuModels: ProviderCpuModel[];
  cpuProfile: CpuProfile;
  cpuUnreportedNodeCount: number;
}

export function describeProviderCpus(nodes: ProviderSnapshotNode[]): ProviderCpus {
  const cpuModels = getProviderCpuModels(nodes);
  const cpuUnreportedNodeCount = cpuModels.length > 0 ? countNodesWithoutCpuModel(nodes) : 0;

  return { cpuModels, cpuProfile: getCpuProfile(cpuModels, cpuUnreportedNodeCount), cpuUnreportedNodeCount };
}

export function countNodesWithoutCpuModel(nodes: ProviderSnapshotNode[]): number {
  return nodes.filter(node => !(node.cpus ?? []).some(cpu => describeCpu(cpu.vendor, cpu.model))).length;
}

export function getCpuProfile(cpuModels: Pick<ProviderCpuModel, "isVirtual">[], nodesWithoutCpuModel = 0): CpuProfile {
  if (cpuModels.length === 0) return "unknown";
  if (nodesWithoutCpuModel > 0) return "mixed";
  if (cpuModels.every(cpuModel => cpuModel.isVirtual)) return "virtual";

  return cpuModels.length > 1 ? "mixed" : "uniform";
}

function readEpycGeneration(model: string) {
  const match = /^EPYC (\d)(\d)\d(\d)[A-Z]?$/.exec(model);
  if (!match) return null;

  const [, series, density, generationDigit] = match;
  if (series === "9" && density === "7" && generationDigit === "4") return "Bergamo";

  return EPYC_GENERATIONS[`${series}xx${generationDigit}`];
}

function readXeonScalableGeneration(model: string) {
  const match = /^Xeon (?:Bronze|Silver|Gold|Platinum) \d(\d)\d\d([A-Z]*)\+?$/.exec(model);
  if (!match || XEON_5TH_GEN_ON_SAPPHIRE_RAPIDS.has(model)) return null;

  const [, generationDigit, suffix] = match;
  if (generationDigit === "3" && suffix.startsWith("H")) return "Cooper Lake";

  return XEON_SCALABLE_GENERATIONS[generationDigit];
}

function readXeon6Generation(model: string) {
  const match = /^Xeon 6(\d)\d{2}([PE])$/.exec(model);
  if (!match) return null;

  return XEON_6_GENERATIONS[`${match[1]}${match[2]}`];
}

function readXeonEGeneration(model: string) {
  const match = /^Xeon E[35]-\d{4}[A-Z]*(?: v(\d))?$/.exec(model);
  if (!match) return null;

  return XEON_E_GENERATIONS[match[1] ?? "1"];
}

/** The X-series (i9-7900X, i7-6950X) is left out: its number runs ahead of the generation it is built on. */
function readCoreGeneration(model: string) {
  const match = /^Core i[3579]-(\d{4,5})(?!\d|X)[A-Z0-9]*$/.exec(model);
  if (!match || CORE_X_SERIES_WITHOUT_X.has(model)) return null;

  const modelNumber = match[1];
  const generation = Number(modelNumber.startsWith("1") ? modelNumber.slice(0, 2) : modelNumber.slice(0, 1));

  return `${generation}${generation === 2 ? "nd" : generation === 3 ? "rd" : "th"} Gen`;
}

function readRyzenDesktopGeneration(model: string) {
  const match = /^Ryzen [3579] (?:PRO )?(\d)\d{3}(?:X3D|XT|X)?$/.exec(model);
  if (!match) return null;

  return RYZEN_DESKTOP_GENERATIONS[match[1]];
}
