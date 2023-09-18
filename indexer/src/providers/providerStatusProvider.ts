import https from "https";
import axios from "axios";
import { Provider } from "@shared/dbSchemas/akash";
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
            akashVersion: versionResponse.data.akash.version,
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
          error: err?.message || err,
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