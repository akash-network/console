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
      totalUAktSpent: input.totalUAktSpent || faker.number.int({ min: 0, max: 10000000 }),
      totalUUsdcSpent: input.totalUUsdcSpent || faker.number.int({ min: 0, max: 10000000 }),
      totalUUsdSpent: input.totalUUsdSpent || faker.number.int({ min: 0, max: 10000000 }),
      activeLeaseCount: input.activeLeaseCount || faker.number.int({ min: 0, max: 10000000 }),
      totalLeaseCount: input.totalLeaseCount || faker.number.int({ min: 0, max: 10000000 }),
      activeCPU: input.activeCPU || faker.number.int({ min: 0, max: 10000000 }),
      activeGPU: input.activeGPU || faker.number.int({ min: 0, max: 10000000 }),
      activeMemory: input.activeMemory || faker.number.int({ min: 0, max: 10000000 }),
      activeEphemeralStorage: input.activeEphemeralStorage || faker.number.int({ min: 0, max: 10000000 }),
      activePersistentStorage: input.activePersistentStorage || faker.number.int({ min: 0, max: 10000000 }),
      activeProviderCount: input.activeProviderCount || faker.number.int({ min: 0, max: 10000000 })
    };
  }

  static async createInDatabase(input: Partial<CreationAttributes<AkashBlock>> = {}): Promise<AkashBlock> {
    return await Block.create(BlockSeeder.create(input));
  }
}
