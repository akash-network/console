import { faker } from "@faker-js/faker";
import { merge } from "lodash";

export type Transaction = {
  id: string;
  hash: string;
  index: number;
  height: number;
  msgCount: number;
  multisigThreshold?: number;
  gasUsed: number;
  gasWanted: number;
  fee: string;
  memo: string;
  isProcessed: boolean;
  hasProcessingError: boolean;
  log?: string;
};

export class TransactionSeeder {
  static create(input: Partial<Transaction> = {}): Transaction {
    return merge(
      {
        id: faker.string.uuid(),
        hash: faker.string.hexadecimal({ length: 64 }),
        index: faker.number.int({ min: 0, max: 10000000 }),
        height: faker.number.int({ min: 0, max: 10000000 }),
        msgCount: faker.number.int({ min: 0, max: 10000000 }),
        gasUsed: faker.number.int({ min: 0, max: 10000000 }),
        gasWanted: faker.number.int({ min: 0, max: 10000000 }),
        fee: faker.string.numeric({ length: 5 }),
        memo: faker.word.noun(),
        isProcessed: faker.datatype.boolean(),
        hasProcessingError: faker.datatype.boolean()
      },
      input
    );
  }
}
