import { Provider } from "@akashnetwork/database/dbSchemas/akash";
import { SupportedChainNetworks } from "@akashnetwork/net";
import { singleton } from "tsyringe";

import { ProviderIdentity, ProviderProxyService } from "./provider-proxy.service";

@singleton()
export class ProviderService {
  constructor(private readonly providerProxy: ProviderProxyService) {}

  async sendManifest(provider: string, dseq: string, gseq: number, oseq: number, manifest: unknown, options: { certPem: string; keyPem: string }) {
    let jsonStr = JSON.stringify(manifest);
    jsonStr = jsonStr.replace(/"quantity":{"val/g, '"size":{"val');

    const dbProvider = await Provider.findByPk(provider);
    if (!dbProvider) {
      throw new Error(`Provider ${provider} not found`);
    }

    const providerIdentity: ProviderIdentity = {
      owner: provider,
      hostUri: dbProvider.hostUri
    };

    // Check lease status with retries
    let leaseActive = false;
    for (let i = 1; i <= 5 && !leaseActive; i++) {
      try {
        const response = await this.providerProxy.fetchProviderUrl(`/lease/${dseq}/${gseq}/${oseq}/status`, {
          method: "GET",
          certPem: options.certPem,
          keyPem: options.keyPem,
          chainNetwork: "mainnet" as SupportedChainNetworks,
          providerIdentity,
          timeout: 10000
        });

        if (response) {
          leaseActive = true;
        } else {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      } catch (err) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    if (!leaseActive) {
      throw new Error("Lease not found or not active");
    }

    // Send manifest with retries
    let response;
    for (let i = 1; i <= 3 && !response; i++) {
      try {
        const result = await this.providerProxy.fetchProviderUrl(`/deployment/${dseq}/manifest`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: jsonStr,
          certPem: options.certPem,
          keyPem: options.keyPem,
          chainNetwork: "mainnet" as SupportedChainNetworks,
          providerIdentity,
          timeout: 60000
        });

        if (result) {
          response = result;
        } else {
          throw new Error("Failed to send manifest");
        }
      } catch (err) {
        if (err.message?.includes("no lease for deployment") && i < 3) {
          await new Promise(resolve => setTimeout(resolve, 6000));
        } else {
          throw new Error(err?.response?.data || err);
        }
      }
    }

    // Check if manifest was applied successfully
    let manifestApplied = false;
    for (let i = 1; i <= 5 && !manifestApplied; i++) {
      try {
        const result = await this.providerProxy.fetchProviderUrl(`/lease/${dseq}/status`, {
          method: "GET",
          certPem: options.certPem,
          keyPem: options.keyPem,
          chainNetwork: "mainnet" as SupportedChainNetworks,
          providerIdentity,
          timeout: 10000
        });

        if (result) {
          manifestApplied = true;
        }
      } catch (err) {
        // Ignore errors during status check
      }
      if (!manifestApplied) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    return response;
  }
}
