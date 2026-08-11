import { isHttpError } from "@akashnetwork/http-sdk";

/**
 * Bridges the HTTP layer and the Auth0 client context: proxied API calls that fail with 401 signal
 * that the server-side session is dead while the client may still hold a cached user. Subscribers
 * (see `SessionExpirySync`) re-check the session so the client auth state converges with the server.
 */
export class SessionExpiryNotifier {
  readonly #listeners = new Set<() => void>();

  notify(): void {
    this.#listeners.forEach(listener => listener());
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }
}

/** Matches `withUserToken`, which routes all session-authenticated API calls through this base URL. */
const PROXIED_API_BASE_URL = "/api/proxy";

export function createSessionExpiryResponseInterceptor(notifier: SessionExpiryNotifier) {
  return (error: unknown): Promise<never> => {
    if (isHttpError(error) && error.response?.status === 401 && error.config?.baseURL === PROXIED_API_BASE_URL) {
      notifier.notify();
    }
    return Promise.reject(error);
  };
}
