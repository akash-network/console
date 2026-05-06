import {
  Provider,
  ProviderAttributeSignature,
  ProviderSnapshot,
  ProviderSnapshotNode,
  ProviderSnapshotNodeCPU,
  ProviderSnapshotNodeGPU,
  ProviderSnapshotStorage
} from "@akashnetwork/database/dbSchemas/akash";
import { Op } from "sequelize";
import { singleton } from "tsyringe";

import { ProviderWithSnapshot } from "@src/bid-screening/types/provider";

@singleton()
export class BidScreeningRepository {
  async getOnlineProvidersWithSnapshots(): Promise<ProviderWithSnapshot[]> {
    const providers = await Provider.findAll({
      attributes: ["owner", "hostUri", "ipRegion", "uptime7d"],
      where: {
        isOnline: true,
        deletedHeight: null,
        lastSuccessfulSnapshotId: { [Op.ne]: null }
      },
      include: [
        {
          model: ProviderSnapshot,
          as: "lastSuccessfulSnapshot",
          required: true,
          include: [
            {
              model: ProviderSnapshotNode,
              required: false,
              include: [
                { model: ProviderSnapshotNodeGPU, required: false },
                { model: ProviderSnapshotNodeCPU, required: false }
              ]
            },
            {
              model: ProviderSnapshotStorage,
              required: false
            }
          ]
        }
      ]
    });

    return providers;
  }

  async getAuditedProviderAddresses(auditorAddresses: string[]): Promise<Set<string>> {
    const signatures = await ProviderAttributeSignature.findAll({
      attributes: ["provider"],
      where: {
        auditor: { [Op.in]: auditorAddresses }
      },
      raw: true
    });

    return new Set(signatures.map(s => s.provider));
  }
}
