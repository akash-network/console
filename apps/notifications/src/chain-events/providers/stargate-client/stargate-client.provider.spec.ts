import type { StargateClient } from '@cosmjs/stargate';
import { faker } from '@faker-js/faker';
import type { ConfigService } from '@nestjs/config';
import { mock } from 'jest-mock-extended';

import { createStargateClientFactory } from './stargate-client.provider';

describe('createStargateClient', () => {
  it('should connect to the Akash network', async () => {
    const config = mock<ConfigService>();
    const mockClient = mock<StargateClient>();
    const MockStargateClient = {
      connect: jest.fn().mockResolvedValue(mockClient),
    };
    const rpcNodeEndpoint = faker.internet.url();
    config.getOrThrow.mockReturnValue(rpcNodeEndpoint);

    const client = await createStargateClientFactory(
      MockStargateClient as unknown as typeof StargateClient,
    )(config);

    expect(MockStargateClient.connect).toHaveBeenCalledWith(rpcNodeEndpoint);
    expect(client).toBe(mockClient);
  });
});
