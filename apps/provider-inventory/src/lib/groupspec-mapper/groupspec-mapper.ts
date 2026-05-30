import type { GroupSpec } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";

import type { RequestedResourceUnit, RequestedStorage, ResourceAttribute, ToJSON } from "../../types/inventory.types";
import { parseGPUAttributes } from "../gpu-attribute-parser/gpu-attribute-parser";
import { parseStorageAttributes } from "../storage-attribute-parser/storage-attribute-parser";

export function mapGroupSpecToResourceUnits(request: GroupSpecJSON): RequestedResourceUnit[] {
  return request.resources.map(unit => {
    const resource = unit.resource;

    return {
      id: resource.id,
      resources: {
        cpu: {
          units: resource.cpu.units.val,
          fingerprint: getAttributeFingerprint(resource.cpu.attributes)
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
        )
      },
      count: unit.count
    };
  });
}

export function getAttributeFingerprint(attributes: ResourceAttribute[] | undefined): string | null {
  if (!attributes || attributes.length === 0) return null;
  return attributes
    .map(a => `${a.key}=${a.value}`)
    .sort()
    .join(",");
}

export type GroupSpecJSON = ToJSON<GroupSpec>;
