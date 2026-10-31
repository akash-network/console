import type { AkashMessage as Message } from "@akashnetwork/database/dbSchemas/akash";
import { Validator } from "@akashnetwork/database/dbSchemas/base";
import { toBase64, toBech32 } from "@cosmjs/encoding";
import type { Transaction as DbTransaction } from "sequelize";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { IGenesis, IGenesisValidator, IGentxCreateValidator } from "@src/chain/genesisTypes";
import { sequelize } from "@src/db/dbConnection";
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

  describe("when a genesis validator description carries values its columns refuse", () => {
    it("seeds genesis and gentx validators with NUL characters removed and long values capped", async () => {
      const { indexer, transaction } = setup();
      vi.spyOn(sequelize, "transaction").mockImplementation((async (callback: (t: DbTransaction) => Promise<void>) => callback(transaction)) as never);
      const create = vi.spyOn(Validator, "create").mockResolvedValue(mock<Validator>());

      await indexer.seed(genesis({ validators: [genesisValidator()], gentxs: [gentxValidator()] }));

      const cleanedDescription = expect.objectContaining({
        moniker: "node",
        identity: CAPPED_IDENTITY,
        website: "https://validator.example.com",
        description: "runs  nodes",
        securityContact: "sec@example.com"
      });
      expect(create.mock.calls.map(([validator]) => validator)).toEqual([cleanedDescription, cleanedDescription]);
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

const UNCLEAN_DESCRIPTION = {
  moniker: "node\0",
  identity: OVERSIZED_IDENTITY,
  website: "https://validator.example.com\0",
  details: "runs \0 nodes",
  security_contact: "sec\0@example.com"
};

const ED25519_PUBKEY = { "@type": "/cosmos.crypto.ed25519.PubKey", key: toBase64(new Uint8Array(32)) };

function genesis(input: { validators: IGenesisValidator[]; gentxs: IGentxCreateValidator[] }): IGenesis {
  return {
    app_state: {
      gov: { proposals: [] },
      staking: { validators: input.validators },
      genutil: { gen_txs: [{ body: { messages: input.gentxs } }] }
    }
  };
}

function genesisValidator(): IGenesisValidator {
  return {
    commission: { commission_rates: { max_change_rate: "0.01", max_rate: "0.2", rate: "0.05" }, update_time: "2020-01-01T00:00:00Z" },
    consensus_pubkey: ED25519_PUBKEY,
    delegate_shares: "1",
    description: UNCLEAN_DESCRIPTION,
    jailed: false,
    min_self_delegation: "1",
    operator_address: toBech32("akashvaloper", new Uint8Array(20).fill(1)),
    status: "BOND_STATUS_BONDED",
    tokens: "1",
    unbonding_height: "0",
    unbonding_time: "1970-01-01T00:00:00Z"
  };
}

function gentxValidator(): IGentxCreateValidator {
  return {
    "@type": "/cosmos.staking.v1beta1.MsgCreateValidator",
    description: UNCLEAN_DESCRIPTION,
    commission: { rate: "0.05", max_rate: "0.2", max_change_rate: "0.01" },
    min_self_delegation: "1",
    delegator_address: toBech32("akash", new Uint8Array(20).fill(2)),
    validator_address: toBech32("akashvaloper", new Uint8Array(20).fill(2)),
    pubkey: ED25519_PUBKEY,
    value: { denom: "uakt", amount: "1" }
  };
}
