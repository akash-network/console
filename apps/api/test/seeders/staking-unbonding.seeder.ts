import { StakingUnbonding } from "@akashnetwork/database/dbSchemas/akash";
import { faker } from "@faker-js/faker";

import { createAkashAddress } from "./akash-address.seeder";

type StakingUnbondingInput = { height: number } & Partial<
  Pick<StakingUnbonding, "transactionEventId" | "type" | "delegator" | "validator" | "amount" | "completionTime" | "creationHeight">
>;

export const createStakingUnbonding = async (input: StakingUnbondingInput): Promise<StakingUnbonding> => {
  return await StakingUnbonding.create({
    transactionEventId: input.transactionEventId ?? faker.string.uuid(),
    height: input.height,
    type: input.type ?? "unbond",
    delegator: input.delegator ?? createAkashAddress(),
    validator: input.validator ?? `akashvaloper${faker.string.alphanumeric(39).toLowerCase()}`,
    amount: input.amount ?? "1000000",
    completionTime: input.completionTime ?? (input.type === "cancel" ? null : faker.date.future()),
    creationHeight: input.creationHeight ?? null
  });
};
