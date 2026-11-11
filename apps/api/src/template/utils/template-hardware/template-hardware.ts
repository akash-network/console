import { yaml } from "@akashnetwork/chain-sdk";
import { CORE_SCHEMA, load } from "js-yaml";
import { z } from "zod";

import { MAX_SUBMITTED_SDL_LENGTH } from "@src/deployment/config/sdl.config";
import { exceedsSubmittableLength } from "@src/deployment/utils/sdl-for-storage/sdl-for-storage";
import type { TemplateHardware } from "@src/template/types/template";

const SIZE_PREFIXES = "kmgtpe";

const MERGE_KEY = "<<";

/** A merge key copies every key of the mapping it merges while the SDL is still being parsed, so the copies are bounded before the parse rather than after it. */
const MAX_MERGED_KEY_COPIES = MAX_SUBMITTED_SDL_LENGTH;

const quantitySchema = z.union([z.string(), z.number()]);

const storageSchema = z.object({ size: quantitySchema });

const computeProfileSchema = z.object({
  resources: z.object({
    cpu: z.object({ units: quantitySchema }),
    memory: z.object({ size: quantitySchema }),
    storage: z.union([storageSchema, z.array(storageSchema)]),
    gpu: z
      .object({
        units: quantitySchema,
        attributes: z.object({ vendor: z.record(z.array(z.object({ model: z.string() })).nullish()) }).optional()
      })
      .optional()
  })
});

const sdlSchema = z.object({
  profiles: z.object({ compute: z.record(computeProfileSchema) }),
  deployment: z.record(z.record(z.object({ profile: z.string(), count: z.number().int().nonnegative() })))
});

type Sdl = z.infer<typeof sdlSchema>;
type ComputeResources = z.infer<typeof computeProfileSchema>["resources"];

/** Reads only the resource fields, so a template that fails strict SDL validation still gets a hardware summary. */
export function summarizeTemplateHardware(sdl: string): TemplateHardware | undefined {
  try {
    if (copiesTooManyMergedKeys(sdl)) return undefined;

    const document = yaml.raw(sdl);
    return exceedsSubmittableLength(sdl, document) || containsCycle(document) ? undefined : totalHardware(sdlSchema.parse(document));
  } catch {
    return undefined;
  }
}

/** Counts merges on a parse that leaves them unresolved, where every alias is a shared reference and the walk is linear in the document. */
function copiesTooManyMergedKeys(sdl: string): boolean {
  return sdl.includes(MERGE_KEY) && countMergedKeyCopies(load(sdl, { schema: CORE_SCHEMA })) > MAX_MERGED_KEY_COPIES;
}

function countMergedKeyCopies(document: unknown): number {
  const keysAfterMerging = new Map<object, number>();
  let copies = 0;

  function visit(node: unknown): number {
    if (node === null || typeof node !== "object") return 0;

    const known = keysAfterMerging.get(node);
    if (known !== undefined) return known;

    keysAfterMerging.set(node, Infinity);

    let keys = 0;
    for (const [key, value] of Object.entries(node)) {
      if (key === MERGE_KEY) {
        const merged = [value].flat().reduce((total: number, source) => total + visit(source), 0);
        copies += merged;
        keys += merged;
      } else {
        visit(value);
        keys += 1;
      }
    }

    keysAfterMerging.set(node, keys);
    return keys;
  }

  visit(document);

  return copies;
}

function containsCycle(document: unknown): boolean {
  const ancestors = new Set<object>();
  const finished = new Set<object>();

  function reachesAncestor(node: unknown): boolean {
    if (node === null || typeof node !== "object" || finished.has(node)) return false;
    if (ancestors.has(node)) return true;

    ancestors.add(node);
    const cyclic = Object.values(node).some(reachesAncestor);
    ancestors.delete(node);
    finished.add(node);

    return cyclic;
  }

  return reachesAncestor(document);
}

function totalHardware(sdl: Sdl): TemplateHardware {
  let cpuMillis = 0;
  let memoryBytes = 0;
  let storageBytes = 0;
  let gpuUnits = 0;
  const gpuModels = new Set<string>();

  for (const placements of Object.values(sdl.deployment)) {
    for (const { profile, count } of Object.values(placements)) {
      const resources = findComputeResources(sdl, profile);
      cpuMillis += parseCpuMillis(resources.cpu.units) * count;
      memoryBytes += parseBytes(resources.memory.size) * count;
      storageBytes += [resources.storage].flat().reduce((total, storage) => total + parseBytes(storage.size), 0) * count;

      const units = resources.gpu ? parseCount(resources.gpu.units) * count : 0;
      if (units > 0) {
        gpuUnits += units;
        listGpuModels(resources.gpu?.attributes?.vendor).forEach(model => gpuModels.add(model.toLowerCase()));
      }
    }
  }

  const hardware: TemplateHardware = { cpu: cpuMillis / 1000, memoryBytes, storageBytes };
  if (gpuUnits > 0) {
    hardware.gpu = { units: gpuUnits, models: [...gpuModels] };
  }

  return hardware;
}

function findComputeResources(sdl: Sdl, profile: string): ComputeResources {
  const compute = sdl.profiles.compute[profile];
  if (!compute) throw new Error(`Unknown compute profile: ${profile}`);

  return compute.resources;
}

/** Each vendor's named models, or the vendor itself when it accepts any of its models. */
function listGpuModels(vendors: Record<string, { model: string }[] | null | undefined> = {}): string[] {
  return Object.entries(vendors).flatMap(([vendor, models]) => (models?.length ? models.map(({ model }) => model) : [vendor]));
}

function parseCpuMillis(units: string | number): number {
  const match = /^(\d+(?:\.\d+)?)(m?)$/.exec(String(units));
  if (!match) throw new Error(`Invalid CPU units: ${units}`);

  const value = Number(match[1]);
  return Math.round(match[2] ? value : value * 1000);
}

function parseBytes(size: string | number): number {
  const match = /^(\d+(?:\.\d+)?)(?:([a-z])(i?)b?)?$/.exec(String(size).toLowerCase());
  if (!match) throw new Error(`Invalid size: ${size}`);

  const [, value, prefix, binary] = match;
  if (!prefix) return Number(value);

  const power = SIZE_PREFIXES.indexOf(prefix) + 1;
  if (power === 0) throw new Error(`Invalid size prefix: ${size}`);

  return Math.round(Number(value) * (binary ? 1024 : 1000) ** power);
}

function parseCount(units: string | number): number {
  const count = Number(units);
  if (!Number.isInteger(count) || count < 0) throw new Error(`Invalid GPU units: ${units}`);

  return count;
}
