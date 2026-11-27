import { z } from "@hono/zod-openapi";

import { INSIGHT_HINT_KINDS } from "@src/template-marketplace/lib/template-insights/template-insight-hints";
import { INSIGHT_PERIODS } from "@src/template-marketplace/lib/template-insights/template-insights";
import { templateViewKindEnum } from "@src/template-marketplace/model-schemas/template-view-event/template-view-event.schema";

export const CreateTemplateViewRequestSchema = z
  .object({
    data: z.object({
      kind: z.enum(templateViewKindEnum.enumValues).openapi({ description: "Whether the template's page was viewed or Configure was opened from it" })
    })
  })
  .openapi("CreateTemplateViewRequest");

export const GetTemplateInsightsQuerySchema = z.object({
  days: z
    .enum(INSIGHT_PERIODS.map(String) as ["7", "30", "90"])
    .default("30")
    .openapi({ description: "How many days, up to and including today in UTC, the insights cover" })
});

const DayCountsSchema = {
  views: z.number().int().nonnegative().openapi({ description: "People who viewed the template's page, each counted once a day" }),
  configureOpens: z.number().int().nonnegative().openapi({ description: "People who opened Configure from it, each counted once a day" }),
  deploys: z.number().int().nonnegative().openapi({ description: "Deployments made from it" }),
  leases: z.number().int().nonnegative().openapi({ description: "Of those deployments, the ones that got a provider" }),
  stillRunning: z.number().int().nonnegative().openapi({ description: "Of those deployments, the ones still running a day after they got a provider" })
};

const RateSchema = (description: string) =>
  z
    .number()
    .min(0)
    .max(1)
    .nullable()
    .openapi({ description: `${description}, null while too few are behind it` });

const TotalsSchema = z
  .object({
    ...DayCountsSchema,
    decidedLeases: z
      .number()
      .int()
      .nonnegative()
      .openapi({ description: "Deployments that got a provider at least a day ago, so whether they kept running is known" }),
    forks: z.number().int().nonnegative(),
    leaseRate: RateSchema("Share of deployments that got a provider"),
    stillRunningRate: RateSchema("Share of the decided deployments still running a day later"),
    viewToDeployRate: RateSchema("Deployments per view")
  })
  .openapi("TemplateInsightTotals");

export const GetTemplateInsightsResponseSchema = z
  .object({
    data: z.object({
      days: z.number().int().positive(),
      from: z.string().date().openapi({ description: "First UTC day covered" }),
      to: z.string().date().openapi({ description: "Last UTC day covered, today" }),
      current: TotalsSchema,
      previous: TotalsSchema.openapi({ description: "The same numbers for the period of the same length just before" }),
      daily: z
        .array(z.object({ day: z.string().date(), ...DayCountsSchema }))
        .openapi({ description: "One entry per day, deployments counted on the day they were made" }),
      versions: z
        .array(
          z.object({
            version: z.number().int().positive(),
            deploys: z.number().int().nonnegative(),
            leases: z.number().int().nonnegative(),
            decidedLeases: z.number().int().nonnegative(),
            stillRunning: z.number().int().nonnegative(),
            leaseRate: RateSchema("Share of the version's deployments that got a provider"),
            stillRunningRate: RateSchema("Share of the version's decided deployments still running a day later")
          })
        )
        .openapi({ description: "Every version ever deployed, over all time" }),
      hints: z
        .array(
          z.object({
            kind: z.enum(INSIGHT_HINT_KINDS),
            tone: z.enum(["warning", "info", "positive"]),
            value: z.number().openapi({ description: "The rate or count the hint is about" }),
            previousValue: z.number().nullable().openapi({ description: "What the value is compared to, for a hint that compares" }),
            version: z.number().int().positive().nullable().openapi({ description: "The version the hint is about, for a hint about one" })
          })
        )
        .openapi({ description: "What the numbers suggest, warnings first" })
    })
  })
  .openapi("GetTemplateInsightsResponse");

export type CreateTemplateViewRequest = z.infer<typeof CreateTemplateViewRequestSchema>;
export type GetTemplateInsightsQuery = z.infer<typeof GetTemplateInsightsQuerySchema>;
export type GetTemplateInsightsResponse = z.infer<typeof GetTemplateInsightsResponseSchema>;
