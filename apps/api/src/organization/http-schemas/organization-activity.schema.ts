import { z } from "@hono/zod-openapi";

import { organizationActivityTypeEnum } from "@src/organization/model-schemas/organization-activity/organization-activity.schema";

export const MAX_ORGANIZATION_ACTIVITY_PAGE_LIMIT = 100;
export const DEFAULT_ORGANIZATION_ACTIVITY_PAGE_LIMIT = 20;

export const OrganizationActivitySchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid().nullable().openapi({ description: "The project the activity happened in, null for one about the whole organization." }),
  actor: z
    .object({ id: z.string().uuid(), username: z.string().nullable() })
    .nullable()
    .openapi({ description: "Who did it, null for the system or a since deleted user." }),
  type: z.enum(organizationActivityTypeEnum.enumValues),
  payload: z.record(z.string(), z.unknown()).openapi({ description: "The names and values the client renders the activity text with, per type." }),
  createdAt: z.string().datetime()
});

export const ListOrganizationActivitiesQuerySchema = z.object({
  projectId: z.string().uuid().optional().openapi({ description: "Only the activities of this project." }),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_ORGANIZATION_ACTIVITY_PAGE_LIMIT)
    .default(DEFAULT_ORGANIZATION_ACTIVITY_PAGE_LIMIT)
    .openapi({ description: `Activities per page, at most ${MAX_ORGANIZATION_ACTIVITY_PAGE_LIMIT}.` }),
  cursor: z.string().optional().openapi({ description: "Where the page starts: the `nextCursor` of the page before it. Omit it for the newest activities." })
});

export const ListOrganizationActivitiesResponseSchema = z.object({
  data: z.array(OrganizationActivitySchema).openapi({ description: "Newest first." }),
  nextCursor: z.string().nullable().openapi({ description: "Pass it as `cursor` to read the next page. Null on the last page." })
});

export type OrganizationActivityResponseItem = z.infer<typeof OrganizationActivitySchema>;
export type ListOrganizationActivitiesQuery = z.infer<typeof ListOrganizationActivitiesQuerySchema>;
export type ListOrganizationActivitiesResponse = z.infer<typeof ListOrganizationActivitiesResponseSchema>;
