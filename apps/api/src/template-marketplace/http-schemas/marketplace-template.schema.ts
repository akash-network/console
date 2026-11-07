import { z } from "@hono/zod-openapi";

import { organizationTypeEnum } from "@src/organization/model-schemas/organization/organization.schema";
import { TemplateHardwareSchema } from "@src/template/http-schemas/template.schema";
import { AskedValueSchema } from "@src/template-marketplace/lib/asked-values/asked-values.schema";
import { TEMPLATE_VERSION_CHANGES } from "@src/template-marketplace/lib/version-changes/summarize-version-changes";
import { templateVersionStatusEnum } from "@src/template-marketplace/model-schemas/template-version/template-version.schema";
import { templateModerationStatusEnum, templateVisibilityEnum } from "@src/user/model-schemas/template/template.schema";

/** The `version` column is a Postgres integer, which refuses anything larger with a 500. */
export const MAX_VERSION_NUMBER = 2_147_483_647;

export const UserTemplateParamsSchema = z.object({
  id: z.string().uuid()
});

export const UserTemplateVersionParamsSchema = UserTemplateParamsSchema.extend({
  version: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_VERSION_NUMBER)
    .openapi({ type: "integer", minimum: 1, maximum: MAX_VERSION_NUMBER, description: "The version number, counted from 1" })
});

export const TemplateVersionSummarySchema = z
  .object({
    id: z.string().uuid(),
    templateId: z.string().uuid(),
    version: z.number().int().positive(),
    resources: TemplateHardwareSchema.nullable().openapi({ description: "Null when the version recorded none" }),
    status: z.enum(templateVersionStatusEnum.enumValues),
    changes: z
      .array(z.enum(TEMPLATE_VERSION_CHANGES))
      .nullable()
      .openapi({ description: "What this version changed from the one before it, null for a version saved before changes were recorded" }),
    createdBy: z.object({ username: z.string() }).nullable().openapi({ description: "Null when the creator deleted their account or has no username" }),
    createdAt: z.string().datetime()
  })
  .openapi("TemplateVersionSummary");

export const TemplateVersionSchema = TemplateVersionSummarySchema.extend({
  sdl: z.string(),
  readme: z.string().nullable(),
  askedValues: z.array(AskedValueSchema)
}).openapi("TemplateVersion");

export const MarketplaceTemplateSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string(),
    summary: z.string().nullable(),
    icon: z.string().nullable(),
    categories: z.array(z.string()),
    visibility: z.enum(templateVisibilityEnum.enumValues),
    isListed: z.boolean(),
    isOfficial: z.boolean(),
    moderationStatus: z.enum(templateModerationStatusEnum.enumValues),
    projectId: z
      .string()
      .uuid()
      .nullable()
      .openapi({ description: "The project the template is filed in, null for one filed in none or outside the active organization" }),
    copiedFromId: z.string().uuid().nullable().openapi({ description: "The template this one was copied from, null unless the caller may read it" }),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    author: z.object({ username: z.string() }).nullable().openapi({ description: "Null when the author deleted their account" }),
    publisher: z
      .object({
        name: z.string(),
        slug: z.string().nullable().openapi({ description: "Null for a personal organization" }),
        type: z.enum(organizationTypeEnum.enumValues)
      })
      .nullable()
      .openapi({ description: "The organization the template belongs to, null for a template filed in none" }),
    currentVersion: TemplateVersionSchema.nullable().openapi({
      description: "Its readme falls back to the template's description and its resources to the SDL's, for versions saved before they were recorded"
    }),
    canEdit: z.boolean().openapi({ description: "Whether the caller may change the template" }),
    isFavorite: z.boolean().openapi({ description: "Whether the caller made the template a favorite, false without a session" })
  })
  .openapi("MarketplaceTemplate");

export const GetUserTemplateResponseSchema = z.object({ data: MarketplaceTemplateSchema }).openapi("GetUserTemplateResponse");

export const ListUserTemplateVersionsResponseSchema = z.object({ data: z.array(TemplateVersionSummarySchema) }).openapi("ListUserTemplateVersionsResponse");

export const GetUserTemplateVersionResponseSchema = z.object({ data: TemplateVersionSchema }).openapi("GetUserTemplateVersionResponse");

export type MarketplaceTemplateResponse = z.infer<typeof MarketplaceTemplateSchema>;
export type TemplateVersionSummaryResponse = z.infer<typeof TemplateVersionSummarySchema>;
export type TemplateVersionResponse = z.infer<typeof TemplateVersionSchema>;
export type GetUserTemplateResponse = z.infer<typeof GetUserTemplateResponseSchema>;
export type ListUserTemplateVersionsResponse = z.infer<typeof ListUserTemplateVersionsResponseSchema>;
export type GetUserTemplateVersionResponse = z.infer<typeof GetUserTemplateVersionResponseSchema>;
