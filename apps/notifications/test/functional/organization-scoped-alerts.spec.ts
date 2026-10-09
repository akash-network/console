import { faker } from "@faker-js/faker";
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import nock from "nock";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { DRIZZLE_PROVIDER_TOKEN } from "@src/infrastructure/db/config/db.config";
import { HttpExceptionFilter } from "@src/interfaces/rest/filters/http-exception/http-exception.filter";
import { HttpResultInterceptor } from "@src/interfaces/rest/interceptors/http-result/http-result.interceptor";
import RestModule from "@src/interfaces/rest/rest.module";
import type { OrganizationRole } from "@src/interfaces/rest/services/auth/request-identity";
import { Alert } from "@src/modules/alert/model-schemas";
import { NotificationChannel } from "@src/modules/notifications/model-schemas";

import { mockAkashAddress } from "@test/seeders/akash-address.seeder";
import { generateGeneralAlert } from "@test/seeders/general-alert.seeder";
import { generateNotificationChannel } from "@test/seeders/notification-channel.seeder";

describe("Organization-scoped alerts and notification channels", () => {
  it("shares a deployment alert with the members who reach its project", async () => {
    const { app, db, organizationId, projectId, channelId, chainApi } = await setup();
    const deployer = memberHeaders({ organizationId, role: "member", projectIds: [projectId] });
    const teammate = memberHeaders({ organizationId, role: "member", projectIds: [projectId] });
    const dseq = String(faker.number.int());
    const owner = mockAkashAddress();
    chainApi.get("/akash/deployment/v1beta4/deployments/info").query({ "id.owner": owner, "id.dseq": dseq }).reply(200, {});

    const createRes = await request(app.getHttpServer())
      .post(`/v1/deployment-alerts/${dseq}`)
      .set({ ...deployer, "x-project-id": projectId, "x-owner-address": owner })
      .send({ data: { alerts: { deploymentClosed: { notificationChannelId: channelId, enabled: true } } } });
    const teammateRes = await request(app.getHttpServer()).get(`/v1/deployment-alerts/${dseq}`).set(teammate);
    const [stored] = await db.select().from(Alert).where(eq(Alert.organizationId, organizationId));
    await app.close();

    expect(createRes.status).toBe(201);
    expect(teammateRes.status).toBe(200);
    expect(teammateRes.body.data.alerts.deploymentClosed).toMatchObject({ id: stored.id, notificationChannelId: channelId, enabled: true });
    expect(stored).toMatchObject({ userId: deployer["x-user-id"], organizationId, projectId });
  });

  it("keeps alerts of a project a member is not granted out of their reach", async () => {
    const { app, db, organizationId, projectId, channelId } = await setup();
    const [hidden] = await db
      .insert(Alert)
      .values(generateGeneralAlert({ notificationChannelId: channelId, organizationId, projectId: faker.string.uuid(), params: deploymentParams() }))
      .returning();
    const [visible] = await db
      .insert(Alert)
      .values(generateGeneralAlert({ notificationChannelId: channelId, organizationId, projectId, params: deploymentParams() }))
      .returning();
    const member = memberHeaders({ organizationId, role: "member", projectIds: [projectId] });
    const server = app.getHttpServer();

    const listRes = await request(server).get("/v1/alerts").set(member);
    const readRes = await request(server).get(`/v1/alerts/${hidden.id}`).set(member);
    const updateRes = await request(server)
      .patch(`/v1/alerts/${hidden.id}`)
      .set(member)
      .send({ data: { enabled: false } });
    const deleteRes = await request(server).delete(`/v1/alerts/${hidden.id}`).set(member);
    const ownerListRes = await request(server)
      .get("/v1/alerts")
      .set(memberHeaders({ organizationId, role: "owner" }));
    const [stillEnabled] = await db.select().from(Alert).where(eq(Alert.id, hidden.id));
    await app.close();

    expect(listRes.body.data.map((alert: { id: string }) => alert.id)).toEqual([visible.id]);
    expect([readRes.status, updateRes.status, deleteRes.status]).toEqual([404, 404, 404]);
    expect(stillEnabled.enabled).toBe(true);
    expect(ownerListRes.body.data.map((alert: { id: string }) => alert.id).sort()).toEqual([hidden.id, visible.id].sort());
  });

  it("lets a viewer read alerts in reach without changing them", async () => {
    const { app, db, organizationId, projectId, channelId } = await setup();
    const [alert] = await db
      .insert(Alert)
      .values(generateGeneralAlert({ notificationChannelId: channelId, organizationId, projectId }))
      .returning();
    const viewer = memberHeaders({ organizationId, role: "viewer", projectIds: [projectId] });

    const readRes = await request(app.getHttpServer()).get(`/v1/alerts/${alert.id}`).set(viewer);
    const deleteRes = await request(app.getHttpServer()).delete(`/v1/alerts/${alert.id}`).set(viewer);
    await app.close();

    expect(readRes.status).toBe(200);
    expect(deleteRes.status).toBe(403);
  });

  it("gives billing members no access to alerts or channels", async () => {
    const { app, organizationId } = await setup();
    const billing = memberHeaders({ organizationId, role: "billing", projectIds: [] });

    const alertsRes = await request(app.getHttpServer()).get("/v1/alerts").set(billing);
    const channelsRes = await request(app.getHttpServer()).get("/v1/notification-channels").set(billing);
    await app.close();

    expect([alertsRes.status, channelsRes.status]).toEqual([403, 403]);
  });

  it("keeps a single default notification channel per organization", async () => {
    const { app, organizationId } = await setup();
    const createDefault = (headers: Record<string, string>) =>
      request(app.getHttpServer())
        .post("/v1/notification-channels/default")
        .set(headers)
        .send({ data: { name: "Default", type: "email", config: { addresses: [faker.internet.email()] } } });

    const responses = await Promise.all([
      createDefault(memberHeaders({ organizationId, role: "owner" })),
      createDefault(memberHeaders({ organizationId, role: "member", projectIds: [] }))
    ]);
    const listRes = await request(app.getHttpServer())
      .get("/v1/notification-channels")
      .set(memberHeaders({ organizationId, role: "viewer", projectIds: [] }));
    await app.close();

    expect(responses.map(res => res.status)).toEqual([204, 204]);
    expect(listRes.body.data.filter((channel: { isDefault: boolean }) => channel.isDefault)).toHaveLength(1);
  });

  it("keeps channels user-scoped and stamps their organization when no membership is minted", async () => {
    const { app, db } = await setup();
    const organizationId = faker.string.uuid();
    const userId = faker.string.uuid();

    const createRes = await request(app.getHttpServer())
      .post("/v1/notification-channels")
      .set({ "x-user-id": userId, "x-organization-id": organizationId })
      .send({ data: { name: "Mine", type: "email", config: { addresses: [faker.internet.email()] } } });
    const otherUserRes = await request(app.getHttpServer())
      .get(`/v1/notification-channels/${createRes.body.data.id}`)
      .set({ "x-user-id": faker.string.uuid(), "x-organization-id": organizationId });
    const [stored] = await db.select().from(NotificationChannel).where(eq(NotificationChannel.id, createRes.body.data.id));
    await app.close();

    expect(createRes.status).toBe(201);
    expect(otherUserRes.status).toBe(404);
    expect(stored).toMatchObject({ userId, organizationId });
  });

  it("refuses a membership the api did not mint in full", async () => {
    const { app, organizationId } = await setup();

    const res = await request(app.getHttpServer())
      .get("/v1/alerts")
      .set({ "x-user-id": faker.string.uuid(), "x-organization-id": organizationId, "x-organization-role": "owner" });
    await app.close();

    expect(res.status).toBe(401);
  });

  function deploymentParams() {
    return { dseq: String(faker.number.int()), type: "DEPLOYMENT_CLOSED" };
  }

  function memberHeaders(input: { organizationId: string; role: OrganizationRole; projectIds?: string[] }): Record<string, string> {
    return {
      "x-user-id": faker.string.uuid(),
      "x-organization-id": input.organizationId,
      "x-organization-role": input.role,
      "x-project-scope": JSON.stringify(input.projectIds ? { kind: "projects", projectIds: input.projectIds } : { kind: "all" })
    };
  }

  async function setup() {
    @Module({
      imports: [RestModule]
    })
    class TestModule {}

    const module: TestingModule = await Test.createTestingModule({
      imports: [TestModule]
    }).compile();

    const app = module.createNestApplication();
    app.enableVersioning();
    app.useGlobalInterceptors(new HttpResultInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter(await app.resolve(LoggerService)));

    await app.init();

    const organizationId = faker.string.uuid();
    const projectId = faker.string.uuid();
    const db = module.get<NodePgDatabase<{ Alert: typeof Alert; NotificationChannel: typeof NotificationChannel }>>(DRIZZLE_PROVIDER_TOKEN);
    const [channel] = await db
      .insert(NotificationChannel)
      .values([generateNotificationChannel({ organizationId, isDefault: false })])
      .returning();
    const chainApi = nock(module.get(ConfigService).getOrThrow("API_NODE_ENDPOINT")).persist();

    return { app, db, organizationId, projectId, channelId: channel.id, chainApi };
  }
});
