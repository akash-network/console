/**
 * Stable, machine-readable error codes emitted in x402 error bodies (400/402/404/409).
 * These are part of the public API contract — see doc/x402/USAGE.md. Do not rename or
 * repurpose an existing code; add a new one instead.
 */
export const X402_ERROR_CODES = {
  /** 404 — x402 payments are not enabled on this deployment. */
  X402_DISABLED: "X402_DISABLED",
  /** 400 — requested top-up amount is outside the configured min/max bounds. */
  AMOUNT_OUT_OF_BOUNDS: "AMOUNT_OUT_OF_BOUNDS",
  /** 402 — no payment attached yet; the body carries the accepted payment requirements. */
  PAYMENT_REQUIRED: "PAYMENT_REQUIRED",
  /** 402 — the attached payment failed verification or on-chain settlement. */
  PAYMENT_INVALID: "PAYMENT_INVALID",
  /** 409 — this payment was already used to credit a previous top-up. */
  DUPLICATE_PAYMENT: "DUPLICATE_PAYMENT"
} as const;

export type X402ErrorCode = (typeof X402_ERROR_CODES)[keyof typeof X402_ERROR_CODES];
