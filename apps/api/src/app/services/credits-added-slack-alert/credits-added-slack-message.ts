import type { CreditsAdded } from "@src/billing/events/credits-added";
import type { EventPayload } from "@src/core";

export interface CreditsAddedSlackMessage {
  text: string;
}

function describeSource(event: EventPayload<CreditsAdded>): string {
  switch (event.source) {
    case "payment_intent":
      return event.isAutoRecharge ? ":repeat: *Auto-recharge*" : ":credit_card: *Card purchase*";
    case "coupon_claim":
      return ":ticket: *Coupon claim*";
    case "manual_credit":
      return ":gift: *Admin credit*";
  }
}

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function escapeSlackText(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function describeBuyer(event: EventPayload<CreditsAdded>, email: string | null | undefined): string {
  const buyer = escapeSlackText(email || event.userId);

  if (event.bonusAmountCents > 0) {
    return `${buyer} · ${formatUsd(event.paidAmountCents)} paid + ${formatUsd(event.bonusAmountCents)} first-purchase bonus`;
  }

  return buyer;
}

function describeLinks(userId: string, links: { amplitudeProjectUrl?: string; adminUrl?: string }): string[] {
  const userLinks: string[] = [];

  if (links.amplitudeProjectUrl) {
    userLinks.push(`<${links.amplitudeProjectUrl}/search/user_id%3D${encodeURIComponent(userId)}|Amplitude sessions>`);
  }
  if (links.adminUrl) {
    userLinks.push(`<${links.adminUrl}/users/${encodeURIComponent(userId)}|Admin>`);
  }

  return userLinks.length ? [userLinks.join(" · ")] : [];
}

export function buildCreditsAddedSlackMessage(input: {
  event: EventPayload<CreditsAdded>;
  email: string | null | undefined;
  amplitudeProjectUrl?: string;
  adminUrl?: string;
}): CreditsAddedSlackMessage {
  const { event } = input;
  const creditedCents = event.paidAmountCents + event.bonusAmountCents;
  const messageLines = [
    `${describeSource(event)} · ${formatUsd(creditedCents)} credited`,
    describeBuyer(event, input.email),
    ...describeLinks(event.userId, input)
  ];

  return { text: messageLines.join("\n") };
}
