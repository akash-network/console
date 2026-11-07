import { isHttpError } from "@akashnetwork/http-sdk";
import { isApiError } from "@akashnetwork/openapi-sdk";

import { PROXY_API_BASE_URL } from "@src/services/auth/auth/interceptors";
import type { AccountStatus } from "@src/types/user";

export type AccountStatusRefusal = { status: Exclude<AccountStatus, "active">; reason: string | null };

const FORBIDDEN_STATUS = 403;

const STATUS_BY_ERROR_CODE: Record<string, AccountStatusRefusal["status"]> = {
  account_suspended: "suspended",
  account_terminated: "terminated"
};

type RefusalBody = { code?: unknown; data?: { reason?: unknown } | null };

/**
 * The Console API refuses what a suspended or terminated account may no longer do with a 403 naming the state and the reason written for the user.
 * Only Console API clients raise an `ApiError`, but axios also talks to providers, so an axios refusal counts only when it came through the session proxy.
 */
export function readAccountStatusRefusal(error: unknown): AccountStatusRefusal | undefined {
  if (isApiError(error)) return error.status === FORBIDDEN_STATUS ? readRefusalBody(error.body) : undefined;
  if (isHttpError<RefusalBody>(error) && error.config?.baseURL === PROXY_API_BASE_URL && error.response?.status === FORBIDDEN_STATUS) {
    return readRefusalBody(error.response.data);
  }

  return undefined;
}

function readRefusalBody(body: unknown): AccountStatusRefusal | undefined {
  if (!body || typeof body !== "object") return undefined;

  const { code, data } = body as RefusalBody;
  const status = typeof code === "string" ? STATUS_BY_ERROR_CODE[code] : undefined;
  if (!status) return undefined;

  const reason = data?.reason;
  return { status, reason: typeof reason === "string" ? reason : null };
}

/** Bridges the HTTP layer and the user profile: subscribers (see `AccountStatusSync`) reload the profile and explain the refusal. */
export class AccountStatusRefusalNotifier {
  static readonly #EVENT_TYPE = "account-status-refusal";
  readonly #target = new EventTarget();

  notify(refusal: AccountStatusRefusal): void {
    this.#target.dispatchEvent(new CustomEvent(AccountStatusRefusalNotifier.#EVENT_TYPE, { detail: refusal }));
  }

  subscribe(listener: (refusal: AccountStatusRefusal) => void): () => void {
    const onRefusal = (event: Event) => listener((event as CustomEvent<AccountStatusRefusal>).detail);
    this.#target.addEventListener(AccountStatusRefusalNotifier.#EVENT_TYPE, onRefusal);
    return () => {
      this.#target.removeEventListener(AccountStatusRefusalNotifier.#EVENT_TYPE, onRefusal);
    };
  }
}

export function createAccountStatusRefusalInterceptor(notifier: AccountStatusRefusalNotifier) {
  return (error: unknown): Promise<never> => {
    const refusal = readAccountStatusRefusal(error);
    if (refusal) notifier.notify(refusal);
    return Promise.reject(error);
  };
}

/** Compose only into fetches that reach the Console API, since the body of any 403 it sees is trusted as the Console's word. */
export function createAccountStatusRefusalFetch(notifier: AccountStatusRefusalNotifier, fetchImpl: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const response = await fetchImpl(input, init);
    if (response.status === FORBIDDEN_STATUS) await notifyOnRefusalBody(notifier, response.clone());
    return response;
  };
}

async function notifyOnRefusalBody(notifier: AccountStatusRefusalNotifier, response: Response): Promise<void> {
  const body = await response.json().catch(() => undefined);
  const refusal = readRefusalBody(body);
  if (refusal) notifier.notify(refusal);
}
