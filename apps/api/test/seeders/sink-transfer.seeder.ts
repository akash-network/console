import { SinkTransfer } from "@akashnetwork/database/dbSchemas/akash";
import { faker } from "@faker-js/faker";

import { createAkashAddress } from "./akash-address.seeder";

type SinkTransferInput = { height: number } & Partial<
  Pick<SinkTransfer, "sequence" | "owner" | "recipient" | "amount" | "status" | "hasVoidOrder" | "statusHeight">
>;

export const createSinkTransfer = async (input: SinkTransferInput): Promise<SinkTransfer> => {
  return await SinkTransfer.create({
    height: input.height,
    sequence: input.sequence ?? 1,
    owner: input.owner ?? createAkashAddress(),
    recipient: input.recipient ?? faker.string.alphanumeric(44),
    amount: input.amount ?? "1000000",
    status: input.status ?? "pending",
    hasVoidOrder: input.hasVoidOrder ?? false,
    statusHeight: input.statusHeight ?? input.height
  });
};
