import { faker } from "@faker-js/faker";
import { merge } from "lodash";

export type Message = {
  id: string;
  txId: string;
  height: number;
  type: string;
  typeCategory: string;
  index: number;
  indexInBlock: number;
  isProcessed: boolean;
  isNotificationProcessed: boolean;
  amount?: string;
  data: Uint8Array;
  relatedDeploymentId?: string;
};

export class MessageSeeder {
  static create(input: Partial<Message> = {}): Message {
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
        data: Buffer.from(
          "0a2c616b61736831306d6c34647a356e706779687a78337871306d796c3434647a79636d6b6779746d6339726865122c616b617368316778676c75336e79303835766e7765617270336b6636747668716167616479617779303567711a0d0a0475616b7412053130303030",
          "hex"
        )
      },
      input
    );
  }
}
