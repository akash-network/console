import { generateMock } from "@anatine/zod-mock";
import { faker } from "@faker-js/faker";
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import nock from "nock";
import request from "supertest";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { DRIZZLE_PROVIDER_TOKEN } from "@src/infrastructure/db/config/db.config";
import { DeploymentAlertCreateInput } from "@src/interfaces/rest/controllers/deployment-alert/deployment-alert.controller";
import { HttpExceptionFilter } from "@src/interfaces/rest/filters/http-exception/http-exception.filter";
import { HttpResultInterceptor } from "@src/interfaces/rest/interceptors/http-result/http-result.interceptor";
import RestModule from "@src/interfaces/rest/rest.module";
import * as schema from "@src/modules/alert/model-schemas";

import { mockAkashAddress } from "@test/seeders/akash-address.seeder";
import { generateNotificationChannel } from "@test/seeders/notification-channel.seeder";

describe("Deployment Alerts CRUD", () => {
  it("should perform all CRUD operations against raw alerts", async () => {
    const { app, userId, notificationChannelId, chainApi } = await setup();

    const input = generateMock(DeploymentAlertCreateInput.schema);

    const dseq = String(faker.number.int());
    const owner = mockAkashAddress();
    chainApi
      .get("/akash/deployment/v1beta3/deployments/info")
      .query({
        "id.owner": owner,
        "id.dseq": String(dseq)
      })
      .reply(200, () => {
        return {};
      });

    input.data.alerts.deploymentBalance!.notificationChannelId = notificationChannelId;
    input.data.alerts.deploymentClosed!.notificationChannelId = notificationChannelId;

    const createRes = await request(app.getHttpServer())
      .post(`/v1/deployment-alerts/${dseq}`)
      .set("x-user-id", userId)
      .set("x-owner-address", owner)
      .send(input);
    const getRes = await request(app.getHttpServer()).get(`/v1/deployment-alerts/${dseq}`).set("x-user-id", userId).send(input);
    await app.close();

    const expectedOutput = {
      data: {
        dseq,
        alerts: {
          deploymentBalance: {
            notificationChannelId,
            enabled: input.data.alerts.deploymentBalance!.enabled,
            threshold: input.data.alerts.deploymentBalance!.threshold,
            status: "OK",
            id: expect.any(String)
          },
          deploymentClosed: {
            notificationChannelId,
            enabled: input.data.alerts.deploymentClosed!.enabled,
            status: "OK",
            id: expect.any(String)
          }
        }
      }
    };

    expect(createRes.status).toBe(201);
    expect(createRes.body).toEqual(expectedOutput);

    expect(getRes.status).toBe(200);
    expect(getRes.body).toEqual(expectedOutput);
  });

  it("should respond with 404 if owner is not provided", async () => {
    const { app, userId, notificationChannelId } = await setup();

    const input = generateMock(DeploymentAlertCreateInput.schema);

    const dseq = String(faker.number.int());

    input.data.alerts.deploymentBalance!.notificationChannelId = notificationChannelId;
    input.data.alerts.deploymentClosed!.notificationChannelId = notificationChannelId;

    const createRes = await request(app.getHttpServer()).post(`/v1/deployment-alerts/${dseq}`).set("x-user-id", userId).send(input);
    await app.close();

    expect(createRes.status).toBe(404);
  });

  it("should respond with 404 if wrong owner is provided", async () => {
    const { app, userId, notificationChannelId } = await setup();

    const input = generateMock(DeploymentAlertCreateInput.schema);

    const dseq = String(faker.number.int());
    const owner = mockAkashAddress();

    input.data.alerts.deploymentBalance!.notificationChannelId = notificationChannelId;
    input.data.alerts.deploymentClosed!.notificationChannelId = notificationChannelId;

    const createRes = await request(app.getHttpServer())
      .post(`/v1/deployment-alerts/${dseq}`)
      .set("x-user-id", userId)
      .set("x-owner-address", owner)
      .send(input);
    await app.close();

    expect(createRes.status).toBe(404);
  });

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

    const userId = faker.string.uuid();
    const db = module.get<NodePgDatabase<typeof schema>>(DRIZZLE_PROVIDER_TOKEN);
    const [notificationChannel] = await db
      .insert(schema.NotificationChannel)
      .values([generateNotificationChannel({ userId })])
      .returning();

    const chainApi = nock(module.get(ConfigService).getOrThrow("API_NODE_ENDPOINT")).persist();

    return { app, notificationChannelId: notificationChannel.id, userId, chainApi };
  }
});
