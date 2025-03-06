import { Provider } from "@akashnetwork/database/dbSchemas/akash";
import { LoggerService } from "@akashnetwork/logging";
import { SupportedChainNetworks } from "@akashnetwork/net";
import { singleton } from "tsyringe";

import { LeaseStatusResponse } from "@src/deployment/http-schemas/lease.schema";
import { ProviderIdentity, ProviderProxyService } from "./provider-proxy.service";

@singleton()
export class ProviderService {
  private readonly logger = LoggerService.forContext(ProviderService.name);
  private readonly LEASE_STATUS_MAX_RETRIES = 5;
  private readonly LEASE_STATUS_RETRY_DELAY = 3000;
  private readonly MANIFEST_SEND_MAX_RETRIES = 3;
  private readonly MANIFEST_SEND_RETRY_DELAY = 6000;

  constructor(private readonly providerProxy: ProviderProxyService) {}

  async sendManifest(provider: string, dseq: string, gseq: number, oseq: number, manifest: string, options: { certPem: string; keyPem: string }) {
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

    // Check lease status
    const leaseActive = await this.checkLeaseStatus(dseq, gseq, oseq, options, providerIdentity);
    if (!leaseActive) {
      throw new Error("Lease not found or not active");
    }

    // Send manifest
    const response = await this.sendManifestToProvider(dseq, jsonStr, options, providerIdentity);

    return response;
  }

  private async checkLeaseStatus(dseq: string, gseq: number, oseq: number, options: { certPem: string; keyPem: string }, providerIdentity: ProviderIdentity) {
    for (let i = 1; i <= this.LEASE_STATUS_MAX_RETRIES; i++) {
      try {
        const response = await this.providerProxy.fetchProviderUrl<LeaseStatusResponse>(`/lease/${dseq}/${gseq}/${oseq}/status`, {
          method: "GET",
          certPem: options.certPem,
          keyPem: options.keyPem,
          chainNetwork: "mainnet" as SupportedChainNetworks,
          providerIdentity,
          timeout: 10000
        });

        if (response && response.services) {
          const allServicesAvailable = Object.values(response.services).every(service => service.available > 0);
          return allServicesAvailable;
        }
        return false;
      } catch (err) {
        this.logger.error(`Failed to check lease status (attempt ${i}/${this.LEASE_STATUS_MAX_RETRIES}): ${err}`);
      }
      await new Promise(resolve => setTimeout(resolve, this.LEASE_STATUS_RETRY_DELAY));
    }
    return false;
  }

  private async sendManifestToProvider(dseq: string, jsonStr: string, options: { certPem: string; keyPem: string }, providerIdentity: ProviderIdentity) {
    for (let i = 1; i <= this.MANIFEST_SEND_MAX_RETRIES; i++) {
      try {
        const result = await this.providerProxy.fetchProviderUrl(`/deployment/${dseq}/manifest`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: jsonStr,
          certPem: options.certPem,
          keyPem: options.keyPem,
          chainNetwork: "mainnet" as SupportedChainNetworks,
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
      throw new Error("Failed to send manifest");
    }
  }
}
