import { Provider, ProviderAttribute, ProviderAttributeSignature, ProviderSnapshotNode, ProviderSnapshotNodeGPU } from "@akashnetwork/database/dbSchemas/akash";
import { ProviderSnapshot } from "@akashnetwork/database/dbSchemas/akash/providerSnapshot";
import { ProviderHttpService } from "@akashnetwork/http-sdk";
import { SupportedChainNetworks } from "@akashnetwork/net";
import { AxiosError } from "axios";
import { add } from "date-fns";
import assert from "http-assert";
import { Op } from "sequelize";
import { setTimeout as delay } from "timers/promises";
import { singleton } from "tsyringe";

import { type BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { AUDITOR, TRIAL_ATTRIBUTE } from "@src/deployment/config/provider.config";
import { LeaseStatusResponse } from "@src/deployment/http-schemas/lease.schema";
import { ProviderIdentity, ProviderProxyService } from "@src/provider/services/provider/provider-proxy.service";
import { ProviderList } from "@src/types/provider";
import { toUTC } from "@src/utils";
import { mapProviderToList } from "@src/utils/map/provider";
import { AuditorService } from "../auditors/auditors.service";
import { JwtTokenService } from "../jwt-token/jwt-token.service";
import { ProviderAttributesSchemaService } from "../provider-attributes-schema/provider-attributes-schema.service";

@singleton()
export class ProviderService {
  private readonly MANIFEST_SEND_MAX_RETRIES = 3;
  private readonly MANIFEST_SEND_RETRY_DELAY = 6000;
  private readonly chainNetwork: SupportedChainNetworks;

  constructor(
    private readonly providerProxy: ProviderProxyService,
    private readonly providerHttpService: ProviderHttpService,
    private readonly providerAttributesSchemaService: ProviderAttributesSchemaService,
    private readonly auditorsService: AuditorService,
    @InjectBillingConfig() private readonly config: BillingConfig,
    private readonly jwtTokenService: JwtTokenService
  ) {
    this.chainNetwork = this.config.NETWORK as SupportedChainNetworks;
  }

  async sendManifest({ provider, dseq, manifest, walletId }: { provider: string; dseq: string; manifest: string; walletId: number }) {
    const jsonStr = manifest.replace(/"quantity":{"val/g, '"size":{"val');

    const providerResponse = await this.providerHttpService.getProvider(provider);

    assert(providerResponse, 404, `Provider ${provider} not found`);

    const providerIdentity: ProviderIdentity = {
      owner: provider,
      hostUri: providerResponse.provider.host_uri
    };

    return await this.sendManifestToProvider(walletId, dseq, jsonStr, providerIdentity);
  }

  private async sendManifestToProvider(walletId: number, dseq: string, jsonStr: string, providerIdentity: ProviderIdentity) {
    for (let i = 1; i <= this.MANIFEST_SEND_MAX_RETRIES; i++) {
      try {
        const result = await this.providerProxy.fetchProviderUrl(`/deployment/${dseq}/manifest`, {
          method: "PUT",
          body: jsonStr,
          headers: {
            Authorization: `Bearer ${await this.jwtTokenService.generateJwtToken({ walletId, provider: providerIdentity.owner })}`,
            "Content-Type": "application/json"
          },
          chainNetwork: this.chainNetwork,
          providerIdentity,
          timeout: 60000
        });

        if (result) return result;
      } catch (err: any) {
        if (err.message?.includes("no lease for deployment") && i < this.MANIFEST_SEND_MAX_RETRIES) {
          await delay(this.MANIFEST_SEND_RETRY_DELAY);
          continue;
        }
        const providerError = err instanceof AxiosError && err.response?.data;
        assert(!providerError?.toLowerCase()?.includes("invalid manifest"), 400, err?.response?.data);

        throw new Error(providerError || err);
      }
    }
  }

  async getLeaseStatus(provider: string, dseq: string, gseq: number, oseq: number, walletId: number): Promise<LeaseStatusResponse> {
    const providerResponse = await this.providerHttpService.getProvider(provider);
    if (!providerResponse) {
      throw new Error(`Provider ${provider} not found`);
    }

    const providerIdentity: ProviderIdentity = {
      owner: provider,
      hostUri: providerResponse.provider.host_uri
    };

    return await this.providerProxy.fetchProviderUrl<LeaseStatusResponse>(`/lease/${dseq}/${gseq}/${oseq}/status`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${await this.jwtTokenService.generateJwtToken({ walletId, provider: providerIdentity.owner })}`,
        "Content-Type": "application/json"
      },
      chainNetwork: this.chainNetwork,
      providerIdentity,
      timeout: 30000
    });
  }

  async getProviderList({ trial = false }: { trial?: boolean } = {}): Promise<ProviderList[]> {
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
      ...mapProviderToList(provider, providerAttributeSchema, auditors, lastSuccessfulSnapshot ?? undefined),
      uptime: uptimeSnapshots.map(ps => ({
        id: ps.id,
        isOnline: ps.isOnline,
        checkDate: ps.checkDate
      }))
    };
  }
}
