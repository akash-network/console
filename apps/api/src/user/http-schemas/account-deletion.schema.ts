import { z } from "@hono/zod-openapi";

export const InitiateAccountDeletionRequestSchema = z.object({
  data: z.object({
    forfeitAcknowledged: z.boolean()
  })
});

export type InitiateAccountDeletionRequest = z.infer<typeof InitiateAccountDeletionRequestSchema>;

export const ConfirmAccountDeletionRequestSchema = z.object({
  data: z.object({
    token: z.string().min(1).max(256)
  })
});

export type ConfirmAccountDeletionRequest = z.infer<typeof ConfirmAccountDeletionRequestSchema>;

const TeamReferenceSchema = z.object({ id: z.string().uuid(), name: z.string() });

export const AccountDeletionEligibilityResponseSchema = z.object({
  data: z.object({
    activeDeploymentCount: z
      .number()
      .openapi({ description: "Running deployments of the account and of the teams going with it, which must be closed first." }),
    forfeitableBalanceUsd: z.number().openapi({ description: "The credits, in USD, deleting forfeits: the account's and those of every team going with it." }),
    isTrialing: z.boolean(),
    teamsDeletedWithAccount: z
      .array(TeamReferenceSchema.extend({ activeDeploymentCount: z.number(), forfeitableBalanceUsd: z.number() }))
      .openapi({ description: "Teams the account is the only member of, deleted along with it." }),
    teamsToTransfer: z
      .array(TeamReferenceSchema)
      .openapi({ description: "Teams the account is the last owner of while others are members, whose ownership must be transferred first." })
  })
});

export type AccountDeletionEligibilityResponse = z.infer<typeof AccountDeletionEligibilityResponseSchema>;
