import { faker } from "@faker-js/faker";
import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";

import { DRIZZLE_PROVIDER_TOKEN } from "@src/infrastructure/db/config/db.config";
import AlertEventsModule from "@src/interfaces/alert-events/alert-events.module";
import * as schema from "@src/modules/alert/model-schemas";
import { ProviderTierDemotionRepository } from "@src/modules/alert/repositories/provider-tier-demotion/provider-tier-demotion.repository";
import { NotificationChannel } from "@src/modules/notifications/model-schemas";

import { mockAkashAddress } from "@test/seeders/akash-address.seeder";
import { generateGeneralAlert } from "@test/seeders/general-alert.seeder";
import { generateNotificationChannel } from "@test/seeders/notification-channel.seeder";

describe("provider tier-demotion alert persistence", () => {
  it("serializes feed processing and persists sent-delivery deduplication", async () => {
    const module = await Test.createTestingModule({ imports: [AlertEventsModule] }).compile();

    try {
      const repository = module.get(ProviderTierDemotionRepository);
      const db = module.get(DRIZZLE_PROVIDER_TOKEN);
      const firstClaim = await repository.claimFeed();

      expect(firstClaim).toMatchObject({ streamId: null, cursor: "0" });
      await expect(repository.claimFeed()).resolves.toBeUndefined();

      await repository.setFeedPosition(firstClaim.claimId, STREAM_ID, "10");
      await repository.releaseFeed(firstClaim.claimId);
      await expect(repository.claimFeed()).resolves.toMatchObject({ streamId: STREAM_ID, cursor: "10" });

      const [channel] = await db.insert(NotificationChannel).values(generateNotificationChannel({})).returning();
      const owner = mockAkashAddress();
      const dseq = String(faker.number.int({ min: 1, max: 999999 }));
      const [alert] = await db
        .insert(schema.Alert)
        .values(generateClosedAlert({ owner, dseq, notificationChannelId: channel.id }))
        .returning();
      const delivery = {
        streamId: STREAM_ID,
        cursor: "11",
        alertId: alert.id,
        provider: PROVIDER,
        lease: { owner, dseq, provider: PROVIDER, gseq: 1, oseq: 1, bseq: 3 }
      };

      const deliveryClaim = await repository.claimDelivery(delivery);
      expect(deliveryClaim.status).toBe("claimed");
      if (deliveryClaim.status !== "claimed") throw new Error("Expected a claimed delivery");
      await repository.completeDelivery(delivery, deliveryClaim.claimId);

      await expect(repository.claimDelivery(delivery)).resolves.toEqual({ status: "sent" });
      await expect(db.select().from(schema.ProviderTierDemotionNotification)).resolves.toMatchObject([
        { streamId: STREAM_ID, cursor: 11n, status: "SENT", sentAt: expect.any(Date) }
      ]);

      const retryableDelivery = { ...delivery, cursor: "12" };
      const pendingClaim = await repository.claimDelivery(retryableDelivery);
      expect(pendingClaim.status).toBe("claimed");
      await expect(repository.claimDelivery(retryableDelivery)).resolves.toEqual({ status: "busy" });
      if (pendingClaim.status !== "claimed") throw new Error("Expected a claimed delivery");
      await repository.releaseDelivery(retryableDelivery, pendingClaim.claimId);
      await expect(repository.claimDelivery(retryableDelivery)).resolves.toMatchObject({ status: "claimed" });
    } finally {
      await module.close();
    }
  });
});

function generateClosedAlert(input: { owner: string; dseq: string; notificationChannelId: string }) {
  return generateGeneralAlert({
    type: "CHAIN_EVENT",
    notificationChannelId: input.notificationChannelId,
    enabled: true,
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

const STREAM_ID = "5be32550-fbc2-4f02-9ac2-7d58f0362451";
const PROVIDER = "akash1provideraddressxxxxxxxxxxxxxxxxxxxxxx";
