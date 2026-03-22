import { AkashBlock } from "@akashnetwork/database/dbSchemas/akash";
import { faker } from "@faker-js/faker";
import type { CreationAttributes } from "sequelize";

import { createAkashAddress } from "./akash-address.seeder";

export const createAkashBlock = async (input: Partial<CreationAttributes<AkashBlock>> = {}): Promise<AkashBlock> => {
  return await AkashBlock.create({
    height: input.height ?? faker.number.int({ min: 0, max: 10000000 }),
    datetime: input.datetime ?? faker.date.past(),
    hash: input.hash ?? createAkashAddress(),
    proposer: input.proposer ?? createAkashAddress(),
    dayId: input.dayId ?? faker.string.uuid(),
    txCount: input.txCount ?? faker.number.int({ min: 0, max: 10000000 }),
    isProcessed: input.isProcessed ?? faker.datatype.boolean(),
    totalTxCount: input.totalTxCount ?? faker.number.int({ min: 0, max: 10000000 }),
    totalUAktSpent: input.totalUAktSpent ?? faker.number.int({ min: 0, max: 10000000 }),
    totalUUsdcSpent: input.totalUUsdcSpent ?? faker.number.int({ min: 0, max: 10000000 }),
    totalUActSpent: input.totalUActSpent ?? faker.number.int({ min: 0, max: 10000000 }),
    totalUUsdSpent: input.totalUUsdSpent ?? faker.number.int({ min: 0, max: 10000000 }),
    activeLeaseCount: input.activeLeaseCount ?? faker.number.int({ min: 0, max: 10000000 }),
    totalLeaseCount: input.totalLeaseCount ?? faker.number.int({ min: 0, max: 10000000 }),
    activeCPU: input.activeCPU ?? faker.number.int({ min: 0, max: 10000000 }),
    activeGPU: input.activeGPU ?? faker.number.int({ min: 0, max: 10000000 }),
    activeMemory: input.activeMemory ?? faker.number.int({ min: 0, max: 10000000 }),
    activeEphemeralStorage: input.activeEphemeralStorage ?? faker.number.int({ min: 0, max: 10000000 }),
    activePersistentStorage: input.activePersistentStorage ?? faker.number.int({ min: 0, max: 10000000 }),
    activeProviderCount: input.activeProviderCount ?? faker.number.int({ min: 0, max: 10000000 }),
    totalUaktBurnedForUact: input.totalUaktBurnedForUact ?? faker.number.int({ min: 0, max: 10000000 }),
    totalUactMinted: input.totalUactMinted ?? faker.number.int({ min: 0, max: 10000000 }),
    totalUactBurnedForUakt: input.totalUactBurnedForUakt ?? faker.number.int({ min: 0, max: 10000000 }),
    totalUaktReminted: input.totalUaktReminted ?? faker.number.int({ min: 0, max: 10000000 }),
    vaultUakt: input.vaultUakt ?? faker.number.int({ min: 0, max: 10000000 }),
    outstandingUact: input.outstandingUact ?? faker.number.int({ min: 1, max: 10000000 })
  });
};
