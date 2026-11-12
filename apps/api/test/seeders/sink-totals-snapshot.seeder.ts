import { SinkTotalsSnapshot } from "@akashnetwork/database/dbSchemas/akash";

type SinkTotalsSnapshotInput = { height: number } & Partial<
  Pick<
    SinkTotalsSnapshot,
    | "pendingAmount"
    | "pendingCount"
    | "mintedAmount"
    | "mintedCount"
    | "voidedAmount"
    | "voidedCount"
    | "refundPendingAmount"
    | "refundPendingCount"
    | "refundedAmount"
    | "refundedCount"
  >
>;

export const createSinkTotalsSnapshot = async (input: SinkTotalsSnapshotInput): Promise<SinkTotalsSnapshot> => {
  return await SinkTotalsSnapshot.create({
    height: input.height,
    pendingAmount: input.pendingAmount ?? "0",
    pendingCount: input.pendingCount ?? 0,
    mintedAmount: input.mintedAmount ?? "0",
    mintedCount: input.mintedCount ?? 0,
    voidedAmount: input.voidedAmount ?? "0",
    voidedCount: input.voidedCount ?? 0,
    refundPendingAmount: input.refundPendingAmount ?? "0",
    refundPendingCount: input.refundPendingCount ?? 0,
    refundedAmount: input.refundedAmount ?? "0",
    refundedCount: input.refundedCount ?? 0
  });
};
