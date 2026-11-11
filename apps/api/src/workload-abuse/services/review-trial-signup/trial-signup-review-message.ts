import type { UserOutput } from "@src/user/repositories";

type ReviewedAccount = Pick<UserOutput, "id" | "email">;

export interface TrialSignupReviewMessage {
  text: string;
}

function escapeSlackText(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function describeAccount(account: ReviewedAccount, adminUrl: string | undefined): string {
  const name = escapeSlackText(account.email || account.id);

  if (!adminUrl) return name;

  return `${name} · <${adminUrl}/users/${encodeURIComponent(account.id)}|Admin>`;
}

export function buildTrialSignupReviewMessage(input: {
  account: ReviewedAccount;
  linkedAccounts: ReviewedAccount[];
  adminUrl?: string;
  held?: boolean;
}): TrialSignupReviewMessage {
  const linkedLines = input.linkedAccounts.map(linkedAccount => `• ${describeAccount(linkedAccount, input.adminUrl)}`);
  const messageLines = [
    input.held ? ":no_entry: *Trial held pending review*" : ":mag: *Trial sign-up flagged for review*",
    describeAccount(input.account, input.adminUrl),
    `Linked accounts (${input.linkedAccounts.length}):`,
    ...linkedLines
  ];

  return { text: messageLines.join("\n") };
}
