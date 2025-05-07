import { Provider, ProviderAttribute, ProviderAttributeSignature, ProviderSnapshotNode, ProviderSnapshotNodeGPU } from "@akashnetwork/database/dbSchemas/akash";
import { ProviderSnapshot } from "@akashnetwork/database/dbSchemas/akash/providerSnapshot";
import { ProviderHttpService } from "@akashnetwork/http-sdk";
import { SupportedChainNetworks } from "@akashnetwork/net";
import { setTimeout as delay } from "timers/promises";
import { singleton } from "tsyringe";

import { BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { AUDITOR, TRIAL_ATTRIBUTE } from "@src/deployment/config/provider.config";
import { LeaseStatusResponse } from "@src/deployment/http-schemas/lease.schema";
import { ProviderProxyService } from "@src/provider/services/provider/provider-proxy.service";
import { ProviderIdentity } from "@src/provider/services/provider/provider-proxy.service";
import { getAuditors, getProviderAttributesSchema } from "@src/services/external/githubService";
import { mapProviderToList } from "@src/utils/map/provider";

@singleton()
export class ProviderService {
  private readonly MANIFEST_SEND_MAX_RETRIES = 3;
  private readonly MANIFEST_SEND_RETRY_DELAY = 6000;
  private readonly chainNetwork: SupportedChainNetworks;

  constructor(
    private readonly providerProxy: ProviderProxyService,
    private readonly providerHttpService: ProviderHttpService,
    @InjectBillingConfig() private readonly config: BillingConfig
  ) {
    this.chainNetwork = this.config.NETWORK as SupportedChainNetworks;
  }

  async sendManifest(provider: string, dseq: string, manifest: string, options: { certPem: string; keyPem: string }) {
    const jsonStr = manifest.replace(/"quantity":{"val/g, '"size":{"val');

    const providerResponse = await this.providerHttpService.getProvider(provider);
    if (!providerResponse) {
      throw new Error(`Provider ${provider} not found`);
    }

    const providerIdentity: ProviderIdentity = {
      owner: provider,
      hostUri: providerResponse.provider.host_uri
    };

    const response = await this.sendManifestToProvider(dseq, jsonStr, options, providerIdentity);

    return response;
  }

  private async sendManifestToProvider(dseq: string, jsonStr: string, options: { certPem: string; keyPem: string }, providerIdentity: ProviderIdentity) {
    for (let i = 1; i <= this.MANIFEST_SEND_MAX_RETRIES; i++) {
      try {
        const result = await this.providerProxy.fetchProviderUrl(`/deployment/${dseq}/manifest`, {
          method: "PUT",
          body: jsonStr,
          certPem: options.certPem,
          keyPem: options.keyPem,
          chainNetwork: this.chainNetwork,
          providerIdentity,
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

  async getLeaseStatus(provider: string, dseq: string, gseq: number, oseq: number, options: { certPem: string; keyPem: string }): Promise<LeaseStatusResponse> {
    const providerResponse = await this.providerHttpService.getProvider(provider);
    if (!providerResponse) {
      throw new Error(`Provider ${provider} not found`);
    }

    const providerIdentity: ProviderIdentity = {
      owner: provider,
      hostUri: providerResponse.provider.host_uri
    };

    const response = await this.providerProxy.fetchProviderUrl<LeaseStatusResponse>(`/lease/${dseq}/${gseq}/${oseq}/status`, {
      method: "GET",
      certPem: options.certPem,
      keyPem: options.keyPem,
      chainNetwork: this.chainNetwork,
      providerIdentity,
      timeout: 30000
    });

    return response;
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

    const distinctProviders = providersWithAttributesAndAuditors.filter((value, index, self) => self.map(x => x.hostUri).lastIndexOf(value.hostUri) === index);

    const [auditors, providerAttributeSchema] = await Promise.all([getAuditors(), getProviderAttributesSchema()]);

    return distinctProviders.map(x => {
      const lastSuccessfulSnapshot = providerWithNodes.find(p => p.owner === x.owner)?.lastSuccessfulSnapshot;
      return mapProviderToList(x, providerAttributeSchema, auditors, lastSuccessfulSnapshot);
    });
  }
}
