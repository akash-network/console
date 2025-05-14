import { generateMock } from "@anatine/zod-mock";
import { faker } from "@faker-js/faker";
import { Test } from "@nestjs/testing";

import { BrokerService } from "@src/infrastructure/broker";
import { DRIZZLE_PROVIDER_TOKEN } from "@src/infrastructure/db/config/db.config";
import AlertEventsModule from "@src/interfaces/alert-events/alert-events.module";
import { ChainEventsHandler } from "@src/interfaces/alert-events/handlers/chain-events/chain-events.handler";
import { MsgCloseDeploymentDto } from "@src/modules/alert/dto/msg-close-deployment.dto";
import * as schema from "@src/modules/alert/model-schemas";

import { mockAkashAddress } from "@test/seeders/akash-address.seeder";
import { generateContactPoint } from "@test/seeders/contact-point.seeder";
import { generateRawAlert } from "@test/seeders/raw-alert.seeder";

describe("raw alerts", () => {
  it("should send an alert based on conditions", async () => {
    const { module } = await setup();
    const controller = module.get(ChainEventsHandler);
    const brokerService = module.get(BrokerService);
    const db = module.get(DRIZZLE_PROVIDER_TOKEN);

    const owner = mockAkashAddress();
    const dseq = faker.number.int({ min: 0, max: 999999 });

    jest.spyOn(brokerService, "publish").mockResolvedValue(undefined);

    const [contactPoint] = await db
      .insert(schema.ContactPoint)
      .values([generateContactPoint({})])
      .returning();

    const matchingAlert = generateRawAlert({
      contactPointId: contactPoint.id,
      conditions: {
        value: [
          {
            field: "value.id.owner",
            value: owner,
            operator: "eq"
          },
          {
            field: "type",
            value: "akash.deployment.v1beta3.MsgCloseDeployment",
            operator: "eq"
          }
        ],
        operator: "and"
      },
      summary: "deployment {{value.id.dseq.low}} closed",
      description: "deployment {{value.id.dseq.low}} is closed"
    });

    const mismatchingAlert = generateRawAlert({
      contactPointId: contactPoint.id,
      conditions: {
        value: [
          {
            field: "value.id.owner",
            value: mockAkashAddress(),
            operator: "eq"
          },
          {
            field: "type",
            value: "akash.deployment.v1beta3.MsgCloseDeployment",
            operator: "eq"
          }
        ],
        operator: "and"
      },
      summary: "deployment {{value.id.dseq.low}} closed",
      description: "deployment {{value.id.dseq.low}} is closed"
    });

    await db.insert(schema.RawAlert).values([matchingAlert, mismatchingAlert]);

    const message = generateMock(MsgCloseDeploymentDto.schema);
    message.value.id.owner = owner;
    message.value.id.dseq.low = dseq;

    await controller.processDeploymentClosed(message);

    expect(brokerService.publish).toHaveBeenCalledTimes(1);
    expect(brokerService.publish).toHaveBeenCalledWith("notifications.v1.notification.send", {
      contactPointId: contactPoint.id,
      payload: {
        summary: `deployment ${dseq} closed`,
        description: `deployment ${dseq} is closed`
      }
    });

    await module.close();
  });

  async function setup() {
    const module = await Test.createTestingModule({
      imports: [AlertEventsModule]
    }).compile();

    return {
      module
    };
  }
});
