import { generateMock } from '@anatine/zod-mock';
import { faker } from '@faker-js/faker';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import { AlertModule } from '@src/alert/alert.module';
import { ChainEventsController } from '@src/alert/controllers/chain-events/chain-events.controller';
import { MsgCloseDeploymentDto } from '@src/alert/dto/msg-close-deployment.dto';
import * as schema from '@src/alert/model-schemas';
import { BrokerModule, BrokerService } from '@src/broker';
import { DRIZZLE_PROVIDER_TOKEN } from '@src/config/db.config';
import type { GlobalEnvConfig } from '@src/config/env.config';
import { globalEnvSchema } from '@src/config/env.config';

import { mockAkashAddress } from '@test/seeders/akash-address.seeder';
import { generateContactPoint } from '@test/seeders/contact-point.seeder';
import { generateRawAlert } from '@test/seeders/raw-alert.seeder';

describe('raw alerts', () => {
  it('should send an alert based on conditions', async () => {
    const { module } = await setup();
    const controller = module.get(ChainEventsController);
    const brokerService = module.get(BrokerService);
    const db = module.get(DRIZZLE_PROVIDER_TOKEN);

    const owner = mockAkashAddress();
    const dseq = faker.number.int({ min: 0, max: 999999 });

    jest.spyOn(brokerService, 'publish').mockResolvedValue(undefined);

    const [contactPoint] = await db
      .insert(schema.ContactPoint)
      .values([generateContactPoint({})])
      .returning();

    const matchingAlert = generateRawAlert({
      contactPointId: contactPoint.id,
      conditions: {
        value: [
          {
            field: 'value.id.owner',
            value: owner,
            operator: 'eq',
          },
          {
            field: 'type',
            value: 'akash.deployment.v1beta3.MsgCloseDeployment',
            operator: 'eq',
          },
        ],
        operator: 'and',
      },
      template: 'deployment {{value.id.dseq.low}} is closed',
    });

    const mismatchingAlert = generateRawAlert({
      contactPointId: contactPoint.id,
      conditions: {
        value: [
          {
            field: 'value.id.owner',
            value: mockAkashAddress(),
            operator: 'eq',
          },
          {
            field: 'type',
            value: 'akash.deployment.v1beta3.MsgCloseDeployment',
            operator: 'eq',
          },
        ],
        operator: 'and',
      },
      template: 'deployment {{value.id.dseq.low}} is closed',
    });

    await db.insert(schema.RawAlert).values([matchingAlert, mismatchingAlert]);

    const message = generateMock(MsgCloseDeploymentDto.schema);
    message.value.id.owner = owner;
    message.value.id.dseq.low = dseq;

    await controller.processDeploymentClosed(message);

    expect(brokerService.publish).toHaveBeenCalledTimes(1);
    expect(brokerService.publish).toHaveBeenCalledWith('notification.v1.send', {
      message: `deployment ${dseq} is closed`,
    });

    await module.close();
  });

  async function setup() {
    const module = await Test.createTestingModule({
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

    return {
      module,
    };
  }
});
