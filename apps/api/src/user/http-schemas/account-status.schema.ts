import { z } from "@hono/zod-openapi";

import { accountStatusActionEnum } from "@src/user/model-schemas/account-status-event/account-status-event.schema";

const MAX_USER_REASON_LENGTH = 1000;
const MAX_INTERNAL_NOTE_LENGTH = 2000;
const MAX_ACTOR_FIELD_LENGTH = 255;

export const AccountStatusUserParamsSchema = z.object({ userId: z.string().uuid() });

const AccountStatusActorSchema = z
  .object({
    staffId: z.string().trim().min(1).max(MAX_ACTOR_FIELD_LENGTH).optional(),
    email: z.string().trim().min(1).max(MAX_ACTOR_FIELD_LENGTH),
    name: z.string().trim().min(1).max(MAX_ACTOR_FIELD_LENGTH)
  })
  .describe("The staff member acting, as the admin app knows them");

const InternalNoteSchema = z.string().trim().max(MAX_INTERNAL_NOTE_LENGTH).optional().describe("Never shown to the user");

export const SuspendAccountRequestSchema = z.object({
  data: z.object({
    actor: AccountStatusActorSchema,
    userReason: z.string().trim().min(1).max(MAX_USER_REASON_LENGTH).describe("Shown to the user in the app and in the email"),
    internalNote: InternalNoteSchema,
    closeDeployments: z.boolean()
  })
});

export const TerminateAccountRequestSchema = z.object({
  data: z.object({
    actor: AccountStatusActorSchema,
    userReason: z.string().trim().min(1).max(MAX_USER_REASON_LENGTH).describe("Shown to the user in the app and in the email"),
    internalNote: InternalNoteSchema,
    forfeitCredits: z.boolean().describe("Revokes the wallet's grants and zeroes its allowances once its deployments are closed")
  })
});

export const ReinstateAccountRequestSchema = z.object({
  data: z.object({
    actor: AccountStatusActorSchema,
    note: InternalNoteSchema
  })
});

const AccountStatusEventSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  userEmail: z.string().nullable(),
  action: z.enum(accountStatusActionEnum.enumValues),
  actorStaffId: z.string().nullable(),
  actorEmail: z.string(),
  actorName: z.string(),
  userReason: z.string().nullable(),
  internalNote: z.string().nullable(),
  options: z.object({
    closeDeployments: z.boolean().optional(),
    forfeitCredits: z.boolean().optional(),
    emailVerified: z.boolean().optional().describe("Whether the address was verified when the account was terminated"),
    matchedUserId: z.string().uuid().optional().describe("The terminated account whose email a new account signed up with")
  }),
  notificationSentAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime()
});

export const AccountStatusEventResponseSchema = z.object({ data: AccountStatusEventSchema });

export const AccountStatusEventListResponseSchema = z.object({ data: z.array(AccountStatusEventSchema) });

export type SuspendAccountRequest = z.infer<typeof SuspendAccountRequestSchema>;
export type TerminateAccountRequest = z.infer<typeof TerminateAccountRequestSchema>;
export type ReinstateAccountRequest = z.infer<typeof ReinstateAccountRequestSchema>;
export type AccountStatusEventResponse = z.infer<typeof AccountStatusEventResponseSchema>;
export type AccountStatusEventListResponse = z.infer<typeof AccountStatusEventListResponseSchema>;
