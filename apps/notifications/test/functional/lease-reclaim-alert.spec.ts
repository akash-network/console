import { faker } from "@faker-js/faker";
import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";

import { eventKeyRegistry } from "@src/common/config/event-key-registry.config";
import { BrokerService } from "@src/infrastructure/broker";
import { DRIZZLE_PROVIDER_TOKEN } from "@src/infrastructure/db/config/db.config";
import AlertEventsModule from "@src/interfaces/alert-events/alert-events.module";
import { ChainEventsHandler } from "@src/interfaces/alert-events/handlers/chain-events/chain-events.handler";
import type { EventLeaseReclaimStartedDto } from "@src/modules/alert/dto/event-lease-reclaim-started.dto";
import * as schema from "@src/modules/alert/model-schemas";
import { NotificationChannel } from "@src/modules/notifications/model-schemas";

import { mockAkashAddress } from "@test/seeders/akash-address.seeder";
import { generateGeneralAlert } from "@test/seeders/general-alert.seeder";
import { generateNotificationChannel } from "@test/seeders/notification-channel.seeder";

describe("lease reclaim alerts", () => {
  it("sends a single reclaim notification to the deployment-closed alert's channel and dedupes on replay", async () => {
    const { module } = await setup();

    try {
      const controller = module.get(ChainEventsHandler);
      const brokerService = module.get(BrokerService);
      const db = module.get(DRIZZLE_PROVIDER_TOKEN);

      const owner = mockAkashAddress();
      const otherOwner = mockAkashAddress();
      const dseq = String(faker.number.int({ min: 1, max: 999999 }));
      const provider = mockAkashAddress();

      vi.spyOn(brokerService, "publish").mockResolvedValue(undefined);

      const [ownerChannel, otherOwnerChannel] = await db
        .insert(NotificationChannel)
        .values([generateNotificationChannel({}), generateNotificationChannel({})])
        .returning();

      const ownerClosedAlert = generateClosedAlert({ owner, dseq, notificationChannelId: ownerChannel.id });
      // Same dseq, different owner, different channel: must NOT be borrowed.
      const otherOwnerClosedAlert = generateClosedAlert({ owner: otherOwner, dseq, notificationChannelId: otherOwnerChannel.id });

      await db.insert(schema.Alert).values([ownerClosedAlert, otherOwnerClosedAlert]);

      const event = generateReclaimEvent({ owner, dseq, provider });

      await controller.processLeaseReclaimStarted(event);
      await controller.processLeaseReclaimStarted(event);

      expect(brokerService.publish).toHaveBeenCalledTimes(1);
      expect(brokerService.publish).toHaveBeenCalledWith(
        eventKeyRegistry.createNotification,
        expect.objectContaining({
          notificationChannelId: ownerChannel.id,
          payload: expect.objectContaining({
            summary: expect.stringContaining(dseq),
            description: expect.stringContaining(provider)
          })
        })
      );
    } finally {
      await module.close();
    }
  });

  it("does not send when the deployment-closed alert is disabled (opted out)", async () => {
    const { module } = await setup();

    try {
      const controller = module.get(ChainEventsHandler);
      const brokerService = module.get(BrokerService);
      const db = module.get(DRIZZLE_PROVIDER_TOKEN);

      const owner = mockAkashAddress();
      const dseq = String(faker.number.int({ min: 1, max: 999999 }));

      vi.spyOn(brokerService, "publish").mockResolvedValue(undefined);

      const [channel] = await db
        .insert(NotificationChannel)
        .values([generateNotificationChannel({})])
        .returning();
      await db.insert(schema.Alert).values([generateClosedAlert({ owner, dseq, notificationChannelId: channel.id, enabled: false })]);

      await controller.processLeaseReclaimStarted(generateReclaimEvent({ owner, dseq }));

      expect(brokerService.publish).not.toHaveBeenCalled();
    } finally {
      await module.close();
    }
  });

  it("does not send when there is no deployment-closed alert on file", async () => {
    const { module } = await setup();

    try {
      const controller = module.get(ChainEventsHandler);
      const brokerService = module.get(BrokerService);

      vi.spyOn(brokerService, "publish").mockResolvedValue(undefined);

      await controller.processLeaseReclaimStarted(generateReclaimEvent({ owner: mockAkashAddress(), dseq: String(faker.number.int({ min: 1, max: 999999 })) }));

      expect(brokerService.publish).not.toHaveBeenCalled();
    } finally {
      await module.close();
    }
  });

  function generateClosedAlert(input: { owner: string; dseq: string; notificationChannelId: string; enabled?: boolean }) {
    return generateGeneralAlert({
      type: "CHAIN_EVENT",
      notificationChannelId: input.notificationChannelId,
      enabled: input.enabled ?? true,
      params: { dseq: input.dseq, type: "DEPLOYMENT_CLOSED" },
      conditions: {
        operator: "and",
        value: [
          { field: "action", value: "deployment-closed", operator: "eq" },
          { field: "owner", value: input.owner, operator: "eq" },
          { field: "dseq", value: input.dseq, operator: "eq" }
        ]
      },
      summary: "Deployment closed",
      description: "Deployment closed"
    });
  }

  function generateReclaimEvent(input: { owner: string; dseq: string; provider?: string }): EventLeaseReclaimStartedDto {
    return {
      module: "market",
      action: "lease-reclaim-started",
      owner: input.owner,
      dseq: input.dseq,
      provider: input.provider ?? mockAkashAddress(),
      reason: "lease_closed_reason_unstable",
      deadline: "1749398400"
    } as EventLeaseReclaimStartedDto;
  }

  async function setup() {
    const module = await Test.createTestingModule({
      imports: [AlertEventsModule]
    }).compile();

    return {
      module
    };
  }
});
