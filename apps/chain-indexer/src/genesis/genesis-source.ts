import { fromBase64 } from "@cosmjs/encoding";
import type { InjectionToken } from "tsyringe";
import { container, inject, singleton } from "tsyringe";

import type { ParsedGenesis } from "@src/genesis/genesis-schema";
import { parseGenesis } from "@src/genesis/genesis-schema";
import { LoggerService } from "@src/providers/logging.provider";
import { RpcClientPool } from "@src/rpc/rpc-client-pool.service";

/** Seam over where the genesis document comes from. Swapping to a GitHub-mirror source (for a large mainnet genesis) is a one-line re-registration. */
export interface GenesisSource {
  fetchGenesis(): Promise<ParsedGenesis>;
}

export const GENESIS_SOURCE: InjectionToken<GenesisSource> = Symbol("GENESIS_SOURCE");

@singleton()
export class RpcGenesisSource implements GenesisSource {
  readonly #pool: RpcClientPool;
  readonly #logger: LoggerService;

  constructor(@inject(RpcClientPool) pool: RpcClientPool, @inject(LoggerService) logger: LoggerService) {
    this.#pool = pool;
    this.#logger = logger;
    this.#logger.setContext("GENESIS_SOURCE");
  }

  /** Fetches genesis from the same RPC pool the indexer syncs from and asserts its chain-id matches, so balances can only be seeded for the chain being indexed. */
  async fetchGenesis(): Promise<ParsedGenesis> {
    const genesis = parseGenesis(await this.#fetchRawGenesis());
    const chainId = (await this.#pool.getStatus()).node_info.network;

    if (genesis.chainId !== chainId) {
      throw new Error(`Genesis chain_id "${genesis.chainId}" does not match the RPC chain-id "${chainId}"`);
    }

    return genesis;
  }

  async #fetchRawGenesis(): Promise<unknown> {
    const first = await this.#pool.getGenesisChunk(0);
    const total = Number(first.total);

    if (!Number.isInteger(total) || total < 1) {
      throw new Error(`Invalid genesis chunk total: ${JSON.stringify(first.total)}`);
    }

    const encodedChunks: string[] = [first.data];
    for (let chunk = 1; chunk < total; chunk++) {
      encodedChunks.push((await this.#pool.getGenesisChunk(chunk)).data);
    }

    const decoded = Buffer.concat(encodedChunks.map(encoded => Buffer.from(fromBase64(encoded))));
    this.#logger.info({ event: "GENESIS_FETCHED", chunks: total, bytes: decoded.byteLength });

    return JSON.parse(decoded.toString("utf8"));
  }
}

container.register(GENESIS_SOURCE, { useToken: RpcGenesisSource });
