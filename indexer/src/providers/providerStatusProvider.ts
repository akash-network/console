import https from "https";
import axios from "axios";
import semver from "semver";
import { Provider, ProviderSnapshotNode, ProviderSnapshotNodeCPU, ProviderSnapshotNodeGPU } from "@shared/dbSchemas/akash";
import { asyncify, eachLimit } from "async";
import { ProviderSnapshot } from "@src/../../shared/dbSchemas/akash/providerSnapshot";
import { sequelize } from "@src/db/dbConnection";
import { toUTC } from "@src/shared/utils/date";
import { ProviderStatusInfo, ProviderVersionEndpointResponseType } from "./statusEndpointHandlers/types";
import { add, differenceInDays, differenceInHours, differenceInMinutes, isSameDay } from "date-fns";
import { fetchProviderStatusFromGRPC } from "./statusEndpointHandlers/grpc";
import { fetchProviderStatusFromREST } from "./statusEndpointHandlers/rest";
import { Op } from "sequelize";

const ConcurrentStatusCall = 10;
const StatusCallTimeout = 10_000; // 10 seconds
const UptimeCheckIntervalSeconds = 15 * 60; // 15 minutes

export async function syncProvidersInfo() {
  let providers = await Provider.findAll({
    where: {
      deletedHeight: null,
      nextCheckDate: { [Op.lte]: toUTC(new Date()) }
    },
    include: [
      { model: ProviderSnapshot, as: "lastSnapshot" },
      { model: ProviderSnapshot, as: "downtimeFirstSnapshot" }
    ],
    order: [["nextCheckDate", "ASC"]]
  });

  const httpsAgent = new https.Agent({
    rejectUnauthorized: false
  });

  let doneCount = 0;
  await eachLimit(
    providers,
    ConcurrentStatusCall,
    asyncify(async (provider: Provider) => {
      let providerStatus: ProviderStatusInfo | null = null;
      let errorMessage: string | null = null;
      let akashVersion: string | null = null;
      let cosmosVersion: string | null = null;

      try {
        const versionResponse = await axios.get<ProviderVersionEndpointResponseType>(provider.hostUri + "/version", {
          httpsAgent: httpsAgent,
          timeout: StatusCallTimeout
        });

        akashVersion = semver.valid(versionResponse.data.akash.version);
        cosmosVersion = semver.valid(
          "cosmosSdkVersion" in versionResponse.data.akash ? versionResponse.data.akash.cosmosSdkVersion : versionResponse.data.akash.cosmos_sdk_version
        );

        if (akashVersion && semver.gte(akashVersion, "0.5.0-0")) {
          providerStatus = await fetchProviderStatusFromGRPC(provider, StatusCallTimeout);
        } else {
          providerStatus = await fetchProviderStatusFromREST(provider, StatusCallTimeout);
        }
      } catch (err) {
        errorMessage = err?.message?.toString() ?? err?.toString();
      }

      await saveProviderStatus(provider, providerStatus, akashVersion, cosmosVersion, errorMessage);

      doneCount++;
      console.log("Fetched provider info: " + doneCount + " / " + providers.length);
    })
  );
}

