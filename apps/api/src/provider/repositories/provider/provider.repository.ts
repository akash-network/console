import {
  Provider,
  ProviderAttribute,
  ProviderAttributeSignature,
  ProviderSnapshot,
  ProviderSnapshotNode,
  ProviderSnapshotNodeGPU
} from "@akashnetwork/database/dbSchemas/akash";
import { Op } from "sequelize";
import { singleton } from "tsyringe";

import { AUDITOR, TRIAL_ATTRIBUTE } from "@src/deployment/config/provider.config";

@singleton()
export class ProviderRepository {
  async getTrialProviders(): Promise<string[]> {
    const trialProviders = await ProviderAttributeSignature.findAll({
      attributes: ["provider"],
      where: {
        auditor: AUDITOR,
        key: TRIAL_ATTRIBUTE,
        value: "true"
      },
      raw: true
    });

    return trialProviders.map(provider => provider.provider);
  }

  async getWithAttributesAndAuditors({
    trial = false,
    addresses,
    limit,
    offset
  }: { trial?: boolean; addresses?: string[]; limit?: number; offset?: number } = {}) {
    return await Provider.findAll({
      where: {
        deletedHeight: null,
        ...(addresses && { owner: { [Op.in]: addresses } })
      },
      order: [["createdHeight", "ASC"]],
      limit,
      offset,
      include: [
        {
          model: ProviderAttribute
        },
        trial
          ? {
              model: ProviderAttributeSignature,
              required: true,
              where: {
                auditor: AUDITOR,
                key: TRIAL_ATTRIBUTE,
                value: "true"
              }
            }
          : {
              model: ProviderAttributeSignature
            }
      ]
    });
  }

  async getProviderWithNodes({ addresses, limit, offset }: { addresses?: string[]; limit?: number; offset?: number } = {}) {
    return await Provider.findAll({
      attributes: ["owner"],
      where: {
        deletedHeight: null,
        ...(addresses && { owner: { [Op.in]: addresses } })
      },
      limit,
      offset,
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
  }

  async getProviderByAddressWithAttributes(address: string) {
    return await Provider.findOne({
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
  }

  async getProvidersByAddressesWithAttributes(addresses: string[]) {
    return await Provider.findAll({
      where: {
        deletedHeight: null,
        owner: { [Op.in]: addresses }
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
  }

  async findActiveByAddress(address: string): Promise<Provider | null> {
    return await Provider.findOne({
      where: {
        deletedHeight: null,
        owner: address
      }
    });
  }
}
