import type { SigningStargateClient } from "@cosmjs/stargate";
import type { Comet38Client, RpcClient } from "@cosmjs/tendermint-rpc";
import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { Wallet } from "../wallet/wallet";
import { createSigningStargateClientFactory } from "./signing-stargate-client.factory";

describe(createSigningStargateClientFactory.name, () => {
  it("builds an RpcClient via the injected factory and passes it to Comet38Client", () => {
    const endpoint = faker.internet.url();
    const signer = mock<Wallet>();
    const mockClient = mock<SigningStargateClient>({});
    const mockCometClient = mock<Comet38Client>();
    const mockRpcClient = mock<RpcClient>();

    const createRpcClient = vi.fn().mockReturnValue(mockRpcClient);
    const mockFactory = vi.fn().mockReturnValue(mockClient);
    const MockComet38Client = {
      create: vi.fn().mockReturnValue(mockCometClient)
    } as unknown as typeof Comet38Client;

    const factory = createSigningStargateClientFactory(createRpcClient, MockComet38Client, mockFactory);
    const result = factory(endpoint, signer);

    expect(createRpcClient).toHaveBeenCalledWith(endpoint);
    expect(MockComet38Client.create).toHaveBeenCalledWith(mockRpcClient);
    expect(mockFactory).toHaveBeenCalledWith(mockCometClient, signer, {});
    expect(result).toBe(mockClient);
  });

  it("forwards optional registry to the SigningStargateClient factory", () => {
    const endpoint = faker.internet.url();
    const signer = mock<Wallet>();
    const mockClient = mock<SigningStargateClient>({});
    const mockCometClient = mock<Comet38Client>();
    const mockRpcClient = mock<RpcClient>();
    const registry = { encode: vi.fn() } as never;

    const createRpcClient = vi.fn().mockReturnValue(mockRpcClient);
    const mockFactory = vi.fn().mockReturnValue(mockClient);
    const MockComet38Client = {
      create: vi.fn().mockReturnValue(mockCometClient)
    } as unknown as typeof Comet38Client;

    const factory = createSigningStargateClientFactory(createRpcClient, MockComet38Client, mockFactory);
    factory(endpoint, signer, { registry });

    expect(mockFactory).toHaveBeenCalledWith(mockCometClient, signer, { registry });
  });
});
