import { z } from "zod";

const AttributeSchema = z.object({
  key: z.string(),
  value: z.string()
});

const QuantitySchema = z.object({
  val: z.string()
});

const DeploymentIdSchema = z.object({
  owner: z.string(),
  dseq: z.string()
});

const GroupIdSchema = z.object({
  owner: z.string(),
  dseq: z.string(),
  gseq: z.number()
});

const SignedBySchema = z.object({
  all_of: z.array(z.string()),
  any_of: z.array(z.string())
});

const RequirementsSchema = z.object({
  signed_by: SignedBySchema,
  attributes: z.array(AttributeSchema)
});

const UnitsSchema = z.object({
  val: z.string()
});

const CpuSchema = z.object({
  units: UnitsSchema,
  attributes: z.array(AttributeSchema)
});

const MemorySchema = z.object({
  quantity: QuantitySchema,
  attributes: z.array(AttributeSchema)
});

const StorageItemSchema = z.object({
  name: z.string(),
  quantity: QuantitySchema,
  attributes: z.array(AttributeSchema)
});

const GpuSchema = z.object({
  units: UnitsSchema,
  attributes: z.array(AttributeSchema)
});

const EndpointSchema = z.object({
  kind: z.string(),
  sequence_number: z.number()
});

const ResourceSchema = z.object({
  id: z.number(),
  cpu: CpuSchema,
  memory: MemorySchema,
  storage: z.array(StorageItemSchema),
  gpu: GpuSchema,
  endpoints: z.array(EndpointSchema)
});

const PriceSchema = z.object({
  denom: z.string(),
  amount: z.string()
});

const ResourceWithCountSchema = z.object({
  resource: ResourceSchema,
  count: z.number(),
  price: PriceSchema
});

const GroupSpecSchema = z.object({
  name: z.string(),
  requirements: RequirementsSchema,
  resources: z.array(ResourceWithCountSchema)
});

const GroupSchema = z.object({
  group_id: GroupIdSchema,
  state: z.string(),
  group_spec: GroupSpecSchema,
  created_at: z.string()
});

const DeploymentSchema = z.object({
  deployment_id: DeploymentIdSchema,
  state: z.string(),
  version: z.string(),
  created_at: z.string()
});

const EscrowIdSchema = z.object({
  scope: z.string(),
  xid: z.string()
});

const BalanceSchema = z.object({
  denom: z.string(),
  amount: z.string()
});

const EscrowAccountSchema = z.object({
  id: EscrowIdSchema,
  owner: z.string(),
  state: z.string(),
  balance: BalanceSchema,
  transferred: BalanceSchema,
  settled_at: z.string(),
  depositor: z.string(),
  funds: BalanceSchema
});

const DeploymentWithGroupsSchema = z.object({
  deployment: DeploymentSchema,
  groups: z.array(GroupSchema),
  escrow_account: EscrowAccountSchema
});

const PaginationSchema = z.object({
  next_key: z.string().nullable(),
  total: z.string()
});

export const FallbackDeploymentListQuerySchema = z.object({
  "filters.owner": z.string().optional(),
  "filters.state": z.enum(["active", "closed"]).optional(),
  "pagination.offset": z.coerce.number().optional(),
  "pagination.limit": z.coerce.number().optional(),
  "pagination.key": z.string().optional(),
  "pagination.count_total": z
    .string()
    .optional()
    .transform(val => val === "true"),
  "pagination.reverse": z.coerce.boolean().optional()
});

export const FallbackDeploymentListResponseSchema = z.object({
  deployments: z.array(DeploymentWithGroupsSchema),
  pagination: PaginationSchema
});

export const FallbackDeploymentInfoQuerySchema = z.object({
  "id.owner": z.string(),
  "id.dseq": z.string()
});

export const FallbackDeploymentInfoResponseSchema = z.union([
  z.object({
    code: z.number(),
    message: z.string(),
    details: z.array(z.string())
  }),
  DeploymentWithGroupsSchema
]);

export type FallbackDeploymentListQuery = z.infer<typeof FallbackDeploymentListQuerySchema>;
export type FallbackDeploymentListResponse = z.infer<typeof FallbackDeploymentListResponseSchema>;
export type FallbackDeploymentInfoQuery = z.infer<typeof FallbackDeploymentInfoQuerySchema>;
export type FallbackDeploymentInfoResponse = z.infer<typeof FallbackDeploymentInfoResponseSchema>;
