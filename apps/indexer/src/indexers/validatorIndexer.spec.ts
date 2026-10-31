import type { AkashMessage as Message } from "@akashnetwork/database/dbSchemas/akash";
import { Validator } from "@akashnetwork/database/dbSchemas/base";
import type { Transaction as DbTransaction } from "sequelize";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { ValidatorIndexer } from "./validatorIndexer";

const OVERSIZED_IDENTITY = "i".repeat(3000);
const CAPPED_IDENTITY = "i".repeat(255);

describe(ValidatorIndexer.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("when a validator description carries values its columns refuse", () => {
    it("stores a created validator with NUL characters removed and long values capped", async () => {
      const { indexer, transaction } = setup();
      vi.spyOn(Validator, "findOne").mockResolvedValue(null);
      const create = vi.spyOn(Validator, "create").mockResolvedValue(mock<Validator>());

      await indexer.processMessage(
        {
          validatorAddress: "akashvaloper1validator",
          delegatorAddress: "akash1delegator",
          pubkey: { typeUrl: "/cosmos.crypto.ed25519.PubKey", value: new Uint8Array(34) },
          description: {
            moniker: "node\0",
            identity: OVERSIZED_IDENTITY,
            website: "https://validator.example.com\0",
            details: "runs \0 nodes",
            securityContact: "sec\0@example.com"
          },
          commission: { rate: "0.05", maxRate: "0.2", maxChangeRate: "0.01" },
          minSelfDelegation: "1"
        },
        200,
        transaction,
        message("/cosmos.staking.v1beta1.MsgCreateValidator")
      );

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          moniker: "node",
          identity: CAPPED_IDENTITY,
          website: "https://validator.example.com",
          description: "runs  nodes",
          securityContact: "sec@example.com"
        }),
        { transaction }
      );
    });

    it("stores a created validator without a description without description fields", async () => {
      const { indexer, transaction } = setup();
      vi.spyOn(Validator, "findOne").mockResolvedValue(null);
      const create = vi.spyOn(Validator, "create").mockResolvedValue(mock<Validator>());

      await indexer.processMessage(
        {
          validatorAddress: "akashvaloper1validator",
          delegatorAddress: "akash1delegator",
          pubkey: { typeUrl: "/cosmos.crypto.ed25519.PubKey", value: new Uint8Array(34) },
          minSelfDelegation: "1"
        },
        202,
        transaction,
        message("/cosmos.staking.v1beta1.MsgCreateValidator")
      );

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ moniker: undefined, identity: undefined, website: undefined, description: undefined, securityContact: undefined }),
        { transaction }
      );
    });

    it("stores an edited validator with NUL characters removed and long values capped", async () => {
      const { indexer, transaction } = setup();
      const validator = mock<Validator>();
      vi.spyOn(Validator, "findOne").mockResolvedValue(validator);

      await indexer.processMessage(
        {
          validatorAddress: "akashvaloper1validator",
          description: {
            moniker: "node\0",
            identity: OVERSIZED_IDENTITY,
            website: "https://validator.example.com\0",
            details: "runs \0 nodes",
            securityContact: "sec\0@example.com"
          }
        },
        201,
        transaction,
        message("/cosmos.staking.v1beta1.MsgEditValidator")
      );

      expect(validator).toEqual(
        expect.objectContaining({
          moniker: "node",
          identity: CAPPED_IDENTITY,
          website: "https://validator.example.com",
          description: "runs  nodes",
          securityContact: "sec@example.com"
        })
      );
      expect(validator.save).toHaveBeenCalledWith({ transaction });
    });
  });

  function setup() {
    const indexer = new ValidatorIndexer();
    const transaction = mock<DbTransaction>();

    return { indexer, transaction };
  }
});

function message(type: string) {
  return mock<Message>({ type, id: "message-id", txId: "tx-id" });
}
