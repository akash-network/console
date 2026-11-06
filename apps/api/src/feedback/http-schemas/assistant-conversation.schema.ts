import { z } from "@hono/zod-openapi";

import { MAX_CONSENT_COPY_VERSION_LENGTH } from "@src/feedback/model-schemas/assistant-consent/assistant-consent.schema";
import { ASSISTANT_ACTION_TYPES, AssistantActionSchema, AssistantDiagnosisSchema, AssistantDseqSchema } from "./assistant-action.schema";

export const MAX_ASSISTANT_MESSAGE_LENGTH = 4_000;
export const MAX_ASSISTANT_HISTORY_MESSAGES = 20;
export const MAX_ASSISTANT_HISTORY_MESSAGE_LENGTH = 8_000;
export const MAX_CLIENT_TOOL_RESULT_LENGTH = 16_000;
export const MAX_CLIENT_TOOL_RESULTS = 5;

const MAX_PAGE_LENGTH = 300;
const MAX_ACTION_ERROR_LENGTH = 500;

const ConversationContextSchema = z.object({
  page: z.string().max(MAX_PAGE_LENGTH).optional().openapi({ description: "The Console path the assistant was opened on" }),
  dseq: AssistantDseqSchema.optional().openapi({ description: "The deployment the user was looking at" })
});

export const ConversationIdParamsSchema = z.object({ id: z.string().uuid() });

export const StartAssistantConversationRequestSchema = z.object({
  data: z.object({
    copyVersion: z.string().trim().min(1).max(MAX_CONSENT_COPY_VERSION_LENGTH).openapi({ description: "The consent copy version the client showed" }),
    context: ConversationContextSchema.optional()
  })
});

export const StartAssistantConversationResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    stored: z.boolean().openapi({
      description:
        "True when the user allowed review, so the API keeps the history. When false the API keeps nothing, and the client sends `history` with each message."
    })
  })
});

export const SendAssistantMessageRequestSchema = z.object({
  data: z.object({
    content: z.string().trim().min(1).max(MAX_ASSISTANT_MESSAGE_LENGTH),
    history: z
      .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(MAX_ASSISTANT_HISTORY_MESSAGE_LENGTH) }))
      .max(MAX_ASSISTANT_HISTORY_MESSAGES)
      .optional()
      .openapi({ description: "The earlier messages of a conversation the API does not store, oldest first. Ignored for a stored conversation." }),
    context: ConversationContextSchema.optional()
  })
});

export const SubmitClientToolResultsRequestSchema = z.object({
  data: z.object({
    results: z
      .array(
        z.object({
          toolCallId: z.string().min(1).max(200),
          content: z.string().max(MAX_CLIENT_TOOL_RESULT_LENGTH).openapi({ description: "The excerpt the browser read, or why it could not read it" }),
          ok: z.boolean().default(true)
        })
      )
      .min(1)
      .max(MAX_CLIENT_TOOL_RESULTS)
  })
});

export const EndAssistantConversationRequestSchema = z.object({
  data: z.object({ resolvedByUser: z.boolean().optional() })
});

export const EndAssistantConversationResponseSchema = z.object({
  data: z.object({ id: z.string().uuid(), status: z.enum(["resolved", "unresolved"]) })
});

export const RecordAssistantActionResultRequestSchema = z.object({
  data: z.object({
    proposalId: z.string().uuid(),
    actionType: z.enum(ASSISTANT_ACTION_TYPES as [string, ...string[]]),
    decision: z.enum(["confirmed", "cancelled"]),
    outcome: z.enum(["succeeded", "failed"]).optional().openapi({ description: "How the confirmed request ended" }),
    error: z.string().max(MAX_ACTION_ERROR_LENGTH).optional()
  })
});

export const RecordAssistantActionResultResponseSchema = z.object({
  data: z.object({ recorded: z.boolean().openapi({ description: "False for a conversation the API does not store" }) })
});

export const ASSISTANT_LIVE_HELP_REASONS = ["provider_side_issue", "not_supported_here", "no_confident_answer", "user_asked_for_a_person"] as const;

export const ASSISTANT_STREAM_ERROR_CODES = ["assistant_unavailable", "assistant_timeout", "assistant_error"] as const;

export const AssistantStreamEventSchema = z
  .discriminatedUnion("type", [
    z.object({ type: z.literal("text_delta"), text: z.string() }),
    z.object({ type: z.literal("tool_started"), toolCallId: z.string(), name: z.string() }),
    z.object({
      type: z.literal("tool_result_summary"),
      toolCallId: z.string(),
      name: z.string(),
      ok: z.boolean(),
      summary: z.string().openapi({ description: "What the assistant read, shown under the answer" })
    }),
    z.object({
      type: z.literal("client_tool_request"),
      toolCallId: z.string(),
      name: z.enum(["read_logs", "read_events"]),
      arguments: z.object({ dseq: z.string(), service: z.string().optional(), tailLines: z.number().int().optional() }),
      maxLength: z.number().int().openapi({ description: "The longest `content` the API accepts for this result" })
    }),
    z.object({
      type: z.literal("action_proposal"),
      proposalId: z.string().uuid(),
      action: AssistantActionSchema,
      diagnosis: AssistantDiagnosisSchema.optional()
    }),
    z.object({
      type: z.literal("live_help_suggested"),
      reason: z.enum(ASSISTANT_LIVE_HELP_REASONS).openapi({ description: "Why the assistant cannot solve this itself; the client offers live help on Discord" })
    }),
    z.object({
      type: z.literal("secret_redacted"),
      count: z
        .number()
        .int()
        .positive()
        .openapi({ description: "How many secrets were removed from the user's message before it reached the model. Never says which or what kind." })
    }),
    z.object({
      type: z.literal("done"),
      reason: z.enum(["stop", "length", "awaiting_client_tool"]).openapi({
        description: "`awaiting_client_tool`: the turn is paused until the browser posts the requested results to `client-tool-results`"
      })
    }),
    z.object({ type: z.literal("error"), code: z.enum(ASSISTANT_STREAM_ERROR_CODES), message: z.string() })
  ])
  .openapi({
    description: "One server-sent event. The SSE `event` field repeats `type`, and `data` holds this object as JSON."
  });

export type StartAssistantConversationRequest = z.infer<typeof StartAssistantConversationRequestSchema>;
export type StartAssistantConversationResponse = z.infer<typeof StartAssistantConversationResponseSchema>;
export type SendAssistantMessageRequest = z.infer<typeof SendAssistantMessageRequestSchema>;
export type SubmitClientToolResultsRequest = z.infer<typeof SubmitClientToolResultsRequestSchema>;
export type EndAssistantConversationRequest = z.infer<typeof EndAssistantConversationRequestSchema>;
export type EndAssistantConversationResponse = z.infer<typeof EndAssistantConversationResponseSchema>;
export type RecordAssistantActionResultRequest = z.infer<typeof RecordAssistantActionResultRequestSchema>;
export type RecordAssistantActionResultResponse = z.infer<typeof RecordAssistantActionResultResponseSchema>;
export type AssistantStreamEvent = z.infer<typeof AssistantStreamEventSchema>;
export type AssistantLiveHelpReason = (typeof ASSISTANT_LIVE_HELP_REASONS)[number];
