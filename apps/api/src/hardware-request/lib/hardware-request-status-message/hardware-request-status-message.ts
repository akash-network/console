import type { CloseReason, HardwareRequestStatus } from "@src/hardware-request/model-schemas";

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

export function describeReceiptForTenant(title: string): HardwareRequestStatusMessage {
  return { headline: `${title} was received`, detail: "We're working on it and will let you know if we find capacity that matches your request." };
}
