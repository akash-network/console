import { describe, expect, it } from "vitest";

import {
  DEFAULT_GPU_REQUEST_ROUTING_POLICY,
  gpuRequestRoutingPolicySchema
} from "@src/hardware-request/lib/gpu-request-routing-policy/gpu-request-routing-policy";
import { responseScheduleOf } from "./hardware-request-response-schedule";

const TUESDAY_10AM_NEW_YORK = new Date("2026-11-10T15:00:00.000Z");

describe(responseScheduleOf.name, () => {
  it.each([
    {
      lane: "sales" as const,
      schedule: {
        first_reply: { remindAt: "2026-11-10T18:00:00.000Z", dueAt: "2026-11-10T19:00:00.000Z" },
        first_offer: { remindAt: "2026-11-11T22:00:00.000Z", dueAt: "2026-11-12T15:00:00.000Z" }
      }
    },
    {
      lane: "automated" as const,
      schedule: {
        first_reply: { remindAt: "2026-11-10T22:00:00.000Z", dueAt: "2026-11-11T15:00:00.000Z" },
        first_offer: { remindAt: "2026-11-10T22:00:00.000Z", dueAt: "2026-11-11T15:00:00.000Z" }
      }
    }
  ])("schedules the $lane lane's reminders an hour of business before each target", ({ lane, schedule }) => {
    expect(serialize(responseScheduleOf(TUESDAY_10AM_NEW_YORK, lane, DEFAULT_GPU_REQUEST_ROUTING_POLICY))).toEqual(schedule);
  });

  it("reminds at once when the lead is longer than the target", () => {
    const policy = gpuRequestRoutingPolicySchema.parse({ responseTargets: { reminderLeadBusinessHours: 5 } });

    expect(responseScheduleOf(TUESDAY_10AM_NEW_YORK, "sales", policy).first_reply.remindAt).toEqual(TUESDAY_10AM_NEW_YORK);
  });

  function serialize(schedule: ReturnType<typeof responseScheduleOf>) {
    return Object.fromEntries(
      Object.entries(schedule).map(([target, { remindAt, dueAt }]) => [target, { remindAt: remindAt.toISOString(), dueAt: dueAt.toISOString() }])
    );
  }
});
