import { Deployment, DeploymentGroup, DeploymentGroupResource, Lease, Provider, ProviderAttribute, ProviderAttributeSignature } from "@shared/dbSchemas/akash";
import { ProviderSnapshot } from "@shared/dbSchemas/akash/providerSnapshot";
import { toUTC } from "@src/utils/date";
import { add } from "date-fns";
import { Op } from "sequelize";
import { mapProviderToList } from "@src/utils/map/provider";
import { getAuditors, getProviderAttributesSchema } from "./githubProvider";
import { ProviderDetail } from "@src/types/provider";
import { RestDeploymentInfoResponse } from "@src/types/rest";

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

export const getProviderDeployments = async (address: string, skip: number, limit: number, state?: string): Promise<RestDeploymentInfoResponse[]> => {
  const leases = await Lease.findAll({
    where: {
      // closedHeight: null, // TODO State
      providerAddress: address
    },
    include: [
      {
        model: Deployment,
        required: true,
        include: [{ model: DeploymentGroup, required: true, include: [{ model: DeploymentGroupResource, required: true }] }]
        // where: {
        //   deletedHeight: null // TODO
        // }
      }
    ],
    order: [["createdHeight", "ASC"]],
    offset: skip,
    limit
  });

  return leases.map((lease) => ({
    deployment: {
      deployment_id: {
        owner: lease.deployment.owner,
        dseq: lease.deployment.dseq
      },
      state: lease.deployment.closedHeight ? "closed" : "active",
      version: lease.deployment.version,
      created_at: lease.deployment.createdHeight.toString()
    },
    groups: [],
    escrow_account: {
      balance: {
        denom: lease.deployment.denom,
        amount: lease.deployment.balance.toString()
      },
      transferred: {
        denom: lease.deployment.denom,
        amount: lease.deployment.withdrawnAmount.toString()
      },
      settled_at: lease.deployment.closedHeight ? lease.deployment.closedHeight.toString() : null,
      depositor: lease.deployment.deposit
    }
    // escrow_account: {
    //   id: {
    //     scope: string;
    //     xid: string;
    //   };
    //   owner: string;
    //   state: string;
    //   balance: {
    //     denom: string;
    //     amount: string;
    //   };
    //   transferred: {
    //     denom: string;
    //     amount: string;
    //   };
    //   settled_at: string;
    //   depositor: string;
    //   funds: {
    //     denom: string;
    //     amount: string;
    //   };
    // };
  })) as any;
};
