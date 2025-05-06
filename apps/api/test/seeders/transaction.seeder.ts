import type { Transaction } from "@akashnetwork/database/dbSchemas/base";
import { faker } from "@faker-js/faker";
import type { CreationAttributes } from "sequelize";

export class TransactionSeeder {
  static create(input: Partial<CreationAttributes<Transaction>> = {}): CreationAttributes<Transaction> {
    return {
      id: input.id || faker.string.uuid(),
      hash: input.hash || faker.string.hexadecimal({ length: 64 }),
      index: input.index || faker.number.int({ min: 0, max: 10000000 }),
      height: input.height || faker.number.int({ min: 0, max: 10000000 }),
      msgCount: input.msgCount || faker.number.int({ min: 0, max: 10000000 }),
      multisigThreshold: input.multisigThreshold || faker.number.int({ min: 1, max: 10 }),
      gasUsed: input.gasUsed || faker.number.int({ min: 0, max: 10000000 }),
      gasWanted: input.gasWanted || faker.number.int({ min: 0, max: 10000000 }),
      fee: input.fee || faker.string.numeric({ length: 5 }),
      memo: input.memo || faker.word.noun(),
      isProcessed: input.isProcessed || faker.datatype.boolean(),
      hasProcessingError: input.hasProcessingError || faker.datatype.boolean(),
      log: input.log || faker.lorem.sentence()
    };
  }
}
