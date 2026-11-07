import { z } from "@hono/zod-openapi";

import { SDL_MAX_LENGTH } from "@src/deployment/config/sdl.config";
import { AskedValuesSchema } from "@src/template-marketplace/lib/asked-values/asked-values.schema";
import {
  MAX_TEMPLATE_CATEGORIES,
  MAX_TEMPLATE_README_LENGTH,
  MAX_TEMPLATE_SUMMARY_LENGTH,
  MAX_TEMPLATE_TITLE_LENGTH,
  TEMPLATE_CATEGORIES,
  TEMPLATE_ICONS
} from "@src/template-marketplace/lib/template-catalog/template-catalog";
import { templateVersionStatusEnum } from "@src/template-marketplace/model-schemas/template-version/template-version.schema";
import { templateModerationStatusEnum, templateVisibilityEnum } from "@src/user/model-schemas/template/template.schema";
import { MarketplaceTemplateSchema, MAX_VERSION_NUMBER, TemplateVersionSchema } from "./marketplace-template.schema";

const TemplateSdlSchema = z.string().min(1).max(SDL_MAX_LENGTH);

const ReadmeSchema = z.string().max(MAX_TEMPLATE_README_LENGTH);

const TitleSchema = z.string().trim().min(1).max(MAX_TEMPLATE_TITLE_LENGTH);

const SummarySchema = z.string().trim().max(MAX_TEMPLATE_SUMMARY_LENGTH);

const IconSchema = z.enum(TEMPLATE_ICONS);

const CategoriesSchema = z
  .array(z.enum(TEMPLATE_CATEGORIES))
  .max(MAX_TEMPLATE_CATEGORIES)
  .refine(categories => new Set(categories).size === categories.length, { message: "Categories must be unique" });

export const CreateUserTemplateRequestSchema = z
  .object({
    data: z.object({
      title: TitleSchema,
      summary: SummarySchema.optional(),
      icon: IconSchema.optional(),
      categories: CategoriesSchema.optional(),
      sdl: TemplateSdlSchema,
      readme: ReadmeSchema.optional(),
      askedValues: AskedValuesSchema.default([]).openapi({ description: "The values the deployer fills in, bound to the SDL's env vars" }),
      projectId: z.string().uuid().optional().openapi({ description: "The project to file the template in, required when the caller may write to several" }),
      copiedFromId: z.string().uuid().optional().openapi({ description: "The template this one was copied from, which the caller must be able to read" })
    })
  })
  .openapi("CreateUserTemplateRequest");

export const CreateUserTemplateVersionRequestSchema = z
  .object({
    data: z.object({
      sdl: TemplateSdlSchema,
      readme: ReadmeSchema.nullable().optional().openapi({ description: "Omitted keeps the current version's readme, null clears it" }),
      askedValues: AskedValuesSchema,
      baseVersion: z.number().int().positive().max(MAX_VERSION_NUMBER).optional().openapi({
        description:
          "The version this one was edited from, refused with 409 once another version has been saved after it; required once the template has a version"
      })
    })
  })
  .openapi("CreateUserTemplateVersionRequest");

export const UpdateUserTemplateRequestSchema = z
  .object({
    data: z
      .object({
        title: TitleSchema.optional(),
        summary: SummarySchema.nullable().optional().openapi({ description: "Null or blank clears it" }),
        icon: IconSchema.nullable().optional().openapi({ description: "Null shows the default icon" }),
        categories: CategoriesSchema.optional(),
        visibility: z.enum(["private", "organization"]).optional().openapi({ description: "Moving a public template to either clears its public flag" })
      })
      .refine(settings => Object.values(settings).some(value => value !== undefined), { message: "Change at least one setting" })
  })
  .openapi("UpdateUserTemplateRequest");

export const ListUserTemplatesQuerySchema = z.object({
  visibility: z.enum(templateVisibilityEnum.enumValues).optional(),
  projectId: z.string().uuid().optional()
});

export const UserTemplateListItemSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string(),
    summary: z.string().nullable(),
    icon: z.string().nullable(),
    categories: z.array(z.string()),
    visibility: z.enum(templateVisibilityEnum.enumValues),
    isListed: z.boolean(),
    moderationStatus: z.enum(templateModerationStatusEnum.enumValues),
    projectId: z.string().uuid().nullable(),
    copiedFromId: z.string().uuid().nullable(),
    updatedAt: z.string().datetime(),
    currentVersion: z
      .object({ version: z.number().int().positive(), status: z.enum(templateVersionStatusEnum.enumValues), createdAt: z.string().datetime() })
      .nullable()
      .openapi({ description: "Null on a template an older API pod saved without a version" }),
    lastEditedBy: z.object({ username: z.string() }).nullable().openapi({ description: "Who saved the current version, null when unknown or gone" }),
    canEdit: z.boolean().openapi({ description: "Whether the caller may change the template" })
  })
  .openapi("UserTemplateListItem");

export const ListUserTemplatesResponseSchema = z.object({ data: z.array(UserTemplateListItemSchema) }).openapi("ListUserTemplatesResponse");

export const UpdateUserTemplateResponseSchema = z.object({ data: MarketplaceTemplateSchema }).openapi("UpdateUserTemplateResponse");

export const CreateUserTemplateResponseSchema = z.object({ data: MarketplaceTemplateSchema }).openapi("CreateUserTemplateResponse");

export const CreateUserTemplateVersionResponseSchema = z.object({ data: TemplateVersionSchema }).openapi("CreateUserTemplateVersionResponse");

export type CreateUserTemplateRequest = z.infer<typeof CreateUserTemplateRequestSchema>;
export type CreateUserTemplateVersionRequest = z.infer<typeof CreateUserTemplateVersionRequestSchema>;
export type CreateUserTemplateResponse = z.infer<typeof CreateUserTemplateResponseSchema>;
export type CreateUserTemplateVersionResponse = z.infer<typeof CreateUserTemplateVersionResponseSchema>;
export type UpdateUserTemplateRequest = z.infer<typeof UpdateUserTemplateRequestSchema>;
export type UpdateUserTemplateResponse = z.infer<typeof UpdateUserTemplateResponseSchema>;
export type ListUserTemplatesQuery = z.infer<typeof ListUserTemplatesQuerySchema>;
export type ListUserTemplatesResponse = z.infer<typeof ListUserTemplatesResponseSchema>;
