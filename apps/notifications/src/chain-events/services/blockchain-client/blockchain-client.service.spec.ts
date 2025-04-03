import { StargateClient } from '@cosmjs/stargate';
import { faker } from '@faker-js/faker';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { MockProxy } from 'jest-mock-extended';
import { mock } from 'jest-mock-extended';

import { BlockchainClientService } from './blockchain-client.service';

import { generateSimpleMockBlock } from '@test/seeders';

describe(BlockchainClientService.name, () => {
  it('should be defined', async () => {
    const { service } = await setup();
    expect(service).toBeDefined();
  });

  describe('getBlock', () => {
    it('should fetch a block by height', async () => {
      const { service, stargateClient } = await setup();

      const height = faker.number.int({ min: 1, max: 1000000 });
      const mockBlock = generateSimpleMockBlock({ height });

      stargateClient.getBlock.mockResolvedValue(mockBlock);

      const result = await service.getBlock(height);

      expect(stargateClient.getBlock).toHaveBeenCalledWith(height);
      expect(result).toEqual(mockBlock);
    });

    it('should fetch the latest block when height is "latest"', async () => {
      const { service, stargateClient } = await setup();

      const currentHeight = faker.number.int({ min: 1, max: 1000000 });
      const mockBlock = generateSimpleMockBlock({ height: currentHeight });

      stargateClient.getHeight.mockResolvedValue(currentHeight);
      stargateClient.getBlock.mockResolvedValue(mockBlock);

      const result = await service.getBlock('latest');

      expect(stargateClient.getHeight).toHaveBeenCalled();
      expect(stargateClient.getBlock).toHaveBeenCalledWith(currentHeight);
      expect(result).toEqual(mockBlock);
    });
  });

  async function setup(): Promise<{
    module: TestingModule;
    service: BlockchainClientService;
    stargateClient: MockProxy<StargateClient>;
  }> {
    const module = await Test.createTestingModule({
      providers: [
        BlockchainClientService,
        { provide: StargateClient, useValue: mock<StargateClient>() },
      ],
    }).compile();

    return {
      module,
      service: module.get<BlockchainClientService>(BlockchainClientService),
      stargateClient: module.get<MockProxy<StargateClient>>(StargateClient),
    };
  }
});
