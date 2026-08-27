import { Provider, ProviderSnapshot, ProviderSnapshotNode, ProviderSnapshotNodeGPU } from "@akashnetwork/database/dbSchemas/akash";
import type { ProviderAttributesSchema } from "@akashnetwork/http-sdk";
import { AxiosError } from "axios";
import { add } from "date-fns";
import assert from "http-assert";
import createError from "http-errors";
import { Op } from "sequelize";
import { singleton } from "tsyringe";

import { Memoize } from "@src/caching/helpers";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { LeaseStatusResponse } from "@src/deployment/http-schemas/lease.schema";
import type { Auditor } from "@src/provider/http-schemas/auditor.schema";
import type { ProviderVerificationListView, ProviderVerificationView } from "@src/provider/provider-verification/provider-verification.schema";
import { ProviderVerificationService } from "@src/provider/provider-verification/provider-verification.service";
import { ProviderVerificationReadinessService } from "@src/provider/provider-verification/provider-verification-readiness.service";
import { ProviderRepository } from "@src/provider/repositories/provider/provider.repository";
import { ProviderAuth, ProviderIdentity, ProviderProxyService } from "@src/provider/services/provider/provider-proxy.service";
import { ProviderJwtTokenService } from "@src/provider/services/provider-jwt-token/provider-jwt-token.service";
import { ProviderList } from "@src/types/provider";
import { toUTC } from "@src/utils";
import { forEachInChunks } from "@src/utils/array/array";
import { mapProviderToList } from "@src/utils/map/provider";
import { AuditorService } from "../auditors/auditors.service";
import { ProviderAttributesSchemaService } from "../provider-attributes-schema/provider-attributes-schema.service";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
type ProviderListWithVerificationSummary = Omit<ProviderList, "verification"> & { verification: ProviderVerificationListView | null };
type WithVerificationView<T extends ProviderList> = Omit<T, "verification"> & { verification: ProviderVerificationView | null };

@singleton()
export class ProviderService {
  private readonly MANIFEST_SEND_MAX_RETRIES = 3;
  private readonly MANIFEST_SEND_RETRY_DELAY = 6000;

