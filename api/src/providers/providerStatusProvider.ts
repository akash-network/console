import { Provider, ProviderAttribute, ProviderAttributeSignature } from "@shared/dbSchemas/akash";
import { ProviderSnapshot } from "@shared/dbSchemas/akash/providerSnapshot";
import { toUTC } from "@src/utils/date";
import { add } from "date-fns";
import { Op } from "sequelize";
import semver from "semver";
import { getProviderAttributesSchema } from "./providerAttributesProvider";
import { mapProviderToList } from "@src/utils/map/provider";

export async function getNetworkCapacity() {
  const providers = await Provider.findAll({
    where: {
      isOnline: true,
      deletedHeight: null
    }
  });
  const filteredProviders = providers.filter((value, index, self) => self.map((x) => x.hostUri).indexOf(value.hostUri) === index);

  const stats = {
    activeProviderCount: filteredProviders.length,
    activeCPU: filteredProviders.map((x) => x.activeCPU).reduce((a, b) => a + b, 0),
    activeGPU: filteredProviders.map((x) => x.activeGPU).reduce((a, b) => a + b, 0),
    activeMemory: filteredProviders.map((x) => x.activeMemory).reduce((a, b) => a + b, 0),
    activeStorage: filteredProviders.map((x) => x.activeStorage).reduce((a, b) => a + b, 0),
    pendingCPU: filteredProviders.map((x) => x.pendingCPU).reduce((a, b) => a + b, 0),
    pendingGPU: filteredProviders.map((x) => x.pendingGPU).reduce((a, b) => a + b, 0),
    pendingMemory: filteredProviders.map((x) => x.pendingMemory).reduce((a, b) => a + b, 0),
    pendingStorage: filteredProviders.map((x) => x.pendingStorage).reduce((a, b) => a + b, 0),
    availableCPU: filteredProviders.map((x) => x.availableCPU).reduce((a, b) => a + b, 0),
    availableGPU: filteredProviders.map((x) => x.availableGPU).reduce((a, b) => a + b, 0),
    availableMemory: filteredProviders.map((x) => x.availableMemory).reduce((a, b) => a + b, 0),
    availableStorage: filteredProviders.map((x) => x.availableStorage).reduce((a, b) => a + b, 0)
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
    const name = x.isOnline ? new URL(x.hostUri).hostname : null;

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
      uptime7d: x.uptime7d,
      uptime: x.providerSnapshots
        .filter((ps) => ps.checkDate > add(nowUtc, { days: -1 }))
        .map((ps) => ({
          id: ps.id,
          isOnline: ps.isOnline,
          checkDate: ps.checkDate
        })),
      isValidVersion,
      isOnline: x.isOnline
    };
  });
}

export const getProviderList = async () => {
  const providers = await Provider.findAll({
    where: {
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
  const providerAttributeSchema = await getProviderAttributesSchema();

  return providers.map((x) => mapProviderToList(x, providerAttributeSchema));
};
