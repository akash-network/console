import { generateMock } from "@anatine/zod-mock";
import { faker } from "@faker-js/faker";
import { ConfigService } from "@nestjs/config";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import nock from "nock";

import { eventKeyRegistry } from "@src/common/config/event-key-registry.config";
import { BrokerService } from "@src/infrastructure/broker";
import { DRIZZLE_PROVIDER_TOKEN } from "@src/infrastructure/db/config/db.config";
import AlertEventsModule from "@src/interfaces/alert-events/alert-events.module";
import { ChainEventsHandler } from "@src/interfaces/alert-events/handlers/chain-events/chain-events.handler";
import { ChainBlockCreatedDto } from "@src/modules/alert/dto/chain-block-created.dto";
import * as schema from "@src/modules/alert/model-schemas";

import { mockAkashAddress } from "@test/seeders/akash-address.seeder";
import { generateDeploymentBalanceAlert } from "@test/seeders/deployment-balance-alert.seeder";
import { generateDeploymentBalanceResponse } from "@test/seeders/deployment-balance-response.seeder";
import { generateNotificationChannel } from "@test/seeders/notification-channel.seeder";

describe("balance alerts", () => {
  it("should send an alert based on conditions", async () => {
    const { module, chainApi } = await setup();
    const controller = module.get(ChainEventsHandler);
    const brokerService = module.get(BrokerService);
    const db = module.get<NodePgDatabase<typeof schema>>(DRIZZLE_PROVIDER_TOKEN);

    const owner = mockAkashAddress();
    const matchingDseq = faker.number.int({ min: 0, max: 999999 });
    const throttlingDseq = faker.number.int({ min: 0, max: 999999 });
    const CURRENT_HEIGHT = 1000;

    jest.spyOn(brokerService, "publish").mockResolvedValue(undefined);

    const [notificationChannel] = await db
      .insert(schema.NotificationChannel)
      .values([generateNotificationChannel({})])
      .returning();

    const matchingAlert = generateDeploymentBalanceAlert({
      notificationChannelId: notificationChannel.id,
      conditions: {
        field: "balance",
        value: 10000000,
        operator: "lt"
      },
      params: {
        dseq: String(matchingDseq),
        owner
      },
      summary: `deployment low: ${matchingDseq}`,
      description: `deployment ${matchingDseq} balance is {{data.balance}} < 10000000 uAKT`,
      minBlockHeight: CURRENT_HEIGHT
    });

    const throttlingAlert = generateDeploymentBalanceAlert({
      notificationChannelId: notificationChannel.id,
      conditions: {
        field: "balance",
        value: 10000000,
        operator: "lt"
      },
      params: {
        dseq: String(throttlingDseq),
        owner: mockAkashAddress()
      },
      summary: `deployment low: ${matchingDseq}`,
      description: `deployment ${matchingDseq} balance is {{data.balance}} < 10000000 uAKT`,
      minBlockHeight: CURRENT_HEIGHT + 10
    });

    await db.insert(schema.Alert).values([matchingAlert, throttlingAlert]);

    const balanceResponse = generateDeploymentBalanceResponse({
      fundsAmount: 400000,
      escrowAmount: 400000,
      state: "active"
    });
    let alertsProcessed = 0;

    chainApi
      .get("/akash/deployment/v1beta3/deployments/info")
      .query({
        "id.owner": owner,
        "id.dseq": String(matchingDseq)
      })
      .reply(200, () => {
        alertsProcessed++;
        return balanceResponse;
      });

    const message = generateMock(ChainBlockCreatedDto.schema);
    message.height = CURRENT_HEIGHT;

    await controller.processBlock(message);
    await controller.processBlock(message);

    expect(alertsProcessed).toBe(1);
    expect(brokerService.publish).toHaveBeenCalledTimes(1);
    expect(brokerService.publish).toHaveBeenCalledWith(eventKeyRegistry.createNotification, {
      notificationChannelId: notificationChannel.id,
      payload: {
        summary: `deployment low: ${matchingDseq}`,
        description: `deployment ${matchingDseq} balance is 800000 < 10000000 uAKT`
      }
    });

    await module.close();
  });

  async function setup() {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AlertEventsModule]
    }).compile();

    const chainApi = nock(module.get(ConfigService).getOrThrow("API_NODE_ENDPOINT")).persist();

    return {
      module,
      chainApi
    };
  }
});
