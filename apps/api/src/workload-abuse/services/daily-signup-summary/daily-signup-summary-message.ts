import type { CreatedAccount } from "@src/user/repositories";
import { extractEmailDomain } from "@src/workload-abuse/lib/email-domain/email-domain";
import { isPublicEmailProvider } from "@src/workload-abuse/lib/email-domain/public-email-providers";

const MIN_SHARED_FINGERPRINT_ACCOUNTS = 3;
const MAX_FINGERPRINT_GROUPS = 10;
const MAX_ACCOUNTS_PER_GROUP = 10;
const MAX_TOP_DOMAINS = 10;

const SIGN_IN_METHOD_LABELS: Record<string, string> = {
  auth0: "Email",
  "google-oauth2": "Google",
  github: "GitHub"
};

type SummarizedAccount = Pick<CreatedAccount, "id" | "email">;

export interface DailySignupSummary {
  windowStartsAt: Date;
  windowEndsAt: Date;
  accounts: CreatedAccount[];
  trialsStarted: number;
}

export interface DailySignupSummaryMessage {
  text: string;
}

function escapeSlackText(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function describeAccount(account: SummarizedAccount, adminUrl: string | undefined): string {
  const name = escapeSlackText(account.email || account.id);
  if (!adminUrl) return name;
  return `${name} · <${adminUrl}/users/${encodeURIComponent(account.id)}|Admin>`;
}

function describeDomain(domain: string, adminUrl: string | undefined): string {
  const name = escapeSlackText(domain);
  if (!adminUrl) return name;
  return `<${adminUrl}/users?q=${encodeURIComponent(`@${domain}`)}|${name}>`;
}

function formatUtc(date: Date): string {
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function signInMethodOf(externalUserId: string | null): string {
  const provider = externalUserId?.split("|")[0];
  if (!provider) return "Unknown";
  return SIGN_IN_METHOD_LABELS[provider] ?? provider;
}

function countBy<T>(items: T[], keyOf: (item: T) => string | null): [string, number][] {
  const counts = new Map<string, number>();

  for (const item of items) {
    const key = keyOf(item);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts].sort(([keyA, countA], [keyB, countB]) => countB - countA || keyA.localeCompare(keyB));
}

function listWithOverflow(lines: string[], max: number): string[] {
  if (lines.length <= max) return lines;
  return [...lines.slice(0, max), `…and ${lines.length - max} more`];
}

function headlineLines(summary: DailySignupSummary): string[] {
  const methods = countBy(summary.accounts, account => signInMethodOf(account.userId)).map(([method, total]) => `${escapeSlackText(method)} ${total}`);
  const methodBreakdown = methods.length ? ` (${methods.join(" · ")})` : "";

  return [
    `:bar_chart: *Daily sign-up and trial summary* ${formatUtc(summary.windowStartsAt)} to ${formatUtc(summary.windowEndsAt)}`,
    `New accounts: ${summary.accounts.length}${methodBreakdown}`,
    `Trials started: ${summary.trialsStarted}`
  ];
}

function fingerprintGroupLines(accounts: CreatedAccount[], adminUrl: string | undefined): string[] {
  const groups = countBy(accounts, account => account.lastFingerprint).filter(([, total]) => total >= MIN_SHARED_FINGERPRINT_ACCOUNTS);
  if (!groups.length) return [];

  const groupLines = groups.slice(0, MAX_FINGERPRINT_GROUPS).flatMap(([fingerprint, total]) => {
    const members = accounts.filter(account => account.lastFingerprint === fingerprint).map(account => `    ◦ ${describeAccount(account, adminUrl)}`);
    return [`• ${total} accounts on one device`, ...listWithOverflow(members, MAX_ACCOUNTS_PER_GROUP)];
  });
  const hiddenGroups = groups.length - MAX_FINGERPRINT_GROUPS;

  return [`*Shared device fingerprints (${groups.length})*`, ...groupLines, ...(hiddenGroups > 0 ? [`…and ${hiddenGroups} more groups`] : [])];
}

function topDomainLines(accounts: CreatedAccount[], adminUrl: string | undefined): string[] {
  const domains = countBy(accounts, account => extractEmailDomain(account.email)).filter(([domain]) => !isPublicEmailProvider(domain));
  if (!domains.length) return [];

  return ["*Top email domains*", ...domains.slice(0, MAX_TOP_DOMAINS).map(([domain, total]) => `• ${describeDomain(domain, adminUrl)} ${total}`)];
}

export function buildDailySignupSummaryMessage(summary: DailySignupSummary, adminUrl?: string): DailySignupSummaryMessage {
  const lines = [...headlineLines(summary), ...fingerprintGroupLines(summary.accounts, adminUrl), ...topDomainLines(summary.accounts, adminUrl)];

  return { text: lines.join("\n") };
}
