import type { ChainNodeWebSDK } from "@akashnetwork/chain-sdk/web";
import type { LoggerService } from "@akashnetwork/logging";
import { inject, singleton } from "tsyringe";

import { CHAIN_SDK } from "@src/providers/chain-sdk.provider";
import type { LoggerFactory } from "@src/providers/logger-factory.provider";
import { LOGGER_FACTORY } from "@src/providers/logger-factory.provider";
import type { ChainProvider } from "@src/types/chain-provider";

@singleton()
export class ChainProviderPollerService {
  readonly #logger: LoggerService;
  readonly #chainSDK: ChainNodeWebSDK;

  constructor(@inject(CHAIN_SDK) chainSDK: ChainNodeWebSDK, @inject(LOGGER_FACTORY) loggerFactory: LoggerFactory) {
    this.#chainSDK = chainSDK;
    this.#logger = loggerFactory({ context: "ChainProviderPoller" });
  }

  async *poll(input: { signal?: AbortSignal; batchSize?: number } = {}): AsyncGenerator<ChainProvider[]> {
    const MAX_PROVIDERS_PER_BATCH = input.batchSize ?? 500;
    this.#logger.info({ event: "CHAIN_POLL_START" });

    const auditRecords = await this.#chainSDK.akash.audit.v1.getAllProvidersAttributes({}, { signal: input.signal });

    const signedByOwner = new Map<string, { attributes: Array<{ key: string; value: string; auditor: string }>; auditors: Set<string> }>();
    for (const record of auditRecords.providers) {
      const existing = signedByOwner.get(record.owner);
      const attributes = record.attributes.map(a => ({ key: a.key, value: a.value, auditor: record.auditor }));
      if (existing) {
        existing.attributes.push(...attributes);
        existing.auditors.add(record.auditor);
      } else {
        signedByOwner.set(record.owner, { attributes, auditors: new Set([record.auditor]) });
      }
    }

    let providerCount = 0;
    let nextKey: Uint8Array | undefined = undefined;
    do {
      this.#logger.info({ event: "CHAIN_PROVIDERS_POLL_BATCH", nextKey: nextKey ? Buffer.from(nextKey).toString("base64") : null });

      const response = await this.#chainSDK.akash.provider.v1beta4.getProviders(
        {
          pagination: { limit: MAX_PROVIDERS_PER_BATCH, key: nextKey }
        },
        { signal: input.signal }
      );
      providerCount += response.providers.length;

      const validProviders: ChainProvider[] = [];
      for (const provider of response.providers) {
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
        yield validProviders;
      }

      nextKey = response.pagination?.nextKey;
    } while (nextKey && nextKey.length > 0 && !input.signal?.aborted);

    this.#logger.info({ event: "CHAIN_PROVIDERS_POLL_COMPLETE", providerCount });
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
