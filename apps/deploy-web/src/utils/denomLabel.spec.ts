import { MAINNET_ID } from "@akashnetwork/chain-sdk/web";
import { describe, expect, it } from "vitest";

import { UACT_DENOM, UAKT_DENOM, USDC_IBC_DENOMS } from "@src/config/denom.config";
import { getDenomLabel } from "./denomLabel";

describe("getDenomLabel", () => {
  it("maps uakt to AKT with 6 decimals", () => {
    expect(getDenomLabel(UAKT_DENOM)).toEqual({ symbol: "AKT", decimals: 6 });
  });

  it("maps uact to ACT with 6 decimals", () => {
    expect(getDenomLabel(UACT_DENOM)).toEqual({ symbol: "ACT", decimals: 6 });
  });

  it("maps a USDC IBC denom to USDC with 6 decimals", () => {
    expect(getDenomLabel(USDC_IBC_DENOMS[MAINNET_ID]!)).toEqual({ symbol: "USDC", decimals: 6 });
  });

  it("falls back to the raw denom as symbol for unknown denoms", () => {
    expect(getDenomLabel("uunknown")).toEqual({ symbol: "uunknown", decimals: 6 });
  });
});
