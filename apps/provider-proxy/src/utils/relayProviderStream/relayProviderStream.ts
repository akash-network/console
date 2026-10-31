import { toErrno } from "../errno";

/** Reads the provider only when the caller asks for more, so a caller that stops reading leaves the rest of the body with the provider. */
export function relayProviderStream<T>(stream: ReadableStream<T>, clientAbortSignal: AbortSignal): ReadableStream<T> {
  const reader = stream.getReader();

  return new ReadableStream<T>({
    async pull(controller) {
      const { done, value } = await reader.read().catch(error => endIfClientAborted(error, clientAbortSignal));
      if (done) return controller.close();
      controller.enqueue(value);
    },
    async cancel(reason) {
      await reader.cancel(reason);
    }
  });
}

function endIfClientAborted(error: unknown, clientAbortSignal: AbortSignal): { done: true; value: undefined } {
  if (clientAbortSignal.aborted && toErrno(error) === "ECONNRESET") return { done: true, value: undefined };
  throw error;
}
