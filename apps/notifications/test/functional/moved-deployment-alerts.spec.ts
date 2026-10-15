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
import { HttpResultInterceptor } from "@src/interfaces/rest/interceptors/http-result/http-result.interceptor";
import RestModule from "@src/interfaces/rest/rest.module";
import { Alert } from "@src/modules/alert/model-schemas";
import type { GeneralAlertOutput } from "@src/modules/alert/repositories/alert/alert.repository";
import { NotificationChannel } from "@src/modules/notifications/model-schemas";

import { mockAkashAddress } from "@test/seeders/akash-address.seeder";
import { generateDeploymentBalanceAlert } from "@test/seeders/deployment-balance-alert.seeder";
import { generateGeneralAlert } from "@test/seeders/general-alert.seeder";
import { generateNotificationChannel } from "@test/seeders/notification-channel.seeder";

describe("Moving a deployment's alerts to another project (internal)", () => {
  it("files every alert of the deployment into the new project, wherever the alert names its owner", async () => {
    const { db, organizationId, owner, dseq, fromProjectId, toProjectId, seedAlerts, moveAlerts } = await setup();
    const alerts = await seedAlerts([
      closedAlert({ organizationId, projectId: fromProjectId, owner, dseq }),
      closedAlert({ organizationId, projectId: null, owner, dseq }),
      generateDeploymentBalanceAlert({ organizationId, projectId: fromProjectId, params: { dseq, owner } }),
      generateGeneralAlert({
        organizationId,
        projectId: fromProjectId,
        params: { dseq, type: "DEPLOYMENT_UPDATED" },
        conditions: { field: "owner", operator: "eq", value: owner }
      })
    ]);

    const res = await moveAlerts({ projectId: toProjectId });

    expect(res.status).toBe(204);
    expect(await projectsOf(db, alerts)).toEqual(alerts.map(() => toProjectId));
  });

  it("takes the alerts out of reach of the old project's members and into reach of the new project's", async () => {
    const { app, organizationId, owner, dseq, fromProjectId, toProjectId, seedAlerts, moveAlerts } = await setup();
    const [alert] = await seedAlerts([closedAlert({ organizationId, projectId: fromProjectId, owner, dseq })]);

    await moveAlerts({ projectId: toProjectId });
    const fromMemberRes = await request(app.getHttpServer())
      .get("/v1/alerts")
      .set(memberHeaders({ organizationId, projectId: fromProjectId }));
    const toMemberRes = await request(app.getHttpServer())
      .get(`/v1/deployment-alerts/${dseq}`)
      .set(memberHeaders({ organizationId, projectId: toProjectId }));

    expect(fromMemberRes.body.data).toEqual([]);
    expect(toMemberRes.body.data.alerts.deploymentClosed).toMatchObject({ id: alert.id });
  });

  it("leaves the alerts of the same dseq under another owner in the organization where they are", async () => {
    const { db, organizationId, dseq, fromProjectId, toProjectId, seedAlerts, moveAlerts } = await setup();
    const otherOwner = mockAkashAddress();
    const untouched = await seedAlerts([
      closedAlert({ organizationId, projectId: fromProjectId, owner: otherOwner, dseq }),
      generateDeploymentBalanceAlert({ organizationId, projectId: fromProjectId, params: { dseq, owner: otherOwner } }),
      generateGeneralAlert({ organizationId, projectId: fromProjectId, params: { dseq, type: "DEPLOYMENT_UPDATED" } })
    ]);

    await moveAlerts({ projectId: toProjectId });

    expect(await projectsOf(db, untouched)).toEqual(untouched.map(() => fromProjectId));
  });

  it("leaves the alerts of other deployments and of the same deployment in other organizations where they are", async () => {
    const { db, organizationId, owner, dseq, fromProjectId, toProjectId, seedAlerts, moveAlerts } = await setup();
    const untouched = await seedAlerts([
      closedAlert({ organizationId: faker.string.uuid(), projectId: fromProjectId, owner, dseq }),
      closedAlert({ organizationId: null, projectId: fromProjectId, owner, dseq }),
      closedAlert({ organizationId, projectId: fromProjectId, owner, dseq: `${dseq}1` })
    ]);

    await moveAlerts({ projectId: toProjectId });

    expect(await projectsOf(db, untouched)).toEqual(untouched.map(() => fromProjectId));
  });

  it("leaves an alert already filed in the project untouched", async () => {
    const { db, organizationId, owner, dseq, toProjectId, seedAlerts, moveAlerts } = await setup();
    const updatedAt = new Date("2026-01-01T00:00:00.000Z");
    const [alert] = await seedAlerts([{ ...closedAlert({ organizationId, projectId: toProjectId, owner, dseq }), updatedAt }]);

    await moveAlerts({ projectId: toProjectId });
    const [stored] = await db
      .select()
      .from(Alert)
      .where(inArray(Alert.id, [alert.id]));

    expect(stored.updatedAt).toEqual(updatedAt);
  });

  it("refuses a project that is not a uuid", async () => {
    const { moveAlerts } = await setup();

    const res = await moveAlerts({ projectId: "project-b" });

    expect(res.status).toBe(400);
  });

  it("refuses a move that names no owner", async () => {
    const { moveAlerts, toProjectId } = await setup();

    const res = await moveAlerts({ projectId: toProjectId, owner: "" });

    expect(res.status).toBe(400);
  });

  it("refuses an organization that is not a uuid", async () => {
    const { app, owner, dseq, toProjectId } = await setup();

    const res = await request(app.getHttpServer())
      .put(`/internal/v1/organizations/acme/deployment-alerts/${dseq}/project`)
      .send({ data: { owner, projectId: toProjectId } });

    expect(res.status).toBe(400);
  });

  function closedAlert(input: { organizationId: string | null; projectId: string | null; owner: string; dseq: string }): GeneralAlertOutput {
    return generateGeneralAlert({
      type: "CHAIN_EVENT",
      organizationId: input.organizationId,
      projectId: input.projectId,
      params: { dseq: input.dseq, type: "DEPLOYMENT_CLOSED" },
      conditions: {
        operator: "and",
        value: [
          { field: "action", operator: "eq", value: "deployment-closed" },
          { field: "owner", operator: "eq", value: input.owner },
          { field: "dseq", operator: "eq", value: input.dseq }
        ]
      }
    });
  }

  async function projectsOf(db: NodePgDatabase<{ Alert: typeof Alert }>, alerts: { id: string }[]) {
    const stored = await db
      .select({ id: Alert.id, projectId: Alert.projectId })
      .from(Alert)
      .where(
        inArray(
          Alert.id,
          alerts.map(({ id }) => id)
        )
      );
    const projectIdById = new Map(stored.map(({ id, projectId }) => [id, projectId]));

    return alerts.map(({ id }) => projectIdById.get(id));
  }

  function memberHeaders({ organizationId, projectId }: { organizationId: string; projectId: string }): Record<string, string> {
    return {
      "x-user-id": faker.string.uuid(),
      "x-organization-id": organizationId,
      "x-organization-type": "team",
      "x-organization-role": "member",
      "x-project-scope": JSON.stringify({ kind: "projects", projectIds: [projectId], writableProjectIds: [projectId] })
    };
  }

  async function setup() {
    @Module({ imports: [RestModule] })
    class TestModule {}

    const module: TestingModule = await Test.createTestingModule({
      imports: [TestModule]
    }).compile();

    const app = module.createNestApplication();
    app.enableVersioning();
    app.useGlobalInterceptors(new HttpResultInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter(await app.resolve(LoggerService)));
    await app.init();
    onTestFinished(() => app.close());

    const db = module.get<NodePgDatabase<{ Alert: typeof Alert; NotificationChannel: typeof NotificationChannel }>>(DRIZZLE_PROVIDER_TOKEN);
    const organizationId = faker.string.uuid();
    const owner = mockAkashAddress();
    const dseq = faker.string.numeric({ length: 8, allowLeadingZeros: false });
    const fromProjectId = faker.string.uuid();
    const toProjectId = faker.string.uuid();
    const [channel] = await db
      .insert(NotificationChannel)
      .values([generateNotificationChannel({ organizationId, isDefault: false })])
      .returning();

    return {
      app,
      db,
      organizationId,
      owner,
      dseq,
      fromProjectId,
      toProjectId,
      seedAlerts: (alerts: (typeof Alert.$inferInsert)[]) =>
        db
          .insert(Alert)
          .values(alerts.map(alert => ({ ...alert, notificationChannelId: channel.id })))
          .returning(),
      moveAlerts: (body: { projectId: string; owner?: string }) =>
        request(app.getHttpServer())
          .put(`/internal/v1/organizations/${organizationId}/deployment-alerts/${dseq}/project`)
          .send({ data: { owner, ...body } })
    };
  }
});
