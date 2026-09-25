/** Keeps the chain's log verbatim as its message, because console-api picks its refusal reasons out of that text. */
export class MessageExecutionFailedError extends Error {
  readonly name = "MessageExecutionFailedError";

  constructor(cause: Error) {
    super(cause.message, { cause });
  }
}
