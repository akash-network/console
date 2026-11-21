import { z } from "@hono/zod-openapi";

import { MAX_TEMPLATE_REPORT_DETAILS_LENGTH, templateReportReasonEnum } from "@src/template-marketplace/model-schemas/template-report/template-report.schema";

const CONTROL_CHARACTER_OTHER_THAN_WHITESPACE = /[^\P{Cc}\n\r\t]/u;

export const CreateTemplateReportRequestSchema = z
  .object({
    data: z.object({
      reason: z.enum(templateReportReasonEnum.enumValues),
      details: z
        .string()
        .trim()
        .max(MAX_TEMPLATE_REPORT_DETAILS_LENGTH)
        .refine(details => !CONTROL_CHARACTER_OTHER_THAN_WHITESPACE.test(details), { message: "Details must be readable text" })
        .optional()
        .openapi({ description: "What the reporter saw, as plain text; staff read it and the publisher never does" })
    })
  })
  .openapi("CreateTemplateReportRequest");

export const CreateTemplateReportResponseSchema = z
  .object({
    data: z.object({
      id: z.string().uuid(),
      reason: z.enum(templateReportReasonEnum.enumValues),
      createdAt: z.string().datetime()
    })
  })
  .openapi("CreateTemplateReportResponse");

export type CreateTemplateReportRequest = z.infer<typeof CreateTemplateReportRequestSchema>;
export type CreateTemplateReportResponse = z.infer<typeof CreateTemplateReportResponseSchema>;
