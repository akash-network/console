import { addBusinessMinutes } from "@src/hardware-request/lib/business-hours/business-hours";
import type { GpuRequestRoutingPolicy } from "@src/hardware-request/lib/gpu-request-routing-policy/gpu-request-routing-policy";
import type { HardwareRequestLane } from "@src/hardware-request/model-schemas";

export const RESPONSE_TARGETS = ["first_reply", "first_offer"] as const;

export type ResponseTarget = (typeof RESPONSE_TARGETS)[number];

export type ResponseSchedule = Record<ResponseTarget, { remindAt: Date; dueAt: Date }>;

export function responseScheduleOf(createdAt: Date, lane: HardwareRequestLane, policy: GpuRequestRoutingPolicy): ResponseSchedule {
  const { businessHours, responseTargets } = policy;
  const laneTargets = responseTargets[lane];
  const scheduleWithin = (targetBusinessHours: number) => ({
    remindAt: addBusinessMinutes(createdAt, Math.max(0, targetBusinessHours - responseTargets.reminderLeadBusinessHours) * 60, businessHours),
    dueAt: addBusinessMinutes(createdAt, targetBusinessHours * 60, businessHours)
  });

  return { first_reply: scheduleWithin(laneTargets.firstReplyBusinessHours), first_offer: scheduleWithin(laneTargets.firstOfferBusinessHours) };
}
