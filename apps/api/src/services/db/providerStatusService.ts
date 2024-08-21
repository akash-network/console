import { Provider, ProviderAttribute, ProviderAttributeSignature, ProviderSnapshotNode, ProviderSnapshotNodeGPU } from "@akashnetwork/database/dbSchemas/akash";
import { ProviderSnapshot } from "@akashnetwork/database/dbSchemas/akash/providerSnapshot";
import { add, sub } from "date-fns";
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

  const filteredProviders = providers.filter((value, index, self) => self.map(x => x.hostUri).indexOf(value.hostUri) === index);

  const stats = {
    activeProviderCount: filteredProviders.length,
    activeCPU: filteredProviders.map(x => x.lastSuccessfulSnapshot.activeCPU).reduce((a, b) => a + b, 0),
    activeGPU: filteredProviders.map(x => x.lastSuccessfulSnapshot.activeGPU).reduce((a, b) => a + b, 0),
    activeMemory: filteredProviders.map(x => x.lastSuccessfulSnapshot.activeMemory).reduce((a, b) => a + b, 0),
    activeStorage: filteredProviders
      .map(x => x.lastSuccessfulSnapshot.activeEphemeralStorage + x.lastSuccessfulSnapshot.activePersistentStorage)
      .reduce((a, b) => a + b, 0),
    pendingCPU: filteredProviders.map(x => x.lastSuccessfulSnapshot.pendingCPU).reduce((a, b) => a + b, 0),
    pendingGPU: filteredProviders.map(x => x.lastSuccessfulSnapshot.pendingGPU).reduce((a, b) => a + b, 0),
    pendingMemory: filteredProviders.map(x => x.lastSuccessfulSnapshot.pendingMemory).reduce((a, b) => a + b, 0),
    pendingStorage: filteredProviders
      .map(x => x.lastSuccessfulSnapshot.pendingEphemeralStorage + x.lastSuccessfulSnapshot.pendingPersistentStorage)
      .reduce((a, b) => a + b, 0),
    availableCPU: filteredProviders.map(x => x.lastSuccessfulSnapshot.availableCPU).reduce((a, b) => a + b, 0),
    availableGPU: filteredProviders.map(x => x.lastSuccessfulSnapshot.availableGPU).reduce((a, b) => a + b, 0),
    availableMemory: filteredProviders.map(x => x.lastSuccessfulSnapshot.availableMemory).reduce((a, b) => a + b, 0),
    availableStorage: filteredProviders
      .map(x => x.lastSuccessfulSnapshot.availableEphemeralStorage + x.lastSuccessfulSnapshot.availablePersistentStorage)
      .reduce((a, b) => a + b, 0)
  };

  return {
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
  const providerAttributeSchemaQuery = getProviderAttributesSchema();
  const auditorsQuery = getAuditors();

  const [auditors, providerAttributeSchema] = await Promise.all([auditorsQuery, providerAttributeSchemaQuery]);

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

  const providerAttributeSchemaQuery = getProviderAttributesSchema();
  const auditorsQuery = getAuditors();

  const [auditors, providerAttributeSchema] = await Promise.all([auditorsQuery, providerAttributeSchemaQuery]);

  return {
    ...mapProviderToList(provider, providerAttributeSchema, auditors, lastSuccessfulSnapshot),
    uptime: uptimeSnapshots.map(ps => ({
      id: ps.id,
      isOnline: ps.isOnline,
      checkDate: ps.checkDate
    }))
  };
};
