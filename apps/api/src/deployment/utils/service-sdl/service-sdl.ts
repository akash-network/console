import type { SDLInput } from "@akashnetwork/chain-sdk";

import { GENERATED_SERVICE_NAME } from "@src/deployment/config/sdl.config";
import type { CreateDeploymentService } from "@src/deployment/http-schemas/deployment.schema";
import { DEFAULT_MAX_PRICE } from "@src/feedback/lib/sdl-pricing/sdl-pricing";

const PLACEMENT_NAME = "dcloud";

type SdlComputeResources = SDLInput["profiles"]["compute"][string]["resources"];

/** Writes what the editor starts a single service with: every listed port public, one replica, and the console's default price ceiling. */
export function buildServiceSdl(service: CreateDeploymentService): SDLInput {
  const env = Object.entries(service.env ?? {}).map(([name, value]) => `${name}=${value}`);

  return {
    version: "2.0",
    services: {
      [GENERATED_SERVICE_NAME]: {
        image: service.image,
        ...(env.length > 0 && { env }),
        expose: service.ports.map(({ port, as }) => ({ port, as: as ?? port, to: [{ global: true }] }))
      }
    },
    profiles: {
      compute: { [GENERATED_SERVICE_NAME]: { resources: resourcesOf(service.resources) } },
      placement: { [PLACEMENT_NAME]: { pricing: { [GENERATED_SERVICE_NAME]: { ...DEFAULT_MAX_PRICE } } } }
    },
    deployment: { [GENERATED_SERVICE_NAME]: { [PLACEMENT_NAME]: { profile: GENERATED_SERVICE_NAME, count: 1 } } }
  };
}

function resourcesOf({ cpu, memory, storage, gpu }: CreateDeploymentService["resources"]): SdlComputeResources {
  return {
    cpu: { units: cpu },
    memory: { size: memory },
    storage: { size: storage },
    ...(gpu && { gpu: { units: gpu.units, attributes: { vendor: { nvidia: gpu.model ? [{ model: gpu.model }] : null } } } })
  };
}
