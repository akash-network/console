import { generateMock } from "@anatine/zod-mock";
import { faker } from "@faker-js/faker";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { createServer, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { eventKeyRegistry } from "@src/common/config/event-key-registry.config";
import { BrokerService } from "@src/infrastructure/broker";
import { DRIZZLE_PROVIDER_TOKEN } from "@src/infrastructure/db/config/db.config";
import AlertEventsModule from "@src/interfaces/alert-events/alert-events.module";
import { ChainEventsHandler } from "@src/interfaces/alert-events/handlers/chain-events/chain-events.handler";
import type { AlertConfig } from "@src/modules/alert/config";
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

      vi.spyOn(brokerService, "publish").mockResolvedValue(undefined);

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

  it("adds a team deployment's deployment-closed alert to its user's feed under the key of that deployment's close, with the email it always sent", async () => {
    const { module } = await setup();

    try {
      const controller = module.get(ChainEventsHandler);
      const brokerService = module.get(BrokerService);
      const db = module.get(DRIZZLE_PROVIDER_TOKEN);
      const owner = mockAkashAddress();
      const dseq = String(faker.number.int({ min: 1, max: 999999 }));
      vi.spyOn(brokerService, "publish").mockResolvedValue(undefined);
      const [notificationChannel] = await db
        .insert(NotificationChannel)
        .values([generateNotificationChannel({})])
        .returning();
      const closedAlert = generateGeneralAlert({
        type: "CHAIN_EVENT",
        notificationChannelId: notificationChannel.id,
        organizationId: faker.string.uuid(),
        projectId: faker.string.uuid(),
        params: { dseq, type: "DEPLOYMENT_CLOSED" },
        conditions: {
          operator: "and",
          value: [
            { field: "action", value: "deployment-closed", operator: "eq" },
            { field: "owner", value: owner, operator: "eq" },
            { field: "dseq", value: dseq, operator: "eq" }
          ]
        },
        summary: "Deployment {{alert.next.params.dseq}} is now closed",
        description: "Please visit Console to manage your deployment and re-deploy if needed."
      });
      await db.insert(schema.Alert).values([closedAlert]);

      await controller.processDeploymentClosed({ ...generateMock(EventClosedDeploymentDto.schema), owner, dseq });

      expect(brokerService.publish).toHaveBeenCalledWith(eventKeyRegistry.createNotification, {
        notificationChannelId: notificationChannel.id,
        payload: {
          summary: `Deployment ${dseq} is now closed`,
          description: "Please visit Console to manage your deployment and re-deploy if needed.",
          feedEntry: {
            type: "deployment_closed_alert",
            alertId: closedAlert.id,
            userId: closedAlert.userId,
            organizationId: closedAlert.organizationId,
            projectId: closedAlert.projectId,
            dedupeKey: `deployment_close.${owner}.${dseq}`,
            dseq
          }
        }
      });
    } finally {
      await module.close();
    }
  });

  it("names a deployment by the name console-api holds for it in the email of its deployment-closed alert, linking to it in the alert's organization", async () => {
    const owner = mockAkashAddress();
    const dseq = String(faker.number.int({ min: 1, max: 999999 }));
    const consoleApi = await startConsoleApi(response => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ name: "my-app" }));
    });
    const { module } = await setup();

    try {
      const { brokerService, db, consoleWebUrl, controller } = resolve(module);
      vi.spyOn(brokerService, "publish").mockResolvedValue(undefined);
      const [notificationChannel] = await db
        .insert(NotificationChannel)
        .values([generateNotificationChannel({})])
        .returning();
      const closedAlert = generateClosedAlert({ owner, dseq, notificationChannelId: notificationChannel.id, organizationId: faker.string.uuid() });
      await db.insert(schema.Alert).values([closedAlert]);

      await controller.processDeploymentClosed({ ...generateMock(EventClosedDeploymentDto.schema), owner, dseq });

      expect(consoleApi.requests).toEqual([{ url: `/internal/deployment-names/${owner}/${dseq}`, token: consoleApi.token }]);
      expect(brokerService.publish).toHaveBeenCalledWith(
        eventKeyRegistry.createNotification,
        expect.objectContaining({
          payload: expect.objectContaining({
            summary: "Deployment “my-app” is now closed",
            description: `Please visit <a href="https://${consoleWebUrl}/deployments/${dseq}?tab=SETTINGS&org=${closedAlert.organizationId}">${consoleWebUrl}</a> to manage your deployment and re-deploy if needed.`
          })
        })
      );
    } finally {
      await module.close();
    }
  });

  it("names a deployment by its dseq in the email of its deployment-closed alert when console-api cannot name it", async () => {
    const owner = mockAkashAddress();
    const dseq = String(faker.number.int({ min: 1, max: 999999 }));
    await startConsoleApi(response => {
      response.writeHead(503);
      response.end();
    });
    const { module } = await setup();

    try {
      const { brokerService, db, controller } = resolve(module);
      vi.spyOn(brokerService, "publish").mockResolvedValue(undefined);
      const [notificationChannel] = await db
        .insert(NotificationChannel)
        .values([generateNotificationChannel({})])
        .returning();
      await db.insert(schema.Alert).values([generateClosedAlert({ owner, dseq, notificationChannelId: notificationChannel.id, organizationId: null })]);

      await controller.processDeploymentClosed({ ...generateMock(EventClosedDeploymentDto.schema), owner, dseq });

      expect(brokerService.publish).toHaveBeenCalledWith(
        eventKeyRegistry.createNotification,
        expect.objectContaining({ payload: expect.objectContaining({ summary: `Deployment ${dseq} is now closed` }) })
      );
    } finally {
      await module.close();
    }
  });

  function generateClosedAlert(input: { owner: string; dseq: string; notificationChannelId: string; organizationId: string | null }) {
    return generateGeneralAlert({
      type: "CHAIN_EVENT",
      notificationChannelId: input.notificationChannelId,
      organizationId: input.organizationId,
      params: { dseq: input.dseq, type: "DEPLOYMENT_CLOSED" },
      conditions: {
        operator: "and",
        value: [
          { field: "action", value: "deployment-closed", operator: "eq" },
          { field: "owner", value: input.owner, operator: "eq" },
          { field: "dseq", value: input.dseq, operator: "eq" }
        ]
      },
      summary: "Deployment {{{deployment.label}}} is now closed",
      description: "Please visit {{{deployment.link}}} to manage your deployment and re-deploy if needed."
    });
  }

  async function startConsoleApi(respond: (response: ServerResponse) => void) {
    const token = faker.string.alphanumeric(32);
    const requests: Array<{ url?: string; token?: string | string[] }> = [];
    const server = createServer((request, response) => {
      requests.push({ url: request.url, token: request.headers["x-console-internal-token"] });
      respond(response);
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    vi.stubEnv("CONSOLE_API_BASE_URL", `http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    vi.stubEnv("CONSOLE_API_INTERNAL_TOKEN", token);
    onTestFinished(async () => {
      vi.unstubAllEnvs();
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
    });

    return { token, requests };
  }

  function resolve(module: Awaited<ReturnType<typeof setup>>["module"]) {
    return {
      controller: module.get(ChainEventsHandler),
      brokerService: module.get(BrokerService),
      db: module.get(DRIZZLE_PROVIDER_TOKEN),
      consoleWebUrl: module.get<ConfigService<AlertConfig>>(ConfigService).getOrThrow("alert.CONSOLE_WEB_URL")
    };
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
