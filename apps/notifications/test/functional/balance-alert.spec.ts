import { generateMock } from '@anatine/zod-mock';
import { faker } from '@faker-js/faker';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import nock from 'nock';

import { AlertModule } from '@src/alert/alert.module';
import { ChainEventsController } from '@src/alert/controllers/chain-events/chain-events.controller';
import { ChainBlockCreatedDto } from '@src/alert/dto/chain-block-created.dto';
import * as schema from '@src/alert/model-schemas';
import { BrokerModule, BrokerService } from '@src/broker';
import { DRIZZLE_PROVIDER_TOKEN } from '@src/config/db.config';
import type { GlobalEnvConfig } from '@src/config/env.config';
import { globalEnvSchema } from '@src/config/env.config';

import { mockAkashAddress } from '@test/seeders/akash-address.seeder';
import { generateContactPoint } from '@test/seeders/contact-point.seeder';
import { generateDeploymentBalanceAlert } from '@test/seeders/deployment-balance-alert.seeder';
import { generateDeploymentBalanceResponse } from '@test/seeders/deployment-balance-response.seeder';

describe('balance alerts', () => {
  it('should send an alert based on conditions', async () => {
    const { module, chainApi } = await setup();
    const controller = module.get(ChainEventsController);
    const brokerService = module.get(BrokerService);
    const db = module.get<NodePgDatabase<typeof schema>>(
      DRIZZLE_PROVIDER_TOKEN,
    );

    const owner = mockAkashAddress();
    const matchingDseq = faker.number.int({ min: 0, max: 999999 });
    const throttlingDseq = faker.number.int({ min: 0, max: 999999 });
    const CURRENT_HEIGHT = 1000;

    jest.spyOn(brokerService, 'publish').mockResolvedValue(undefined);

    const [contactPoint] = await db
      .insert(schema.ContactPoint)
      .values([generateContactPoint({})])
      .returning();

    const matchingAlert = generateDeploymentBalanceAlert({
      contactPointId: contactPoint.id,
      conditions: {
        value: [
          {
            field: 'balance',
            value: 10000000,
            operator: 'lt',
          },
        ],
        operator: 'and',
      },
      dseq: String(matchingDseq),
      owner,
      template: `deployment ${matchingDseq} balance is {{balance}} < 10000000 uAKT`,
      minBlockHeight: CURRENT_HEIGHT,
    });

    const throttlingAlert = generateDeploymentBalanceAlert({
      contactPointId: contactPoint.id,
      conditions: {
        value: [
          {
            field: 'balance',
            value: 10000000,
            operator: 'lt',
          },
        ],
        operator: 'and',
      },
      dseq: String(throttlingDseq),
      owner: mockAkashAddress(),
      template: `deployment ${matchingDseq} balance is {{balance}} < 10000000 uAKT`,
      minBlockHeight: CURRENT_HEIGHT + 10,
    });

    await db
      .insert(schema.DeploymentBalanceAlert)
      .values([matchingAlert, throttlingAlert]);

    const balanceResponse = generateDeploymentBalanceResponse({
      fundsAmount: 400000,
      escrowAmount: 400000,
      state: 'active',
    });

    chainApi
      .get('/akash/deployment/v1beta3/deployments/info')
      .query({
        'id.owner': owner,
        'id.dseq': String(matchingDseq),
      })
      .reply(200, balanceResponse);

    const message = generateMock(ChainBlockCreatedDto.schema);
    message.height = CURRENT_HEIGHT;

    await controller.processBlock(message);
    await controller.processBlock(message);

    expect(brokerService.publish).toHaveBeenCalledTimes(1);
    expect(brokerService.publish).toHaveBeenCalledWith('notification.v1.send', {
      message: `FIRING: deployment ${matchingDseq} balance is 800000 < 10000000 uAKT`,
    });

    await module.close();
  });

  async function setup() {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        AlertModule,
        ConfigModule.forRoot({
          isGlobal: true,
          skipProcessEnv: true,
          validate: (config) => globalEnvSchema.parse(config),
        }),
        BrokerModule.registerAsync({
          useFactory: async (
            configService: ConfigService<GlobalEnvConfig>,
          ) => ({
            appName: configService.getOrThrow('APP_NAME'),
            postgresUri: configService.getOrThrow('EVENT_BROKER_POSTGRES_URI'),
          }),
          inject: [ConfigService],
        }),
      ],
    }).compile();

    const chainApi = nock(
      module.get(ConfigService).getOrThrow('API_NODE_ENDPOINT'),
    ).persist();

    return {
      module,
      chainApi,
    };
  }
});
