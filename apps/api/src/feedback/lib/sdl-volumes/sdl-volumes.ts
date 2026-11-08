import { load } from "js-yaml";
import { z } from "zod";

const VolumeSchema = z
  .object({
    name: z.string().optional(),
    attributes: z
      .object({ persistent: z.union([z.boolean(), z.string()]).optional(), class: z.string().optional() })
      .passthrough()
      .nullish()
  })
  .passthrough();

const SdlSchema = z.object({
  services: z.record(
    z
      .object({
        params: z
          .object({ storage: z.record(z.unknown()).nullish() })
          .passthrough()
          .nullish()
      })
      .passthrough()
  ),
  profiles: z.object({
    compute: z.record(z.object({ resources: z.object({ storage: z.union([VolumeSchema, z.array(VolumeSchema)]) }).passthrough() }).passthrough())
  }),
  deployment: z.record(z.record(z.object({ profile: z.string() }).passthrough()))
});

type Volume = z.infer<typeof VolumeSchema>;

function parsedSdlOf(sdl: string) {
  try {
    return SdlSchema.safeParse(load(sdl));
  } catch {
    return null;
  }
}

function isMountable({ attributes }: Volume): boolean {
  return String(attributes?.persistent) === "true" || attributes?.class === "ram";
}

/** Providers back a mount only with a persistent volume claim or a RAM emptyDir, so mounting any other volume asks Kubernetes for a pod volume that does not exist. */
export function unmountableVolumesOf(sdl: string): string[] {
  const parsed = parsedSdlOf(sdl);
  if (!parsed?.success) return [];

  const { services, profiles, deployment } = parsed.data;

  return Object.entries(services).flatMap(([service, { params }]) => {
    const volumes = Object.values(deployment[service] ?? {}).flatMap(({ profile }) => [profiles.compute[profile]?.resources.storage ?? []].flat());

    return Object.keys(params?.storage ?? {})
      .filter(name => volumes.some(volume => volume.name === name && !isMountable(volume)))
      .map(name => `${service}/${name}`);
  });
}
