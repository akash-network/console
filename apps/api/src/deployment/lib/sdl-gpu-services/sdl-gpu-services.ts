import type { SDLInput } from "@akashnetwork/chain-sdk";

export function findGpuServices(sdl: SDLInput | null | undefined, placement: string): string[] {
  const deployment = sdl?.deployment;
  const computeProfiles = sdl?.profiles?.compute;
  if (!deployment || !computeProfiles) return [];

  const services: string[] = [];

  for (const [service, placements] of Object.entries(deployment)) {
    const profileName = placements?.[placement]?.profile;
    if (!profileName) continue;

    const units = computeProfiles[profileName]?.resources?.gpu?.units;
    if (toUnits(units) > 0) services.push(service);
  }

  return services;
}

function toUnits(units: unknown): number {
  const value = Number(units);
  return Number.isFinite(value) ? value : 0;
}
