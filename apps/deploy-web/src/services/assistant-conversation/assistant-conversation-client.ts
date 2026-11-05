import { ApiError } from "@akashnetwork/openapi-sdk";

import type { AssistantStreamEvent, SendAssistantMessageBody, SubmitAssistantClientToolResultsBody } from "@src/types/assistant";
import { readServerSentEvents } from "./readServerSentEvents";

/** Streams assistant turns through the session-authenticated proxy, which the typed SDK cannot do because it reads every answer as one JSON body. */
export class AssistantConversationClient {
  readonly #fetch: typeof fetch;
  readonly #baseUrl: string;

  constructor(fetchImpl: typeof fetch, baseUrl: string) {
    this.#fetch = fetchImpl;
    this.#baseUrl = baseUrl;
  }

  sendMessage(conversationId: string, body: SendAssistantMessageBody, signal?: AbortSignal): AsyncGenerator<AssistantStreamEvent> {
    return this.#stream(`/v1/assistant/conversations/${encodeURIComponent(conversationId)}/messages`, body, signal);
  }

  submitClientToolResults(conversationId: string, body: SubmitAssistantClientToolResultsBody, signal?: AbortSignal): AsyncGenerator<AssistantStreamEvent> {
    return this.#stream(`/v1/assistant/conversations/${encodeURIComponent(conversationId)}/client-tool-results`, body, signal);
  }

  async *#stream(path: string, body: unknown, signal: AbortSignal | undefined): AsyncGenerator<AssistantStreamEvent> {
    const fetchImpl = this.#fetch;
    const response = await fetchImpl(`${this.#baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      body: JSON.stringify(body),
      signal
    });

    if (!response.ok || !response.body) {
      throw new ApiError(response.status, await readErrorBody(response), `POST ${path} → ${response.status}`);
    }

    for await (const event of readServerSentEvents(response.body)) {
      yield JSON.parse(event.data) as AssistantStreamEvent;
    }
  }
}

async function readErrorBody(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
