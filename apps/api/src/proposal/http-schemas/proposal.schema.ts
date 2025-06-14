import { z } from "@hono/zod-openapi";

export const GetProposalListResponseSchema = z.array(
  z.object({
    id: z.number(),
    title: z.string(),
    status: z.string(),
    submitTime: z.string(),
    votingStartTime: z.string(),
    votingEndTime: z.string(),
    totalDeposit: z.number()
  })
);

export const GetProposalByIdParamsSchema = z.object({
  id: z.coerce.number().openapi({
    description: "Proposal ID",
    example: 1
  })
});

export const GetProposalByIdResponseSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  status: z.string(),
  submitTime: z.string(),
  votingStartTime: z.string(),
  votingEndTime: z.string(),
  totalDeposit: z.number(),
  tally: z.object({
    yes: z.number(),
    abstain: z.number(),
    no: z.number(),
    noWithVeto: z.number(),
    total: z.number()
  }),
  paramChanges: z.array(
    z.object({
      subspace: z.string(),
      key: z.string(),
      value: z.any()
    })
  )
});

export type GetProposalListResponse = z.infer<typeof GetProposalListResponseSchema>;
export type GetProposalByIdParams = z.infer<typeof GetProposalByIdParamsSchema>;
export type GetProposalByIdResponse = z.infer<typeof GetProposalByIdResponseSchema>;
