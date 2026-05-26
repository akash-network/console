import type { RpcClient } from "@cosmjs/tendermint-rpc";
import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { RetryingRpcClient } from "./retrying-rpc-client";

type RpcResponse = Awaited<ReturnType<RpcClient["execute"]>>;

describe(RetryingRpcClient.name, () => {
  it("returns the response on first attempt without retrying", async () => {
    const { client, inner } = setup({ responses: [okResponse("first")] });

    const result = await client.execute(buildRequest("abci_query"));

    expect(result.result).toBe("first");
    expect(inner.execute).toHaveBeenCalledTimes(1);
  });

  it("retries idempotent calls on a 5xx-shaped error and eventually succeeds", async () => {
    const { client, inner } = setup({
      responses: [new Error("Bad status on response: 500"), new Error("Bad status on response: 503"), okResponse("third")]
    });

    const result = await client.execute(buildRequest("abci_query"));

    expect(result.result).toBe("third");
    expect(inner.execute).toHaveBeenCalledTimes(3);
  });

  it("exhausts retries on persistent 5xx and surfaces the last error", async () => {
    const { client, inner } = setup({
      responses: Array.from({ length: 4 }, () => new Error("Bad status on response: 500"))
    });

    await expect(client.execute(buildRequest("abci_query"))).rejects.toThrow(/Bad status on response: 500/);
    expect(inner.execute).toHaveBeenCalledTimes(4);
  });

  it("retries on errors whose cause has a retriable network code", async () => {
    const networkError = Object.assign(new TypeError("fetch failed"), {
      cause: Object.assign(new Error("socket reset"), { code: "ECONNRESET" })
    });
    const { client, inner } = setup({ responses: [networkError, okResponse("recovered")] });

    const result = await client.execute(buildRequest("abci_query"));

    expect(result.result).toBe("recovered");
    expect(inner.execute).toHaveBeenCalledTimes(2);
  });

  it("retries on errors with a top-level retriable code", async () => {
    const error = Object.assign(new Error("socket reset"), { code: "ECONNRESET" });
    const { client, inner } = setup({ responses: [error, okResponse("recovered")] });

    const result = await client.execute(buildRequest("abci_query"));

    expect(result.result).toBe("recovered");
    expect(inner.execute).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-idempotent methods on 5xx", async () => {
    const { client, inner } = setup({ responses: [new Error("Bad status on response: 500"), okResponse("would-recover")] });

    await expect(client.execute(buildRequest("broadcast_tx_sync"))).rejects.toThrow(/Bad status on response: 500/);
    expect(inner.execute).toHaveBeenCalledTimes(1);
  });

  it("does not retry on 4xx-shaped errors", async () => {
    const { client, inner } = setup({ responses: [new Error("Bad status on response: 404"), okResponse("would-recover")] });

    await expect(client.execute(buildRequest("abci_query"))).rejects.toThrow(/Bad status on response: 404/);
    expect(inner.execute).toHaveBeenCalledTimes(1);
  });

  it("does not retry on non-network application errors", async () => {
    const { client, inner } = setup({ responses: [new Error("totally unrelated failure")] });

    await expect(client.execute(buildRequest("abci_query"))).rejects.toThrow(/totally unrelated failure/);
    expect(inner.execute).toHaveBeenCalledTimes(1);
  });

  it("delegates disconnect to the inner client", () => {
    const { client, inner } = setup({ responses: [] });

    client.disconnect();

    expect(inner.disconnect).toHaveBeenCalledTimes(1);
  });

  function buildRequest(method: string) {
    return { jsonrpc: "2.0" as const, id: faker.number.int(), method, params: {} };
  }

  function okResponse(result: unknown): RpcResponse {
    return { jsonrpc: "2.0", id: 1, result };
  }

  function setup(input: { responses: Array<RpcResponse | Error> }) {
    const inner = mock<RpcClient>();
    for (const response of input.responses) {
      if (response instanceof Error) {
        inner.execute.mockRejectedValueOnce(response);
      } else {
        inner.execute.mockResolvedValueOnce(response);
      }
    }

    const client = new RetryingRpcClient(inner, {
      maxAttempts: 3,
      initialDelayMs: 1,
      maxDelayMs: 1
    });

    return { client, inner };
  }
});
