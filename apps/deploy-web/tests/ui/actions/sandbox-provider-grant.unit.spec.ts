import { BasicAllowance, MsgGrantAllowance } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import type { DeliverTxResponse } from "@cosmjs/stargate";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { GrantClient } from "./sandbox-provider-grant";
import { grantSandboxProviderAccess } from "./sandbox-provider-grant";

const GRANTER = "akash1granter";
const GRANTEE = "akash1grantee";
const NOW = new Date("2026-11-24T10:00:00.000Z");

describe(grantSandboxProviderAccess.name, () => {
  it("grants the account a 1uakt fee allowance from the granter that expires two hours later", async () => {
    const { dependencies, client } = setup();

    await grantSandboxProviderAccess(GRANTEE, dependencies);

    expect(dependencies.connect).toHaveBeenCalledWith("granter mnemonic");
    const [[message]] = client.signAndBroadcast.mock.calls[0];
    const grant = message.value as MsgGrantAllowance;
    expect(message.typeUrl).toBe(`/${MsgGrantAllowance.$type}`);
    expect(grant).toMatchObject({ granter: GRANTER, grantee: GRANTEE, allowance: { typeUrl: `/${BasicAllowance.$type}` } });
    expect(BasicAllowance.decode(grant.allowance!.value)).toEqual({
      spendLimit: [{ denom: "uakt", amount: "1" }],
      expiration: new Date("2026-11-24T12:00:00.000Z")
    });
    expect(client.disconnect).toHaveBeenCalledTimes(1);
  });

  it("does nothing outside sandbox", async () => {
    const { dependencies } = setup({ networkId: "mainnet" });

    await grantSandboxProviderAccess(GRANTEE, dependencies);

    expect(dependencies.connect).not.toHaveBeenCalled();
  });

  it("does nothing without a granter mnemonic", async () => {
    const { dependencies } = setup({ granterMnemonic: undefined });

    await grantSandboxProviderAccess(GRANTEE, dependencies);

    expect(dependencies.connect).not.toHaveBeenCalled();
  });

  it("fails with the chain's log when the transaction is rejected and still disconnects", async () => {
    const { dependencies, client } = setup({ result: { code: 5, rawLog: "insufficient fees" } });

    await expect(grantSandboxProviderAccess(GRANTEE, dependencies)).rejects.toThrow("granting sandbox provider access failed: insufficient fees");

    expect(client.disconnect).toHaveBeenCalledTimes(1);
  });

  it("reports the failure code when the chain gives no log", async () => {
    const { dependencies } = setup({ result: { code: 13, rawLog: "" } });

    await expect(grantSandboxProviderAccess(GRANTEE, dependencies)).rejects.toThrow("granting sandbox provider access failed: code 13");
  });

  it("disconnects when broadcasting throws", async () => {
    const { dependencies, client } = setup();
    client.signAndBroadcast.mockRejectedValue(new Error("account sequence mismatch"));

    await expect(grantSandboxProviderAccess(GRANTEE, dependencies)).rejects.toThrow("account sequence mismatch");

    expect(client.disconnect).toHaveBeenCalledTimes(1);
  });

  function setup(input: { networkId?: string; granterMnemonic?: string; result?: { code: number; rawLog: string } } = {}) {
    const client = mock<GrantClient>({ granter: GRANTER });
    client.signAndBroadcast.mockResolvedValue(mock<DeliverTxResponse>(input.result ?? { code: 0, rawLog: "" }));
    const dependencies = {
      networkId: input.networkId ?? "sandbox",
      granterMnemonic: "granterMnemonic" in input ? input.granterMnemonic : "granter mnemonic",
      connect: vi.fn(async () => client),
      now: () => NOW
    };

    return { dependencies, client };
  }
});
