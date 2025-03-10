import { faker } from "@faker-js/faker";
import { merge } from "lodash";

import { AkashAddressSeeder } from "./akash-address.seeder";

type Block = {
  height: number;
  datetime: string;
  hash: string;
  proposer: string;
  dayId: string;
  txCount: number;
  isProcessed: boolean;
  totalUAktSpent?: number;
  totalUUsdcSpent?: number;
  totalUUsdSpent?: number;
  activeLeaseCount?: number;
  totalLeaseCount?: number;
  activeCPU?: number;
  activeGPU?: number;
  activeMemory?: number;
  activeEphemeralStorage?: number;
  activePersistentStorage?: number;
  activeProviderCount?: number;
};

export class BlockSeeder {
  static create(input: Partial<Block> = {}): Block {
    return merge(
      {
        height: faker.number.int({ min: 0, max: 10000000 }),
        datetime: faker.date.past().toISOString(),
        hash: AkashAddressSeeder.create(),
        proposer: AkashAddressSeeder.create(),
        dayId: faker.string.uuid(),
        txCount: faker.number.int({ min: 0, max: 10000000 }),
        isProcessed: faker.datatype.boolean(),
        totalTxCount: faker.number.int({ min: 0, max: 10000000 })
      },
      input
    );
  }
}
