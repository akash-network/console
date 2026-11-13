import { ApiError } from "@akashnetwork/openapi-sdk";

export const TEMPLATE_INVALID_STATUS = 400;

export function describeTemplateRefusal(error: unknown): string | undefined {
  if (!(error instanceof ApiError) || error.status !== TEMPLATE_INVALID_STATUS) return undefined;

  const body: { message?: unknown; data?: { issues?: unknown } } | null = typeof error.body === "object" ? error.body : null;
  const issues = Array.isArray(body?.data?.issues) ? body.data.issues.filter((issue): issue is string => typeof issue === "string" && issue.length > 0) : [];
  if (issues.length > 0) return issues.join("; ");

  return typeof body?.message === "string" && body.message ? body.message : undefined;
}
