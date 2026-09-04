import type { GroupSpec } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";

import type { RequestedResourceUnit, RequestedStorage, ToJSON } from "../../types/inventory";
import { parseCPUAttributes } from "../cpu-attribute-parser/cpu-attribute-parser";
import { parseGPUAttributes } from "../gpu-attribute-parser/gpu-attribute-parser";
import { parseStorageAttributes } from "../storage-attribute-parser/storage-attribute-parser";

export function mapGroupSpecToResourceUnits(request: Omit<GroupSpecJSON, "name">): RequestedResourceUnit[] {
  return request.resources.map(unit => {
    const resource = unit.resource;

    return {
      id: resource.id,
      resources: {
        cpu: {
          units: resource.cpu.units.val,
          arch: parseCPUAttributes(resource.cpu.attributes ?? []).arch
        },
        gpu: {
          units: resource.gpu.units.val,
          attributes: parseGPUAttributes(resource.gpu.attributes ?? [])
        },
        memory: {
          quantity: resource.memory.quantity.val
        },
        storage: resource.storage.map(
          (s): RequestedStorage => ({
            name: s.name,
            quantity: s.quantity.val,
            attributes: parseStorageAttributes(s.attributes ?? [])
          })
        ),
        // GroupSpecJSON kind is of type string, not enum. It's enum for gRPC response/request. So, can safely cast here.
        endpoints: (resource.endpoints ?? []) as unknown as RequestedResourceUnit["resources"]["endpoints"]
      },
      count: unit.count
    };
  });
}

export type GroupSpecJSON = ToJSON<GroupSpec>;
