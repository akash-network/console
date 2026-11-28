import { MsgAccountDeposit, Source } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { MsgCloseDeployment, MsgCreateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { describe, expect, it } from "vitest";

import { readGrantFundedDeposits } from "./grant-funded-deposit";

describe(readGrantFundedDeposits.name, () => {
  it("reads the deposit of a new deployment paid from a grant", () => {
    const messages = [createDeployment({ amount: "5000000", sources: [Source.grant] })];

    expect(readGrantFundedDeposits(messages)).toEqual([{ denom: "uact", amount: "5000000" }]);
  });

  it("reads the deposit added to a running deployment from a grant", () => {
    const messages = [depositIntoDeployment({ amount: "700000", sources: [Source.grant] })];

    expect(readGrantFundedDeposits(messages)).toEqual([{ denom: "uact", amount: "700000" }]);
  });

  it("reads a deposit that names a grant next to the wallet's own balance", () => {
    const messages = [createDeployment({ amount: "5000000", sources: [Source.balance, Source.grant] })];

    expect(readGrantFundedDeposits(messages)).toEqual([{ denom: "uact", amount: "5000000" }]);
  });

  it("reads every grant-funded deposit of a transaction, in order", () => {
    const messages = [
      createDeployment({ amount: "1", sources: [Source.grant] }),
      closeDeployment(),
      depositIntoDeployment({ amount: "2", sources: [Source.grant] })
    ];

    expect(readGrantFundedDeposits(messages)).toEqual([
      { denom: "uact", amount: "1" },
      { denom: "uact", amount: "2" }
    ]);
  });

  it("skips a deposit paid from the wallet's own balance alone", () => {
    const messages = [createDeployment({ amount: "5000000", sources: [Source.balance] }), depositIntoDeployment({ amount: "1", sources: [Source.balance] })];

    expect(readGrantFundedDeposits(messages)).toEqual([]);
  });

  it("skips a message that deposits nothing", () => {
    expect(readGrantFundedDeposits([closeDeployment()])).toEqual([]);
  });

  it("skips a deposit that names a grant but no amount", () => {
    const message = {
      typeUrl: `/${MsgCreateDeployment.$type}`,
      value: MsgCreateDeployment.fromPartial({ deposit: { sources: [Source.grant] } })
    };

    expect(readGrantFundedDeposits([message])).toEqual([]);
  });

  it("skips a message type named like an object property", () => {
    expect(readGrantFundedDeposits([{ typeUrl: "constructor", value: {} }])).toEqual([]);
  });

  function createDeployment(deposit: { amount: string; sources: Source[] }) {
    return {
      typeUrl: `/${MsgCreateDeployment.$type}`,
      value: MsgCreateDeployment.fromPartial({ deposit: { amount: { denom: "uact", amount: deposit.amount }, sources: deposit.sources } })
    };
  }

  function depositIntoDeployment(deposit: { amount: string; sources: Source[] }) {
    return {
      typeUrl: `/${MsgAccountDeposit.$type}`,
      value: MsgAccountDeposit.fromPartial({ deposit: { amount: { denom: "uact", amount: deposit.amount }, sources: deposit.sources } })
    };
  }

  function closeDeployment() {
    return { typeUrl: `/${MsgCloseDeployment.$type}`, value: MsgCloseDeployment.fromPartial({}) };
  }
});
