import { z } from "zod";

import { openApiExampleProviderAddress } from "@src/utils/constants";

const maxLimit = 100;

export const ProviderDeploymentsParamsSchema = z.object({
  provider: z.string().openapi({
    description: "Provider Address",
    example: openApiExampleProviderAddress
  }),
  skip: z.coerce.number().min(0).openapi({
    description: "Deployments to skip",
    example: 10
  }),
  limit: z.coerce.number().min(1).max(maxLimit).openapi({
    description: "Deployments to return",
    example: 10,
    maximum: maxLimit
  })
});

export const ProviderDeploymentsQuerySchema = z.object({
  status: z
    .enum(["active", "closed"])
    .optional()
    .openapi({
      description: "Filter by status",
      enum: ["active", "closed"],
      example: "closed"
    })
});

export const ProviderDeploymentsResponseSchema = z.object({
  total: z.number(),
  deployments: z.array(
    z.object({
      owner: z.string(),
      dseq: z.string(),
      denom: z.string(),
      createdHeight: z.number(),
      createdDate: z.date().nullable(),
      status: z.string(), //TODO
      balance: z.number(),
      transferred: z.number(),
      settledAt: z.number().nullable(),
      resources: z.object({
        cpu: z.number(),
        memory: z.number(),
        gpu: z.number(),
        ephemeralStorage: z.number(),
        persistentStorage: z.number()
      }),
      leases: z.array(
        z.object({
          provider: z.string(),
          gseq: z.number(),
          oseq: z.number(),
          price: z.number(),
          createdHeight: z.number(),
          createdDate: z.date().nullable(),
          closedHeight: z.number().nullable(),
          closedDate: z.date().nullable(),
          status: z.string(), //TODO
          resources: z.object({
            cpu: z.number(),
            memory: z.number(),
            gpu: z.number(),
            ephemeralStorage: z.number(),
            persistentStorage: z.number()
          })
        })
      )
    })
  )
});

export type ProviderDeploymentsParams = z.infer<typeof ProviderDeploymentsParamsSchema>;
export type ProviderDeploymentsQuery = z.infer<typeof ProviderDeploymentsQuerySchema>;
export type ProviderDeploymentsResponse = z.infer<typeof ProviderDeploymentsResponseSchema>;
