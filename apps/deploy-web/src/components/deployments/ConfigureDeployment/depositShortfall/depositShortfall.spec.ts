import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it } from "vitest";

import { describeDepositShortfall, extractDepositShortfall, isBalanceTopUpPending } from "./depositShortfall";

describe(extractDepositShortfall.name, () => {
  it("reads the deposit and the balance a refused create reports", () => {
    const refusal = paymentRequired({ code: "insufficient_balance", data: { requiredAmountUsd: 0.5, availableAmountUsd: 0.12 } });

    expect(extractDepositShortfall(refusal)).toEqual({ requiredAmountUsd: 0.5, availableAmountUsd: 0.12 });
  });

  it("returns nothing for a refusal that reports no amounts", () => {
    const refusal = paymentRequired({ code: "payment_required" });

    expect(extractDepositShortfall(refusal)).toBeUndefined();
  });

  it("returns nothing when the reported balance already covers the deposit", () => {
    const refusal = paymentRequired({ code: "insufficient_balance", data: { requiredAmountUsd: 5, availableAmountUsd: 5 } });

    expect(extractDepositShortfall(refusal)).toBeUndefined();
  });

  it("returns nothing for a failure that is not an api error", () => {
    expect(extractDepositShortfall(new Error("network down"))).toBeUndefined();
  });
});

describe(isBalanceTopUpPending.name, () => {
  it("recognises a refusal that a top up already on its way will clear", () => {
    expect(isBalanceTopUpPending(paymentRequired({ code: "balance_top_up_pending" }))).toBe(true);
  });

  it("does not mistake a refusal that needs credits for one", () => {
    expect(isBalanceTopUpPending(paymentRequired({ code: "insufficient_balance" }))).toBe(false);
  });
});

describe(describeDepositShortfall.name, () => {
  it("states what the deployment takes, what the balance has and the difference", () => {
    expect(describeDepositShortfall({ requiredAmountUsd: 0.5, availableAmountUsd: 0.12 })).toBe(
      "Starting this deployment takes $0.50 and your balance has $0.12, so you're $0.38 short."
    );
  });
});

function paymentRequired(body: { code: string; data?: unknown }) {
  return new ApiError(402, { message: "Not enough balance to cover the deployment deposit.", ...body }, "POST /v1/deployments → 402");
}
