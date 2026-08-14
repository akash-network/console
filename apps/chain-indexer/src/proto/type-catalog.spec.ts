import { MsgCreateDeployment as legacyMsgCreateDeployment } from "@akashnetwork/akash-api/v1beta4";
import { MsgCreateDeployment as sdkMsgCreateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { describe, expect, it } from "vitest";

import { isIgnoredTypeUrl, registeredProtoTypes } from "@src/proto/type-catalog";

describe("type catalog", () => {
  it("registers the chain SDK types including the previously missing modules", () => {
    const typeUrls = new Set(registeredProtoTypes.map(([typeUrl]) => typeUrl));

    expect(typeUrls.has("/akash.deployment.v1beta4.MsgCreateDeployment")).toBe(true);
    expect(typeUrls.has("/akash.oracle.v2.MsgAddPriceEntry")).toBe(true);
    expect(typeUrls.has("/akash.epochs.v1beta1.EpochInfo")).toBe(true);
    expect(typeUrls.has("/cosmos.bank.v1beta1.MsgSend")).toBe(true);
    expect(typeUrls.has("/ibc.applications.transfer.v1.MsgTransfer")).toBe(true);
  });

  it("registers historical Akash versions from the legacy package", () => {
    const typeUrls = new Set(registeredProtoTypes.map(([typeUrl]) => typeUrl));

    expect(typeUrls.has("/akash.deployment.v1beta1.MsgCreateDeployment")).toBe(true);
    expect(typeUrls.has("/akash.deployment.v1beta2.MsgCreateDeployment")).toBe(true);
    expect(typeUrls.has("/akash.market.v1beta3.MsgCreateBid")).toBe(true);
    expect(typeUrls.has("/akash.market.v1beta4.MsgCreateLease")).toBe(true);
  });

  it("keeps one registration per typeUrl with the chain SDK winning over the legacy package", () => {
    const typeUrls = registeredProtoTypes.map(([typeUrl]) => typeUrl);
    const overlapping = registeredProtoTypes.find(([typeUrl]) => typeUrl === "/akash.deployment.v1beta4.MsgCreateDeployment");

    expect(new Set(typeUrls).size).toBe(typeUrls.length);
    expect(overlapping?.[1]).toBe(sdkMsgCreateDeployment);
    expect(overlapping?.[1]).not.toBe(legacyMsgCreateDeployment);
  });

  it("ignores cosmwasm type urls by prefix", () => {
    expect(isIgnoredTypeUrl("/cosmwasm.wasm.v1.MsgExecuteContract")).toBe(true);
    expect(isIgnoredTypeUrl("/akash.deployment.v1beta4.MsgCreateDeployment")).toBe(false);
  });
});
