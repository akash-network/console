import type { BillingTransaction, StripeService } from "@akashnetwork/http-sdk";

import { wait } from "@src/utils/timer";

const MAX_SETTLEMENT_CHECKS = 10;

const SETTLEMENT_CHECK_INTERVAL_MS = 1_000;

/** Reads past the newest row so another team member's purchase landing on top cannot hide this one. */
const RECENT_TRANSACTIONS_LIMIT = 10;

/** The API client sets no request timeout, so a read still unanswered by then counts as a failed check. */
const READ_TIMEOUT_MS = 3_000;

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
  let readTimeout: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_, reject) => {
    readTimeout = setTimeout(reject, READ_TIMEOUT_MS);
  });

  try {
    const { transactions } = await Promise.race([stripe.getCustomerTransactions({ limit: RECENT_TRANSACTIONS_LIMIT }), timedOut]);
    return transactions.find(transaction => transaction.id === transactionId);
  } catch {
    return undefined;
  } finally {
    clearTimeout(readTimeout);
  }
}
