import { Provider, ProviderSnapshotNode, ProviderSnapshotNodeGPU } from "@akashnetwork/database/dbSchemas/akash";
import { ProviderSnapshot } from "@akashnetwork/database/dbSchemas/akash/providerSnapshot";
import { SupportedChainNetworks } from "@akashnetwork/net";
import { AxiosError } from "axios";
import { add } from "date-fns";
import assert from "http-assert";
import { Op } from "sequelize";
import { setTimeout as delay } from "timers/promises";
import { singleton } from "tsyringe";

import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { LeaseStatusResponse } from "@src/deployment/http-schemas/lease.schema";
import { ProviderRepository } from "@src/provider/repositories/provider/provider.repository";
import { ProviderAuth, ProviderIdentity, ProviderMtlsAuth, ProviderProxyService } from "@src/provider/services/provider/provider-proxy.service";
import { ProviderJwtTokenService } from "@src/provider/services/provider-jwt-token/provider-jwt-token.service";
import { ProviderList } from "@src/types/provider";
import { toUTC } from "@src/utils";
import { mapProviderToList } from "@src/utils/map/provider";
import { AuditorService } from "../auditors/auditors.service";
import { ProviderAttributesSchemaService } from "../provider-attributes-schema/provider-attributes-schema.service";

@singleton()
export class ProviderService {
  private readonly MANIFEST_SEND_MAX_RETRIES = 3;
  private readonly MANIFEST_SEND_RETRY_DELAY = 6000;
  private readonly chainNetwork: SupportedChainNetworks;

  constructor(
    private readonly providerProxy: ProviderProxyService,
    private readonly providerRepository: ProviderRepository,
    private readonly providerAttributesSchemaService: ProviderAttributesSchemaService,
    private readonly auditorsService: AuditorService,
    private readonly jwtTokenService: ProviderJwtTokenService,
    private readonly config: BillingConfigService
  ) {
    this.chainNetwork = this.config.get("NETWORK") as SupportedChainNetworks;
  }

  async sendManifest(options: { provider: string; dseq: string; manifest: string; auth: ProviderAuth }) {
    const provider = await this.providerRepository.findActiveByAddress(options.provider);

    assert(provider, 404, `Provider ${options.provider} not found`);

    const manifest = options.manifest.replace(/"quantity":{"val/g, '"size":{"val');
    const providerIdentity: ProviderIdentity = {
      owner: options.provider,
      hostUri: provider.hostUri
    };

    return await this.sendManifestToProvider({ dseq: options.dseq, manifest, auth: options.auth, providerIdentity });
  }

  async toProviderAuth(auth: Omit<ProviderMtlsAuth, "type"> | { walletId: number; provider: string }): Promise<ProviderAuth> {
    if ("walletId" in auth) {
      const jwtToken = await this.jwtTokenService.generateJwtToken({
        walletId: auth.walletId,
        leases: this.jwtTokenService.getGranularLeases({
          provider: auth.provider,
          scope: ["send-manifest"]
        })
      });

      return {
        type: "jwt",
        token: jwtToken
      };
    }
    return {
      type: "mtls",
      ...auth
    };
  }

  private async sendManifestToProvider(options: { dseq: string; manifest: string; auth: ProviderAuth; providerIdentity: ProviderIdentity }) {
    for (let i = 1; i <= this.MANIFEST_SEND_MAX_RETRIES; i++) {
      try {
        const result = await this.providerProxy.request(`/deployment/${options.dseq}/manifest`, {
          method: "PUT",
          body: options.manifest,
          auth: options.auth,
          chainNetwork: this.chainNetwork,
          providerIdentity: options.providerIdentity,
          timeout: 60000
        });

        if (result) return result;
      } catch (err: unknown) {
        if (err instanceof Error && err.message?.includes("no lease for deployment") && i < this.MANIFEST_SEND_MAX_RETRIES) {
          await delay(this.MANIFEST_SEND_RETRY_DELAY);
          continue;
        }

        const providerError = err instanceof AxiosError && (err.response?.data?.message || err.response?.data);
        if (typeof providerError === "string") {
          assert(!providerError.toLowerCase().includes("invalid manifest"), 400, providerError);
          assert(!providerError.toLowerCase().includes("unauthorized access"), 401, providerError);
        }

        throw new Error(providerError || err);
      }
    }
  }

  async getLeaseStatus(providerAddress: string, dseq: string, gseq: number, oseq: number, auth: ProviderAuth): Promise<LeaseStatusResponse> {
    const provider = await this.providerRepository.findActiveByAddress(providerAddress);
    assert(provider, 404, `Provider ${providerAddress} not found`);

    const providerIdentity: ProviderIdentity = {
      owner: providerAddress,
      hostUri: provider.hostUri
    };

    return await this.providerProxy.request<LeaseStatusResponse>(`/lease/${dseq}/${gseq}/${oseq}/status`, {
      method: "GET",
      auth,
      chainNetwork: this.chainNetwork,
      providerIdentity,
      timeout: 30000
    });
  }

  async getProviderList({ trial = false }: { trial?: boolean } = {}): Promise<ProviderList[]> {
    const providersWithAttributesAndAuditors = await this.providerRepository.getWithAttributesAndAuditors({ trial });
    const providerWithNodes = await this.providerRepository.getProviderWithNodes();

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
    const provider = await this.providerRepository.getProviderByAddressWithAttributes(address);

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
