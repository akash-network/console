import { faker } from "@faker-js/faker";
import { Test } from "@nestjs/testing";
import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import { eventKeyRegistry } from "@src/common/config/event-key-registry.config";
import { BrokerService } from "@src/infrastructure/broker";
import { DRIZZLE_PROVIDER_TOKEN } from "@src/infrastructure/db/config/db.config";
import AlertEventsModule from "@src/interfaces/alert-events/alert-events.module";
import { ChainEventsHandler } from "@src/interfaces/alert-events/handlers/chain-events/chain-events.handler";
import type { EventProviderMaintenanceOpenedDto } from "@src/modules/alert/dto/event-provider-maintenance-opened.dto";
import * as schema from "@src/modules/alert/model-schemas";
import { ProviderActiveLeasesService } from "@src/modules/alert/services/provider-active-leases/provider-active-leases.service";
import type { ProviderLeaseId } from "@src/modules/alert/types/provider-lease.type";
import { NotificationChannel } from "@src/modules/notifications/model-schemas";

import { mockAkashAddress } from "@test/seeders/akash-address.seeder";
import { generateGeneralAlert } from "@test/seeders/general-alert.seeder";
import { generateNotificationChannel } from "@test/seeders/notification-channel.seeder";

describe("provider maintenance alerts", () => {
  it("publishes once for the provider, maintenance and lease tuple", async () => {
    const provider = mockAkashAddress();
    const owner = mockAkashAddress();
    const dseq = String(faker.number.int({ min: 1, max: 999999 }));
    const lease: ProviderLeaseId = { owner, dseq, provider, gseq: 1, oseq: 1, bseq: 4 };
    const activeLeases = { list: vi.fn().mockResolvedValue([lease]) };
    const module = await setup(activeLeases);

    try {
      const handler = module.get(ChainEventsHandler);
      const brokerService = module.get(BrokerService);
      const db = module.get(DRIZZLE_PROVIDER_TOKEN);
      vi.spyOn(brokerService, "publish").mockResolvedValue(undefined);

      const [channel] = await db
        .insert(NotificationChannel)
        .values([generateNotificationChannel({})])
        .returning();
      const [alert] = await db
        .insert(schema.Alert)
        .values([generateClosedAlert({ owner, dseq, notificationChannelId: channel.id })])
        .returning();
      const event = maintenanceEvent(provider);

      await handler.processProviderMaintenanceOpened(event);
      await handler.processProviderMaintenanceOpened(event);

      expect(activeLeases.list).toHaveBeenCalledWith(provider);
      expect(brokerService.publish).toHaveBeenCalledTimes(1);
      expect(brokerService.publish).toHaveBeenCalledWith(
        eventKeyRegistry.createNotification,
        expect.objectContaining({
          notificationChannelId: channel.id,
          payload: expect.objectContaining({
            summary: expect.stringContaining(dseq),
            description: expect.stringContaining("The lease remains open")
          })
        })
      );

      const saved = await db.query.Alert.findFirst({ where: (table, { eq }) => eq(table.id, alert.id) });
      expect(saved.params.providerMaintenanceNotifications[notificationKey(event, lease)]).toEqual({
        status: "sent",
        sentAt: expect.any(String)
      });
    } finally {
      await module.close();
    }
  });

  it("does not reclaim a fresh pending notification", async () => {
    const context = await setupScenario();

    try {
      const { alert, brokerService, db, event, handler, lease } = context;
      const key = notificationKey(event, lease);
      const pending = {
        status: "pending",
        claimId: faker.string.uuid(),
        claimedAt: new Date().toISOString()
      };
      await db
        .update(schema.Alert)
        .set({ params: { ...alert.params, providerMaintenanceNotifications: { [key]: pending } } })
        .where(eq(schema.Alert.id, alert.id));

      await handler.processProviderMaintenanceOpened(event);

      expect(brokerService.publish).not.toHaveBeenCalled();
      const saved = await db.query.Alert.findFirst({ where: (table, { eq }) => eq(table.id, alert.id) });
      expect(saved.params.providerMaintenanceNotifications[key]).toEqual(pending);
    } finally {
      await context.module.close();
    }
  });

  it("reclaims a stale pending notification and marks it sent", async () => {
    const context = await setupScenario();

    try {
      const { alert, brokerService, db, event, handler, lease } = context;
      const key = notificationKey(event, lease);
      await db
        .update(schema.Alert)
        .set({
          params: {
            ...alert.params,
            providerMaintenanceNotifications: {
              [key]: { status: "pending", claimId: faker.string.uuid(), claimedAt: new Date(0).toISOString() }
            }
          }
        })
        .where(eq(schema.Alert.id, alert.id));

      await handler.processProviderMaintenanceOpened(event);

      expect(brokerService.publish).toHaveBeenCalledTimes(1);
      const saved = await db.query.Alert.findFirst({ where: (table, { eq }) => eq(table.id, alert.id) });
      expect(saved.params.providerMaintenanceNotifications[key]).toEqual({ status: "sent", sentAt: expect.any(String) });
    } finally {
      await context.module.close();
    }
  });

  it("releases a failed publication so replay can send it", async () => {
    const context = await setupScenario();

    try {
      const { alert, brokerService, db, event, handler, lease } = context;
      const key = notificationKey(event, lease);
      vi.mocked(brokerService.publish).mockRejectedValueOnce(new Error("publish failed")).mockResolvedValueOnce(undefined);

      await expect(handler.processProviderMaintenanceOpened(event)).rejects.toThrow("publish failed");
      const failed = await db.query.Alert.findFirst({ where: (table, { eq }) => eq(table.id, alert.id) });
      expect(failed.params.providerMaintenanceNotifications?.[key]).toBeUndefined();

      await handler.processProviderMaintenanceOpened(event);

      expect(brokerService.publish).toHaveBeenCalledTimes(2);
      const sent = await db.query.Alert.findFirst({ where: (table, { eq }) => eq(table.id, alert.id) });
      expect(sent.params.providerMaintenanceNotifications[key]).toEqual({ status: "sent", sentAt: expect.any(String) });
    } finally {
      await context.module.close();
    }
  });

  async function setupScenario() {
    const provider = mockAkashAddress();
    const owner = mockAkashAddress();
    const dseq = String(faker.number.int({ min: 1, max: 999999 }));
    const lease: ProviderLeaseId = { owner, dseq, provider, gseq: 1, oseq: 1, bseq: 4 };
    const module = await setup({ list: vi.fn().mockResolvedValue([lease]) });
    const brokerService = module.get(BrokerService);
    const db = module.get(DRIZZLE_PROVIDER_TOKEN);
    vi.spyOn(brokerService, "publish").mockResolvedValue(undefined);
    const [channel] = await db
      .insert(NotificationChannel)
      .values([generateNotificationChannel({})])
      .returning();
    const [alert] = await db
      .insert(schema.Alert)
      .values([generateClosedAlert({ owner, dseq, notificationChannelId: channel.id })])
      .returning();

    return {
      alert,
      brokerService,
      db,
      event: maintenanceEvent(provider),
      handler: module.get(ChainEventsHandler),
      lease,
      module
    };
  }

  async function setup(activeLeases: Pick<ProviderActiveLeasesService, "list">) {
    process.env.PROVIDER_MAINTENANCE_ALERTS_ENABLED = "true";

    return await Test.createTestingModule({ imports: [AlertEventsModule] })
      .overrideProvider(ProviderActiveLeasesService)
      .useValue(activeLeases)
      .compile();
  }
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

function maintenanceEvent(provider: string): EventProviderMaintenanceOpenedDto {
  return {
    module: "provider",
    action: "provider-maintenance-opened",
    maintenance_id: "17",
    provider,
    maintenance_type: "provider_maintenance_type_planned",
    starts_at: "2026-08-25T12:00:00Z",
    expected_ends_at: "2026-08-25T14:00:00Z"
  } as EventProviderMaintenanceOpenedDto;
}

function notificationKey(event: EventProviderMaintenanceOpenedDto, lease: ProviderLeaseId): string {
  return [event.provider, event.maintenance_id, lease.owner, lease.dseq, lease.gseq, lease.oseq, lease.bseq, lease.provider].join("/");
}
