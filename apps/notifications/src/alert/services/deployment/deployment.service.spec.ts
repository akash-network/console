import { faker } from '@faker-js/faker';
import { Test, type TestingModule } from '@nestjs/testing';
import type { MockProxy } from 'jest-mock-extended';
import { Ok } from 'ts-results';

import { BlockchainNodeHttpService } from '@src/alert/services/blockchain-node-http/blockchain-node-http.service';
import { LoggerService } from '@src/common/services/logger/logger.service';
import { DeploymentService } from './deployment.service';

import { MockProvider } from '@test/mocks/provider.mock';
import { mockAkashAddress } from '@test/seeders/akash-address.seeder';

describe(DeploymentService.name, () => {
  describe('getDeploymentBalance', () => {
    it('should return the deployment balance', async () => {
      const { service, blockchainNodeHttpService } = await setup();
      blockchainNodeHttpService.get.mockResolvedValue({
        data: {
          deployment: {
            state: 'active',
          },
          escrow_account: {
            state: 'overdrawn',
            balance: {
              denom: 'uakt',
              amount: '1000',
            },
            funds: {
              denom: 'uakt',
              amount: '1000',
            },
          },
        },
      });
      const owner = mockAkashAddress();
      const dseq = faker.string.alphanumeric(6);

      const balance = await service.getDeploymentBalance(owner, dseq);

      expect(balance).toEqual(Ok({ balance: 2000 }));
      expect(blockchainNodeHttpService.get).toHaveBeenCalledWith(
        '/akash/deployment/v1beta3/deployments/info',
        {
          params: {
            'id.owner': owner,
            'id.dseq': dseq,
          },
        },
      );
    });

    it('should return null if deployment is closed', async () => {
      const { service, blockchainNodeHttpService } = await setup();
      blockchainNodeHttpService.get.mockResolvedValue({
        data: {
          deployment: {
            state: 'closed',
          },
          escrow_account: {
            state: 'overdrawn',
            balance: {
              denom: 'uakt',
              amount: '1000',
            },
            funds: {
              denom: 'uakt',
              amount: '1000',
            },
          },
        },
      });
      const owner = mockAkashAddress();
      const dseq = faker.string.alphanumeric(6);

      const balance = await service.getDeploymentBalance(owner, dseq);

      expect(balance).toMatchObject({
        err: true,
        val: {
          message: 'Deployment closed',
          code: 'DEPLOYMENT_CLOSED',
        },
      });
      expect(blockchainNodeHttpService.get).toHaveBeenCalledWith(
        '/akash/deployment/v1beta3/deployments/info',
        {
          params: {
            'id.owner': owner,
            'id.dseq': dseq,
          },
        },
      );
    });
  });

  async function setup(): Promise<{
    module: TestingModule;
    service: DeploymentService;
    blockchainNodeHttpService: MockProxy<BlockchainNodeHttpService>;
    loggerService: MockProxy<LoggerService>;
  }> {
    const module = await Test.createTestingModule({
      providers: [
        DeploymentService,
        MockProvider(BlockchainNodeHttpService),
        MockProvider(LoggerService),
      ],
    }).compile();

    return {
      module,
      service: module.get<DeploymentService>(DeploymentService),
      loggerService: module.get<MockProxy<LoggerService>>(LoggerService),
      blockchainNodeHttpService: module.get<
        MockProxy<BlockchainNodeHttpService>
      >(BlockchainNodeHttpService),
    };
  }
});
