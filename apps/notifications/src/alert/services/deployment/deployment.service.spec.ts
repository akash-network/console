import { faker } from '@faker-js/faker';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import axios from 'axios';

import { LoggerService } from '@src/common/services/logger.service';
import type { GlobalEnvConfig } from '@src/config/env.config';
import { DeploymentService } from './deployment.service';

import { MockProvider } from '@test/mocks/provider.mock';
import { mockAkashAddress } from '@test/seeders/akash-address.seeder';

type Config = Pick<GlobalEnvConfig, 'RPC_NODE_ENDPOINT'>;

describe(DeploymentService.name, () => {
  describe('getDeploymentBalance', () => {
    it('should return the deployment balance', async () => {
      const { service } = await setup();
      jest.spyOn(axios, 'get').mockResolvedValue({
        data: {
          deployment: {},
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

      expect(balance).toEqual({ balance: 2000 });
    });

    it('should resolve with null given no deployment in a response and log it', async () => {
      const { service, loggerService } = await setup();
      const result = {};
      jest.spyOn(axios, 'get').mockResolvedValue({
        data: result,
      });
      const owner = mockAkashAddress();
      const dseq = faker.string.alphanumeric(6);

      const balance = await service.getDeploymentBalance(owner, dseq);

      expect(balance).toBeNull();
      expect(loggerService.error).toHaveBeenCalledWith({
        event: 'BALANCE_FETCH_ERROR',
        owner,
        dseq,
        error: result,
      });
    });
  });

  async function setup(): Promise<{
    module: TestingModule;
    service: DeploymentService;
    loggerService: LoggerService;
    config: Config;
  }> {
    const config: Config = {
      RPC_NODE_ENDPOINT: faker.internet.url(),
    };
    const module = await Test.createTestingModule({
      providers: [
        DeploymentService,
        MockProvider(LoggerService),
        MockProvider(ConfigService),
      ],
    }).compile();

    return {
      module,
      service: module.get<DeploymentService>(DeploymentService),
      loggerService: module.get<LoggerService>(LoggerService),
      config,
    };
  }
});
