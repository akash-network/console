import type { StargateClient } from "@cosmjs/stargate";
import { faker } from "@faker-js/faker";
import { mock } from "jest-mock-extended";

import type { RpcUrlResolverService } from "@src/modules/chain/services/rpc-url-resolver/rpc-url-resolver.service";
import { createStargateClientFactory } from "./stargate-client.provider";

describe("createStargateClient", () => {
  it("should connect to the Akash network", async () => {
    const rpcUrlResolver = mock<RpcUrlResolverService>();
    const mockClient = mock<StargateClient>();
    const MockStargateClient = {
      connect: jest.fn().mockResolvedValue(mockClient)
    };
    const rpcNodeEndpoint = faker.internet.url();

    rpcUrlResolver.getRpcUrl.mockResolvedValue(rpcNodeEndpoint);

    const client = await createStargateClientFactory(MockStargateClient as unknown as typeof StargateClient)(rpcUrlResolver);

    expect(MockStargateClient.connect).toHaveBeenCalledWith(rpcNodeEndpoint);
    expect(client).toBe(mockClient);
  });
});
