import type { ChatMessage, ChatToolCall } from "@src/feedback/services/akashml-client/akashml.client";

export interface TurnToolCall {
  call: ChatToolCall;
  result: string | undefined;
}

function argumentsOf(call: ChatToolCall): unknown {
  try {
    return JSON.parse(call.function.arguments || "{}");
  } catch {
    return call.function.arguments;
  }
}

function normalized(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalized);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => [key, normalized(entry)])
  );
}

export function toolCallKeyOf(call: ChatToolCall): string {
  return JSON.stringify([call.function.name, normalized(argumentsOf(call))]);
}

/** A turn starts at the user's latest message, so a turn resumed after browser tools still sees what it read before pausing. */
export function toolCallsOfCurrentTurn(messages: ChatMessage[]): TurnToolCall[] {
  const turn = messages.slice(messages.findLastIndex(message => message.role === "user") + 1);
  const results = new Map(turn.flatMap(message => (message.role === "tool" ? [[message.tool_call_id, message.content] as const] : [])));

  return turn.flatMap(message => (message.role === "assistant" ? message.tool_calls ?? [] : [])).map(call => ({ call, result: results.get(call.id) }));
}

export function earlierResultOf(call: ChatToolCall, messages: ChatMessage[]): string | undefined {
  const key = toolCallKeyOf(call);
  return toolCallsOfCurrentTurn(messages).find(earlier => earlier.result !== undefined && toolCallKeyOf(earlier.call) === key)?.result;
}
