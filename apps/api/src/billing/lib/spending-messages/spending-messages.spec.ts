import { MsgAccountDeposit, MsgCreateCertificate } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { MsgCloseDeployment, MsgCreateDeployment, MsgUpdateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { MsgCreateLease } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import { describe, expect, it } from "vitest";

import { isAccountDepositMessage, isCreateDeploymentMessage, isNonSpendingMessage, isSpendingMessage, parseCoinAmount } from "./spending-messages";

describe("spending messages", () => {
  describe(isSpendingMessage.name, () => {
    it("recognizes the create and the deposit a managed wallet signs, by their exact type", () => {
      expect(isCreateDeploymentMessage({ typeUrl: `/${MsgCreateDeployment.$type}`, value: {} })).toBe(true);
      expect(isAccountDepositMessage({ typeUrl: `/${MsgAccountDeposit.$type}`, value: {} })).toBe(true);
      expect(isSpendingMessage({ typeUrl: `/${MsgCreateDeployment.$type}`, value: {} })).toBe(true);
      expect(isSpendingMessage({ typeUrl: `/${MsgAccountDeposit.$type}`, value: {} })).toBe(true);
    });

    it.each([
      "/akash.deployment.v1beta3.MsgCreateDeployment",
      "/akash.deployment.v1beta3.MsgDepositDeployment",
      "/cosmos.authz.v1beta1.MsgExec",
      "/cosmos.bank.v1beta1.MsgSend",
      "akash.deployment.v1beta4.MsgCreateDeployment",
      "/AKASH.DEPLOYMENT.V1BETA4.MSGCREATEDEPLOYMENT",
      "/x/akash.escrow.v1.MsgAccountDeposit"
    ])("recognizes %s neither as spending nor as a message that moves no funds", typeUrl => {
      expect(isSpendingMessage({ typeUrl, value: {} })).toBe(false);
      expect(isNonSpendingMessage({ typeUrl, value: {} })).toBe(false);
    });
  });

  describe(isNonSpendingMessage.name, () => {
    it.each([MsgCloseDeployment, MsgUpdateDeployment, MsgCreateLease, MsgCreateCertificate])("knows $$type moves no funds", type => {
      expect(isNonSpendingMessage({ typeUrl: `/${type.$type}`, value: {} })).toBe(true);
    });

    it("does not count a spending message among them", () => {
      expect(isNonSpendingMessage({ typeUrl: `/${MsgCreateDeployment.$type}`, value: {} })).toBe(false);
    });
  });

  describe(parseCoinAmount.name, () => {
    it.each([
      ["5000000", 5000000n],
      ["0", 0n],
      ["007", 7n],
      ["340282366920938463463374607431768211456", 340282366920938463463374607431768211456n]
    ])("reads %s as a whole number", (amount, expected) => {
      expect(parseCoinAmount(amount)).toBe(expected);
    });

    it.each(["-5", "+5", "5.0", "1e6", " 5", "5 ", "", "0x10", "5_000", undefined])("reads %s as no amount", amount => {
      expect(parseCoinAmount(amount)).toBeUndefined();
    });
  });
});
