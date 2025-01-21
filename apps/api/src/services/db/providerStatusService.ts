import { Provider, ProviderAttribute, ProviderAttributeSignature, ProviderSnapshotNode, ProviderSnapshotNodeGPU } from "@akashnetwork/database/dbSchemas/akash";
import { ProviderSnapshot } from "@akashnetwork/database/dbSchemas/akash/providerSnapshot";
import { add, sub } from "date-fns";
import uniqBy from "lodash/uniqBy";
import { Op } from "sequelize";

import { ProviderDetail } from "@src/types/provider";
import { toUTC } from "@src/utils";
import { env } from "@src/utils/env";
import { mapProviderToList } from "@src/utils/map/provider";
import { getAuditors, getProviderAttributesSchema } from "../external/githubService";

export async function getNetworkCapacity() {
  const providers = await Provider.findAll({
    where: {
      deletedHeight: null
    },
    include: [
      {
        required: true,
        model: ProviderSnapshot,
        as: "lastSuccessfulSnapshot",
        where: { checkDate: { [Op.gte]: toUTC(sub(new Date(), { minutes: env.PROVIDER_UPTIME_GRACE_PERIOD_MINUTES })) } }
      }
    ]
  });

  const filteredProviders = uniqBy(providers, provider => provider.hostUri);
  const stats = filteredProviders.reduce(
    (all, provider) => {
      all.activeCPU += provider.lastSuccessfulSnapshot.activeCPU;
      all.pendingCPU += provider.lastSuccessfulSnapshot.pendingCPU;
      all.availableCPU += provider.lastSuccessfulSnapshot.availableCPU;

      all.activeGPU += provider.lastSuccessfulSnapshot.activeGPU;
      all.pendingGPU += provider.lastSuccessfulSnapshot.pendingGPU;
      all.availableGPU += provider.lastSuccessfulSnapshot.availableGPU;

      all.activeMemory += provider.lastSuccessfulSnapshot.activeMemory;
      all.pendingMemory += provider.lastSuccessfulSnapshot.pendingMemory;
      all.availableMemory += provider.lastSuccessfulSnapshot.availableMemory;

      all.activeEphemeralStorage += provider.lastSuccessfulSnapshot.activeEphemeralStorage;
      all.pendingEphemeralStorage += provider.lastSuccessfulSnapshot.pendingEphemeralStorage;
      all.availableEphemeralStorage += provider.lastSuccessfulSnapshot.availableEphemeralStorage;

      all.activePersistentStorage += provider.lastSuccessfulSnapshot.activePersistentStorage;
      all.pendingPersistentStorage += provider.lastSuccessfulSnapshot.pendingPersistentStorage;
      all.availablePersistentStorage += provider.lastSuccessfulSnapshot.availablePersistentStorage;

      return all;
    },
    {
      activeCPU: 0,
      pendingCPU: 0,
      availableCPU: 0,
      activeGPU: 0,
      pendingGPU: 0,
      availableGPU: 0,
      activeMemory: 0,
      pendingMemory: 0,
      availableMemory: 0,
      activeStorage: 0,
      pendingStorage: 0,
      availableStorage: 0,
      activeEphemeralStorage: 0,
      pendingEphemeralStorage: 0,
      availableEphemeralStorage: 0,
      activePersistentStorage: 0,
      pendingPersistentStorage: 0,
      availablePersistentStorage: 0
    }
  );

  return {
    activeProviderCount: filteredProviders.length,
    activeStorage: stats.activeEphemeralStorage + stats.activePersistentStorage,
    pendingStorage: stats.pendingEphemeralStorage + stats.pendingPersistentStorage,
    availableStorage: stats.availableEphemeralStorage + stats.availablePersistentStorage,
    ...stats,
    totalCPU: stats.activeCPU + stats.pendingCPU + stats.availableCPU,
    totalGPU: stats.activeGPU + stats.pendingGPU + stats.availableGPU,
    totalMemory: stats.activeMemory + stats.pendingMemory + stats.availableMemory,
    totalStorage: stats.activeStorage + stats.pendingStorage + stats.availableStorage
  };
}

export const getProviderList = async () => {
  const providersWithAttributesAndAuditors = await Provider.findAll({
    where: {
      deletedHeight: null
    },
    order: [["createdHeight", "ASC"]],
    include: [
      {
        model: ProviderAttribute
      },
      {
        model: ProviderAttributeSignature
      }
    ]
  });

  const providerWithNodes = await Provider.findAll({
    attributes: ["owner"],
    where: {
      deletedHeight: null
    },
    include: [
      {
        model: ProviderSnapshot,
        required: true,
        as: "lastSuccessfulSnapshot",
        include: [
          {
            model: ProviderSnapshotNode,
            attributes: ["id"],
            required: false,
            include: [{ model: ProviderSnapshotNodeGPU, required: false }]
          }
        ]
      }
    ]
  });

  const distinctProviders = providersWithAttributesAndAuditors.filter((value, index, self) => self.map(x => x.hostUri).lastIndexOf(value.hostUri) === index);

  const [auditors, providerAttributeSchema] = await Promise.all([getAuditors(), getProviderAttributesSchema()]);

  return distinctProviders.map(x => {
    const lastSuccessfulSnapshot = providerWithNodes.find(p => p.owner === x.owner)?.lastSuccessfulSnapshot;
    return mapProviderToList(x, providerAttributeSchema, auditors, lastSuccessfulSnapshot);
  });
};

export const getProviderDetail = async (address: string): Promise<ProviderDetail> => {
  const nowUtc = toUTC(new Date());
  const provider = await Provider.findOne({
    where: {
      deletedHeight: null,
      owner: address
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

  if (!provider) return null;

  const uptimeSnapshots = await ProviderSnapshot.findAll({
    attributes: ["isOnline", "id", "checkDate"],
    where: {
      owner: provider.owner,
      checkDate: {
        [Op.gte]: add(nowUtc, { days: -1 })
      }
    }
  });

  const lastSuccessfulSnapshot = provider.lastSuccessfulSnapshotId
    ? await ProviderSnapshot.findOne({
        where: {
          id: provider.lastSuccessfulSnapshotId
        },
        order: [["checkDate", "DESC"]],
        include: [
          {
            model: ProviderSnapshotNode,
            include: [{ model: ProviderSnapshotNodeGPU }]
          }
        ]
      })
    : null;

  const [auditors, providerAttributeSchema] = await Promise.all([getAuditors(), getProviderAttributesSchema()]);

  return {
    ...mapProviderToList(provider, providerAttributeSchema, auditors, lastSuccessfulSnapshot),
    uptime: uptimeSnapshots.map(ps => ({
      id: ps.id,
      isOnline: ps.isOnline,
      checkDate: ps.checkDate
    }))
  };
};
