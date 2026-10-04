import { extractApiErrorCode, isApiError } from "@akashnetwork/openapi-sdk";
import { z } from "zod";

const BALANCE_TOP_UP_PENDING_ERROR_CODE = "balance_top_up_pending";

export const TOP_UP_PENDING_MESSAGE = "A top up from your saved payment method is on the way. Try again in a moment.";

const depositShortfallSchema = z
  .object({ requiredAmountUsd: z.number(), availableAmountUsd: z.number() })
  .refine(({ requiredAmountUsd, availableAmountUsd }) => requiredAmountUsd > availableAmountUsd);

const refusalBodySchema = z.object({ data: depositShortfallSchema });

export type DepositShortfall = z.infer<typeof depositShortfallSchema>;

export function extractDepositShortfall(cause: unknown): DepositShortfall | undefined {
  const parsed = refusalBodySchema.safeParse(isApiError(cause) ? cause.body : null);
  return parsed.success ? parsed.data.data : undefined;
}

export function isBalanceTopUpPending(cause: unknown): boolean {
  return extractApiErrorCode(cause) === BALANCE_TOP_UP_PENDING_ERROR_CODE;
}

export function describeDepositShortfall({ requiredAmountUsd, availableAmountUsd }: DepositShortfall): string {
  const missingAmountUsd = requiredAmountUsd - availableAmountUsd;

  return `Starting this deployment takes ${formatUsd(requiredAmountUsd)} and your balance has ${formatUsd(availableAmountUsd)}, so you're ${formatUsd(missingAmountUsd)} short.`;
}

function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
