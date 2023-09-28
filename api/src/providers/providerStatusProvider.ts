import { Provider, ProviderAttribute, ProviderAttributeSignature } from "@shared/dbSchemas/akash";
import { ProviderSnapshot } from "@shared/dbSchemas/akash/providerSnapshot";
import { toUTC } from "@src/utils/date";
import { add } from "date-fns";
import { Op } from "sequelize";
import semver from "semver";
import { mapProviderToList } from "@src/utils/map/provider";
import { getAuditors, getProviderAttributesSchema } from "./githubProvider";
import { ProviderDetail } from "@src/types/provider";

export async function getNetworkCapacity() {
  const providers = await Provider.findAll({
    where: {
      isOnline: true,
      deletedHeight: null
    }
  });
  const filteredProviders = providers.filter((value, index, self) => self.map((x) => x.hostUri).lastIndexOf(value.hostUri) === index);

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

export const getProviderList = async () => {
  const providers = await Provider.findAll({
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
  const filteredProviders = providers.filter((value, index, self) => self.map((x) => x.hostUri).lastIndexOf(value.hostUri) === index);
  const providerAttributeSchemaQuery = getProviderAttributesSchema();
  const auditorsQuery = getAuditors();

  const [auditors, providerAttributeSchema] = await Promise.all([auditorsQuery, providerAttributeSchemaQuery]);

  return filteredProviders.map((x) => mapProviderToList(x, providerAttributeSchema, auditors));
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
      },
      {
        model: ProviderSnapshot,
        attributes: ["isOnline", "id", "checkDate"],
        required: false,
        separate: true,
        where: {
          checkDate: {
            [Op.gte]: add(nowUtc, { days: -1 })
          }
        }
      }
    ]
  });
  const providerAttributeSchemaQuery = getProviderAttributesSchema();
  const auditorsQuery = getAuditors();

  const [auditors, providerAttributeSchema] = await Promise.all([auditorsQuery, providerAttributeSchemaQuery]);

  return {
    ...mapProviderToList(provider, providerAttributeSchema, auditors),
    uptime: provider.providerSnapshots.map((ps) => ({
      id: ps.id,
      isOnline: ps.isOnline,
      checkDate: ps.checkDate
    }))
  };
};
