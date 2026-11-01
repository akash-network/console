import { z } from "@hono/zod-openapi";

import { AkashAddressSchema, DseqSchema } from "@src/utils/schema";

/** A console-side bound on the work one request starts, since the chain does not limit placement groups per deployment. */
export const MAX_LEASES_PER_REQUEST = 100;

export const CreateLeaseRequestSchema = z.object({
  manifest: z.string().optional().openapi({
    description: "The manifest to send to the provider, in YAML format (deprecated)",
    deprecated: true
  }),
  leases: z
    .array(
      z.object({
        dseq: DseqSchema,
        gseq: z.number(),
        oseq: z.number(),
        provider: AkashAddressSchema
      })
    )
    .min(1)
    .max(MAX_LEASES_PER_REQUEST, `A request can create at most ${MAX_LEASES_PER_REQUEST} leases`)
});

export const CreateLeaseQuerySchema = z.object({
  async: z
    .enum(["true", "false"])
    .optional()
    .transform(value => value === "true")
    .openapi({
      description:
        "With `true`, the leases are created and the manifest sent in the background: the request answers 202 with an `activityId` to follow at `GET /v1/activities/{id}` once every check that could refuse it has passed. A second request by the same user for the same leases while they are still being created answers with the same activity, and any other request for that deployment meanwhile answers 409. It answers 200 as without it when the leases span more than one deployment or the manifest can only come from the request."
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

export const MAX_LEASE_LIST_LIMIT = 1000;

const LeaseStateSchema = z.enum(["active", "insufficient_funds", "closed", "reclaiming"]);

export const ListLeasesQuerySchema = z.object({
  dseq: DseqSchema.optional().openapi({ description: "Only the leases of this deployment." }),
  provider: AkashAddressSchema.optional().openapi({ description: "Only the leases with this provider." }),
  state: z
    .preprocess(value => (value === undefined || Array.isArray(value) ? value : [value]), z.array(LeaseStateSchema).min(1).optional())
    .openapi({ description: "Only the leases in these states, repeated once per state. Every state when omitted." }),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_LEASE_LIST_LIMIT)
    .default(MAX_LEASE_LIST_LIMIT)
    .openapi({ description: `At most this many leases per requested state, up to ${MAX_LEASE_LIST_LIMIT}.` })
});

const ListedLeaseSchema = z.object({
  id: z.object({
    owner: z.string(),
    dseq: z.string(),
    gseq: z.number(),
    oseq: z.number(),
    provider: z.string(),
    bseq: z.number()
  }),
  state: z.string(),
  price: z.object({
    denom: z.string(),
    amount: z.string()
  }),
  created_at: z.string(),
  closed_on: z.string(),
  reason: z.string().optional(),
  reclamation: z
    .object({
      window: z.string().optional(),
      started_at: z.string().optional(),
      deadline: z.string().optional(),
      reason: z.string().optional()
    })
    .optional()
});

export const ListLeasesResponseSchema = z.object({
  data: z.array(ListedLeaseSchema).openapi({ description: "The current wallet's leases as the Akash Network holds them." })
});

export type CreateLeaseRequest = z.infer<typeof CreateLeaseRequestSchema>;
export type CreateLeaseQuery = z.infer<typeof CreateLeaseQuerySchema>;
export type CreateLeaseAcceptedResponse = z.infer<typeof CreateLeaseAcceptedResponseSchema>;
export type LeaseStatusResponse = z.infer<typeof LeaseStatusResponseSchema>;
export type ListLeasesQuery = z.infer<typeof ListLeasesQuerySchema>;
export type ListLeasesResponse = z.infer<typeof ListLeasesResponseSchema>;
