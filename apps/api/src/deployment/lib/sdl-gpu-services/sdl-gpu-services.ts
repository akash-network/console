import type { SDLInput } from "@akashnetwork/chain-sdk";

/**
 * Names the services of one placement whose compute profile asks for a gpu, so a probe opens a shell only where
 * there is hardware to report and a ten service deployment costs one session rather than ten.
 */
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
