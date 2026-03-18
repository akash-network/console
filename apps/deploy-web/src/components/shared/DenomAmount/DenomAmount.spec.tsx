import { describe, expect, it, vi } from "vitest";

import type { PricingContext } from "@src/hooks/usePricing/usePricing";
import { DenomAmount, DEPENDENCIES } from "./DenomAmount";

import { render } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe(DenomAmount.name, () => {
  it("renders denom label with the given denom", () => {
    const { deps } = setup({ amount: 1000000, denom: "uakt" });
    expect(deps.DenomLabel).toHaveBeenCalledWith(expect.objectContaining({ denom: "uakt" }), expect.anything());
  });

  it("renders formatted number parts with converted denom amount", () => {
    const { deps } = setup({ amount: 1000000, denom: "uakt" });
    expect(deps.FormattedNumberParts).toHaveBeenCalledWith(
      expect.objectContaining({
        value: 1,
        maximumFractionDigits: 6,
        minimumFractionDigits: 6
      }),
      expect.anything()
    );
  });

  it("uses custom digits for fraction formatting", () => {
    const { deps } = setup({ amount: 1000000, denom: "uakt", digits: 2 });
    expect(deps.FormattedNumberParts).toHaveBeenCalledWith(
      expect.objectContaining({
        maximumFractionDigits: 2,
        minimumFractionDigits: 2
      }),
      expect.anything()
    );
  });

  it("passes notation to formatted number parts", () => {
    const { deps } = setup({ amount: 1000000, denom: "uakt", notation: "compact" });
    expect(deps.FormattedNumberParts).toHaveBeenCalledWith(expect.objectContaining({ notation: "compact" }), expect.anything());
  });

  it("shows USD price when showUSD is true and price is loaded", () => {
    const udenomToUsd = vi.fn().mockReturnValue(5.5);
    const { deps } = setup({ amount: 1000000, denom: "uakt", showUSD: true, usePricingReturn: { isLoaded: true, udenomToUsd } });
    expect(deps.FormattedNumber).toHaveBeenCalledWith(
      expect.objectContaining({
        style: "currency",
        currency: "USD",
        value: 5.5,
        notation: "compact"
      }),
      expect.anything()
    );
  });

  it("does not show USD price when showUSD is false", () => {
    const { deps } = setup({ amount: 1000000, denom: "uakt", showUSD: false, usePricingReturn: { isLoaded: true, udenomToUsd: vi.fn() } });
    expect(deps.FormattedNumber).not.toHaveBeenCalled();
  });

  it("does not show USD price when price is not loaded", () => {
    const { deps } = setup({ amount: 1000000, denom: "uakt", showUSD: true, usePricingReturn: { isLoaded: false, udenomToUsd: vi.fn() } });
    expect(deps.FormattedNumber).not.toHaveBeenCalled();
  });

  it("does not show USD price when denom amount is 0", () => {
    const { deps } = setup({ amount: 0, denom: "uakt", showUSD: true, usePricingReturn: { isLoaded: true, udenomToUsd: vi.fn() } });
    expect(deps.FormattedNumber).not.toHaveBeenCalled();
  });

  function setup(input: {
    amount: number;
    denom: string;
    showUSD?: boolean;
    digits?: number;
    notation?: "standard" | "scientific" | "engineering" | "compact";
    usePricingReturn?: Partial<PricingContext>;
  }) {
    const deps = MockComponents(DEPENDENCIES);
    deps.usePricing.mockReturnValue({
      isLoaded: false,
      isLoading: false,
      price: undefined,
      uaktToUSD: vi.fn(),
      aktToUSD: vi.fn(),
      usdToAkt: vi.fn(),
      getPriceForDenom: vi.fn(),
      udenomToUsd: vi.fn().mockReturnValue(0),
      ...input.usePricingReturn
    });

    const result = render(
      <DenomAmount amount={input.amount} denom={input.denom} showUSD={input.showUSD} digits={input.digits} notation={input.notation} dependencies={deps} />
    );

    return { ...result, deps };
  }
});
