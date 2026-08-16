import { describe, expect, it } from "vitest";

import { normalizeDeploymentMessage } from "@src/akash/normalize-deployment";

describe("normalizeDeploymentMessage", () => {
  it("normalizes a legacy v1beta1 create with a Long dseq and a bare deposit coin", () => {
    const change = normalizeDeploymentMessage("/akash.deployment.v1beta1.MsgCreateDeployment", {
      id: { owner: "akash1owner", dseq: { low: 12345, high: 0, unsigned: true } },
      groups: [],
      deposit: { denom: "uakt", amount: "5000000" }
    });

    expect(change).toEqual({
      kind: "deploymentCreated",
      key: { owner: "akash1owner", dseq: "12345" },
      denom: "uakt",
      deposit: "5000000",
      depositor: null,
      groups: []
    });
  });

  it("normalizes a v1beta4 create whose deposit coin is wrapped in a Deposit message", () => {
    const change = normalizeDeploymentMessage("/akash.deployment.v1beta4.MsgCreateDeployment", {
      id: { owner: "akash1owner", dseq: "12345" },
      groups: [],
      deposit: { amount: { denom: "ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1", amount: "5000000" }, sources: [1] }
    }) as { deposit: string; denom: string };

    expect(change.deposit).toBe("5000000");
    expect(change.denom).toBe("ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1");
  });

  it("keeps the v1beta3 depositor on both create and deposit", () => {
    const create = normalizeDeploymentMessage("/akash.deployment.v1beta3.MsgCreateDeployment", {
      id: { owner: "akash1owner", dseq: "1" },
      groups: [],
      deposit: { denom: "uakt", amount: "1" },
      depositor: "akash1other"
    }) as { depositor: string };
    const deposit = normalizeDeploymentMessage("/akash.deployment.v1beta3.MsgDepositDeployment", {
      id: { owner: "akash1owner", dseq: "1" },
      amount: { denom: "uakt", amount: "777" },
      depositor: "akash1other"
    });

    expect(create.depositor).toBe("akash1other");
    expect(deposit).toEqual({
      kind: "deploymentDeposited",
      key: { owner: "akash1owner", dseq: "1" },
      amount: "777",
      depositor: "akash1other"
    });
  });

  it("normalizes a v1 escrow deposit from its scoped xid", () => {
    const change = normalizeDeploymentMessage("/akash.escrow.v1.MsgAccountDeposit", {
      signer: "akash1depositor",
      id: { scope: 1, xid: "akash1owner/12345" },
      deposit: { amount: { denom: "uakt", amount: "777" }, sources: [1] }
    });

    expect(change).toEqual({
      kind: "deploymentDeposited",
      key: { owner: "akash1owner", dseq: "12345" },
      amount: "777",
      depositor: "akash1depositor"
    });
  });

  it("ignores escrow deposits outside the deployment scope", () => {
    const change = normalizeDeploymentMessage("/akash.escrow.v1.MsgAccountDeposit", {
      signer: "akash1depositor",
      id: { scope: 2, xid: "akash1owner/12345/1/1/akash1prov" },
      deposit: { amount: { denom: "uakt", amount: "777" }, sources: [1] }
    });

    expect(change).toBeNull();
  });

  it("normalizes close, update and group lifecycle messages", () => {
    const key = { owner: "akash1owner", dseq: "9" };

    expect(normalizeDeploymentMessage("/akash.deployment.v1beta2.MsgCloseDeployment", { id: key })).toEqual({ kind: "deploymentClosed", key });
    expect(normalizeDeploymentMessage("/akash.deployment.v1beta4.MsgUpdateDeployment", { id: key })).toEqual({ kind: "deploymentUpdated", key });
    expect(normalizeDeploymentMessage("/akash.deployment.v1beta4.MsgCloseGroup", { id: { ...key, gseq: 2 } })).toEqual({ kind: "groupClosed", key, gseq: 2 });
    expect(normalizeDeploymentMessage("/akash.deployment.v1beta3.MsgPauseGroup", { id: { ...key, gseq: 1 } })).toEqual({ kind: "groupPaused", key, gseq: 1 });
    expect(normalizeDeploymentMessage("/akash.deployment.v1beta2.MsgStartGroup", { id: { ...key, gseq: 1 } })).toEqual({ kind: "groupStarted", key, gseq: 1 });
  });

  it("returns null for unknown types and malformed bodies", () => {
    expect(normalizeDeploymentMessage("/akash.deployment.v1beta1.MsgSomethingElse", {})).toBeNull();
    expect(normalizeDeploymentMessage("/akash.deployment.v1beta1.MsgCreateDeployment", { id: { owner: "" } })).toBeNull();
    expect(normalizeDeploymentMessage("/akash.deployment.v1beta1.MsgDepositDeployment", { id: { owner: "a", dseq: "1" } })).toBeNull();
  });
});
