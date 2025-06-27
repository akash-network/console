import { AkashMessage } from "@akashnetwork/database/dbSchemas/akash";
import { faker } from "@faker-js/faker";
import { merge } from "lodash";
import type { CreationAttributes } from "sequelize";

export class AkashMessageSeeder {
  static create(input: Partial<CreationAttributes<AkashMessage>> = {}): CreationAttributes<AkashMessage> {
    return merge(
      {
        id: faker.string.uuid(),
        txId: faker.string.uuid(),
        height: faker.number.int({ min: 0, max: 10000000 }),
        type: "/cosmos.bank.v1beta1.MsgSend",
        typeCategory: "cosmos",
        index: faker.number.int({ min: 0, max: 10000000 }),
        indexInBlock: faker.number.int({ min: 0, max: 10000000 }),
        isProcessed: faker.datatype.boolean(),
        isNotificationProcessed: faker.datatype.boolean(),
        amount: faker.number.int({ min: 0, max: 10000000 }).toString(),
        data: Buffer.from(
          "0a2c616b61736831306d6c34647a356e706779687a78337871306d796c3434647a79636d6b6779746d6339726865122c616b617368316778676c75336e79303835766e7765617270336b6636747668716167616479617779303567711a0d0a0475616b7412053130303030",
          "hex"
        ),
        relatedDeploymentId: faker.string.uuid()
      },
      input
    );
  }

  static async createInDatabase(input: Partial<CreationAttributes<AkashMessage>> = {}): Promise<AkashMessage> {
    return await AkashMessage.create(AkashMessageSeeder.create(input));
  }
}
