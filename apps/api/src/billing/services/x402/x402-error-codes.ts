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
  DUPLICATE_PAYMENT: "DUPLICATE_PAYMENT",
  /** 402 — the verified payment's settlement network differs from the configured/advertised network. */
  WRONG_NETWORK: "WRONG_NETWORK",
  /** 402 — the payer authorized a different asset than the one the requirement settles. */
  WRONG_ASSET: "WRONG_ASSET",
  /** 402 — the payer's authorized amount differs from the requirement amount. */
  AMOUNT_MISMATCH: "AMOUNT_MISMATCH"
} as const;

export type X402ErrorCode = (typeof X402_ERROR_CODES)[keyof typeof X402_ERROR_CODES];

/**
 * Pre-settle guardrail rejection codes — the subset of {@link X402_ERROR_CODES} returned when a
 * verified payment is rejected before on-chain settlement (see `X402Service.validatePreSettle`).
 */
export type X402ValidationCode = typeof X402_ERROR_CODES.WRONG_NETWORK | typeof X402_ERROR_CODES.WRONG_ASSET | typeof X402_ERROR_CODES.AMOUNT_MISMATCH;
