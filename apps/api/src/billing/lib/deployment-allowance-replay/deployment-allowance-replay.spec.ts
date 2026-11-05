import { DepositAuthorization, MsgAccountDeposit } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { MsgCloseDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { MsgGrant, MsgRevoke } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import { describe, expect, it } from "vitest";

import type { AllowanceChange } from "@src/billing/repositories/deployment-allowance-history/deployment-allowance-history.repository";
import { replayAllowance } from "./deployment-allowance-replay";

describe(replayAllowance.name, () => {
  it("keeps the starting limit when nothing changed it", () => {
    expect(replayAllowance(500, [], "uact")).toBe(500);
  });

  it("lowers the limit by the granter's coins of the grant denom each deposit spent", () => {
    const changes = [deposit(["30uact"]), deposit(["7uakt,20uact"]), deposit(["5uact", "1uact"])];

    expect(replayAllowance(500, changes, "uact")).toBe(500 - 30 - 20 - 5 - 1);
  });

  it("raises the limit by the granter's coins of the grant denom a closing deployment returned", () => {
    const changes = [refund(["30uact"]), deposit(["10uact"]), refund(["7uakt,20uact", "5uact"])];

    expect(replayAllowance(500, changes, "uact")).toBe(500 + 30 - 10 + 20 + 5);
  });

  it("sets the limit to what a grant granted and applies the deposits after it", () => {
    const changes = [deposit(["30uact"]), grant({ spendLimits: [{ denom: "uact", amount: "800" }] }), deposit(["40uact"])];

    expect(replayAllowance(500, changes, "uact")).toBe(760);
  });

  it("reads the single legacy limit of a grant like the allowance read does", () => {
    expect(replayAllowance(500, [grant({ spendLimit: { denom: "uact", amount: "650" } })], "uact")).toBe(650);
  });

  it("reads a grant's limits ahead of its legacy limit", () => {
    expect(replayAllowance(500, [grant({ spendLimit: { denom: "uact", amount: "0" }, spendLimits: [{ denom: "uact", amount: "900" }] })], "uact")).toBe(900);
  });

  it("reads a grant of another denom as granting nothing", () => {
    expect(replayAllowance(500, [grant({ spendLimits: [{ denom: "uakt", amount: "900" }] })], "uact")).toBe(0);
  });

  it("sets the limit to nothing on a revoke", () => {
    expect(replayAllowance(500, [revoke(), deposit(["1uact"])], "uact")).toBe(-1);
  });

  function deposit(spentByGranter: string[]): AllowanceChange {
    return { height: 1, txIndex: 0, msgIndex: 0, type: `/${MsgAccountDeposit.$type}`, data: new Uint8Array([1]), spentByGranter, receivedByGranter: [] };
  }

  function refund(receivedByGranter: string[]): AllowanceChange {
    return { height: 1, txIndex: 0, msgIndex: 0, type: `/${MsgCloseDeployment.$type}`, data: new Uint8Array([1]), spentByGranter: [], receivedByGranter };
  }

  function grant(authorization: Partial<DepositAuthorization>): AllowanceChange {
    const data = MsgGrant.encode({
      granter: "akash1granter",
      grantee: "akash1grantee",
      grant: {
        authorization: {
          typeUrl: `/${DepositAuthorization.$type}`,
          value: DepositAuthorization.encode(DepositAuthorization.fromPartial(authorization)).finish()
        },
        expiration: undefined
      }
    }).finish();

    return { height: 1, txIndex: 0, msgIndex: 0, type: `/${MsgGrant.$type}`, data, spentByGranter: [], receivedByGranter: [] };
  }

  function revoke(): AllowanceChange {
    const data = MsgRevoke.encode({ granter: "akash1granter", grantee: "akash1grantee", msgTypeUrl: `/${MsgAccountDeposit.$type}` }).finish();

    return { height: 1, txIndex: 0, msgIndex: 0, type: `/${MsgRevoke.$type}`, data, spentByGranter: [], receivedByGranter: [] };
  }
});
