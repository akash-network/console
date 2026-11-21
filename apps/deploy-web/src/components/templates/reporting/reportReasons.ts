import type { TemplateReportReason } from "@src/types/marketplace-template";

export type ReportReasonCopy = { label: string; description: string };

const REASON_COPY: Record<TemplateReportReason, ReportReasonCopy> = {
  malware_or_miner: { label: "Malware or miner", description: "Runs a crypto miner, a botnet or other hidden software." },
  leaks_secrets: { label: "Leaks secrets", description: "Contains someone's keys, tokens or passwords." },
  impersonation: { label: "Impersonation", description: "Pretends to be Akash, a vendor or another publisher." },
  spam: { label: "Spam", description: "Ads, link farms or copies of other templates." },
  broken: { label: "Broken", description: "Doesn't deploy or doesn't work as described." },
  other: { label: "Other", description: "Something else we should look at." }
};

export const REPORT_REASONS = Object.entries(REASON_COPY).map(([reason, copy]) => ({ reason: reason as TemplateReportReason, ...copy }));

export const MAX_REPORT_DETAILS_LENGTH = 1000;
