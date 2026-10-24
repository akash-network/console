import type { BillingTransaction, StripeService } from "@akashnetwork/http-sdk";

import { wait } from "@src/utils/timer";

const MAX_SETTLEMENT_CHECKS = 10;

const SETTLEMENT_CHECK_INTERVAL_MS = 1_000;

/** Reads past the newest row so another team member's purchase landing on top cannot hide this one. */
const RECENT_TRANSACTIONS_LIMIT = 10;

/** The wallet balance rises before the payment's own row commits, and only the committed row carries its card and first-purchase bonus. */
export async function waitForSettledTransaction(
  stripe: Pick<StripeService, "getCustomerTransactions">,
  transactionId: string
): Promise<BillingTransaction | undefined> {
  for (let check = 0; check < MAX_SETTLEMENT_CHECKS; check++) {
    const transaction = await findRecentTransaction(stripe, transactionId);
    if (transaction?.status === "succeeded") return transaction;
    await wait(SETTLEMENT_CHECK_INTERVAL_MS);
  }

  return undefined;
}

async function findRecentTransaction(stripe: Pick<StripeService, "getCustomerTransactions">, transactionId: string) {
  try {
    const { transactions } = await stripe.getCustomerTransactions({ limit: RECENT_TRANSACTIONS_LIMIT });
    return transactions.find(transaction => transaction.id === transactionId);
  } catch {
    return undefined;
  }
}
