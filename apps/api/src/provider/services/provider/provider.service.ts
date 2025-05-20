import { Provider, ProviderAttribute, ProviderAttributeSignature, ProviderSnapshotNode, ProviderSnapshotNodeGPU } from "@akashnetwork/database/dbSchemas/akash";
import { ProviderSnapshot } from "@akashnetwork/database/dbSchemas/akash/providerSnapshot";
import { ProviderHttpService } from "@akashnetwork/http-sdk";
import { SupportedChainNetworks } from "@akashnetwork/net";
import axios from "axios";
import { add } from "date-fns";
import { Op } from "sequelize";
import { setTimeout as delay } from "timers/promises";
import { singleton } from "tsyringe";

import { BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { UserWalletOutput } from "@src/billing/repositories";
import { AUDITOR, TRIAL_ATTRIBUTE } from "@src/deployment/config/provider.config";
import { LeaseStatusResponse } from "@src/deployment/http-schemas/lease.schema";
import { ProviderIdentity } from "@src/provider/services/provider/provider-proxy.service";
import { toUTC } from "@src/utils";
import { mapProviderToList } from "@src/utils/map/provider";
import { AuditorService } from "../auditors/auditors.service";
import { JwtService } from "../jwt/jwt.service";
import { ProviderAttributesSchemaService } from "../provider-attributes-schema/provider-attributes-schema.service";

@singleton()
export class ProviderService {
  private readonly MANIFEST_SEND_MAX_RETRIES = 3;
  private readonly MANIFEST_SEND_RETRY_DELAY = 6000;
  private readonly chainNetwork: SupportedChainNetworks;

  constructor(
    private readonly providerHttpService: ProviderHttpService,
    private readonly providerAttributesSchemaService: ProviderAttributesSchemaService,
    private readonly auditorsService: AuditorService,
    private readonly jwtService: JwtService,
    @InjectBillingConfig() private readonly config: BillingConfig
  ) {
    this.chainNetwork = this.config.NETWORK as SupportedChainNetworks;
  }

  async sendManifest(currentWallet: UserWalletOutput, provider: string, dseq: string, manifest: string) {
    const jsonStr = manifest.replace(/"quantity":{"val/g, '"size":{"val');

    const providerResponse = await this.providerHttpService.getProvider(provider);
    if (!providerResponse) {
      throw new Error(`Provider ${provider} not found`);
    }

    const providerIdentity: ProviderIdentity = {
      owner: provider,
      hostUri: providerResponse.provider.host_uri
    };

    // Generate JWT token for provider authentication
    const token = await this.jwtService.generateProviderToken(currentWallet, provider, dseq);

    const response = await this.sendManifestToProvider(dseq, jsonStr, { token }, providerIdentity);

    return response;
  }

  private async sendManifestToProvider(dseq: string, jsonStr: string, options: { token: string }, providerIdentity: ProviderIdentity) {
    for (let i = 1; i <= this.MANIFEST_SEND_MAX_RETRIES; i++) {
      try {
        const result = await axios.put(`${providerIdentity.hostUri}/deployment/${dseq}/manifest`, {
          method: "PUT",
          body: jsonStr,
          headers: {
            Authorization: `Bearer ${options.token}`
          },
          timeout: 60000
        });

        if (result) return result;
      } catch (err) {
        if (err.message?.includes("no lease for deployment") && i < this.MANIFEST_SEND_MAX_RETRIES) {
          await delay(this.MANIFEST_SEND_RETRY_DELAY);
          continue;
        }
        throw new Error(err?.response?.data || err);
      }
    }
  }

  async getLeaseStatus(currentWallet: UserWalletOutput, provider: string, dseq: string, gseq: number, oseq: number): Promise<LeaseStatusResponse> {
    const providerResponse = await this.providerHttpService.getProvider(provider);
    if (!providerResponse) {
      throw new Error(`Provider ${provider} not found`);
    }

    const providerIdentity: ProviderIdentity = {
      owner: provider,
      hostUri: providerResponse.provider.host_uri
    };

    // Generate JWT token for provider authentication
    const token = await this.jwtService.generateProviderToken(currentWallet, provider, dseq);

    const response = await axios.get(`${providerIdentity.hostUri}/lease/${dseq}/${gseq}/${oseq}/status`, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      timeout: 30000
    });

    return response.data;
  }

  async getProviderList({ trial = false }: { trial?: boolean } = {}) {
    const providersWithAttributesAndAuditors = await Provider.findAll({
      where: {
        deletedHeight: null
      },
      order: [["createdHeight", "ASC"]],
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

    const distinctProviders = Object.values(
      providersWithAttributesAndAuditors.reduce((acc: Record<string, Provider>, provider: Provider) => {
        acc[provider.hostUri] = provider;
        return acc;
      }, {})
    );

    const [auditors, providerAttributeSchema] = await Promise.all([
      this.auditorsService.getAuditors(),
      this.providerAttributesSchemaService.getProviderAttributesSchema()
    ]);

    return distinctProviders.map(x => {
      const lastSuccessfulSnapshot = providerWithNodes.find(p => p.owner === x.owner)?.lastSuccessfulSnapshot;
      return mapProviderToList(x, providerAttributeSchema, auditors, lastSuccessfulSnapshot);
    });
  }

  async getProvider(address: string) {
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

    const [auditors, providerAttributeSchema] = await Promise.all([
      this.auditorsService.getAuditors(),
      this.providerAttributesSchemaService.getProviderAttributesSchema()
    ]);

    return {
      ...mapProviderToList(provider, providerAttributeSchema, auditors, lastSuccessfulSnapshot),
      uptime: uptimeSnapshots.map(ps => ({
        id: ps.id,
        isOnline: ps.isOnline,
        checkDate: ps.checkDate
      }))
    };
  }
}
