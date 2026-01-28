import { Provider, ProviderSnapshotNode, ProviderSnapshotNodeGPU } from "@akashnetwork/database/dbSchemas/akash";
import { ProviderSnapshot } from "@akashnetwork/database/dbSchemas/akash";
import { NetConfig, SupportedChainNetworks } from "@akashnetwork/net";
import { AxiosError } from "axios";
import { add } from "date-fns";
import assert from "http-assert";
import createError from "http-errors";
import { Op } from "sequelize";
import { setTimeout as delay } from "timers/promises";
import { singleton } from "tsyringe";

import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { Memoize } from "@src/caching/helpers";
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
    private readonly config: BillingConfigService,
    private readonly netConfig: NetConfig
  ) {
    this.chainNetwork = netConfig.mapped(this.config.get("NETWORK"));
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

  async toProviderAuth(
    auth: Omit<ProviderMtlsAuth, "type"> | { walletId: number; provider: string },
    scope: Parameters<ProviderJwtTokenService["getGranularLeases"]>[0]["scope"] = ["send-manifest"]
  ): Promise<ProviderAuth> {
    if ("walletId" in auth) {
      const result = await this.jwtTokenService.generateJwtToken({
        walletId: auth.walletId,
        leases: this.jwtTokenService.getGranularLeases({
          provider: auth.provider,
          scope
        })
      });

      return {
        type: "jwt",
        token: result.unwrap()
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
      } catch (err) {
        if (err instanceof Error && err.message?.includes("no lease for deployment") && i < this.MANIFEST_SEND_MAX_RETRIES) {
          await delay(this.MANIFEST_SEND_RETRY_DELAY);
          continue;
        }

        if (err instanceof AxiosError && err.response) {
          const message = err.response.data?.message || err.response.data;
          let errorMessage = typeof message === "string" ? message : "Provider request failed";
          let status = err.response.status;

          if (err.response.status === 401) {
            status = 400;
            errorMessage = `Invalid provider ${options.auth.type} credentials`;
          }

          if (err.response.status === 500) {
            status = 503;
            errorMessage = "Provider service is temporarily unavailable";
          }

          throw createError(status, errorMessage, {
            originalError: err
          });
        }

        throw err;
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

  @Memoize({ ttlInSeconds: 60 })
  async getProviderList(trial = false): Promise<ProviderList[]> {
    const providersWithAttributesAndAuditors = await this.providerRepository.getWithAttributesAndAuditors({ trial });
    const providerWithNodes = await this.providerRepository.getProviderWithNodes();

    const distinctProviders = Object.values(
      providersWithAttributesAndAuditors.reduce((acc: Record<string, Provider>, provider: Provider) => {
        acc[provider.hostUri] = provider;
        return acc;
      }, {})
    );

    const auditors = this.auditorsService.getAuditors();
    const providerAttributeSchema = await this.providerAttributesSchemaService.getProviderAttributesSchema();

    // Fix 4: Pre-index provider snapshots for O(1) lookup instead of O(n²) with .find()
    const snapshotByOwner = new Map(providerWithNodes.map(p => [p.owner, p.lastSuccessfulSnapshot]));

    return distinctProviders.map(x => {
      const lastSuccessfulSnapshot = snapshotByOwner.get(x.owner);
      return mapProviderToList(x, providerAttributeSchema, auditors, lastSuccessfulSnapshot);
    });
  }

  @Memoize({ ttlInSeconds: 30 })
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

    const auditors = this.auditorsService.getAuditors();
    const providerAttributeSchema = await this.providerAttributesSchemaService.getProviderAttributesSchema();

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
