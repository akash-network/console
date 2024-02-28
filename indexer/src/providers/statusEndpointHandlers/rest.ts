import { Provider } from "@shared/dbSchemas/akash";
import axios from "axios";
import https from "https";
import { ProviderStatusInfo } from "./types";

export async function fetchProviderStatusFromREST(provider: Provider, timeout: number): Promise<ProviderStatusInfo> {
  const httpsAgent = new https.Agent({
    rejectUnauthorized: false
  });

  const response = await axios.get(provider.hostUri + "/status", {
    httpsAgent: httpsAgent,
    timeout: timeout
  });

  if (response.status !== 200) throw "Invalid response status: " + response.status;

  const activeResources = sumResources(response.data.cluster.inventory.active);
  const pendingResources = sumResources(response.data.cluster.inventory.pending);
  const availableResources = sumResources(response.data.cluster.inventory.available);

  return {
    resources: {
      deploymentCount: response.data.manifest.deployments,
      leaseCount: response.data.cluster.leases,
      activeCPU: activeResources.cpu,
      activeGPU: activeResources.gpu,
      activeMemory: activeResources.memory,
      activeStorage: activeResources.storage,
      pendingCPU: pendingResources.cpu,
      pendingGPU: pendingResources.gpu,
      pendingMemory: pendingResources.memory,
      pendingStorage: pendingResources.storage,
      availableCPU: availableResources.cpu,
      availableGPU: availableResources.gpu,
      availableMemory: availableResources.memory,
      availableStorage: availableResources.storage
    },
    nodes: []
  };
}

function sumResources(resources) {
  const resourcesArr = resources?.nodes || resources || [];

  return resourcesArr
    .map((x) => ({
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

function getStorageFromResource(resource) {
  return Object.keys(resource).includes("storage_ephemeral") ? resource.storage_ephemeral : resource.storage;
}

function getUnitValue(resource) {
  return typeof resource === "number" ? resource : parseInt(resource.units.val);
}

function getByteValue(val) {
  return typeof val === "number" ? val : parseInt(val.size.val);
}
