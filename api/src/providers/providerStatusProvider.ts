import { Provider, ProviderAttribute, ProviderAttributeSignature } from "@shared/dbSchemas/akash";
import { ProviderSnapshot } from "@shared/dbSchemas/akash/providerSnapshot";
import { toUTC } from "@src/shared/utils/date";
import { add } from "date-fns";
import { Op } from "sequelize";

const semver = require("semver");

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
  const nowUtc = toUTC(new Date());

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
      },
      {
        model: ProviderSnapshot,
        attributes: ["isOnline", "id", "checkDate"],
        required: false,
        separate: true,
        where: {
          checkDate: {
            [Op.gte]: add(nowUtc, { days: -7 })
          }
        }
      }
    ]
  });

  return providers.map((x) => {
    const isValidVersion = x.cosmosSdkVersion ? semver.gte(x.cosmosSdkVersion, "v0.45.9") : false;
    const name = new URL(x.hostUri).hostname;
    const uptime7d = x.providerSnapshots.some((ps) => ps.isOnline) ? x.providerSnapshots.filter((ps) => ps.isOnline).length / x.providerSnapshots.length : 0;

    return {
      owner: x.owner,
      name: name,
      hostUri: x.hostUri,
      createdHeight: x.createdHeight,
      email: x.email,
      website: x.website,
      lastCheckDate: x.lastCheckDate,
      deploymentCount: x.deploymentCount,
      leaseCount: x.leaseCount,
      cosmosSdkVersion: x.cosmosSdkVersion,
      akashVersion: x.akashVersion,
      ipRegion: x.ipRegion,
      ipRegionCode: x.ipRegionCode,
      ipCountry: x.ipCountry,
      ipCountryCode: x.ipCountryCode,
      ipLat: x.ipLat,
      ipLon: x.ipLon,
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
        cpu: isValidVersion ? x.pendingCPU : 0,
        gpu: isValidVersion ? x.pendingGPU : 0,
        memory: isValidVersion ? x.pendingMemory : 0,
        storage: isValidVersion ? x.pendingStorage : 0
      },
      availableStats: {
        cpu: isValidVersion ? x.availableCPU : 0,
        gpu: isValidVersion ? x.availableGPU : 0,
        memory: isValidVersion ? x.availableMemory : 0,
        storage: isValidVersion ? x.availableStorage : 0
      },
      uptime7d: uptime7d,
      uptime: x.providerSnapshots
        .filter((ps) => ps.checkDate > add(nowUtc, { days: -1 }))
        .map((ps) => ({
          id: ps.id,
          isOnline: ps.isOnline,
          checkDate: ps.checkDate
        })),
      isValidVersion
    };
  });
}
