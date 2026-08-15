import { fromBase64 } from "@cosmjs/encoding";
import { readFile } from "node:fs/promises";
import type { InjectionToken } from "tsyringe";
import { container, inject, instancePerContainerCachingFactory, singleton } from "tsyringe";

import type { EnvConfig } from "@src/config/env.config";
import type { ParsedGenesis } from "@src/genesis/genesis-schema";
import { parseGenesis } from "@src/genesis/genesis-schema";
import { APP_CONFIG } from "@src/providers/app-config.provider";
import { LoggerService } from "@src/providers/logging.provider";
import { RpcClientPool } from "@src/rpc/rpc-client-pool.service";

/** Seam over where the genesis document comes from. `GENESIS_FILE` selects the file source; otherwise RPC `/genesis_chunked`. */
export interface GenesisSource {
  fetchGenesis(): Promise<ParsedGenesis>;
}

export const GENESIS_SOURCE: InjectionToken<GenesisSource> = Symbol("GENESIS_SOURCE");

async function assertChainId(genesis: ParsedGenesis, pool: RpcClientPool): Promise<ParsedGenesis> {
  const chainId = (await pool.getStatus()).node_info.network;

  if (genesis.chainId !== chainId) {
    throw new Error(`Genesis chain_id "${genesis.chainId}" does not match the RPC chain-id "${chainId}"`);
  }

  return genesis;
}

@singleton()
export class FileGenesisSource implements GenesisSource {
  readonly #path: string;
  readonly #pool: RpcClientPool;
  readonly #logger: LoggerService;

  constructor(@inject(APP_CONFIG) config: EnvConfig, @inject(RpcClientPool) pool: RpcClientPool, @inject(LoggerService) logger: LoggerService) {
    this.#path = config.GENESIS_FILE ?? "";
    this.#pool = pool;
    this.#logger = logger;
    this.#logger.setContext("GENESIS_SOURCE");
  }

  /** Reads a genesis JSON file (the practical path for a large mainnet genesis) and asserts its chain-id matches the RPC node. */
  async fetchGenesis(): Promise<ParsedGenesis> {
    const raw = await readFile(this.#path);
    this.#logger.info({ event: "GENESIS_FILE_READ", path: this.#path, bytes: raw.byteLength });
    return await assertChainId(parseGenesis(JSON.parse(raw.toString("utf8"))), this.#pool);
  }
}

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
    return await assertChainId(parseGenesis(await this.#fetchRawGenesis()), this.#pool);
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

container.register(GENESIS_SOURCE, {
  useFactory: instancePerContainerCachingFactory(c => (c.resolve(APP_CONFIG).GENESIS_FILE ? c.resolve(FileGenesisSource) : c.resolve(RpcGenesisSource)))
});
