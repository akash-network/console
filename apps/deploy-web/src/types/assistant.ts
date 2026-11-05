import type { operationDefs } from "@akashnetwork/console-api-types";

type JsonBodyOf<T extends keyof operationDefs> = operationDefs[T] extends { requestBody: { content: { "application/json": infer Body } } } ? Body : never;

export type AssistantStreamEvent = operationDefs["sendAssistantMessage"]["responses"][200]["content"]["text/event-stream"];

export type AssistantStreamEventOf<T extends AssistantStreamEvent["type"]> = Extract<AssistantStreamEvent, { type: T }>;

export type AssistantAction = AssistantStreamEventOf<"action_proposal">["action"];

export type AssistantActionType = AssistantAction["type"];

export type AssistantActionOf<T extends AssistantActionType> = Extract<AssistantAction, { type: T }>;

export type AssistantDiagnosis = NonNullable<AssistantStreamEventOf<"action_proposal">["diagnosis"]>;

export type AssistantLiveHelpReason = AssistantStreamEventOf<"live_help_suggested">["reason"];

export type AssistantClientToolRequest = AssistantStreamEventOf<"client_tool_request">;

export type AssistantStreamErrorCode = AssistantStreamEventOf<"error">["code"];

export type SendAssistantMessageBody = JsonBodyOf<"sendAssistantMessage">;

export type SubmitAssistantClientToolResultsBody = JsonBodyOf<"submitAssistantClientToolResults">;

export type AssistantClientToolResult = SubmitAssistantClientToolResultsBody["data"]["results"][number];

export type AssistantHistoryMessage = NonNullable<SendAssistantMessageBody["data"]["history"]>[number];

export type AssistantContext = NonNullable<SendAssistantMessageBody["data"]["context"]>;
