import { z } from "zod";

const BmePeriodSchema = z.object({
  date: z.string(),
  outstandingAct: z.number(),
  vaultAkt: z.number(),
  collateralRatio: z.number(),
  dailyAktBurnedForAct: z.number(),
  totalAktBurnedForAct: z.number(),
  dailyActMinted: z.number(),
  totalActMinted: z.number(),
  dailyActBurnedForAkt: z.number(),
  totalActBurnedForAkt: z.number(),
  dailyAktReminted: z.number(),
  totalAktReminted: z.number(),
  dailyNetAktBurned: z.number(),
  netAktBurned: z.number()
});

export type BmePeriodData = z.infer<typeof BmePeriodSchema>;

export const BmeDashboardDataResponseSchema = z.object({
  now: BmePeriodSchema,
  compare: BmePeriodSchema
});

export type BmeDashboardDataResponse = z.infer<typeof BmeDashboardDataResponseSchema>;
