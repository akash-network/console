import { generateMock } from "@anatine/zod-mock";
import { faker } from "@faker-js/faker";
import { Test } from "@nestjs/testing";

import { eventKeyRegistry } from "@src/common/config/event-key-registry.config";
import { BrokerService } from "@src/infrastructure/broker";
import { DRIZZLE_PROVIDER_TOKEN } from "@src/infrastructure/db/config/db.config";
import AlertEventsModule from "@src/interfaces/alert-events/alert-events.module";
import { ChainEventsHandler } from "@src/interfaces/alert-events/handlers/chain-events/chain-events.handler";
import { EventClosedDeploymentDto } from "@src/modules/alert/dto/event-closed-deployment.dto";
import * as schema from "@src/modules/alert/model-schemas";
import { NotificationChannel } from "@src/modules/notifications/model-schemas";

import { mockAkashAddress } from "@test/seeders/akash-address.seeder";
import { generateGeneralAlert } from "@test/seeders/general-alert.seeder";
import { generateNotificationChannel } from "@test/seeders/notification-channel.seeder";

describe("chain message alerts", () => {
  it("should send an alert based on conditions", async () => {
    const { module } = await setup();

    try {
      const controller = module.get(ChainEventsHandler);
      const brokerService = module.get(BrokerService);
      const db = module.get(DRIZZLE_PROVIDER_TOKEN);

      const owner = mockAkashAddress();
      const dseq = faker.number.int({ min: 0, max: 999999 });

      jest.spyOn(brokerService, "publish").mockResolvedValue(undefined);

      const [notificationChannel] = await db
        .insert(NotificationChannel)
        .values([generateNotificationChannel({})])
        .returning();

      const matchingAlert = generateGeneralAlert({
        type: "CHAIN_EVENT",
        notificationChannelId: notificationChannel.id,
        conditions: {
          value: [
            {
              field: "owner",
              value: owner,
              operator: "eq"
            },
            {
              field: "action",
              value: "deployment-closed",
              operator: "eq"
            }
          ],
          operator: "and"
        },
        summary: "deployment {{data.payload.dseq}} closed",
        description: "deployment {{data.payload.dseq}} is closed"
      });

      const mismatchingAlert = generateGeneralAlert({
        type: "CHAIN_EVENT",
        notificationChannelId: notificationChannel.id,
        conditions: {
          value: [
            {
              field: "owner",
              value: mockAkashAddress(),
              operator: "eq"
            },
            {
              field: "action",
              value: "deployment-closed",
              operator: "eq"
            }
          ],
          operator: "and"
        },
        summary: "deployment {{data.payload.dseq}} closed",
        description: "deployment {{data.payload.dseq}} is closed"
      });

      await db.insert(schema.Alert).values([matchingAlert, mismatchingAlert]);

      const message = generateMock(EventClosedDeploymentDto.schema);
      message.owner = owner;
      message.dseq = String(dseq);

      await controller.processDeploymentClosed(message);

      expect(brokerService.publish).toHaveBeenCalledTimes(1);
      expect(brokerService.publish).toHaveBeenCalledWith(eventKeyRegistry.createNotification, {
        notificationChannelId: notificationChannel.id,
        payload: {
          summary: `deployment ${dseq} closed`,
          description: `deployment ${dseq} is closed`
        }
      });
    } finally {
      await module.close();
    }
  });

  async function setup() {
    const module = await Test.createTestingModule({
      imports: [AlertEventsModule]
    }).compile();

    return {
      module
    };
  }
});
