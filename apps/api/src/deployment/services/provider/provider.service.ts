import { Provider } from "@akashnetwork/database/dbSchemas/akash";
import { SupportedChainNetworks } from "@akashnetwork/net";
import { singleton } from "tsyringe";

import { BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { ProviderIdentity, ProviderProxyService } from "./provider-proxy.service";

@singleton()
export class ProviderService {
  private readonly MANIFEST_SEND_MAX_RETRIES = 3;
  private readonly MANIFEST_SEND_RETRY_DELAY = 6000;
  private readonly chainNetwork: SupportedChainNetworks;

  constructor(
    private readonly providerProxy: ProviderProxyService,
    @InjectBillingConfig() private readonly config: BillingConfig
  ) {
    this.chainNetwork = this.config.NETWORK as SupportedChainNetworks;
  }

  async sendManifest(provider: string, dseq: string, gseq: number, oseq: number, manifest: string, options: { certPem: string; keyPem: string }) {
    const jsonStr = manifest.replace(/"quantity":{"val/g, '"size":{"val').replace(/\\/g, "");

    const dbProvider = await Provider.findByPk(provider);
    if (!dbProvider) {
      throw new Error(`Provider ${provider} not found`);
    }

    const providerIdentity: ProviderIdentity = {
      owner: provider,
      hostUri: dbProvider.hostUri
    };

    // Send manifest
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
          await new Promise(resolve => setTimeout(resolve, this.MANIFEST_SEND_RETRY_DELAY));
          continue;
        }
        throw new Error(err?.response?.data || err);
      }
    }
  }
}
