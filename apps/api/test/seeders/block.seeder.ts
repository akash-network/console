import { Block } from "@akashnetwork/database/dbSchemas";
import type { AkashBlock } from "@akashnetwork/database/dbSchemas/akash";
import { faker } from "@faker-js/faker";
import type { CreationAttributes } from "sequelize";

import { AkashAddressSeeder } from "./akash-address.seeder";

export class BlockSeeder {
  static create(input: Partial<CreationAttributes<AkashBlock>> = {}): CreationAttributes<AkashBlock> {
    return {
      height: input.height || faker.number.int({ min: 0, max: 10000000 }),
      datetime: input.datetime || faker.date.past().toISOString(),
      hash: input.hash || AkashAddressSeeder.create(),
      proposer: input.proposer || AkashAddressSeeder.create(),
      dayId: input.dayId || faker.string.uuid(),
      txCount: input.txCount || faker.number.int({ min: 0, max: 10000000 }),
      isProcessed: input.isProcessed || faker.datatype.boolean(),
      totalTxCount: input.totalTxCount || faker.number.int({ min: 0, max: 10000000 }),
      totalUUsdSpent: input.totalUUsdSpent || faker.number.int({ min: 0, max: 10000000 })
    };
  }

  static async createInDatabase(input: Partial<CreationAttributes<AkashBlock>> = {}): Promise<AkashBlock> {
    return await Block.create(BlockSeeder.create(input));
  }
}
