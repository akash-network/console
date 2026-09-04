export type TxOutcome = "not_included" | "unknown";

/** Shaped so `http-errors`' `isHttpError` duck-typing accepts it, which is what carries the outcome and hash into the error response. */
class TxOutcomeError extends Error {
  readonly expose = true;
  readonly status: number;
  readonly statusCode: number;
  readonly data: { outcome: TxOutcome; txHash: string };

  constructor(status: number, outcome: TxOutcome, txHash: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.statusCode = status;
    this.data = { outcome, txHash };
  }
}

/**
 * The transaction was broadcast but never included, and its `timeoutTimestamp` has since passed, so the chain
 * can no longer include it.
 */
export class TxNotIncludedError extends TxOutcomeError {
  constructor(txHash: string) {
    super(502, "not_included", txHash, `Transaction ${txHash} expired without being included in a block`);
  }
}

/**
 * The transaction was broadcast and may still be included: the signing deadline stopped the wait before its
 * `timeoutTimestamp` could pass.
 */
export class TxOutcomeUnknownError extends TxOutcomeError {
  constructor(txHash: string) {
    super(504, "unknown", txHash, `Transaction ${txHash} was broadcast but its outcome is not yet decided`);
  }
}
