import { z } from "@hono/zod-openapi";

import { SDL_MAX_LENGTH } from "@src/deployment/config/sdl.config";
import { AskedValuesSchema } from "@src/template-marketplace/lib/asked-values/asked-values.schema";
import {
  MAX_TEMPLATE_README_LENGTH,
  MAX_TEMPLATE_SUMMARY_LENGTH,
  MAX_TEMPLATE_TITLE_LENGTH
} from "@src/template-marketplace/lib/template-catalog/template-catalog";
import { MarketplaceTemplateSchema, MAX_VERSION_NUMBER, TemplateVersionSchema } from "./marketplace-template.schema";

const TemplateSdlSchema = z.string().min(1).max(SDL_MAX_LENGTH);

const ReadmeSchema = z.string().max(MAX_TEMPLATE_README_LENGTH);

export const CreateUserTemplateRequestSchema = z
  .object({
    data: z.object({
      title: z.string().trim().min(1).max(MAX_TEMPLATE_TITLE_LENGTH),
      summary: z.string().trim().max(MAX_TEMPLATE_SUMMARY_LENGTH).optional(),
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
      baseVersion: z
        .number()
        .int()
        .positive()
        .max(MAX_VERSION_NUMBER)
        .openapi({ description: "The version this one was edited from, refused with 409 once another version has been saved after it" })
    })
  })
  .openapi("CreateUserTemplateVersionRequest");

export const CreateUserTemplateResponseSchema = z.object({ data: MarketplaceTemplateSchema }).openapi("CreateUserTemplateResponse");

export const CreateUserTemplateVersionResponseSchema = z.object({ data: TemplateVersionSchema }).openapi("CreateUserTemplateVersionResponse");

export type CreateUserTemplateRequest = z.infer<typeof CreateUserTemplateRequestSchema>;
export type CreateUserTemplateVersionRequest = z.infer<typeof CreateUserTemplateVersionRequestSchema>;
export type CreateUserTemplateResponse = z.infer<typeof CreateUserTemplateResponseSchema>;
export type CreateUserTemplateVersionResponse = z.infer<typeof CreateUserTemplateVersionResponseSchema>;
