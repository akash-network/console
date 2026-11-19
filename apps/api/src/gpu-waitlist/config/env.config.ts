import { z } from "zod";

function positiveInt(defaultValue: number) {
  return z.number({ coerce: true }).int().positive().optional().default(defaultValue);
}

const NETWORKS = ["mainnet", "testnet", "sandbox"] as const;

export const envSchema = z.object({
  /** Networks share the users database and waitlist rows carry no network, so only the networks listed here run waitlists. */
  GPU_WAITLIST_NETWORKS: z
    .string()
    .optional()
    .default("mainnet")
    .transform(networks => networks.split(",").map(network => network.trim()))
    .pipe(z.array(z.enum(NETWORKS))),
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
