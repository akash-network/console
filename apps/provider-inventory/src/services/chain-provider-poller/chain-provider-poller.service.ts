import type { LoggerService } from "@akashnetwork/logging";
import { inject, singleton } from "tsyringe";

import type { ChainQueryClient } from "@src/providers/chain-query.provider";
import { CHAIN_QUERY_CLIENT } from "@src/providers/chain-query.provider";
import type { LoggerFactory } from "@src/providers/logger-factory.provider";
import { LOGGER_FACTORY } from "@src/providers/logger-factory.provider";
import type { ChainProvider } from "@src/types/chain-provider";

@singleton()
export class ChainProviderPollerService {
  readonly #logger: LoggerService;
  readonly #chainClient: ChainQueryClient;

  constructor(@inject(CHAIN_QUERY_CLIENT) chainClient: ChainQueryClient, @inject(LOGGER_FACTORY) loggerFactory: LoggerFactory) {
    this.#chainClient = chainClient;
    this.#logger = loggerFactory({ context: "ChainProviderPoller" });
  }

  async poll(): Promise<ChainProvider[]> {
    this.#logger.info({ event: "CHAIN_POLL_START" });

    const [providers, auditRecords] = await Promise.all([this.#chainClient.getProviders(), this.#chainClient.getAllProvidersAttributes()]);

    const signedByOwner = new Map<string, Array<{ key: string; value: string; auditor: string }>>();
    for (const record of auditRecords) {
      const existing = signedByOwner.get(record.owner);
      if (existing) {
        existing.push(...record.attributes);
      } else {
        signedByOwner.set(record.owner, [...record.attributes]);
      }
    }

    const result: ChainProvider[] = providers.map(p => ({
      owner: p.owner,
      hostUri: p.hostUri,
      createdHeight: p.createdHeight,
      selfAttributes: p.attributes,
      signedAttributes: signedByOwner.get(p.owner) ?? []
    }));

    this.#logger.info({ event: "CHAIN_POLL_COMPLETE", providerCount: result.length });
    return result;
  }
}
