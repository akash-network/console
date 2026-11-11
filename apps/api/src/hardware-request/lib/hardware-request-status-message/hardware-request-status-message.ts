import type { CloseReason, HardwareRequestLane, HardwareRequestStatus } from "@src/hardware-request/model-schemas";

const STATUS_HEADLINES: Record<HardwareRequestStatus, string> = {
  submitted: "is back in our queue",
  in_review: "is being reviewed",
  sourcing: "is being sourced",
  offers: "has offers ready",
  accepted: "has an accepted offer",
  fulfilled: "is ready",
  withdrawn: "was withdrawn",
  closed: "was closed"
};

const STATUS_DETAILS: Record<HardwareRequestStatus, string> = {
  submitted: "We'll pick it up again shortly.",
  in_review: "Our team is reviewing what you asked for.",
  sourcing: "We're reaching out to providers for capacity that matches your request.",
  offers: "Compare the offers and accept the one that suits you.",
  accepted: "Our team is setting up your capacity.",
  fulfilled: "Your capacity is set up.",
  withdrawn: "We've stopped working on it.",
  closed: "We've stopped working on it."
};

const CLOSE_REASON_DETAILS: Record<CloseReason, string> = {
  no_supply: "We couldn't find capacity that matches your request.",
  price: "We couldn't find capacity at your target price.",
  went_silent: "We didn't hear back from you.",
  duplicate: "It repeats another of your requests.",
  other: "We've stopped working on it."
};

export type HardwareRequestStatusMessage = { headline: string; detail: string };

/** Worded for the tenant, so it never names the team member or the internal close reason code. */
export function describeStatusForTenant(title: string, status: HardwareRequestStatus, closeReason?: CloseReason): HardwareRequestStatusMessage {
  const detail = status === "closed" && closeReason ? CLOSE_REASON_DETAILS[closeReason] : STATUS_DETAILS[status];

  return { headline: `${title} ${STATUS_HEADLINES[status]}`, detail };
}

export type HardwareRequestReceipt = { lane: HardwareRequestLane | null; firstReplyDueAt: string | null };

/** The tenant's own time zone is unknown here, so the reply time is shown in the team's business-hours zone with its name. */
export function describeReceiptForTenant(title: string, { lane, firstReplyDueAt }: HardwareRequestReceipt, timeZone: string): HardwareRequestStatusMessage {
  const replier = lane === "sales" ? "Our team will reply" : "We'll get back to you";
  const when = firstReplyDueAt ? `by ${formatReplyTime(new Date(firstReplyDueAt), timeZone)}` : "soon";

  return { headline: `${title} was received`, detail: `${replier} ${when}.` };
}

function formatReplyTime(dueAt: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short"
  }).format(dueAt);
}
