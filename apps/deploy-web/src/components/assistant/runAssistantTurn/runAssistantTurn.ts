import type {
  AssistantClientToolRequest,
  AssistantClientToolResult,
  AssistantStreamErrorCode,
  AssistantStreamEvent,
  AssistantStreamEventOf
} from "@src/types/assistant";

export type AssistantTurnEnd = { kind: "done"; reason: "stop" | "length" } | { kind: "error"; code: AssistantStreamErrorCode; message: string };

export interface RunAssistantTurnInput {
  events: AsyncIterable<AssistantStreamEvent>;
  resume: (results: AssistantClientToolResult[]) => AsyncIterable<AssistantStreamEvent>;
  runClientTool: (request: AssistantClientToolRequest) => Promise<AssistantClientToolResult>;
  onEvent: (event: AssistantStreamEvent) => void;
}

const CUT_SHORT: AssistantTurnEnd = { kind: "error", code: "assistant_error", message: "The answer stopped before it finished." };

/** Plays a turn to its end, answering every browser tool the api pauses on and following the stream it resumes with. */
export async function runAssistantTurn({ events, resume, runClientTool, onEvent }: RunAssistantTurnInput): Promise<AssistantTurnEnd> {
  let stream = events;

  while (true) {
    const requests: AssistantClientToolRequest[] = [];
    let last: AssistantStreamEventOf<"done"> | AssistantStreamEventOf<"error"> | undefined;

    for await (const event of stream) {
      onEvent(event);
      if (event.type === "client_tool_request") requests.push(event);
      if (event.type === "done" || event.type === "error") {
        last = event;
        break;
      }
    }

    if (!last) return CUT_SHORT;
    if (last.type === "error") return { kind: "error", code: last.code, message: last.message };
    if (last.reason !== "awaiting_client_tool") return { kind: "done", reason: last.reason };
    if (requests.length === 0) return CUT_SHORT;

    stream = resume(await Promise.all(requests.map(request => runClientTool(request))));
  }
}
