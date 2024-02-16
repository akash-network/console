import { Provider, ProviderSnapshot } from "@shared/dbSchemas/akash";
import { sequelize } from "@src/db/dbConnection";
import { toUTC } from "@src/shared/utils/date";
import axios from "axios";
import { isSameDay } from "date-fns";
import https from "https";

export async function fetchAndSaveProviderStats(provider: Provider, cosmosSdkVersion: string, version: string, timeout: number) {
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
  const checkDate = toUTC(new Date());

  await sequelize.transaction(async (t) => {
    const createdSnapshot = await ProviderSnapshot.create(
      {
        owner: provider.owner,
        isOnline: true,
        isLastOfDay: true,
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
      },
      { transaction: t }
    );

    if (provider.lastSnapshot && isSameDay(provider.lastSnapshot.checkDate, checkDate)) {
      await ProviderSnapshot.update(
        {
          isLastOfDay: false
        },
        {
          where: { id: provider.lastSnapshot.id },
          transaction: t
        }
      );
    }

    await Provider.update(
      {
        lastSnapshotId: createdSnapshot.id,
        isOnline: true,
        error: null,
        lastCheckDate: checkDate,
        cosmosSdkVersion: cosmosSdkVersion,
        akashVersion: version,
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
        where: { owner: provider.owner },
        transaction: t
      }
    );
  });
}

function sumResources(resources) {
  const resourcesArr = resources?.nodes || resources || [];
  console.log(resourcesArr.find((x) => typeof x.cpu === "undefined" || typeof x.gpu === "undefined"));
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
