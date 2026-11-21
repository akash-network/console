import { isApiError } from "@akashnetwork/openapi-sdk";

export type PublishRefusal =
  | { kind: "requirements_unmet" }
  | { kind: "checks_failed" }
  | { kind: "terms_changed" }
  | { kind: "rate_limited"; message: string }
  | { kind: "not_allowed" };

const RATE_LIMITED_CODE = "template_rate_limited";

const RATE_LIMITED_FALLBACK = "You reached a limit on templates. Try again later.";

const KIND_BY_CODE: Record<string, "requirements_unmet" | "checks_failed" | "terms_changed"> = {
  template_publish_requirements_unmet: "requirements_unmet",
  template_publish_checks_failed: "checks_failed",
  template_terms_version_mismatch: "terms_changed"
};

const NOT_ALLOWED_STATUSES = [403, 404];

type RefusalBody = { code?: unknown; message?: unknown };

export function readPublishRefusal(error: unknown): PublishRefusal | undefined {
  if (!isApiError(error)) return undefined;

  const rateLimitMessage = readTemplateRateLimit(error);
  if (rateLimitMessage) return { kind: "rate_limited", message: rateLimitMessage };

  const { code } = bodyOf(error.body);
  const kind = typeof code === "string" ? KIND_BY_CODE[code] : undefined;
  if (kind) return { kind };

  return NOT_ALLOWED_STATUSES.includes(error.status) ? { kind: "not_allowed" } : undefined;
}

/** The API words the limit and the wait itself, so its message is shown as is. */
export function readTemplateRateLimit(error: unknown): string | undefined {
  if (!isApiError(error)) return undefined;

  const { code, message } = bodyOf(error.body);
  if (code !== RATE_LIMITED_CODE) return undefined;

  return typeof message === "string" && message ? message : RATE_LIMITED_FALLBACK;
}

function bodyOf(body: unknown): RefusalBody {
  return body && typeof body === "object" ? body : {};
}
