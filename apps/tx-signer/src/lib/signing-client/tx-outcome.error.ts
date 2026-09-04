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

/** Broadcast but never included, and past its `timeoutTimestamp`, so the chain can no longer include it. */
export class TxNotIncludedError extends TxOutcomeError {
  constructor(txHash: string) {
    super(502, "not_included", txHash, `Transaction ${txHash} expired without being included in a block`);
  }
}

/** Broadcast and still includable, because the wait ended before the tx's `timeoutTimestamp` passed. */
export class TxOutcomeUnknownError extends TxOutcomeError {
  constructor(txHash: string) {
    super(504, "unknown", txHash, `Transaction ${txHash} was broadcast but its outcome is not yet decided`);
  }
}
