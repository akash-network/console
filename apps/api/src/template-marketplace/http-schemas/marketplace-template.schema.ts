import { z } from "@hono/zod-openapi";

import { organizationTypeEnum } from "@src/organization/model-schemas/organization/organization.schema";
import { TemplateHardwareSchema } from "@src/template/http-schemas/template.schema";
import { AskedValueSchema } from "@src/template-marketplace/lib/asked-values/asked-values.schema";
import { PUBLISH_CHECK_ISSUE_FIELDS, PUBLISH_CHECK_KEYS, PUBLISH_CHECK_STATUSES } from "@src/template-marketplace/lib/publish-checks/publish-check-results";
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

export const PublishCheckSchema = z
  .object({
    key: z.enum(PUBLISH_CHECK_KEYS),
    status: z.enum(PUBLISH_CHECK_STATUSES),
    issues: z.array(
      z.object({
        message: z.string().openapi({ description: "What is wrong and how to fix it, as plain text" }),
        service: z.string().optional().openapi({ description: "The SDL service the issue is in" }),
        variable: z.string().optional().openapi({ description: "The env variable or asked value the issue is in" }),
        image: z.string().optional().openapi({ description: "The container image the issue is about" }),
        field: z
          .enum(PUBLISH_CHECK_ISSUE_FIELDS)
          .optional()
          .openapi({ description: "The name a reserved word was found in, the text a line holding a credential was found in, or the text that is over its length limit" })
      })
    )
  })
  .openapi("TemplatePublishCheck");

const PublishCheckResultsSchema = z.object({ ranAt: z.string().datetime(), checks: z.array(PublishCheckSchema) });

const TemplateVersionFieldsSchema = z
  .object({
    id: z.string().uuid(),
    templateId: z.string().uuid(),
    version: z.number().int().positive(),
    resources: TemplateHardwareSchema.nullable().openapi({ description: "Null when the version recorded none" }),
    status: z.enum(templateVersionStatusEnum.enumValues).openapi({
      description: "A `failed_checks` version failed the publish checks of a public template, never became the current version and is shown to editors only"
    }),
    checkResults: PublishCheckResultsSchema.nullable().openapi({
      description: "What the publish checks found, for callers who may change the template; null for everyone else and for a version they never ran on"
    }),
    changes: z
      .array(z.enum(TEMPLATE_VERSION_CHANGES))
      .nullable()
      .openapi({ description: "What this version changed from the one before it, null for a version saved before changes were recorded" }),
    createdBy: z.object({ username: z.string() }).nullable().openapi({ description: "Null when the creator deleted their account or has no username" }),
    createdAt: z.string().datetime()
  })
  .openapi("TemplateVersionFields");

export const DeploysSchema = z.number().int().nonnegative().openapi({ description: "Deploys made from Console on mainnet" });

export const TemplateVersionSummarySchema = TemplateVersionFieldsSchema.extend({
  deploys: DeploysSchema
}).openapi("TemplateVersionSummary");

export const TemplateVersionSchema = TemplateVersionFieldsSchema.extend({
  sdl: z.string(),
  readme: z.string().nullable(),
  askedValues: z.array(AskedValueSchema)
}).openapi("TemplateVersion");

/** zod-to-openapi drops `nullable` from a named schema's `$ref`, so a nullable version inlines its shape. */
const NullableTemplateVersionSchema = z.object(TemplateVersionSchema.shape).nullable();

export const LastDeployedAtSchema = z
  .string()
  .datetime()
  .nullable()
  .openapi({ description: "The latest mainnet deploy made from Console, null before the first" });

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
    publishedAt: z
      .string()
      .datetime()
      .nullable()
      .openapi({ description: "When the template first went public through the publish checks, kept after it is made private again; null before" }),
    author: z.object({ username: z.string() }).nullable().openapi({ description: "Null when the author deleted their account" }),
    publisher: z
      .object({
        name: z.string(),
        slug: z.string().nullable().openapi({ description: "Null for a personal organization" }),
        type: z.enum(organizationTypeEnum.enumValues),
        handle: z.string().nullable().openapi({ description: "The name of the publisher page, null until the organization first publishes a template" })
      })
      .nullable()
      .openapi({ description: "The organization the template belongs to, null for a template filed in none" }),
    currentVersion: NullableTemplateVersionSchema.openapi({
      description: "Its readme falls back to the template's description and its resources to the SDL's, for versions saved before they were recorded"
    }),
    canEdit: z.boolean().openapi({ description: "Whether the caller may change the template" }),
    isFavorite: z.boolean().openapi({ description: "Whether the caller made the template a favorite, false without a session" }),
    usage: z.object({
      deploys: DeploysSchema,
      lastDeployedAt: LastDeployedAtSchema,
      stillUpAfter24h: z.number().min(0).max(1).nullable().openapi({
        description: "The share of mainnet leases older than a day whose deployment was still running a day later, null below five such leases"
      })
    })
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
