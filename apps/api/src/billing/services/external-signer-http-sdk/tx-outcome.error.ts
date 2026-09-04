export type TxOutcome = "not_included" | "unknown";

/** Shaped so `isHttpError` accepts it, which is what lets the outcome reach the client as its own status instead of an opaque 500. */
class TxOutcomeError extends Error {
  readonly expose = true;
  readonly status: number;
  readonly statusCode: number;
  readonly errorCode: string;

  constructor(
    status: number,
    errorCode: string,
    message: string,
    readonly txHash?: string
  ) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.statusCode = status;
    this.errorCode = errorCode;
  }
}

/** The signer proved the transaction did not land: it was never included and its `timeoutTimestamp` has passed. */
export class TxNotIncludedError extends TxOutcomeError {
  constructor(txHash?: string) {
    super(502, "tx_not_included", "The transaction was not included in a block and can no longer land", txHash);
  }
}

/** May or may not have landed, so nothing may be retried on it until the chain has been asked which happened. */
export class TxOutcomeUnknownError extends TxOutcomeError {
  constructor(txHash?: string) {
    super(504, "tx_outcome_unknown", "Your transaction is still being processed. Check whether it went through before sending it again.", txHash);
  }
}

export function isUnknownTxOutcome(error: unknown): error is TxOutcomeUnknownError {
  return error instanceof TxOutcomeUnknownError;
}

export function isTxOutcomeError(error: unknown): error is TxNotIncludedError | TxOutcomeUnknownError {
  return error instanceof TxNotIncludedError || error instanceof TxOutcomeUnknownError;
}
