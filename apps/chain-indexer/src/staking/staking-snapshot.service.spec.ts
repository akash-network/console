import { toBase64 } from "@cosmjs/encoding";
import { PubKey as Ed25519PubKey } from "cosmjs-types/cosmos/crypto/ed25519/keys";
import {
  QueryValidatorDelegationsResponse,
  QueryValidatorsResponse,
  QueryValidatorUnbondingDelegationsResponse
} from "cosmjs-types/cosmos/staking/v1beta1/query";
import { BondStatus } from "cosmjs-types/cosmos/staking/v1beta1/staking";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { Delegations, UnbondingDelegations, Validators } from "@src/db/schema";
import type { AccountInterner } from "@src/pipeline/balance/account-interner.service";
import type { ChainDatabase } from "@src/providers/db.provider";
import type { LoggerService } from "@src/providers/logging.provider";
import type { RpcClientPool } from "@src/rpc/rpc-client-pool.service";
import { VALIDATOR_DELEGATIONS_PATH, VALIDATOR_UNBONDING_PATH, VALIDATORS_PATH } from "@src/staking/staking-query";
import { StakingSnapshotService } from "@src/staking/staking-snapshot.service";

const OPERATOR = "akashvaloper1abc";

describe(StakingSnapshotService.name, () => {
  it("upserts each validator's bond state at the snapshot height", async () => {
    const { service, inserts } = setup({
      [VALIDATORS_PATH]: [
        validatorsResponse([
          validator({ operatorAddress: OPERATOR, status: BondStatus.BOND_STATUS_BONDED, tokens: "7000000", delegatorShares: "7000000000000000000000000" })
        ])
      ]
    });

    await service.snapshot(1000);

    expect(rowsFor(inserts, Validators)).toEqual([
      expect.objectContaining({
        operatorAddress: OPERATOR,
        jailed: false,
        status: "bonded",
        tokens: "7000000",
        delegatorShares: "7000000.000000000000000000",
        unbondingHeight: null,
        unbondingTime: null
      })
    ]);
  });

  it("derives each validator's consensus hex address from its ed25519 pubkey", async () => {
    const { service, inserts } = setup({
      [VALIDATORS_PATH]: [
        validatorsResponse([
          validator({
            operatorAddress: OPERATOR,
            consensusPubkey: { typeUrl: "/cosmos.crypto.ed25519.PubKey", value: Ed25519PubKey.encode({ key: new Uint8Array(32).fill(1) }).finish() }
          })
        ])
      ]
    });

    await service.snapshot(1000);

    expect(rowsFor(inserts, Validators)[0]).toMatchObject({ operatorAddress: OPERATOR, hexAddress: "72CD6E8422C407FB6D098690F1130B7DED7EC2F7" });
  });

  it("leaves the consensus hex address null when the validator has no pubkey", async () => {
    const { service, inserts } = setup({ [VALIDATORS_PATH]: [validatorsResponse([validator({ operatorAddress: OPERATOR })])] });

    await service.snapshot(1000);

    expect(rowsFor(inserts, Validators)[0]).toMatchObject({ operatorAddress: OPERATOR, hexAddress: null });
  });

  it("fully replaces delegations with interned delegator ids", async () => {
    const { service, inserts, deletes } = setup({
      [VALIDATORS_PATH]: [validatorsResponse([validator({ operatorAddress: OPERATOR })])],
      [VALIDATOR_DELEGATIONS_PATH]: [delegationsResponse([{ delegatorAddress: "akash1del", validatorAddress: OPERATOR, shares: "3000000000000000000000000" }])]
    });

    await service.snapshot(1000);

    expect(deletes).toContain(Delegations);
    expect(rowsFor(inserts, Delegations)).toEqual([{ delegatorAccountId: 1, validatorOperatorAddress: OPERATOR, shares: "3000000.000000000000000000" }]);
  });

  it("fully replaces unbonding entries with interned delegator ids", async () => {
    const { service, inserts, deletes } = setup({
      [VALIDATORS_PATH]: [validatorsResponse([validator({ operatorAddress: OPERATOR })])],
      [VALIDATOR_UNBONDING_PATH]: [
        unbondingResponse([
          {
            delegatorAddress: "akash1del",
            validatorAddress: OPERATOR,
            entries: [{ creationHeight: 900n, completionTime: { seconds: 1_700_000_000n, nanos: 0 }, initialBalance: "500000", balance: "500000" }]
          }
        ])
      ]
    });

    await service.snapshot(1000);

    expect(deletes).toContain(UnbondingDelegations);
    expect(rowsFor(inserts, UnbondingDelegations)).toEqual([
      {
        delegatorAccountId: 1,
        validatorOperatorAddress: OPERATOR,
        creationHeight: 900,
        completionTime: new Date(1_700_000_000_000),
        initialBalance: "500000",
        balance: "500000"
      }
    ]);
  });

  it("follows the pagination cursor across validator pages", async () => {
    const { service, inserts } = setup({
      [VALIDATORS_PATH]: [
        validatorsResponse([validator({ operatorAddress: "akashvaloper1a" })], new Uint8Array([9])),
        validatorsResponse([validator({ operatorAddress: "akashvaloper1b" })])
      ]
    });

    await service.snapshot(1000);

    expect(rowsFor(inserts, Validators).map(row => row.operatorAddress)).toEqual(["akashvaloper1a", "akashvaloper1b"]);
  });

  it("fetches and writes delegations for every validator in the set", async () => {
    const { service, inserts } = setup({
      [VALIDATORS_PATH]: [validatorsResponse([validator({ operatorAddress: "akashvaloper1a" }), validator({ operatorAddress: "akashvaloper1b" })])],
      [VALIDATOR_DELEGATIONS_PATH]: [
        delegationsResponse([{ delegatorAddress: "akash1dela", validatorAddress: "akashvaloper1a", shares: "1000000000000000000" }]),
        delegationsResponse([{ delegatorAddress: "akash1delb", validatorAddress: "akashvaloper1b", shares: "2000000000000000000" }])
      ]
    });

    await service.snapshot(1000);

    expect(rowsFor(inserts, Delegations)).toEqual([
      { delegatorAccountId: 1, validatorOperatorAddress: "akashvaloper1a", shares: "1.000000000000000000" },
      { delegatorAccountId: 2, validatorOperatorAddress: "akashvaloper1b", shares: "2.000000000000000000" }
    ]);
  });

  it("interns every delegator before writing", async () => {
    const { service, interner } = setup({
      [VALIDATORS_PATH]: [validatorsResponse([validator({ operatorAddress: OPERATOR })])],
      [VALIDATOR_DELEGATIONS_PATH]: [delegationsResponse([{ delegatorAddress: "akash1del", validatorAddress: OPERATOR, shares: "1000000000000000000" }])],
      [VALIDATOR_UNBONDING_PATH]: [
        unbondingResponse([
          {
            delegatorAddress: "akash1unbonding",
            validatorAddress: OPERATOR,
            entries: [{ creationHeight: 1n, completionTime: { seconds: 1n, nanos: 0 }, initialBalance: "1", balance: "1" }]
          }
        ])
      ]
    });

    await service.snapshot(1000);

    expect(new Set([...interner.resolve.mock.calls[0][0]])).toEqual(new Set(["akash1del", "akash1unbonding"]));
  });

  it("aborts the fetch when told to stop", async () => {
    const { service } = setup({
      [VALIDATORS_PATH]: [validatorsResponse([validator({ operatorAddress: OPERATOR })])]
    });

    await expect(service.snapshot(1000, () => true)).rejects.toThrow("Staking snapshot stopped");
  });

  it("retries a transient staking query failure and still writes the page", async () => {
    const { service, inserts, rpc } = setup({
      [VALIDATORS_PATH]: [validatorsResponse([validator({ operatorAddress: OPERATOR })])]
    });
    rpc.abciQuery.mockRejectedValueOnce(new Error("ECONNRESET"));

    await service.snapshot(1000);

    expect(rowsFor(inserts, Validators)).toEqual([expect.objectContaining({ operatorAddress: OPERATOR })]);
  });

  it("skips all writes when the chain reports no validators", async () => {
    const { service, inserts, deletes } = setup({ [VALIDATORS_PATH]: [validatorsResponse([])] });

    await service.snapshot(1000);

    expect(inserts).toEqual([]);
    expect(deletes).toEqual([]);
  });

  function setup(responsesByPath: Record<string, string[]>) {
    const inserts: { table: unknown; rows: Record<string, unknown>[] }[] = [];
    const deletes: unknown[] = [];

    const txFake = {
      insert: (table: unknown) => ({
        values: (rows: Record<string, unknown> | Record<string, unknown>[]) => {
          inserts.push({ table, rows: Array.isArray(rows) ? rows : [rows] });
          return Object.assign(Promise.resolve(), {
            onConflictDoNothing: () => Object.assign(Promise.resolve(), { returning: () => Promise.resolve([]) }),
            onConflictDoUpdate: () => Promise.resolve()
          });
        }
      }),
      delete: (table: unknown) => {
        deletes.push(table);
        return Promise.resolve();
      }
    };
    const dbFake = { transaction: (callback: (tx: unknown) => Promise<void>) => callback(txFake) };

    const callsByPath: Record<string, number> = {};
    const rpc = mock<RpcClientPool>();
    rpc.abciQuery.mockImplementation(async path => {
      const queue = responsesByPath[path] ?? [];
      const index = callsByPath[path] ?? 0;
      callsByPath[path] = index + 1;
      return { value: queue[index] ?? null };
    });

    const interner = mock<AccountInterner>();
    interner.resolve.mockImplementation(async addresses => new Map([...addresses].map((address, index) => [address, index + 1])));

    const service = new StakingSnapshotService(dbFake as unknown as ChainDatabase, rpc, interner, mock<LoggerService>());
    return { service, inserts, deletes, rpc, interner };
  }
});

