import { yaml } from "@akashnetwork/chain-sdk";
import { z } from "zod";

import type { TemplateHardware } from "@src/template/types/template";

const SIZE_PREFIXES = "kmgtpe";

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

/** Totals an SDL across services and replicas without validating the rest of it, so a template the deploy flow can still import keeps its hardware; undefined when it cannot be read. */
export function summarizeTemplateHardware(sdl: string): TemplateHardware | undefined {
  try {
    return totalHardware(sdlSchema.parse(yaml.raw(sdl)));
  } catch {
    return undefined;
  }
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
        listGpuModels(resources.gpu?.attributes?.vendor).forEach(model => gpuModels.add(model));
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
