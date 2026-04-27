import type { Comet38Client } from "@cosmjs/tendermint-rpc";
import { faker } from "@faker-js/faker";
import type { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { createCometClientFactory } from "./comet-client.provider";

describe("createCometClient", () => {
  it("should connect to the Akash network", async () => {
    const config = mock<ConfigService>();
    const mockClient = mock<Comet38Client>();
    const MockCometClient = {
      connect: vi.fn().mockResolvedValue(mockClient)
    };
    const rpcNodeEndpoint = faker.internet.url();
    config.getOrThrow.mockReturnValue(rpcNodeEndpoint);

    const client = await createCometClientFactory(MockCometClient as unknown as typeof Comet38Client)(config);

    expect(MockCometClient.connect).toHaveBeenCalledWith(rpcNodeEndpoint);
    expect(client).toBe(mockClient);
  });

  it("should retry connecting when RPC is temporarily unavailable", async () => {
    const config = mock<ConfigService>();
    const mockClient = mock<Comet38Client>();
    const MockCometClient = {
      connect: vi.fn().mockRejectedValueOnce(new Error("ECONNREFUSED")).mockRejectedValueOnce(new Error("ECONNREFUSED")).mockResolvedValue(mockClient)
    };
    const rpcNodeEndpoint = faker.internet.url();
    config.getOrThrow.mockReturnValue(rpcNodeEndpoint);

    const client = await createCometClientFactory(MockCometClient as unknown as typeof Comet38Client)(config);

    expect(MockCometClient.connect).toHaveBeenCalledTimes(3);
    expect(client).toBe(mockClient);
  });
});
