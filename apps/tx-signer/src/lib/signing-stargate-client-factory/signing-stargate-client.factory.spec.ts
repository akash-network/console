import type { SigningStargateClient } from "@cosmjs/stargate";
import type { Comet38Client, HttpClient } from "@cosmjs/tendermint-rpc";
import { faker } from "@faker-js/faker";
import { mock } from "jest-mock-extended";

import type { Wallet } from "../wallet/wallet";
import { createSigningStargateClientFactory } from "./signing-stargate-client.factory";

describe(createSigningStargateClientFactory.name, () => {
  it("creates a factory that returns SigningStargateClient", () => {
    const endpoint = faker.internet.url();
    const signer = mock<Wallet>();
    const mockClient = mock<SigningStargateClient>({});
    const mockCometClient = mock<Comet38Client>();
    const mockHttpClientInstance = mock<HttpClient>();
    const mockFactory = jest.fn().mockReturnValue(mockClient);

    const MockHttpClient = jest.fn().mockImplementation(() => mockHttpClientInstance);
    const MockComet38Client = {
      create: jest.fn().mockReturnValue(mockCometClient)
    } as unknown as typeof Comet38Client;

    const factory = createSigningStargateClientFactory(MockHttpClient as unknown as typeof HttpClient, MockComet38Client, mockFactory);
    const result = factory(endpoint, signer);

    expect(MockHttpClient).toHaveBeenCalledWith({
      url: endpoint,
      headers: {
        "X-Proxy-Key": expect.any(String)
      }
    });
    expect(MockComet38Client.create).toHaveBeenCalledWith(mockHttpClientInstance);
    expect(mockFactory).toHaveBeenCalledWith(mockCometClient, signer, {});
    expect(result).toBe(mockClient);
  });
});
