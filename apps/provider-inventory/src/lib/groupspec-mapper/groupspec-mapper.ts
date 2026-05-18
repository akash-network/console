import type { GroupSpec } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";

import type { RequestedResourceUnit, RequestedStorage, ToJSON } from "../../types/inventory.types";

function parseResourceValue(val: string): bigint {
  const parsed = BigInt(val);
  if (parsed < 0n) {
    throw new Error(`Invalid resource value: ${val} must be a non-negative integer`);
  }
  return parsed;
}

const EMPTY_ARRAY = Object.freeze([]);
export function mapGroupSpecToResourceUnits(request: GroupSpecJSON): RequestedResourceUnit[] {
  return request.resources.map(unit => {
    const resource = unit.resource;

    const storage: RequestedStorage[] = resource.storage.map(vol => ({
      name: vol.name,
      quantity: parseResourceValue(vol.quantity.val),
      attributes: vol.attributes ?? EMPTY_ARRAY
    }));

    return {
      id: resource.id,
      resources: {
        cpu: {
          units: parseResourceValue(resource.cpu.units.val),
          attributes: resource.cpu.attributes ?? EMPTY_ARRAY
        },
        gpu: {
          units: parseResourceValue(resource.gpu.units.val),
          attributes: resource.gpu.attributes ?? EMPTY_ARRAY
        },
        memory: {
          quantity: parseResourceValue(resource.memory.quantity.val),
          attributes: resource.memory.attributes ?? EMPTY_ARRAY
        },
        storage
      },
      count: unit.count
    };
  });
}

export type GroupSpecJSON = ToJSON<GroupSpec>;
