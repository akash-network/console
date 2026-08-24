import { generateMock } from "@anatine/zod-mock";
import { faker } from "@faker-js/faker";
import { ConfigService } from "@nestjs/config";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import nock from "nock";
import { describe, expect, it, vi } from "vitest";

import { BrokerService } from "@src/infrastructure/broker";
import { DRIZZLE_PROVIDER_TOKEN } from "@src/infrastructure/db/config/db.config";
import AlertEventsModule from "@src/interfaces/alert-events/alert-events.module";
import { ChainEventsHandler } from "@src/interfaces/alert-events/handlers/chain-events/chain-events.handler";
import { ChainBlockCreatedDto } from "@src/modules/alert/dto/chain-block-created.dto";
import * as alertSchema from "@src/modules/alert/model-schemas";
import { NotificationChannel } from "@src/modules/notifications/model-schemas";

import { mockAkashAddress } from "@test/seeders/akash-address.seeder";
import { generateDeploymentBalanceAlert } from "@test/seeders/deployment-balance-alert.seeder";
import { generateNotificationChannel } from "@test/seeders/notification-channel.seeder";

describe("balance alerts", () => {
  it("does not evaluate DEPLOYMENT_BALANCE alerts on processBlock", async () => {
    const { module, chainApi, db, schema } = await setup();
    try {
      const controller = module.get(ChainEventsHandler);
      const brokerService = module.get(BrokerService);

      const owner = mockAkashAddress();
      const matchingDseq = faker.number.int({ min: 0, max: 999999 });
      const CURRENT_HEIGHT = 1000;

      vi.spyOn(brokerService, "publish").mockResolvedValue(undefined);

      const [notificationChannel] = await db
        .insert(schema.NotificationChannel)
        .values([generateNotificationChannel({})])
        .returning();

      const matchingAlert = generateDeploymentBalanceAlert({
        notificationChannelId: notificationChannel.id,
        conditions: {
          field: "balance",
          value: 10000000,
          operator: "lt"
        },
        params: {
          dseq: String(matchingDseq),
          owner
        },
        summary: `deployment low: ${matchingDseq}`,
        description: `deployment ${matchingDseq} balance is {{data.balance}} < 10000000 uAKT`,
        minBlockHeight: CURRENT_HEIGHT
      });

      await db.insert(schema.Alert).values([matchingAlert]);

      let deploymentInfoRequested = 0;

      chainApi
        .get("/akash/deployment/v1beta4/deployments/info")
        .query({
          "id.owner": owner,
          "id.dseq": String(matchingDseq)
        })
        .reply(200, () => {
          deploymentInfoRequested++;
          return {};
        });

      const message = generateMock(ChainBlockCreatedDto.schema);
      message.height = CURRENT_HEIGHT;

      await controller.processBlock(message);

      expect(deploymentInfoRequested).toBe(0);
      expect(brokerService.publish).not.toHaveBeenCalled();
    } finally {
      await module.close();
    }
  });

  async function setup() {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AlertEventsModule]
    }).compile();

    const chainApi = nock(module.get(ConfigService).getOrThrow("API_NODE_ENDPOINT")).persist();

    const schema = {
      ...alertSchema,
      NotificationChannel
    };
    const db = module.get<NodePgDatabase<typeof schema>>(DRIZZLE_PROVIDER_TOKEN);

    return {
      module,
      chainApi,
      db,
      schema
    };
  }
});
