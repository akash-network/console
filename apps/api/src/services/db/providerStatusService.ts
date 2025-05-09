import { Provider } from "@akashnetwork/database/dbSchemas/akash";
import { ProviderSnapshot } from "@akashnetwork/database/dbSchemas/akash/providerSnapshot";
import { sub } from "date-fns";
import uniqBy from "lodash/uniqBy";
import { Op } from "sequelize";

import { toUTC } from "@src/utils";
import { env } from "@src/utils/env";

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

  stats.activeStorage = stats.activeEphemeralStorage + stats.activePersistentStorage;
  stats.pendingStorage = stats.pendingEphemeralStorage + stats.pendingPersistentStorage;
  stats.availableStorage = stats.availableEphemeralStorage + stats.availablePersistentStorage;

  return {
    activeProviderCount: filteredProviders.length,
    ...stats,
    totalCPU: stats.activeCPU + stats.pendingCPU + stats.availableCPU,
    totalGPU: stats.activeGPU + stats.pendingGPU + stats.availableGPU,
    totalMemory: stats.activeMemory + stats.pendingMemory + stats.availableMemory,
    totalStorage: stats.activeStorage + stats.pendingStorage + stats.availableStorage
  };
}
