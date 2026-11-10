import { describe, expect, it } from "vitest";

import { averageBlockTimeSeconds, filterTransactionsByGroup, initialsOf, messageTypeName } from "./chainActivity";

describe("chainActivity", () => {
  describe(messageTypeName.name, () => {
    it("keeps the last segment without its Msg prefix", () => {
      expect(messageTypeName("/akash.market.v1beta5.MsgCreateBid")).toBe("CreateBid");
    });

    it("keeps a name without a Msg prefix", () => {
      expect(messageTypeName("cosmos.bank.Send")).toBe("Send");
    });
  });

  describe(filterTransactionsByGroup.name, () => {
    const transactions = [
      tx("/akash.market.v1beta5.MsgCreateBid"),
      tx("/akash.market.v1beta5.MsgWithdrawLease"),
      tx("/akash.provider.v1beta4.MsgUpdateProvider"),
      tx("/akash.deployment.v1beta4.MsgCloseDeployment"),
      tx("/akash.escrow.v1.MsgAccountDeposit"),
      tx("/cosmwasm.wasm.v1.MsgExecuteContract"),
      tx("/cosmos.staking.v1beta1.MsgDelegate"),
      tx("/cosmos.staking.v1beta1.MsgBeginRedelegate"),
      tx("/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward"),
      tx("/cosmos.bank.v1beta1.MsgSend"),
      tx("/ibc.applications.transfer.v1.MsgTransfer"),
      tx("/ibc.core.client.v1.MsgUpdateClient"),
      tx("/cosmos.authz.v1beta1.MsgExec", "/cosmos.bank.v1beta1.MsgSend")
    ];

    it.each([
      ["all", 13],
      ["market", 3],
      ["deployments", 2],
      ["contracts", 1],
      ["staking", 3],
      ["transfers", 3]
    ] as const)("keeps the %s transactions", (group, count) => {
      expect(filterTransactionsByGroup(transactions, group)).toHaveLength(count);
    });

    it("matches a transaction on any of its messages", () => {
      expect(filterTransactionsByGroup(transactions, "transfers").map(({ messages }) => messages[0].type)).toContain("/cosmos.authz.v1beta1.MsgExec");
    });

    it("does not match a send inside another name", () => {
      expect(filterTransactionsByGroup([tx("/x.MsgSendPacket")], "transfers")).toEqual([]);
    });

    function tx(...types: string[]) {
      return { messages: types.map(type => ({ id: type, type })) };
    }
  });

  describe(averageBlockTimeSeconds.name, () => {
    it("averages the gaps between the newest and oldest block", () => {
      expect(
        averageBlockTimeSeconds([{ datetime: "2026-11-10T00:00:12.000Z" }, { datetime: "2026-11-10T00:00:06.500Z" }, { datetime: "2026-11-10T00:00:00.000Z" }])
      ).toBe(6);
    });

    it("is unknown with fewer than two blocks", () => {
      expect(averageBlockTimeSeconds([{ datetime: "2026-11-10T00:00:12.000Z" }])).toBeUndefined();
    });
  });

  describe(initialsOf.name, () => {
    it.each([
      ["Chorus One", "CO"],
      ["P2P.ORG", "PO"],
      ["Polkachu", "P"],
      ["ECO Stake 🌱 | REStake.app", "ES"],
      ["🚀", "?"]
    ])("abbreviates %s as %s", (name, initials) => {
      expect(initialsOf(name)).toBe(initials);
    });
  });
});
