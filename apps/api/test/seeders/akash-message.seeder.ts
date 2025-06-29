import { AkashMessage } from "@akashnetwork/database/dbSchemas/akash";
import { faker } from "@faker-js/faker";
import type { CreationAttributes } from "sequelize";

export const createAkashMessage = async (input: Partial<CreationAttributes<AkashMessage>> = {}): Promise<AkashMessage> => {
  return await AkashMessage.create({
    id: input.id || faker.string.uuid(),
    txId: input.txId || faker.string.uuid(),
    height: input.height || faker.number.int({ min: 0, max: 10000000 }),
    type: input.type || "/cosmos.bank.v1beta1.MsgSend",
    typeCategory: input.typeCategory || "cosmos",
    index: input.index || faker.number.int({ min: 0, max: 10000000 }),
    indexInBlock: input.indexInBlock || faker.number.int({ min: 0, max: 10000000 }),
    isProcessed: input.isProcessed || faker.datatype.boolean(),
    isNotificationProcessed: input.isNotificationProcessed || faker.datatype.boolean(),
    data:
      input.data ||
      Buffer.from(
        "0a2c616b61736831306d6c34647a356e706779687a78337871306d796c3434647a79636d6b6779746d6339726865122c616b617368316778676c75336e79303835766e7765617270336b6636747668716167616479617779303567711a0d0a0475616b7412053130303030",
        "hex"
      ),
    relatedDeploymentId: input.relatedDeploymentId || faker.string.uuid()
  });
};