  constructor(
    private readonly providerProxy: ProviderProxyService,
    private readonly providerRepository: ProviderRepository,
    private readonly providerAttributesSchemaService: ProviderAttributesSchemaService,
    private readonly auditorsService: AuditorService,
    private readonly jwtTokenService: ProviderJwtTokenService,
    private readonly providerVerificationService: ProviderVerificationService,
    private readonly providerVerificationReadiness: ProviderVerificationReadinessService,
    private readonly coreConfig: CoreConfigService
  ) {}

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
    auth: { walletId: number; provider: string },
    scope: Parameters<ProviderJwtTokenService["getGranularLeases"]>[0]["scope"] = ["send-manifest"]
  ): Promise<ProviderAuth> {
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

  private async sendManifestToProvider(options: { dseq: string; manifest: string; auth: ProviderAuth; providerIdentity: ProviderIdentity }) {
    for (let i = 1; i <= this.MANIFEST_SEND_MAX_RETRIES; i++) {
      try {
        const result = await this.providerProxy.request(`/deployment/${options.dseq}/manifest`, {
          method: "PUT",
          body: options.manifest,
          auth: options.auth,
          providerIdentity: options.providerIdentity,
          timeout: 15_000
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
      providerIdentity,
      timeout: 15000
    });
  }

  async getProviderList(trial = false): Promise<ProviderListWithVerificationSummary[]> {
    const providers = await this.getProviderListBase(trial);
    return this.attachVerificationSummaries(providers);
  }

  @Memoize({ ttlInSeconds: 60 })
  private async getProviderListBase(trial = false): Promise<ProviderList[]> {
    // Fetch providers in batches to avoid blocking event loop during Sequelize hydration
    const BATCH_SIZE = 200;
    const providersWithAttributesAndAuditors: Provider[] = [];
    let offset = 0;
    let batch: Provider[];
    do {
      batch = await this.providerRepository.getWithAttributesAndAuditors({ trial, limit: BATCH_SIZE, offset });
      providersWithAttributesAndAuditors.push(...batch);
      offset += BATCH_SIZE;
    } while (batch.length === BATCH_SIZE);

    const providerWithNodes: Provider[] = [];
    offset = 0;
    do {
      batch = await this.providerRepository.getProviderWithNodes({ limit: BATCH_SIZE, offset });
      providerWithNodes.push(...batch);
      offset += BATCH_SIZE;
    } while (batch.length === BATCH_SIZE);

    const providerByHostUri = new Map<string, Provider>();
    await forEachInChunks(providersWithAttributesAndAuditors, provider => {
      const existing = providerByHostUri.get(provider.hostUri);
      if (
        !existing ||
        (!existing.isOnline && provider.isOnline) ||
        (existing.isOnline === provider.isOnline && provider.createdHeight > existing.createdHeight)
      ) {
        providerByHostUri.set(provider.hostUri, provider);
      }
    });
    const distinctProviders = Array.from(providerByHostUri.values());

    const [auditors, providerAttributeSchema] = await Promise.all([
      this.auditorsService.getAuditors(),
      this.providerAttributesSchemaService.getProviderAttributesSchema()
    ]);

    const providerByOwner = new Map<string, Provider>();
    await forEachInChunks(providerWithNodes, provider => {
      providerByOwner.set(provider.owner, provider);
    });
    const finalProviders: ProviderList[] = [];

    await forEachInChunks(distinctProviders, provider => {
      const lastSuccessfulSnapshot = providerByOwner.get(provider.owner)?.lastSuccessfulSnapshot;
      finalProviders.push(mapProviderToList(provider, providerAttributeSchema, auditors, lastSuccessfulSnapshot));
    });

    return finalProviders;
  }

  async getProviderListByAddresses(addresses: string[], trial = false): Promise<ProviderListWithVerificationSummary[]> {
    const [providersWithAttributesAndAuditors, providerWithNodes, auditors, providerAttributeSchema] = await Promise.all([
      this.providerRepository.getWithAttributesAndAuditors({ trial, addresses }),
      this.providerRepository.getProviderWithNodes({ addresses }),
      this.auditorsService.getAuditors(),
      this.providerAttributesSchemaService.getProviderAttributesSchema()
    ]);

    return this.attachVerificationSummaries(this.mapProviderResults(providersWithAttributesAndAuditors, providerWithNodes, auditors, providerAttributeSchema));
  }

  private mapProviderResults(
    providersWithAttributesAndAuditors: Provider[],
    providerWithNodes: Provider[],
    auditors: Auditor[],
    providerAttributeSchema: ProviderAttributesSchema
  ): ProviderList[] {
    const seenProviders = new Set<string>();
    const distinctProviders: Provider[] = [];
    for (const provider of providersWithAttributesAndAuditors) {
      if (!seenProviders.has(provider.owner)) {
        seenProviders.add(provider.owner);
        distinctProviders.push(provider);
      }
    }

    const providerByOwner = new Map<string, Provider>();
    for (const provider of providerWithNodes) {
      providerByOwner.set(provider.owner, provider);
    }

    return distinctProviders.map(provider => {
      const lastSuccessfulSnapshot = providerByOwner.get(provider.owner)?.lastSuccessfulSnapshot;
      return mapProviderToList(provider, providerAttributeSchema, auditors, lastSuccessfulSnapshot);
    });
  }

  async getProvider(address: string) {
    const provider = await this.getProviderBase(address);

    if (!provider) return null;

    const [withVerification] = await this.attachVerificationView([provider]);
    return withVerification;
  }

  @Memoize({ ttlInSeconds: 30 })
  private async getProviderBase(address: string) {
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

    const mappedProvider = {
      ...mapProviderToList(provider, providerAttributeSchema, auditors, lastSuccessfulSnapshot ?? undefined),
      uptime: uptimeSnapshots.map(ps => ({
        id: ps.id,
        isOnline: ps.isOnline,
        checkDate: ps.checkDate
      }))
    };

    return mappedProvider;
  }

  private async attachVerificationSummaries(providers: ProviderList[]): Promise<ProviderListWithVerificationSummary[]> {
    if (!this.coreConfig.get("AEP86_PROVIDER_VERIFICATION_ENABLED") || !(await this.providerVerificationReadiness.isReady())) {
      return providers.map(provider => ({ ...provider, verification: null }));
    }

    const verificationByProvider = await this.providerVerificationService.getSummaries(providers.map(provider => provider.owner));

    return providers.map(provider => ({ ...provider, verification: verificationByProvider.get(provider.owner) ?? null }));
  }

  private async attachVerificationView<T extends ProviderList>(providers: T[]): Promise<WithVerificationView<T>[]> {
    if (!this.coreConfig.get("AEP86_PROVIDER_VERIFICATION_ENABLED") || !(await this.providerVerificationReadiness.isReady())) {
      return providers.map(provider => ({ ...provider, verification: null }));
    }

    const verificationByProvider = await this.providerVerificationService.getViews(
      providers.map(provider => ({ provider: provider.owner, providerDeclaredTier: provider.tier }))
    );

    return providers.map(provider => ({ ...provider, verification: verificationByProvider.get(provider.owner) ?? null }));
  }
}
