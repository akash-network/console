import { isApiError } from "@akashnetwork/openapi-sdk";

import { readTemplateRateLimit } from "@src/components/templates/publishing/readPublishRefusal";
import { readRemovedTemplate } from "@src/components/templates/removed/readRemovedTemplate";

type RefusalKind = "already_reported" | "not_reportable" | "own_organization" | "removed" | "signed_out" | "not_readable" | "invalid";

export type ReportRefusal = { kind: RefusalKind } | { kind: "rate_limited"; message: string };

const KIND_BY_CODE: Record<string, RefusalKind> = {
  template_already_reported: "already_reported",
  template_not_reportable: "not_reportable",
  template_report_own_organization: "own_organization"
};

const KIND_BY_STATUS: Record<number, RefusalKind> = {
  400: "invalid",
  401: "signed_out",
  403: "not_readable",
  404: "not_readable"
};

export function readReportRefusal(error: unknown): ReportRefusal | undefined {
  if (!isApiError(error)) return undefined;

  const rateLimitMessage = readTemplateRateLimit(error);
  if (rateLimitMessage) return { kind: "rate_limited", message: rateLimitMessage };
  if (readRemovedTemplate(error)) return { kind: "removed" };

  const kind = KIND_BY_CODE[codeOf(error.body)] ?? KIND_BY_STATUS[error.status];
  return kind && { kind };
}

function codeOf(body: unknown): string {
  const code = body && typeof body === "object" && "code" in body ? body.code : undefined;
  return typeof code === "string" ? code : "";
}
