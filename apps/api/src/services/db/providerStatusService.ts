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
      all.activeCPU += provider.lastSuccessfulSnapshot.activeCPU || 0;
      all.pendingCPU += provider.lastSuccessfulSnapshot.pendingCPU || 0;
      all.availableCPU += provider.lastSuccessfulSnapshot.availableCPU || 0;

      all.activeGPU += provider.lastSuccessfulSnapshot.activeGPU || 0;
      all.pendingGPU += provider.lastSuccessfulSnapshot.pendingGPU || 0;
      all.availableGPU += provider.lastSuccessfulSnapshot.availableGPU || 0;

      all.activeMemory += provider.lastSuccessfulSnapshot.activeMemory || 0;
      all.pendingMemory += provider.lastSuccessfulSnapshot.pendingMemory || 0;
      all.availableMemory += provider.lastSuccessfulSnapshot.availableMemory || 0;

      all.activeEphemeralStorage += provider.lastSuccessfulSnapshot.activeEphemeralStorage || 0;
      all.pendingEphemeralStorage += provider.lastSuccessfulSnapshot.pendingEphemeralStorage || 0;
      all.availableEphemeralStorage += provider.lastSuccessfulSnapshot.availableEphemeralStorage || 0;

      all.activePersistentStorage += provider.lastSuccessfulSnapshot.activePersistentStorage || 0;
      all.pendingPersistentStorage += provider.lastSuccessfulSnapshot.pendingPersistentStorage || 0;
      all.availablePersistentStorage += provider.lastSuccessfulSnapshot.availablePersistentStorage || 0;

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
