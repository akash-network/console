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
    case "affiliate_commission":
      return ":handshake: *Affiliate commission*";
  }
}

function describeCustomer(event: EventPayload<CreditsAdded>, hasPaidBefore: boolean): string {
  if (hasPaidBefore) {
    return "Returning customer";
  }

  return event.source === "payment_intent" ? ":new: New customer" : "No paid purchase yet";
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

function slackLink(url: string, label: string): string {
  return `<${url}|${label}>`;
}

function describeStripeTransactionLink(stripeDashboardUrl: string, event: EventPayload<CreditsAdded>): string | undefined {
  if (event.stripePaymentIntentId) {
    return slackLink(`${stripeDashboardUrl}/payments/${encodeURIComponent(event.stripePaymentIntentId)}`, "Stripe payment");
  }
  if (event.stripeInvoiceId) {
    return slackLink(`${stripeDashboardUrl}/invoices/${encodeURIComponent(event.stripeInvoiceId)}`, "Stripe invoice");
  }

  return undefined;
}

function describeStripeLinks(stripeDashboardUrl: string, event: EventPayload<CreditsAdded>): string[] {
  const stripeLinks: string[] = [];

  if (event.stripeCustomerId) {
    stripeLinks.push(slackLink(`${stripeDashboardUrl}/customers/${encodeURIComponent(event.stripeCustomerId)}`, "Stripe customer"));
  }

  const transactionLink = describeStripeTransactionLink(stripeDashboardUrl, event);
  if (transactionLink) {
    stripeLinks.push(transactionLink);
  }

  return stripeLinks;
}

function describeLinks(event: EventPayload<CreditsAdded>, links: { amplitudeProjectUrl?: string; adminUrl?: string; stripeDashboardUrl?: string }): string[] {
  const userLinks: string[] = [];

  if (links.amplitudeProjectUrl) {
    userLinks.push(slackLink(`${links.amplitudeProjectUrl}/search/user_id%3D${encodeURIComponent(event.userId)}`, "Amplitude sessions"));
  }
  if (links.adminUrl) {
    userLinks.push(slackLink(`${links.adminUrl}/users/${encodeURIComponent(event.userId)}`, "Admin"));
  }
  if (links.stripeDashboardUrl) {
    userLinks.push(...describeStripeLinks(links.stripeDashboardUrl, event));
  }

  return userLinks.length ? [userLinks.join(" · ")] : [];
}

export function buildCreditsAddedSlackMessage(input: {
  event: EventPayload<CreditsAdded>;
  email: string | null | undefined;
  hasPaidBefore: boolean;
  amplitudeProjectUrl?: string;
  adminUrl?: string;
  stripeDashboardUrl?: string;
}): CreditsAddedSlackMessage {
  const { event } = input;
  const creditedCents = event.paidAmountCents + event.bonusAmountCents;
  const headline = `${describeSource(event)} · *${formatUsd(creditedCents)}* credited · ${describeCustomer(event, input.hasPaidBefore)}`;
  const messageLines = [headline, describeBuyer(event, input.email), ...describeLinks(event, input)];

  return { text: messageLines.join("\n") };
}
