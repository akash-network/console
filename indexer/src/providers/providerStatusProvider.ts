import https from "https";
import axios from "axios";
import { Provider, ProviderAttribute, ProviderAttributeSignature } from "@shared/dbSchemas/akash";
import { asyncify, eachLimit } from "async";
import { ProviderSnapshot } from "@src/../../shared/dbSchemas/akash/providerSnapshot";
import { toUTC } from "@src/shared/utils/date";

const ConcurrentStatusCall = 10;
const StatusCallTimeout = 30_000; // 30 seconds

export async function syncProvidersInfo() {
  let providers = await Provider.findAll({
    where: {
      deletedHeight: null
    },
    order: [["isOnline", "DESC"]]
  });

  const httpsAgent = new https.Agent({
    rejectUnauthorized: false
  });

  let doneCount = 0;
  await eachLimit(
    providers,
    ConcurrentStatusCall,
    asyncify(async (provider: Provider) => {
      try {
        const response = await axios.get(provider.hostUri + "/status", {
          httpsAgent: httpsAgent,
          timeout: StatusCallTimeout
        });

        if (response.status !== 200) throw "Invalid response status: " + response.status;

        const versionResponse = await axios.get(provider.hostUri + "/version", {
          httpsAgent: httpsAgent,
          timeout: StatusCallTimeout
        });

        const activeResources = sumResources(response.data.cluster.inventory.active);
        const pendingResources = sumResources(response.data.cluster.inventory.pending);
        const availableResources = sumResources(response.data.cluster.inventory.available);
        const checkDate = toUTC(new Date());

        await Provider.update(
          {
            isOnline: true,
            error: null,
            lastCheckDate: checkDate,
            cosmosSdkVersion: versionResponse.data.akash.cosmosSdkVersion,
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
          {
            where: { owner: provider.owner }
          }
        );

        await ProviderSnapshot.create({
          owner: provider.owner,
          isOnline: true,
          checkDate: checkDate,
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
        });
      } catch (err) {
        const checkDate = new Date();
        await Provider.update(
          {
            isOnline: false,
            lastCheckDate: checkDate,
            error: err?.message || err,
            akashVersion: null,
            cosmosSdkVersion: null,
            deploymentCount: null,
            leaseCount: null,
            activeCPU: null,
            activeGPU: null,
            activeMemory: null,
            activeStorage: null,
            pendingCPU: null,
            pendingGPU: null,
            pendingMemory: null,
            pendingStorage: null,
            availableCPU: null,
            availableGPU: null,
            availableMemory: null,
            availableStorage: null
          },
          {
            where: { owner: provider.owner }
          }
        );

        await ProviderSnapshot.create({
          owner: provider.owner,
          isOnline: false,
          checkDate: checkDate
        });
      } finally {
        doneCount++;
        console.log("Fetched provider info: " + doneCount + " / " + providers.length);
      }
    })
  );

  console.log("Finished refreshing provider infos");
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

export async function getNetworkCapacity() {
  const providers = await Provider.findAll({
    where: {
      isOnline: true,
      deletedHeight: null
    }
  });

  const stats = {
    activeProviderCount: providers.length,
    activeCPU: providers.map((x) => x.activeCPU).reduce((a, b) => a + b, 0),
    activeGPU: providers.map((x) => x.activeGPU).reduce((a, b) => a + b, 0),
    activeMemory: providers.map((x) => x.activeMemory).reduce((a, b) => a + b, 0),
    activeStorage: providers.map((x) => x.activeStorage).reduce((a, b) => a + b, 0),
    pendingCPU: providers.map((x) => x.pendingCPU).reduce((a, b) => a + b, 0),
    pendingGPU: providers.map((x) => x.pendingGPU).reduce((a, b) => a + b, 0),
    pendingMemory: providers.map((x) => x.pendingMemory).reduce((a, b) => a + b, 0),
    pendingStorage: providers.map((x) => x.pendingStorage).reduce((a, b) => a + b, 0),
    availableCPU: providers.map((x) => x.availableCPU).reduce((a, b) => a + b, 0),
    availableGPU: providers.map((x) => x.availableGPU).reduce((a, b) => a + b, 0),
    availableMemory: providers.map((x) => x.availableMemory).reduce((a, b) => a + b, 0),
    availableStorage: providers.map((x) => x.availableStorage).reduce((a, b) => a + b, 0)
  };

  return {
    ...stats,
    totalCPU: stats.activeCPU + stats.pendingCPU + stats.availableCPU,
    totalGPU: stats.activeGPU + stats.pendingGPU + stats.availableGPU,
    totalMemory: stats.activeMemory + stats.pendingMemory + stats.availableMemory,
    totalStorage: stats.activeStorage + stats.pendingStorage + stats.availableStorage
  };
}

export async function getProviders() {
  const providers = await Provider.findAll({
    where: {
      isOnline: true,
      deletedHeight: null
    },
    include: [
      {
        model: ProviderAttribute
      },
      {
        model: ProviderAttributeSignature
      }
    ]
  });

  return providers.map((x) => ({
    owner: x.owner,
    hostUri: x.hostUri,
    createdHeight: x.createdHeight,
    email: x.email,
    website: x.website,
    lastCheckDate: x.lastCheckDate,
    deploymentCount: x.deploymentCount,
    leaseCount: x.leaseCount,
    attributes: x.providerAttributes.map((attr) => ({
      key: attr.key,
      value: attr.value,
      auditedBy: x.providerAttributeSignatures.filter((pas) => pas.key === attr.key && pas.value === attr.value).map((pas) => pas.auditor)
    })),
    activeStats: {
      cpu: x.activeCPU,
      gpu: x.activeGPU,
      memory: x.activeMemory,
      storage: x.activeStorage
    },
    pendingStats: {
      cpu: x.pendingCPU,
      gpu: x.pendingGPU,
      memory: x.pendingMemory,
      storage: x.pendingStorage
    },
    availableStats: {
      cpu: x.availableCPU,
      gpu: x.availableGPU,
      memory: x.availableMemory,
      storage: x.availableStorage
    }
  }));
}
