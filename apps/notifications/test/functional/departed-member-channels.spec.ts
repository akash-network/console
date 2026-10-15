import { faker } from "@faker-js/faker";
import { Module } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createHash } from "node:crypto";
import request from "supertest";
import { describe, expect, it, onTestFinished } from "vitest";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { DRIZZLE_PROVIDER_TOKEN } from "@src/infrastructure/db/config/db.config";
import { HttpExceptionFilter } from "@src/interfaces/rest/filters/http-exception/http-exception.filter";
import RestModule from "@src/interfaces/rest/rest.module";
import { NotificationChannel } from "@src/modules/notifications/model-schemas";
import { notificationChannelConfigSchema } from "@src/modules/notifications/repositories/notification-channel/notification-channel.repository";

import { generateNotificationChannel } from "@test/seeders/notification-channel.seeder";

describe("Departed member channels (internal)", () => {
  it("stops the team's channels from emailing the departed member and hands an emptied one to the owners", async () => {
    const { app, db, organizationId } = await setup();
    const departed = faker.internet.email().toLowerCase();
    const teammate = faker.internet.email();
    const owners = [faker.internet.email()];
    const [deploymentAlerts, shared, otherTeam] = await db
      .insert(NotificationChannel)
      .values([
        generateNotificationChannel({ organizationId, isDefault: false, config: { addresses: [departed] } }),
        generateNotificationChannel({ organizationId, isDefault: false, config: { addresses: [departed, teammate] } }),
        generateNotificationChannel({ organizationId: faker.string.uuid(), config: { addresses: [departed] } })
      ])
      .returning();

    const response = await request(app.getHttpServer())
      .post(`/internal/v1/organizations/${organizationId}/departed-members`)
      .send({ data: { addressSha256: sha256Of(departed), fallbackAddresses: owners } });

    expect(response.status).toBe(204);
    expect(await addressesById(db, [deploymentAlerts.id, shared.id, otherTeam.id])).toEqual({
      [deploymentAlerts.id]: owners,
      [shared.id]: [teammate],
      [otherTeam.id]: [departed]
    });
  });

  it("refuses an address digest that is not a SHA-256 hex digest", async () => {
    const { app, organizationId } = await setup();

    const response = await request(app.getHttpServer())
      .post(`/internal/v1/organizations/${organizationId}/departed-members`)
      .send({ data: { addressSha256: faker.internet.email(), fallbackAddresses: [faker.internet.email()] } });

    expect(response.status).toBe(400);
  });

  it("deletes a channel the departed member was alone on when the team has no one to hand it to", async () => {
    const { app, db, organizationId } = await setup();
    const departed = faker.internet.email().toLowerCase();
    const [channel] = await db
      .insert(NotificationChannel)
      .values([generateNotificationChannel({ organizationId, isDefault: false, config: { addresses: [departed] } })])
      .returning();

    const response = await request(app.getHttpServer())
      .post(`/internal/v1/organizations/${organizationId}/departed-members`)
      .send({ data: { addressSha256: sha256Of(departed), fallbackAddresses: [] } });

    expect(response.status).toBe(204);
    expect(
      await db
        .select()
        .from(NotificationChannel)
        .where(inArray(NotificationChannel.id, [channel.id]))
    ).toEqual([expect.objectContaining({ config: { addresses: [] }, deletedAt: expect.any(Date) })]);
  });

  function sha256Of(address: string) {
    return createHash("sha256").update(address).digest("hex");
  }

  async function addressesById(db: NodePgDatabase<{ NotificationChannel: typeof NotificationChannel }>, ids: string[]) {
    const channels = await db.select().from(NotificationChannel).where(inArray(NotificationChannel.id, ids));

    return Object.fromEntries(channels.map(channel => [channel.id, notificationChannelConfigSchema.parse(channel.config).addresses]));
  }

  async function setup() {
    @Module({ imports: [RestModule] })
    class TestModule {}

    const module: TestingModule = await Test.createTestingModule({
      imports: [TestModule]
    }).compile();

    const app = module.createNestApplication();
    app.enableVersioning();
    app.useGlobalFilters(new HttpExceptionFilter(await app.resolve(LoggerService)));
    await app.init();
    onTestFinished(() => app.close());

    const db = module.get<NodePgDatabase<{ NotificationChannel: typeof NotificationChannel }>>(DRIZZLE_PROVIDER_TOKEN);

    return { app, db, organizationId: faker.string.uuid() };
  }
});
