import { AsyncLocalStorage } from "node:async_hooks";
import type { IncomingMessage } from "node:http";

export const requestExecutionContext = new AsyncLocalStorage<{ headers: Headers }>();

export function createRequestExecutionContext(req: IncomingMessage) {
  return {
    headers: new Headers(req.headers as HeadersInit)
  };
}
