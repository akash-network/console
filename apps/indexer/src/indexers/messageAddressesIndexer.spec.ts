import type { AkashMessage as Message } from "@akashnetwork/database/dbSchemas/akash";
import { AddressReference } from "@akashnetwork/database/dbSchemas/base";
import type { Transaction as DbTransaction } from "sequelize";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { MessageAddressesIndexer } from "./messageAddressesIndexer";

const OVERSIZED_ADDRESS = `akash1${"q".repeat(300)}`;
const CAPPED_ADDRESS = OVERSIZED_ADDRESS.slice(0, 255);

describe(MessageAddressesIndexer.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("when a send carries addresses its column refuses", () => {
    it("stores the sender and receiver of a send with NUL characters removed and long values capped", async () => {
      const { indexer, transaction } = setup();
      const bulkCreate = vi.spyOn(AddressReference, "bulkCreate").mockResolvedValue([]);

      await indexer.processMessage(
        { fromAddress: "akash1sender\0", toAddress: OVERSIZED_ADDRESS, amount: [] },
        300,
        transaction,
        message("/cosmos.bank.v1beta1.MsgSend")
      );

      expect(bulkCreate).toHaveBeenCalledWith(
        [expect.objectContaining({ address: "akash1sender", type: "Sender" }), expect.objectContaining({ address: CAPPED_ADDRESS, type: "Receiver" })],
        { transaction }
      );
    });

    it("stores the inputs and outputs of a multi-send with NUL characters removed and long values capped", async () => {
      const { indexer, transaction } = setup();
      const bulkCreate = vi.spyOn(AddressReference, "bulkCreate").mockResolvedValue([]);

      await indexer.processMessage(
        { inputs: [{ address: "akash1sender\0", coins: [] }], outputs: [{ address: OVERSIZED_ADDRESS, coins: [] }] },
        301,
        transaction,
        message("/cosmos.bank.v1beta1.MsgMultiSend")
      );

      expect(bulkCreate).toHaveBeenCalledWith(
        [expect.objectContaining({ address: "akash1sender", type: "Sender" }), expect.objectContaining({ address: CAPPED_ADDRESS, type: "Receiver" })],
        { transaction }
      );
    });
  });

  function setup() {
    const indexer = new MessageAddressesIndexer();
    const transaction = mock<DbTransaction>();

    return { indexer, transaction };
  }
});

function message(type: string) {
  return mock<Message>({ type, id: "message-id", txId: "tx-id" });
}
