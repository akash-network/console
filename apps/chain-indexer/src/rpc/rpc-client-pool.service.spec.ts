import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { envSchema } from "@src/config/env.config";
import type { LoggerService } from "@src/providers/logging.provider";
import { RpcClientPool } from "@src/rpc/rpc-client-pool.service";

describe(RpcClientPool.name, () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the result payload from the first healthy node", async () => {
    const { pool, fetchMock } = setup();
    fetchMock.mockResolvedValue(jsonResponse({ result: { sync_info: { latest_block_height: "42" } } }));

    const status = await pool.getStatus();

    expect(status.sync_info.latest_block_height).toBe("42");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("http://node-a/status");
  });

  it("fails over to the next node when the first one errors", async () => {
    const { pool, fetchMock } = setup();
    fetchMock.mockRejectedValueOnce(new Error("connection refused"));
    fetchMock.mockResolvedValueOnce(jsonResponse({ result: { sync_info: { latest_block_height: "43" } } }));

    const status = await pool.getStatus();

    expect(status.sync_info.latest_block_height).toBe("43");
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual(["http://node-a/status", "http://node-b/status"]);
  });

  it("keeps a failed node on cooldown for subsequent requests", async () => {
    const { pool, fetchMock } = setup();
    fetchMock.mockRejectedValueOnce(new Error("connection refused"));
    fetchMock.mockResolvedValue(jsonResponse({ result: { sync_info: { latest_block_height: "44" } } }));

    await pool.getStatus();
    await pool.getStatus();

    expect(fetchMock.mock.calls.map(call => call[0])).toEqual(["http://node-a/status", "http://node-b/status", "http://node-b/status"]);
  });

  it("treats non-200 responses as node failures", async () => {
    const { pool, fetchMock } = setup();
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 502));
    fetchMock.mockResolvedValueOnce(jsonResponse({ result: { sync_info: { latest_block_height: "45" } } }));

    const status = await pool.getStatus();

    expect(status.sync_info.latest_block_height).toBe("45");
  });

  it("treats rpc error envelopes as node failures", async () => {
    const { pool, fetchMock } = setup();
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { code: -32603, message: "height not available" } }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ result: { sync_info: { latest_block_height: "46" } } }));

    const status = await pool.getStatus();

    expect(status.sync_info.latest_block_height).toBe("46");
  });

  it("throws an aggregate error when every node fails", async () => {
    const { pool, fetchMock } = setup();
    fetchMock.mockRejectedValue(new Error("connection refused"));

    await expect(pool.getStatus()).rejects.toThrow(AggregateError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uses a dispatcher so the connect timeout follows RPC_TIMEOUT_MS", async () => {
    const { pool, fetchMock } = setup();
    fetchMock.mockResolvedValue(jsonResponse({ result: { sync_info: { latest_block_height: "1" } } }));

    await pool.getStatus();

    expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({ dispatcher: expect.any(Object) }));
  });

  it("parses the tip height from the status payload", async () => {
    const { pool, fetchMock } = setup();
    fetchMock.mockResolvedValue(jsonResponse({ result: { sync_info: { latest_block_height: "1234" } } }));

    await expect(pool.getTipHeight()).resolves.toBe(1234);
  });

  it("requests block and block results with the height as a query parameter", async () => {
    const { pool, fetchMock } = setup();
    fetchMock.mockResolvedValue(jsonResponse({ result: { height: "7" } }));

    await pool.getBlock(7);
    await pool.getBlockResults(7);

    expect(fetchMock.mock.calls.map(call => call[0])).toEqual(["http://node-a/block?height=7", "http://node-a/block_results?height=7"]);
  });

  it("requests a genesis chunk by index", async () => {
    const { pool, fetchMock } = setup();
    fetchMock.mockResolvedValue(jsonResponse({ result: { chunk: "2", total: "5", data: "eyJ9" } }));

    const chunk = await pool.getGenesisChunk(2);

    expect(chunk).toEqual({ chunk: "2", total: "5", data: "eyJ9" });
    expect(fetchMock.mock.calls[0][0]).toBe("http://node-a/genesis_chunked?chunk=2");
  });

  it("runs an abci query with a quoted path, hex data and historical height", async () => {
    const { pool, fetchMock } = setup();
    fetchMock.mockResolvedValue(jsonResponse({ result: { response: { code: 0, value: "AA==" } } }));

    const response = await pool.abciQuery("/cosmos.bank.v1beta1.Query/TotalSupply", "0a00", 100);

    expect(response.value).toBe("AA==");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://node-a/abci_query?path=%22%2Fcosmos.bank.v1beta1.Query%2FTotalSupply%22&data=0x0a00&height=100&prove=false"
    );
  });

  it("fails over to the next node when a node answers with a non-zero abci code", async () => {
    const { pool, fetchMock } = setup();
    fetchMock.mockResolvedValueOnce(jsonResponse({ result: { response: { code: 26, log: "height not available", value: null } } }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ result: { response: { code: 0, value: "AA==" } } }));

    const response = await pool.abciQuery("/cosmos.bank.v1beta1.Query/AllBalances", "00", 999);

    expect(response.value).toBe("AA==");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain("http://node-a/");
    expect(fetchMock.mock.calls[1][0]).toContain("http://node-b/");
  });

  it("throws an aggregate error carrying the abci log when every node answers with a non-zero code", async () => {
    const { pool, fetchMock } = setup();
    fetchMock.mockResolvedValue(jsonResponse({ result: { response: { code: 26, log: "height not available", value: null } } }));

    const error = await pool.abciQuery("/cosmos.bank.v1beta1.Query/AllBalances", "00", 999).catch(caught => caught);

    expect(error).toBeInstanceOf(AggregateError);
    expect(error.errors[0].message).toContain("height not available");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  function setup() {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const config = envSchema.parse({
      POSTGRES_DB_URI: "postgres://unit:unit@localhost:5432/unit",
      RPC_NODE_ENDPOINTS: "http://node-a,http://node-b",
      RPC_TIMEOUT_MS: 500
    });
    const pool = new RpcClientPool(config, mock<LoggerService>());
    return { pool, fetchMock };
  }

  function jsonResponse(payload: unknown, status = 200) {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => payload
    };
  }
});
