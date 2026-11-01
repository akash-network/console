import { faker } from "@faker-js/faker";
import { Module } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import request from "supertest";
import { describe, expect, it, onTestFinished } from "vitest";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { DRIZZLE_PROVIDER_TOKEN } from "@src/infrastructure/db/config/db.config";
import { HttpExceptionFilter } from "@src/interfaces/rest/filters/http-exception/http-exception.filter";
import RestModule from "@src/interfaces/rest/rest.module";
import { Alert } from "@src/modules/alert/model-schemas";
import { NotificationChannel } from "@src/modules/notifications/model-schemas";

import { generateGeneralAlert } from "@test/seeders/general-alert.seeder";
import { generateNotificationChannel } from "@test/seeders/notification-channel.seeder";

describe("Organization purge (internal)", () => {
  it("deletes the organization's alerts and channels, and leaves another organization's", async () => {
    const { app, db, organizationId } = await setup();
    const otherOrganizationId = faker.string.uuid();
    const [teamChannel, otherTeamChannel] = await db
      .insert(NotificationChannel)
      .values([
        generateNotificationChannel({ organizationId, isDefault: false, config: { addresses: [faker.internet.email()] } }),
        generateNotificationChannel({ organizationId: otherOrganizationId, isDefault: false, config: { addresses: [faker.internet.email()] } })
      ])
      .returning();
    const [teamAlert, otherTeamAlert] = await db
      .insert(Alert)
      .values([
        generateGeneralAlert({ organizationId, notificationChannelId: teamChannel.id }),
        generateGeneralAlert({ organizationId: otherOrganizationId, notificationChannelId: otherTeamChannel.id })
      ])
      .returning();

    const response = await request(app.getHttpServer()).post(`/internal/v1/organizations/${organizationId}/purge`);

    expect(response.status).toBe(204);
    expect(
      await db
        .select({ id: Alert.id })
        .from(Alert)
        .where(inArray(Alert.id, [teamAlert.id, otherTeamAlert.id]))
    ).toEqual([{ id: otherTeamAlert.id }]);
    expect(
      await db
        .select({ id: NotificationChannel.id })
        .from(NotificationChannel)
        .where(inArray(NotificationChannel.id, [teamChannel.id, otherTeamChannel.id]))
    ).toEqual([{ id: otherTeamChannel.id }]);
  });

  it("deletes an alert of another organization that notifies one of the purged channels", async () => {
    const { app, db, organizationId } = await setup();
    const [teamChannel] = await db
      .insert(NotificationChannel)
      .values([generateNotificationChannel({ organizationId, isDefault: false })])
      .returning();
    const [alert] = await db
      .insert(Alert)
      .values([generateGeneralAlert({ organizationId: null, notificationChannelId: teamChannel.id })])
      .returning();

    const response = await request(app.getHttpServer()).post(`/internal/v1/organizations/${organizationId}/purge`);

    expect(response.status).toBe(204);
    expect(
      await db
        .select({ id: Alert.id })
        .from(Alert)
        .where(inArray(Alert.id, [alert.id]))
    ).toEqual([]);
  });

  it("answers 204 again when the same organization is purged a second time", async () => {
    const { app, db, organizationId } = await setup();
    await db
      .insert(NotificationChannel)
      .values([generateNotificationChannel({ organizationId, isDefault: false })])
      .returning();

    const first = await request(app.getHttpServer()).post(`/internal/v1/organizations/${organizationId}/purge`);
    const second = await request(app.getHttpServer()).post(`/internal/v1/organizations/${organizationId}/purge`);

    expect(first.status).toBe(204);
    expect(second.status).toBe(204);
  });

  it("refuses an organization id that is not a uuid", async () => {
    const { app } = await setup();

    const response = await request(app.getHttpServer()).post("/internal/v1/organizations/not-a-uuid/purge");

    expect(response.status).toBe(400);
  });

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

    const db = module.get<NodePgDatabase<{ NotificationChannel: typeof NotificationChannel; Alert: typeof Alert }>>(DRIZZLE_PROVIDER_TOKEN);

    return { app, db, organizationId: faker.string.uuid() };
  }
});
