import type { ChainNodeWebSDK } from "@akashnetwork/chain-sdk/web";
import type { LoggerService } from "@akashnetwork/logging";
import { ProviderVerificationQueryClient } from "@akashnetwork/provider-verification";
import { Sema } from "async-sema";
import { inject, singleton } from "tsyringe";

import { paginate } from "@src/lib/generators/paginate/paginate";
import { mapProviderVerification } from "@src/mappers/provider-verification-mapper/provider-verification-mapper";
import type { EnvConfig } from "@src/providers/app-config.provider";
import { APP_CONFIG } from "@src/providers/app-config.provider";
import { CHAIN_SDK } from "@src/providers/chain-sdk.provider";
import type { LoggerFactory } from "@src/providers/logger-factory.provider";
import { LOGGER_FACTORY } from "@src/providers/logger-factory.provider";
import { PROVIDER_VERIFICATION_QUERY_CLIENT } from "@src/providers/provider-verification-query-client.provider";
import type { ChainProvider, DiscoveredChainProvider } from "@src/types/chain-provider";

interface VerificationObservation {
  moduleActive: boolean | null;
  observedAt: Date;
  observedHeight: string;
}

@singleton()
export class ChainProviderPollerService {
  readonly #logger: LoggerService;
  readonly #chainSDK: ChainNodeWebSDK;
  readonly #verificationClient: ProviderVerificationQueryClient;
  readonly #verificationQueryConcurrency: number;

  constructor(
    @inject(CHAIN_SDK) chainSDK: ChainNodeWebSDK,
    @inject(PROVIDER_VERIFICATION_QUERY_CLIENT) verificationClient: ProviderVerificationQueryClient,
    @inject(APP_CONFIG) config: EnvConfig,
    @inject(LOGGER_FACTORY) loggerFactory: LoggerFactory
  ) {
    this.#chainSDK = chainSDK;
    this.#verificationClient = verificationClient;
    this.#verificationQueryConcurrency = config.VERIFICATION_QUERY_CONCURRENCY;
    this.#logger = loggerFactory({ context: "ChainProviderPoller" });
  }

  async *poll(input: { signal?: AbortSignal; batchSize?: number } = {}): AsyncGenerator<DiscoveredChainProvider[]> {
    const MAX_PROVIDERS_PER_BATCH = input.batchSize ?? 500;
    this.#logger.info({ event: "CHAIN_POLL_START" });

    const verificationObservation = await this.#getVerificationObservation(input.signal);
    const queryOptions = {
      headers: { "x-cosmos-block-height": verificationObservation.observedHeight },
      signal: input.signal
    };

    const signedByOwner = new Map<string, { attributes: Array<{ key: string; value: string; auditor: string }>; auditors: Set<string> }>();
    const auditPages = paginate(
      async key => {
        const response = await this.#chainSDK.akash.audit.v1.getAllProvidersAttributes({ pagination: { limit: MAX_PROVIDERS_PER_BATCH, key } }, queryOptions);
        return { items: response.providers, nextKey: response.pagination?.nextKey };
      },
      { signal: input.signal }
    );

    for await (const records of auditPages) {
      for (const record of records) {
        const existing = signedByOwner.get(record.owner);
        const attributes = record.attributes.map(a => ({ key: a.key, value: a.value, auditor: record.auditor }));
        if (existing) {
          existing.attributes.push(...attributes);
          existing.auditors.add(record.auditor);
        } else {
          signedByOwner.set(record.owner, { attributes, auditors: new Set([record.auditor]) });
        }
      }
    }

    let providerCount = 0;
    const providerPages = paginate(
      async key => {
        this.#logger.info({ event: "CHAIN_PROVIDERS_POLL_BATCH", nextKey: key ? Buffer.from(key).toString("base64") : null });
        const response = await this.#chainSDK.akash.provider.v1beta4.getProviders({ pagination: { limit: MAX_PROVIDERS_PER_BATCH, key } }, queryOptions);
        return { items: response.providers, nextKey: response.pagination?.nextKey };
      },
      { signal: input.signal }
    );

    for await (const providers of providerPages) {
      providerCount += providers.length;

      const validProviders: ChainProvider[] = [];
      for (const provider of providers) {
        if (isValidUrl(provider.hostUri)) {
          validProviders.push({
            owner: provider.owner,
            hostUri: provider.hostUri,
            selfAttributes: provider.attributes,
            signedAttributes: signedByOwner.get(provider.owner)?.attributes ?? [],
            auditedBy: signedByOwner.get(provider.owner)?.auditors ? Array.from(signedByOwner.get(provider.owner)!.auditors) : []
          });
        } else {
          this.#logger.warn({ event: "DISCOVERY_SKIP_PROVIDER", owner: provider.owner, hostUri: provider.hostUri, reason: "Invalid host URI" });
        }
      }

      if (validProviders.length > 0) {
        yield await this.#attachVerification(validProviders, verificationObservation, input.signal);
      }
    }

    this.#logger.info({ event: "CHAIN_PROVIDERS_POLL_COMPLETE", providerCount });
  }

  async #getVerificationObservation(signal?: AbortSignal): Promise<VerificationObservation> {
    const blockResponse = await this.#chainSDK.cosmos.base.tendermint.v1beta1.getLatestBlock({}, { signal });
    const header = blockResponse.sdkBlock?.header ?? blockResponse.block?.header;
    if (!header?.time) throw new Error("Latest block response did not include a height and time");

    const observedHeight = header.height.toString();
    const observedAt = header.time;

    try {
      const response = await this.#chainSDK.akash.verification.v1.getParams({}, { headers: { "x-cosmos-block-height": observedHeight }, signal });
      return { moduleActive: response.params?.verificationModuleActive ?? null, observedAt, observedHeight };
    } catch (error) {
      this.#logger.warn({ event: "VERIFICATION_PARAMS_UNAVAILABLE", error, observedHeight });
      return { moduleActive: null, observedAt, observedHeight };
    }
  }

  async #attachVerification(providers: ChainProvider[], observation: VerificationObservation, signal?: AbortSignal): Promise<DiscoveredChainProvider[]> {
    if (observation.moduleActive !== true) {
      return providers.map(provider => ({
        ...provider,
        verification: mapProviderVerification({ ...observation, state: null })
      }));
    }

    const semaphore = new Sema(this.#verificationQueryConcurrency);
    return await Promise.all(
      providers.map(async provider => {
        await semaphore.acquire();
        try {
          if (signal?.aborted) {
            return { ...provider, verification: mapProviderVerification({ ...observation, state: null }) };
          }

          const state = await this.#verificationClient.getProviderScreeningState(provider.owner, observation.observedHeight);
          return { ...provider, verification: mapProviderVerification({ ...observation, state }) };
        } catch (error) {
          this.#logger.warn({ event: "VERIFICATION_PROVIDER_STATE_UNAVAILABLE", error, owner: provider.owner, observedHeight: observation.observedHeight });
          return { ...provider, verification: mapProviderVerification({ ...observation, state: null }) };
        } finally {
          semaphore.release();
        }
      })
    );
  }
}

function isValidUrl(rawUrl: string): boolean {
  if (!rawUrl || !URL.canParse(rawUrl)) return false;

  const url = new URL(rawUrl);
  const isHTTP = url.protocol === "http:" || url.protocol === "https:";
  if (!isHTTP) return false;
  if (url.hostname[0] === "$" && /^\$[\w_-]+$/.test(url.hostname)) return false; // check against unexpanded env vars

  return true;
}
