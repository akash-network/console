import { describe, expect, it } from "vitest";

import { parseGenesis } from "@src/genesis/genesis-schema";

import { buildParsedGenesis, buildRawGenesis } from "@test/fakes/genesis-fixtures";

describe("parseGenesis", () => {
  it("normalizes a genesis document into the flat parsed shape", () => {
    expect(parseGenesis(buildRawGenesis())).toEqual(buildParsedGenesis());
  });

  it("seeds balances that total the reported supply", () => {
    const genesis = parseGenesis(buildRawGenesis());

    const balanceTotal = genesis.balances.flatMap(balance => balance.coins).reduce((sum, coin) => sum + BigInt(coin.amount), 0n);
    const supplyTotal = genesis.supply.reduce((sum, coin) => sum + BigInt(coin.amount), 0n);

    expect(balanceTotal).toBe(supplyTotal);
  });

  it("collects unmodeled account types instead of failing", () => {
    const raw = {
      chain_id: "sandbox-2",
      initial_height: "1",
      app_state: {
        auth: {
          accounts: [
            { "@type": "/cosmos.auth.v1beta1.BaseAccount", address: "akash1base", account_number: "1" },
            { "@type": "/cosmos.auth.v1beta1.SomethingNew", address: "akash1weird" }
          ]
        }
      }
    };

    const genesis = parseGenesis(raw);

    expect(genesis.accounts).toEqual([{ address: "akash1base", accountNumber: 1, accountType: "base", isModuleAccount: false }]);
    expect(genesis.unknownAccountTypes).toEqual(["/cosmos.auth.v1beta1.SomethingNew"]);
  });

  it("maps validators from the staking module export shape", () => {
    const raw = {
      chain_id: "akashnet-2",
      initial_height: "9455001",
      app_state: {
        staking: {
          validators: [
            {
              operator_address: "akashvaloper1dq9wvqemmpvanmwsdttajsn4hmtx5zk7cgw7cz",
              consensus_pubkey: { "@type": "/cosmos.crypto.ed25519.PubKey", key: "1YM8H2iPYXxzSEQeFJQipwRnWV4sB2EKgujqdeTYLJs=" },
              description: { moniker: "mainnet-val", identity: "id", website: "site", security_contact: "sc", details: "d" },
              commission: { commission_rates: { rate: "0.050000000000000000", max_rate: "0.200000000000000000", max_change_rate: "0.010000000000000000" } },
              min_self_delegation: "1000000"
            }
          ]
        }
      }
    };

    const genesis = parseGenesis(raw);

    expect(genesis.initialHeight).toBe(9455001);
    expect(genesis.validators).toEqual([
      {
        operatorAddress: "akashvaloper1dq9wvqemmpvanmwsdttajsn4hmtx5zk7cgw7cz",
        accountAddress: "akash1dq9wvqemmpvanmwsdttajsn4hmtx5zk7j2qcgg",
        hexAddress: "31410FDD5FF7717918AB0D32645E12B6863B2576",
        moniker: "mainnet-val",
        identity: "id",
        website: "site",
        details: "d",
        securityContact: "sc",
        commissionRate: "0.050000000000000000",
        commissionMaxRate: "0.200000000000000000",
        commissionMaxChangeRate: "0.010000000000000000",
        minSelfDelegation: "1000000"
      }
    ]);
  });

  it("records a null account number when genesis omits it", () => {
    const genesis = parseGenesis({
      chain_id: "sandbox-2",
      initial_height: "1",
      app_state: { auth: { accounts: [{ "@type": "/cosmos.auth.v1beta1.BaseAccount", address: "akash1noacctnum" }] } }
    });

    expect(genesis.accounts).toEqual([{ address: "akash1noacctnum", accountNumber: null, accountType: "base", isModuleAccount: false }]);
  });

  it("falls back to a null account address when the validator operator address is malformed", () => {
    const genesis = parseGenesis({
      chain_id: "sandbox-2",
      initial_height: "1",
      app_state: {
        staking: { validators: [{ operator_address: "invalid-operator", description: { moniker: "x" }, commission: {}, min_self_delegation: "1" }] }
      }
    });

    expect(genesis.validators[0].accountAddress).toBeNull();
    expect(genesis.validators[0].hexAddress).toBeNull();
  });

  it("defaults the initial height to 1 and tolerates missing modules", () => {
    const genesis = parseGenesis({ chain_id: "sandbox-2", app_state: {} });

    expect(genesis.initialHeight).toBe(1);
    expect(genesis.accounts).toEqual([]);
    expect(genesis.balances).toEqual([]);
    expect(genesis.validators).toEqual([]);
    expect(genesis.delegations).toEqual([]);
  });

  it("throws when a required top-level field is missing", () => {
    expect(() => parseGenesis({ app_state: {} })).toThrow();
  });
});
