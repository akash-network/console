import { z } from "@hono/zod-openapi";

import { readableName, readableText } from "@src/core/lib/readable-text/readable-text";
import { organizationTypeEnum } from "@src/organization/model-schemas/organization/organization.schema";
import { TemplateHardwareSchema } from "@src/template/http-schemas/template.schema";
import { MAX_PUBLIC_LINK_LENGTH, parsePublicLink } from "@src/template-marketplace/lib/public-link/public-link";
import { MAX_PUBLISHER_BIO_LENGTH, MAX_PUBLISHER_HANDLE_LENGTH } from "@src/template-marketplace/model-schemas/template-publisher/template-publisher.schema";
import { DeploysSchema, ForksSchema, PublisherCountsSchema, StillUpAfter24hSchema } from "./marketplace-template.schema";

export const MAX_PUBLISHER_LINKS = 3;
export const MAX_PUBLISHER_LINK_LABEL_LENGTH = 40;

export const TemplateScoresSchema = z
  .object({
    popular: z.number().nullable().openapi({
      description: "People whose deployment was still running after a day, weighted toward recent ones; null while nobody counted, which sorts as zero"
    }),
    trending: z.number().nullable().openapi({
      description: "Growth of that count over the last window against the one before, negative when it fell; null while nobody counted"
    }),
    isTrending: z.boolean().openapi({ description: "Whether it grew and reached the minimum volume, which is what the trending row lists" })
  })
  .openapi("TemplateScores");

export const CommunityTemplateUsageSchema = z
  .object({ deploys: DeploysSchema, stillUpAfter24h: StillUpAfter24hSchema, forks: ForksSchema })
  .openapi("CommunityTemplateUsage");

export const CommunityTemplateCardSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string(),
    summary: z.string().nullable(),
    icon: z.string().nullable(),
    categories: z.array(z.string()),
    isOfficial: z.boolean().openapi({ description: "Whether Akash staff promoted the template; every other one is not reviewed by Akash" }),
    isFeatured: z.boolean(),
    publisher: z.object({
      name: z.string(),
      handle: z.string().openapi({ description: "The name of the publisher page" }),
      verified: z.boolean().openapi({ description: "Whether Akash staff verified who the publisher is" })
    }),
    resources: TemplateHardwareSchema.nullable().openapi({ description: "What the current version asks for, null when its SDL cannot be read" }),
    versionCount: z.number().int().nonnegative().openapi({ description: "The versions that went live, the current one included" }),
    publishedAt: z.string().datetime().openapi({ description: "When the template first went public" }),
    updatedAt: z.string().datetime(),
    usage: CommunityTemplateUsageSchema,
    scores: TemplateScoresSchema
  })
  .openapi("CommunityTemplateCard");

export const ListCommunityTemplatesResponseSchema = z
  .object({
    data: z.object({
      templates: z.array(CommunityTemplateCardSchema),
      officialUsage: z
        .record(CommunityTemplateUsageSchema.extend({ scores: TemplateScoresSchema }).openapi("OfficialTemplateUsage"))
        .openapi({ description: "The same numbers for the awesome-akash templates, by template id; a template nobody deployed is missing" }),
      trendingRowMinTemplates: z.number().int().positive().openapi({ description: "The fewest trending templates worth a row of their own" })
    })
  })
  .openapi("ListCommunityTemplatesResponse");

const PublisherHandleSchema = z
  .string()
  .max(MAX_PUBLISHER_HANDLE_LENGTH)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Invalid publisher handle");

export const TemplatePublisherParamsSchema = z.object({
  handle: PublisherHandleSchema.openapi({ description: "The publisher's handle, as templates name it" })
});

const PublisherLinkSchema = z.object({
  url: z.string().openapi({ description: "An https link to a public website" }),
  label: z.string().nullable().openapi({ description: "What the publisher calls the link, null to show its host" })
});

const PublisherProfileFields = {
  name: z.string(),
  handle: z.string(),
  type: z.enum(organizationTypeEnum.enumValues),
  bio: z.string().nullable().openapi({ description: "Plain text written by the publisher, shown as stored" }),
  links: z.array(PublisherLinkSchema),
  verified: z.boolean().openapi({ description: "Whether Akash staff verified who the publisher is" }),
  memberSince: z.string().datetime().openapi({ description: "When the person or the team joined Console" })
};

export const TemplatePublisherPageSchema = z
  .object({ ...PublisherProfileFields, counts: PublisherCountsSchema, templates: z.array(CommunityTemplateCardSchema) })
  .openapi("TemplatePublisherPage");

export const GetTemplatePublisherResponseSchema = z.object({ data: TemplatePublisherPageSchema }).openapi("GetTemplatePublisherResponse");

export const CurrentTemplatePublisherSchema = z
  .object({ ...PublisherProfileFields, canEdit: z.boolean().openapi({ description: "Whether the caller may change the bio and the links" }) })
  .openapi("CurrentTemplatePublisher");

export const GetCurrentTemplatePublisherResponseSchema = z.object({ data: CurrentTemplatePublisherSchema }).openapi("GetCurrentTemplatePublisherResponse");

const PublicLinkUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_PUBLIC_LINK_LENGTH)
  .transform((value, context) => {
    const link = parsePublicLink(value);

    if ("issue" in link) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: link.issue });

      return z.NEVER;
    }

    return link.href;
  });

export const UpdateCurrentTemplatePublisherRequestSchema = z
  .object({
    data: z
      .object({
        bio: readableText(z.string().trim().max(MAX_PUBLISHER_BIO_LENGTH)).nullable().optional().openapi({ description: "Null or blank clears it" }),
        links: z
          .array(
            z.object({
              url: PublicLinkUrlSchema.openapi({ description: "An https link to a public website, without a port, a username or an address for a host" }),
              label: readableName(z.string().trim().min(1).max(MAX_PUBLISHER_LINK_LABEL_LENGTH)).nullable().optional()
            })
          )
          .max(MAX_PUBLISHER_LINKS)
          .optional()
          .openapi({ description: "Replaces every link" })
      })
      .refine(profile => profile.bio !== undefined || profile.links !== undefined, { message: "Change the bio or the links" })
  })
  .openapi("UpdateCurrentTemplatePublisherRequest");

export type CommunityTemplateCardResponse = z.infer<typeof CommunityTemplateCardSchema>;
export type ListCommunityTemplatesResponse = z.infer<typeof ListCommunityTemplatesResponseSchema>;
export type GetTemplatePublisherResponse = z.infer<typeof GetTemplatePublisherResponseSchema>;
export type GetCurrentTemplatePublisherResponse = z.infer<typeof GetCurrentTemplatePublisherResponseSchema>;
export type UpdateCurrentTemplatePublisherRequest = z.infer<typeof UpdateCurrentTemplatePublisherRequestSchema>;
