import { z } from "zod";

function positiveInt(defaultValue: number) {
  return z.number({ coerce: true }).int().positive().optional().default(defaultValue);
}

export const envSchema = z.object({
  GPU_WAITLIST_POLL_SECONDS: positiveInt(60),
  GPU_WAITLIST_BID_EVIDENCE_DAYS: positiveInt(7),
  GPU_WAITLIST_CHECK_COOLDOWN_MINUTES: positiveInt(15),
  GPU_WAITLIST_WAVE_MULTIPLIER: positiveInt(3),
  GPU_WAITLIST_WAVE_WINDOW_MINUTES: positiveInt(10),
  GPU_WAITLIST_MAX_EMAILS_PER_ENTRY_PER_DAY: positiveInt(2),
  GPU_WAITLIST_MAX_ACTIVE_ENTRIES: positiveInt(10),
  GPU_WAITLIST_JOIN_HOURLY_LIMIT: positiveInt(10),
  GPU_WAITLIST_JOIN_DAILY_LIMIT: positiveInt(30),
  GPU_WAITLIST_STILL_WANTED_DAYS: positiveInt(30),
  GPU_WAITLIST_STILL_WANTED_GRACE_DAYS: positiveInt(7)
});

export type GpuWaitlistConfig = z.infer<typeof envSchema>;
