import type { BillingTransaction, CustomerTransactionsResponse, StripeService } from "@akashnetwork/http-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { waitForSettledTransaction } from "./waitForSettledTransaction";

describe(waitForSettledTransaction.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the payment's row as soon as it has succeeded", async () => {
    const settled = transaction({ id: "tx_1", status: "succeeded", bonusAmount: 1000 });
    const { stripe } = setup({ reads: [[settled]] });

    await expect(waitForSettledTransaction(stripe, "tx_1")).resolves.toEqual(settled);
    expect(stripe.getCustomerTransactions).toHaveBeenCalledTimes(1);
    expect(stripe.getCustomerTransactions).toHaveBeenCalledWith({ limit: 10 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("reads the payment's row again a second later until it has succeeded", async () => {
    const settled = transaction({ id: "tx_1", status: "succeeded", bonusAmount: 1000 });
    const { stripe } = setup({ reads: [[transaction({ id: "tx_1", status: "created" })], [settled]] });

    const result = waitForSettledTransaction(stripe, "tx_1");
    await vi.advanceTimersByTimeAsync(999);
    expect(stripe.getCustomerTransactions).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);

    await expect(result).resolves.toEqual(settled);
    expect(stripe.getCustomerTransactions).toHaveBeenCalledTimes(2);
  });

  it("ignores other succeeded payments listed above this one", async () => {
    const settled = transaction({ id: "tx_1", status: "succeeded" });
    const { stripe } = setup({
      reads: [
        [transaction({ id: "tx_2", status: "succeeded" }), transaction({ id: "tx_1", status: "pending" })],
        [transaction({ id: "tx_2" }), settled]
      ]
    });

    const result = waitForSettledTransaction(stripe, "tx_1");
    await vi.advanceTimersByTimeAsync(1_000);

    await expect(result).resolves.toEqual(settled);
  });

  it("keeps reading after a failed read", async () => {
    const settled = transaction({ id: "tx_1", status: "succeeded" });
    const { stripe } = setup({ reads: [new Error("network"), [settled]] });

    const result = waitForSettledTransaction(stripe, "tx_1");
    await vi.advanceTimersByTimeAsync(1_000);

    await expect(result).resolves.toEqual(settled);
  });

  it("reads again when a read is still unanswered after three seconds", async () => {
    const settled = transaction({ id: "tx_1", status: "succeeded" });
    const { stripe } = setup({ reads: ["stalled", [settled]] });

    const result = waitForSettledTransaction(stripe, "tx_1");
    await vi.advanceTimersByTimeAsync(3_999);
    expect(stripe.getCustomerTransactions).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);

    await expect(result).resolves.toEqual(settled);
  });

  it("gives up after ten reads when the payment's row never succeeds", async () => {
    const { stripe } = setup({ reads: [] });
    stripe.getCustomerTransactions.mockResolvedValue(transactions([transaction({ id: "tx_1", status: "created" })]));

    const result = waitForSettledTransaction(stripe, "tx_1");
    await vi.advanceTimersByTimeAsync(10_000);

    await expect(result).resolves.toBeUndefined();
    expect(stripe.getCustomerTransactions).toHaveBeenCalledTimes(10);
  });

  function setup(input: { reads: (BillingTransaction[] | Error | "stalled")[] }) {
    vi.useFakeTimers();
    const stripe = mock<StripeService>();
    input.reads.forEach(read => {
      if (read === "stalled") {
        stripe.getCustomerTransactions.mockReturnValueOnce(new Promise(() => {}));
      } else if (read instanceof Error) {
        stripe.getCustomerTransactions.mockRejectedValueOnce(read);
      } else {
        stripe.getCustomerTransactions.mockResolvedValueOnce(transactions(read));
      }
    });

    return { stripe };
  }

  function transactions(list: BillingTransaction[]): CustomerTransactionsResponse {
    return { transactions: list, totalCount: list.length, hasMore: false };
  }

  function transaction(overrides: Partial<BillingTransaction>): BillingTransaction {
    return {
      id: "tx_1",
      type: "payment_intent",
      amount: 10000,
      amountRefunded: 0,
      currency: "usd",
      status: "succeeded",
      created: 1792813722,
      ...overrides
    };
  }
});
