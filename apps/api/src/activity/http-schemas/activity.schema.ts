import { z } from "@hono/zod-openapi";

import { activityStatusEnum, activityTypeEnum } from "@src/activity/model-schemas";

export const MAX_ACTIVITY_PAGE_LIMIT = 100;
export const DEFAULT_ACTIVITY_PAGE_LIMIT = 20;
export const MAX_ACTIVITY_IDS_PER_REQUEST = 100;

const ActivityStatusSchema = z.enum(activityStatusEnum.enumValues).openapi({
  description: "`pending` while the action is still being confirmed, then `succeeded` or `failed`."
});

const ActivityTypeSchema = z.enum(activityTypeEnum.enumValues).openapi({ description: "What the action was." });

export const ActivitySchema = z.object({
  id: z.string().uuid(),
  type: ActivityTypeSchema,
  status: ActivityStatusSchema,
  meta: z.object({
    dseq: z.string().optional().openapi({ description: "The deployment the action was about." }),
    batchId: z.string().optional().openapi({ description: "The bulk close the action was part of, as its request named it." }),
    txHash: z.string().optional().openapi({ description: "Reference of a pending action whose outcome is still being confirmed." }),
    error: z.object({ code: z.string(), message: z.string() }).optional().openapi({ description: "Why a failed action did not go through." })
  }),
  seenAt: z.string().datetime().nullable().openapi({ description: "When the user first marked the activity seen." }),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const ListActivitiesQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_ACTIVITY_PAGE_LIMIT)
    .default(DEFAULT_ACTIVITY_PAGE_LIMIT)
    .openapi({ description: `Activities per page, at most ${MAX_ACTIVITY_PAGE_LIMIT}.` }),
  cursor: z.string().optional().openapi({ description: "Where the page starts: the `nextCursor` of the page before it. Omit it for the newest activities." }),
  status: ActivityStatusSchema.optional(),
  type: ActivityTypeSchema.optional()
});

const UnseenCountSchema = z.number().int().openapi({ description: "Activities the user has not marked seen, whatever the filters." });

export const ListActivitiesResponseSchema = z.object({
  data: z.object({
    activities: z.array(ActivitySchema).openapi({ description: "Newest first." }),
    unseenCount: UnseenCountSchema,
    pagination: z.object({
      limit: z.number(),
      hasMore: z.boolean().openapi({ description: "Whether a further page exists." }),
      nextCursor: z.string().nullable().openapi({ description: "Pass it as `cursor` to read the next page. Null on the last page." })
    })
  })
});

export const GetActivityParamsSchema = z.object({
  id: z.string().uuid().openapi({ description: "The activity's id, as a background action's request returned it." })
});

export const GetActivityResponseSchema = z.object({
  data: ActivitySchema
});

export const MarkActivitiesSeenResponseSchema = z.object({
  data: z.object({ unseenCount: UnseenCountSchema })
});

export const MarkActivitiesSeenRequestSchema = z.object({
  data: z.union([
    z.object({
      ids: z.array(z.string().uuid()).min(1).max(MAX_ACTIVITY_IDS_PER_REQUEST).openapi({ description: "The activities to mark seen." })
    }),
    z.object({
      upTo: z.string().datetime().openapi({ description: "Marks every activity created at or before this time." })
    })
  ])
});

export type ActivityResponse = z.infer<typeof ActivitySchema>;
export type ListActivitiesQuery = z.infer<typeof ListActivitiesQuerySchema>;
export type ListActivitiesResponse = z.infer<typeof ListActivitiesResponseSchema>;
export type MarkActivitiesSeenResponse = z.infer<typeof MarkActivitiesSeenResponseSchema>;
export type MarkActivitiesSeenRequest = z.infer<typeof MarkActivitiesSeenRequestSchema>;
export type GetActivityResponse = z.infer<typeof GetActivityResponseSchema>;