async function saveProviderStatus(
  provider: Provider,
  providerStatus: ProviderStatusInfo | null,
  akashVersion: string | null,
  cosmosVersion: string | null,
  error: string | null
) {
  await sequelize.transaction(async (t) => {
    const checkDate = toUTC(new Date());

    const createdSnapshot = await ProviderSnapshot.create(
      {
        owner: provider.owner,
        isOnline: !!providerStatus,
        isLastOfDay: true,
        isLastSuccessOfDay: !!providerStatus,
        error: error,
        checkDate: checkDate,
        deploymentCount: providerStatus?.resources.deploymentCount,
        leaseCount: providerStatus?.resources.leaseCount,
        activeCPU: providerStatus?.resources.activeCPU,
        activeGPU: providerStatus?.resources.activeGPU,
        activeMemory: providerStatus?.resources.activeMemory,
        activeStorage: providerStatus?.resources.activeStorage,
        pendingCPU: providerStatus?.resources.pendingCPU,
        pendingGPU: providerStatus?.resources.pendingGPU,
        pendingMemory: providerStatus?.resources.pendingMemory,
        pendingStorage: providerStatus?.resources.pendingStorage,
        availableCPU: providerStatus?.resources.availableCPU,
        availableGPU: providerStatus?.resources.availableGPU,
        availableMemory: providerStatus?.resources.availableMemory,
        availableStorage: providerStatus?.resources.availableStorage
      },
      { transaction: t }
    );

    if (provider.lastSnapshot && isSameDay(provider.lastSnapshot.checkDate, checkDate)) {
      await ProviderSnapshot.update(
        {
          isLastOfDay: false,
          isLastSuccessOfDay: false
        },
        {
          where: { id: provider.lastSnapshot.id },
          transaction: t
        }
      );

      if (providerStatus && provider.lastSuccessfulSnapshotId && provider.lastSuccessfulSnapshotId !== provider.lastSnapshotId) {
        await ProviderSnapshot.update(
          {
            isLastSuccessOfDay: false
          },
          {
            where: { id: provider.lastSuccessfulSnapshotId },
            transaction: t
          }
        );
      }
    }

    await Provider.update(
      {
        lastSnapshotId: createdSnapshot.id,
        lastSuccessfulSnapshotId: createdSnapshot.isOnline ? createdSnapshot.id : provider.lastSuccessfulSnapshotId,
        downtimeFirstSnapshotId: createdSnapshot.isOnline ? null : provider.downtimeFirstSnapshotId ?? createdSnapshot.id,
        isOnline: !!providerStatus,
        error: error,
        lastCheckDate: checkDate,
        failedCheckCount: providerStatus ? 0 : provider.failedCheckCount + 1,
        nextCheckDate: getNextCheckDate(!!providerStatus, checkDate, provider.downtimeFirstSnapshot?.checkDate ?? createdSnapshot.checkDate),
        cosmosSdkVersion: cosmosVersion,
        akashVersion: akashVersion,
        deploymentCount: providerStatus?.resources.deploymentCount,
        leaseCount: providerStatus?.resources.leaseCount,
        activeCPU: providerStatus?.resources.activeCPU,
        activeGPU: providerStatus?.resources.activeGPU,
        activeMemory: providerStatus?.resources.activeMemory,
        activeStorage: providerStatus?.resources.activeStorage,
        pendingCPU: providerStatus?.resources.pendingCPU,
        pendingGPU: providerStatus?.resources.pendingGPU,
        pendingMemory: providerStatus?.resources.pendingMemory,
        pendingStorage: providerStatus?.resources.pendingStorage,
        availableCPU: providerStatus?.resources.availableCPU,
        availableGPU: providerStatus?.resources.availableGPU,
        availableMemory: providerStatus?.resources.availableMemory,
        availableStorage: providerStatus?.resources.availableStorage
      },
      {
        where: { owner: provider.owner },
        transaction: t
      }
    );

    if (providerStatus) {
      for (const node of providerStatus.nodes) {
        const providerSnapshotNode = await ProviderSnapshotNode.create(
          {
            snapshotId: createdSnapshot.id,
            name: node.name,
            cpuAllocatable: node.cpuAllocatable,
            cpuAllocated: node.cpuAllocated,
            memoryAllocatable: node.memoryAllocatable,
            memoryAllocated: node.memoryAllocated,
            ephemeralStorageAllocatable: node.ephemeralStorageAllocatable,
            ephemeralStorageAllocated: node.ephemeralStorageAllocated,
            capabilitiesStorageHDD: node.capabilitiesStorageHDD,
            capabilitiesStorageSSD: node.capabilitiesStorageSSD,
            capabilitiesStorageNVME: node.capabilitiesStorageNVME,
            gpuAllocatable: node.gpuAllocatable,
            gpuAllocated: node.gpuAllocated
          },
          { transaction: t }
        );

        await ProviderSnapshotNodeCPU.bulkCreate(
          node.cpus.map((cpuInfo) => ({
            snapshotNodeId: providerSnapshotNode.id,
            vendor: cpuInfo.vendor,
            model: cpuInfo.model,
            vcores: cpuInfo.vcores
          })),
          { transaction: t }
        );

        await ProviderSnapshotNodeGPU.bulkCreate(
          node.gpus.map((gpuInfo) => ({
            snapshotNodeId: providerSnapshotNode.id,
            vendor: gpuInfo.vendor,
            name: gpuInfo.name,
            modelId: gpuInfo.modelId,
            interface: gpuInfo.interface,
            memorySize: gpuInfo.memorySize
          })),
          { transaction: t }
        );
      }
    }
  });
}

function getNextCheckDate(successful: boolean, checkDate: Date, downtimeStartDate: Date) {
  if (successful) {
    return add(checkDate, { seconds: UptimeCheckIntervalSeconds });
  }

  if (differenceInMinutes(checkDate, downtimeStartDate) < 15) {
    return add(checkDate, { minutes: 1 });
  } else if (differenceInHours(checkDate, downtimeStartDate) < 1) {
    return add(checkDate, { minutes: 5 });
  } else if (differenceInHours(checkDate, downtimeStartDate) < 6) {
    return add(checkDate, { minutes: 15 });
  } else if (differenceInHours(checkDate, downtimeStartDate) < 24) {
    return add(checkDate, { minutes: 30 });
  } else if (differenceInDays(checkDate, downtimeStartDate) < 7) {
    return add(checkDate, { hours: 1 });
  } else {
    return add(checkDate, { hours: 24 });
  }
}
