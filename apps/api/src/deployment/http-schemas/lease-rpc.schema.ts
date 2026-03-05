import { z } from "zod";

import { DseqSchema } from "@src/utils/schema";

const LeaseIdSchema = z.object({
  owner: z.string(),
  dseq: DseqSchema,
  gseq: z.number(),
  oseq: z.number(),
  provider: z.string(),
  bseq: z.number()
});

const PriceSchema = z.object({
  denom: z.string(),
  amount: z.string()
});

const LeaseSchema = z.object({
  id: LeaseIdSchema,
  state: z.string(),
  price: PriceSchema,
  created_at: z.string(),
  closed_on: z.string(),
  reason: z.string().optional()
});

const EscrowAccountIdSchema = z.object({
  scope: z.string(),
  xid: z.string()
});

const EscrowPaymentIdSchema = z.object({
  aid: EscrowAccountIdSchema,
  xid: z.string()
});

const EscrowPaymentStateSchema = z.object({
  owner: z.string(),
  state: z.string(),
  rate: PriceSchema,
  balance: PriceSchema,
  unsettled: PriceSchema,
  withdrawn: PriceSchema
});

const EscrowPaymentSchema = z.object({
  id: EscrowPaymentIdSchema,
  state: EscrowPaymentStateSchema
});

const LeaseWithEscrowSchema = z.object({
  lease: LeaseSchema,
  escrow_payment: EscrowPaymentSchema
});

const PaginationSchema = z.object({
  next_key: z.string().nullable(),
  total: z.string()
});

export const FallbackLeaseListQuerySchema = z.object({
  "filters.owner": z.string().optional(),
  "filters.dseq": z.string().optional(),
  "filters.gseq": z.coerce.number().optional(),
  "filters.oseq": z.coerce.number().optional(),
  "filters.provider": z.string().optional(),
  "filters.state": z.string().optional(),
  "pagination.offset": z.coerce.number().optional(),
  "pagination.limit": z.coerce.number().optional(),
  "pagination.key": z.string().optional(),
  "pagination.count_total": z
    .string()
    .optional()
    .transform(val => val === "true"),
  "pagination.reverse": z.coerce.boolean().optional()
});

export const FallbackLeaseListResponseSchema = z.object({
  leases: z.array(LeaseWithEscrowSchema),
  pagination: PaginationSchema
});

export type FallbackLeaseListQuery = z.infer<typeof FallbackLeaseListQuerySchema>;
export type FallbackLeaseListResponse = z.infer<typeof FallbackLeaseListResponseSchema>;
