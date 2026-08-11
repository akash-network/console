import { isHttpError } from "@akashnetwork/http-sdk";

import { PROXY_API_BASE_URL } from "@src/services/auth/auth/interceptors";

/**
 * Bridges the HTTP layer and the Auth0 client context: proxied API calls that fail with 401 signal
 * that the server-side session is dead while the client may still hold a cached user. Subscribers
 * (see `SessionExpirySync`) re-check the session so the client auth state converges with the server.
 */
export class SessionExpiryNotifier {
  static readonly #EVENT_TYPE = "session-expiry";
  readonly #target = new EventTarget();

  notify(): void {
    this.#target.dispatchEvent(new Event(SessionExpiryNotifier.#EVENT_TYPE));
  }

  subscribe(listener: () => void): () => void {
    this.#target.addEventListener(SessionExpiryNotifier.#EVENT_TYPE, listener);
    return () => {
      this.#target.removeEventListener(SessionExpiryNotifier.#EVENT_TYPE, listener);
    };
  }
}

export function createSessionExpiryResponseInterceptor(notifier: SessionExpiryNotifier) {
  return (error: unknown): Promise<never> => {
    if (isHttpError(error) && error.response?.status === 401 && error.config?.baseURL === PROXY_API_BASE_URL) {
      notifier.notify();
    }
    return Promise.reject(error);
  };
}
