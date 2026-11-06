import { z } from "zod";

const ExposeSchema = z.object({
  port: z.number(),
  as: z.number().optional(),
  accept: z.array(z.string()).optional(),
  to: z.array(z.object({ global: z.boolean().optional() }).passthrough()).optional()
});

const ServiceSchema = z.object({
  image: z.string().optional(),
  command: z.array(z.string()).nullish(),
  args: z.array(z.string()).nullish(),
  env: z.array(z.string()).nullish(),
  expose: z.array(ExposeSchema.passthrough()).nullish(),
  params: z
    .object({ storage: z.record(z.object({ mount: z.string().optional(), readOnly: z.boolean().optional() }).passthrough()).optional() })
    .passthrough()
    .nullish()
});

const SizeSchema = z.object({ size: z.union([z.string(), z.number()]) }).passthrough();

const ComputeProfileSchema = z.object({
  resources: z
    .object({
      cpu: z.object({ units: z.union([z.string(), z.number()]) }).passthrough(),
      memory: SizeSchema,
      storage: z.union([SizeSchema, z.array(SizeSchema.extend({ name: z.string().optional() }))]),
      gpu: z
        .object({ units: z.union([z.string(), z.number()]), attributes: z.unknown().optional() })
        .passthrough()
        .optional()
    })
    .passthrough()
});

const SdlSchema = z.object({
  services: z.record(ServiceSchema.passthrough()),
  profiles: z
    .object({ compute: z.record(ComputeProfileSchema.passthrough()).optional() })
    .passthrough()
    .optional(),
  deployment: z.record(z.record(z.object({ profile: z.string(), count: z.number() }).passthrough())).optional()
});

export interface SdlServiceResources {
  cpu: number | null;
  memory: string | null;
  storage: string[];
  gpu: { units: number; models: string[] } | null;
  count: number | null;
}

export interface SdlServiceSummary {
  service: string;
  image: string | null;
  command: string[] | null;
  args: string[] | null;
  envKeys: string[];
  expose: { port: number; as: number | null; accept: string[]; global: boolean }[];
  storage: { volume: string; mount: string | null; readOnly: boolean }[];
  resources: SdlServiceResources;
}

type ParsedSdl = z.infer<typeof SdlSchema>;
type ComputeProfile = z.infer<typeof ComputeProfileSchema>;

function envKeyOf(entry: string): string {
  const separator = entry.indexOf("=");
  return separator === -1 ? entry : entry.slice(0, separator);
}

function gpuModelsOf(attributes: unknown): string[] {
  const vendors = z.object({ vendor: z.record(z.array(z.object({ model: z.string() }).passthrough()).nullish()) }).safeParse(attributes);
  if (!vendors.success) return [];

  return Object.entries(vendors.data.vendor).flatMap(([vendor, models]) => (models ?? []).map(({ model }) => `${vendor}/${model}`));
}

function placementOf(sdl: ParsedSdl, service: string): { profile: string; count: number } | null {
  const placements = Object.values(sdl.deployment?.[service] ?? {});
  return placements[0] ?? null;
}

function resourcesOf(profile: ComputeProfile | undefined, count: number | null): SdlServiceResources {
  if (!profile) return { cpu: null, memory: null, storage: [], gpu: null, count };

  const { cpu, memory, storage, gpu } = profile.resources;
  const gpuUnits = gpu ? Number(gpu.units) : 0;

  return {
    cpu: Number(cpu.units),
    memory: String(memory.size),
    storage: (Array.isArray(storage) ? storage : [storage]).map(({ size }) => String(size)),
    gpu: gpuUnits > 0 ? { units: gpuUnits, models: gpuModelsOf(gpu?.attributes) } : null,
    count
  };
}

/** Lists what each service declares without any env value, so the summary can reach the model and the action cards. */
export function summarizeSdl(sdl: unknown): SdlServiceSummary[] | null {
  const parsed = SdlSchema.safeParse(sdl);
  if (!parsed.success) return null;

  return Object.entries(parsed.data.services).map(([service, definition]) => {
    const placement = placementOf(parsed.data, service);

    return {
      service,
      image: definition.image ?? null,
      command: definition.command ?? null,
      args: definition.args ?? null,
      envKeys: (definition.env ?? []).map(envKeyOf),
      expose: (definition.expose ?? []).map(entry => ({
        port: entry.port,
        as: entry.as ?? null,
        accept: entry.accept ?? [],
        global: (entry.to ?? []).some(target => target.global === true)
      })),
      storage: Object.entries(definition.params?.storage ?? {}).map(([volume, params]) => ({
        volume,
        mount: params.mount ?? null,
        readOnly: params.readOnly ?? false
      })),
      resources: resourcesOf(placement ? parsed.data.profiles?.compute?.[placement.profile] : undefined, placement?.count ?? null)
    };
  });
}
