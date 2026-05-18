import type { GroupSpec } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";

import type { RequestedResourceUnit, RequestedStorage, ToJSON } from "../../types/inventory.types";

const EMPTY_ARRAY = Object.freeze([]);
export function mapGroupSpecToResourceUnits(request: GroupSpecJSON): RequestedResourceUnit[] {
  return request.resources.map(unit => {
    const resource = unit.resource;

    return {
      id: resource.id,
      resources: {
        cpu: {
          units: resource.cpu.units.val,
          attributes: resource.cpu.attributes ?? EMPTY_ARRAY
        },
        gpu: {
          units: resource.gpu.units.val,
          attributes: resource.gpu.attributes ?? EMPTY_ARRAY
        },
        memory: {
          quantity: resource.memory.quantity.val,
          attributes: resource.memory.attributes ?? EMPTY_ARRAY
        },
        storage: resource.storage.map(
          (s): RequestedStorage => ({
            name: s.name,
            quantity: s.quantity.val,
            attributes: s.attributes ?? EMPTY_ARRAY
          })
        ),
        endpoints: resource.endpoints ?? EMPTY_ARRAY
      },
      count: unit.count
    };
  });
}

export type GroupSpecJSON = ToJSON<GroupSpec>;
