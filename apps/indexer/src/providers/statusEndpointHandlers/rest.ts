import type { Provider } from "@akashnetwork/database/dbSchemas/akash";

import { fetchAllowingSelfSignedCerts } from "@src/shared/utils/fetch";
import type { ProviderStatusInfo } from "./types";

export async function fetchProviderStatusFromREST(provider: Provider, timeout: number): Promise<ProviderStatusInfo> {
  const response = await fetchAllowingSelfSignedCerts(provider.hostUri + "/status", {
    signal: AbortSignal.timeout(timeout)
  });

  if (response.status !== 200) throw "Invalid response status: " + response.status;

  const data = (await response.json()) as RestStatusResponse;
  const activeResources = sumResources(data.cluster.inventory.active);
  const pendingResources = sumResources(data.cluster.inventory.pending);
  const availableResources = sumResources(data.cluster.inventory.available);

  return {
    resources: {
      deploymentCount: data.manifest.deployments,
      leaseCount: data.cluster.leases,
      activeCPU: activeResources.cpu,
      activeGPU: activeResources.gpu,
      activeMemory: activeResources.memory,
      activeEphemeralStorage: activeResources.storage,
      activePersistentStorage: 0,
      pendingCPU: pendingResources.cpu,
      pendingGPU: pendingResources.gpu,
      pendingMemory: pendingResources.memory,
      pendingEphemeralStorage: pendingResources.storage,
      pendingPersistentStorage: 0,
      availableCPU: availableResources.cpu,
      availableGPU: availableResources.gpu,
      availableMemory: availableResources.memory,
      availableEphemeralStorage: availableResources.storage,
      availablePersistentStorage: 0
    },
    nodes: [],
    storage: []
  };
}

type RestUnitValue = number | { units: { val: string } };
type RestSizeValue = number | { size: { val: string } };

interface RestNodeResource {
  cpu: RestUnitValue;
  gpu?: RestUnitValue;
  memory: RestSizeValue;
  storage_ephemeral?: RestSizeValue;
  storage?: RestSizeValue;
}

type RestInventory = RestNodeResource[] | { nodes?: RestNodeResource[] } | null | undefined;

interface RestStatusResponse {
  cluster: {
    leases: number;
    inventory: {
      active: RestInventory;
      pending: RestInventory;
      available: RestInventory;
    };
  };
  manifest: {
    deployments: number;
  };
}

function sumResources(resources: RestInventory) {
  const resourcesArr: RestNodeResource[] = Array.isArray(resources) ? resources : resources?.nodes ?? [];

  return resourcesArr
    .map(x => ({
      cpu: getUnitValue(x.cpu),
      gpu: x.gpu ? getUnitValue(x.gpu) : 0,
      memory: getByteValue(x.memory),
      storage: getByteValue(getStorageFromResource(x))
    }))
    .reduce(
      (prev, next) => ({
        cpu: prev.cpu + next.cpu,
        gpu: prev.gpu + next.gpu,
        memory: prev.memory + next.memory,
        storage: prev.storage + next.storage
      }),
      {
        cpu: 0,
        gpu: 0,
        memory: 0,
        storage: 0
      }
    );
}

function getStorageFromResource(resource: RestNodeResource): RestSizeValue {
  return Object.keys(resource).includes("storage_ephemeral") ? resource.storage_ephemeral! : resource.storage!;
}

function getUnitValue(resource: RestUnitValue) {
  return typeof resource === "number" ? resource : parseInt(resource.units.val);
}

function getByteValue(val: RestSizeValue) {
  return typeof val === "number" ? val : parseInt(val.size.val);
}
