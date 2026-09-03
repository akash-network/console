import type { SDLInput } from "@akashnetwork/chain-sdk";
import { describe, expect, it, vi } from "vitest";

import { restatePricesInGrantDenom } from "./price-denom";

describe("restatePricesInGrantDenom", () => {
  it("converts a uakt ceiling into the grant denom at the akt price", async () => {
    const placement = placementWith({ web: { denom: "uakt", amount: 55 } });

    const result = await restatePricesInGrantDenom(placement, { grantDenom: "uact", loadAktToUsdRate: async () => 0.325 });

    expect(result).toEqual({ ok: true });
    expect(placement.westcoast.pricing.web).toEqual({ denom: "uact", amount: 18 });
  });

  it("rounds a converted ceiling up so it never lands under the price the user asked for", async () => {
    const placement = placementWith({ web: { denom: "uakt", amount: 3 } });

    await restatePricesInGrantDenom(placement, { grantDenom: "uact", loadAktToUsdRate: async () => 1.1 });

    expect(placement.westcoast.pricing.web.amount).toBe(4);
  });

  it("converts a ceiling stated as a string", async () => {
    const placement = placementWith({ web: { denom: "uakt", amount: "1000" } });

    await restatePricesInGrantDenom(placement, { grantDenom: "uact", loadAktToUsdRate: async () => 0.5 });

    expect(placement.westcoast.pricing.web.amount).toBe(500);
  });

  it("converts every uakt ceiling from a single rate lookup", async () => {
    const placement = placementWith({ web: { denom: "uakt", amount: 100 }, api: { denom: "uakt", amount: 200 } });
    const loadAktToUsdRate = vi.fn().mockResolvedValue(0.5);

    await restatePricesInGrantDenom(placement, { grantDenom: "uact", loadAktToUsdRate });

    expect(placement.westcoast.pricing.web.amount).toBe(50);
    expect(placement.westcoast.pricing.api.amount).toBe(100);
    expect(loadAktToUsdRate).toHaveBeenCalledTimes(1);
  });

  it("restates a dollar ceiling into uakt without a rate, since only real networks grant in dollars", async () => {
    const placement = placementWith({ web: { denom: "uact", amount: 50 } });
    const loadAktToUsdRate = vi.fn();

    await restatePricesInGrantDenom(placement, { grantDenom: "uakt", loadAktToUsdRate });

    expect(placement.westcoast.pricing.web).toEqual({ denom: "uakt", amount: 50 });
    expect(loadAktToUsdRate).not.toHaveBeenCalled();
  });

  it("restates a denom already pegged to the dollar without a rate or an amount change", async () => {
    const placement = placementWith({ web: { denom: "uusdc", amount: 26 } });
    const loadAktToUsdRate = vi.fn();

    const result = await restatePricesInGrantDenom(placement, { grantDenom: "uact", loadAktToUsdRate });

    expect(result).toEqual({ ok: true });
    expect(placement.westcoast.pricing.web).toEqual({ denom: "uact", amount: 26 });
    expect(loadAktToUsdRate).not.toHaveBeenCalled();
  });

  it("restates the legacy ibc usdc denom without a rate", async () => {
    const placement = placementWith({ web: { denom: "ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1", amount: 26 } });
    const loadAktToUsdRate = vi.fn();

    await restatePricesInGrantDenom(placement, { grantDenom: "uact", loadAktToUsdRate });

    expect(placement.westcoast.pricing.web).toEqual({ denom: "uact", amount: 26 });
    expect(loadAktToUsdRate).not.toHaveBeenCalled();
  });

  it("leaves a denom pegged to neither akt nor the dollar for sdl validation to reject", async () => {
    const placement = placementWith({ web: { denom: "uatom", amount: 100 } });
    const loadAktToUsdRate = vi.fn();

    const result = await restatePricesInGrantDenom(placement, { grantDenom: "uact", loadAktToUsdRate });

    expect(result).toEqual({ ok: true });
    expect(placement.westcoast.pricing.web).toEqual({ denom: "uatom", amount: 100 });
    expect(loadAktToUsdRate).not.toHaveBeenCalled();
  });

  it("converts a uakt ceiling even when another service prices in a denom it cannot restate", async () => {
    const placement = placementWith({ web: { denom: "uakt", amount: 100 }, api: { denom: "uatom", amount: 100 } });

    await restatePricesInGrantDenom(placement, { grantDenom: "uact", loadAktToUsdRate: async () => 0.5 });

    expect(placement.westcoast.pricing.web).toEqual({ denom: "uact", amount: 50 });
    expect(placement.westcoast.pricing.api).toEqual({ denom: "uatom", amount: 100 });
  });

  it("leaves a price already in the grant denom alone", async () => {
    const placement = placementWith({ web: { denom: "uact", amount: 100000 } });
    const loadAktToUsdRate = vi.fn();

    await restatePricesInGrantDenom(placement, { grantDenom: "uact", loadAktToUsdRate });

    expect(placement.westcoast.pricing.web).toEqual({ denom: "uact", amount: 100000 });
    expect(loadAktToUsdRate).not.toHaveBeenCalled();
  });

  it("reports the unusable rate and leaves the price untouched when the akt price is unavailable", async () => {
    const placement = placementWith({ web: { denom: "uakt", amount: 55 } });

    const result = await restatePricesInGrantDenom(placement, { grantDenom: "uact", loadAktToUsdRate: async () => 0 });

    expect(result).toEqual({ ok: false, aktToUsdRate: 0 });
    expect(placement.westcoast.pricing.web).toEqual({ denom: "uakt", amount: 55 });
  });

  it("reports failure when the akt price is not a finite number", async () => {
    const placement = placementWith({ web: { denom: "uakt", amount: 55 } });

    const result = await restatePricesInGrantDenom(placement, { grantDenom: "uact", loadAktToUsdRate: async () => NaN });

    expect(result).toMatchObject({ ok: false });
  });

  it("leaves an amount that is not a number to downstream validation", async () => {
    const placement = placementWith({ web: { denom: "uakt", amount: "not-a-number" } });

    await restatePricesInGrantDenom(placement, { grantDenom: "uact", loadAktToUsdRate: async () => 0.5 });

    expect(placement.westcoast.pricing.web).toEqual({ denom: "uact", amount: "not-a-number" });
  });

  it("tolerates a placement without pricing", async () => {
    const placement = { westcoast: {} } as unknown as SDLInput["profiles"]["placement"];

    const result = await restatePricesInGrantDenom(placement, { grantDenom: "uact", loadAktToUsdRate: async () => 0.5 });

    expect(result).toEqual({ ok: true });
  });

  it("tolerates a missing placement", async () => {
    const result = await restatePricesInGrantDenom(undefined, { grantDenom: "uact", loadAktToUsdRate: async () => 0.5 });

    expect(result).toEqual({ ok: true });
  });

  function placementWith(pricing: Record<string, { denom: string; amount: string | number }>) {
    return { westcoast: { pricing } } as unknown as SDLInput["profiles"]["placement"];
  }
});
