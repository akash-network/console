import { z } from "@hono/zod-openapi";

import { PUBLISH_REQUIREMENT_KEYS } from "@src/template-marketplace/lib/publish-requirements/publish-requirements";
import { MAX_TERMS_VERSION_LENGTH } from "@src/template-marketplace/model-schemas/template-terms-acceptance/template-terms-acceptance.schema";
import { MarketplaceTemplateSchema, PublishCheckSchema } from "./marketplace-template.schema";

export const PublishReadinessSchema = z
  .object({
    termsVersion: z.string().openapi({ description: "The community template terms to accept, sent back as `acceptedTermsVersion` when publishing" }),
    requirements: z.array(
      z.object({
        key: z.enum(PUBLISH_REQUIREMENT_KEYS),
        met: z.boolean()
      })
    ),
    checks: z.array(PublishCheckSchema).openapi({ description: "The publish checks run on the current version just now" }),
    ranAt: z.string().datetime(),
    canPublish: z.boolean().openapi({ description: "Whether every requirement is met and every check passed" })
  })
  .openapi("TemplatePublishReadiness");

export const GetPublishReadinessResponseSchema = z.object({ data: PublishReadinessSchema }).openapi("GetTemplatePublishReadinessResponse");

export const PublishUserTemplateRequestSchema = z
  .object({
    data: z.object({
      acceptedTermsVersion: z.string().min(1).max(MAX_TERMS_VERSION_LENGTH).openapi({
        description: "The `termsVersion` of the community template terms the user accepted, refused with 409 once the terms have changed"
      })
    })
  })
  .openapi("PublishUserTemplateRequest");

export const PublishUserTemplateResponseSchema = z.object({ data: MarketplaceTemplateSchema }).openapi("PublishUserTemplateResponse");

export type GetPublishReadinessResponse = z.infer<typeof GetPublishReadinessResponseSchema>;
export type PublishUserTemplateRequest = z.infer<typeof PublishUserTemplateRequestSchema>;
export type PublishUserTemplateResponse = z.infer<typeof PublishUserTemplateResponseSchema>;
