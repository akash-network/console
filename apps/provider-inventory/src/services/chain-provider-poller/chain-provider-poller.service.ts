import { createOtelLogger } from "@akashnetwork/logging/otel";
import { inject, singleton } from "tsyringe";

import type { ChainQueryClient } from "@src/providers/chain-query.provider";
import { CHAIN_QUERY_CLIENT } from "@src/providers/chain-query.provider";
import type { ChainProvider } from "@src/types/chain-provider";

@singleton()
export class ChainProviderPollerService {
  private readonly logger = createOtelLogger({ context: "ChainProviderPoller" });

  constructor(@inject(CHAIN_QUERY_CLIENT) private readonly chainClient: ChainQueryClient) {}

  async poll(): Promise<ChainProvider[]> {
    this.logger.info({ event: "CHAIN_POLL_START" });

    const [providers, auditRecords] = await Promise.all([this.chainClient.getProviders(), this.chainClient.getAllProvidersAttributes()]);

    const signedByOwner = new Map<string, Array<{ key: string; value: string; auditor: string }>>();
    for (const record of auditRecords) {
      signedByOwner.set(record.owner, record.attributes);
    }

    const result: ChainProvider[] = providers.map(p => ({
      owner: p.owner,
      hostUri: p.hostUri,
      createdHeight: p.createdHeight,
      selfAttributes: p.attributes,
      signedAttributes: signedByOwner.get(p.owner) ?? []
    }));

    this.logger.info({ event: "CHAIN_POLL_COMPLETE", providerCount: result.length });
    return result;
  }
}
