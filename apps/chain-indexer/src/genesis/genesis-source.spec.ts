import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { RpcGenesisSource } from "@src/genesis/genesis-source";
import type { LoggerService } from "@src/providers/logging.provider";
import type { RpcClientPool } from "@src/rpc/rpc-client-pool.service";

import { buildParsedGenesis, buildRawGenesis } from "@test/fakes/genesis-fixtures";

describe(RpcGenesisSource.name, () => {
  it("reassembles multiple genesis chunks into the parsed document", async () => {
    const { source, pool } = setup({ chunkCount: 3 });

    const genesis = await source.fetchGenesis();

    expect(genesis).toEqual(buildParsedGenesis());
    expect(pool.getGenesisChunk).toHaveBeenCalledTimes(3);
    expect(pool.getGenesisChunk).toHaveBeenNthCalledWith(1, 0);
    expect(pool.getGenesisChunk).toHaveBeenNthCalledWith(3, 2);
  });

  it("fetches a single-chunk genesis", async () => {
    const { source, pool } = setup({ chunkCount: 1 });

    await source.fetchGenesis();

    expect(pool.getGenesisChunk).toHaveBeenCalledTimes(1);
  });

  it("rejects when the genesis chain-id does not match the node", async () => {
    const { source } = setup({ chunkCount: 1, nodeChainId: "othernet" });

    await expect(source.fetchGenesis()).rejects.toThrow('Genesis chain_id "sandbox-2" does not match the RPC chain-id "othernet"');
  });

  it("rejects an invalid chunk total", async () => {
    const { source, pool } = setup({ chunkCount: 1 });
    pool.getGenesisChunk.mockResolvedValueOnce({ chunk: "0", total: "0", data: "" });

    await expect(source.fetchGenesis()).rejects.toThrow("Invalid genesis chunk total");
  });

  function setup(input: { chunkCount: number; nodeChainId?: string }) {
    const encodedChunks = toBase64Chunks(JSON.stringify(buildRawGenesis()), input.chunkCount);

    const pool = mock<RpcClientPool>();
    pool.getGenesisChunk.mockImplementation(async chunk => ({ chunk: String(chunk), total: String(encodedChunks.length), data: encodedChunks[chunk] }));
    pool.getStatus.mockResolvedValue({ node_info: { network: input.nodeChainId ?? "sandbox-2" }, sync_info: { latest_block_height: "100" } });

    const source = new RpcGenesisSource(pool, mock<LoggerService>());
    return { source, pool };
  }

  function toBase64Chunks(json: string, count: number): string[] {
    const size = Math.ceil(json.length / count);
    const chunks: string[] = [];
    for (let offset = 0; offset < json.length; offset += size) {
      chunks.push(Buffer.from(json.slice(offset, offset + size)).toString("base64"));
    }
    return chunks;
  }
});