function rowsFor(inserts: { table: unknown; rows: Record<string, unknown>[] }[], table: unknown): Record<string, unknown>[] {
  return inserts.filter(insert => insert.table === table).flatMap(insert => insert.rows);
}

function validator(overrides: {
  operatorAddress: string;
  status?: BondStatus;
  tokens?: string;
  delegatorShares?: string;
  consensusPubkey?: { typeUrl: string; value: Uint8Array };
}) {
  return {
    operatorAddress: overrides.operatorAddress,
    consensusPubkey: overrides.consensusPubkey,
    jailed: false,
    status: overrides.status ?? BondStatus.BOND_STATUS_BONDED,
    tokens: overrides.tokens ?? "0",
    delegatorShares: overrides.delegatorShares ?? "0"
  };
}

function validatorsResponse(validators: ReturnType<typeof validator>[], nextKey?: Uint8Array): string {
  return toBase64(
    QueryValidatorsResponse.encode(QueryValidatorsResponse.fromPartial({ validators, pagination: nextKey ? { nextKey, total: 0n } : undefined })).finish()
  );
}

function delegationsResponse(delegations: { delegatorAddress: string; validatorAddress: string; shares: string }[]): string {
  return toBase64(
    QueryValidatorDelegationsResponse.encode(
      QueryValidatorDelegationsResponse.fromPartial({
        delegationResponses: delegations.map(delegation => ({ delegation, balance: { denom: "uakt", amount: "0" } }))
      })
    ).finish()
  );
}

function unbondingResponse(
  unbonding: {
    delegatorAddress: string;
    validatorAddress: string;
    entries: { creationHeight: bigint; completionTime: { seconds: bigint; nanos: number }; initialBalance: string; balance: string }[];
  }[]
): string {
  return toBase64(
    QueryValidatorUnbondingDelegationsResponse.encode(QueryValidatorUnbondingDelegationsResponse.fromPartial({ unbondingResponses: unbonding })).finish()
  );
}
