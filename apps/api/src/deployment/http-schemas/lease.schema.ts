import { z } from "@hono/zod-openapi";

import { AkashAddressSchema, DseqSchema } from "@src/utils/schema";

export const CreateLeaseRequestSchema = z.object({
  manifest: z.string().optional().openapi({
    description: "The manifest to send to the provider, in YAML format (deprecated)",
    deprecated: true
  }),
  leases: z.array(
    z.object({
      dseq: DseqSchema,
      gseq: z.number(),
      oseq: z.number(),
      provider: AkashAddressSchema
    })
  )
});

export const CreateLeaseQuerySchema = z.object({
  async: z
    .enum(["true", "false"])
    .optional()
    .transform(value => value === "true")
    .openapi({
      description:
        "With `true`, the leases are created and the manifest sent in the background: the request answers 202 with an `activityId` to follow at `GET /v1/activities/{id}` once every check that could refuse it has passed. A second request for the same leases while they are still being created answers with the same activity, and one naming other bids answers 409. It answers 200 as without it when background leases are unavailable, when the leases span more than one deployment, or when the manifest can only come from the request."
    })
});

export const CreateLeaseAcceptedResponseSchema = z.object({
  data: z.object({
    activityId: z.string().uuid().openapi({ description: "The activity that reports how creating the leases ends." })
  })
});

export const LeaseServiceStatusSchema = z.object({
  name: z.string(),
  available: z.number(),
  total: z.number(),
  uris: z.array(z.string()),
  observed_generation: z.number(),
  replicas: z.number(),
  updated_replicas: z.number(),
  ready_replicas: z.number(),
  available_replicas: z.number()
});

export const ForwardedPortSchema = z.object({
  port: z.number(),
  externalPort: z.number(),
  host: z.string().optional(),
  available: z.number().optional()
});

export const IpSchema = z.object({
  IP: z.string(),
  Port: z.number(),
  ExternalPort: z.number(),
  Protocol: z.string()
});

export const LeaseStatusResponseSchema = z.object({
  forwarded_ports: z.record(z.string(), z.array(ForwardedPortSchema)),
  ips: z.record(z.string(), z.array(IpSchema)),
  services: z.record(z.string(), LeaseServiceStatusSchema)
});

export type CreateLeaseRequest = z.infer<typeof CreateLeaseRequestSchema>;
export type CreateLeaseQuery = z.infer<typeof CreateLeaseQuerySchema>;
export type CreateLeaseAcceptedResponse = z.infer<typeof CreateLeaseAcceptedResponseSchema>;
export type LeaseStatusResponse = z.infer<typeof LeaseStatusResponseSchema>;
