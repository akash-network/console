import { ApiError, extractApiErrorCode } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";

import type { AssistantStreamEvent } from "@src/types/assistant";
import { AssistantConversationClient } from "./assistant-conversation-client";

describe(AssistantConversationClient.name, () => {
  describe("sendMessage", () => {
    it("posts the message to the conversation and yields the streamed events", async () => {
      const { client, fetchImpl } = setup({
        response: streamOf([
          { type: "text_delta", text: "Hello" },
          { type: "done", reason: "stop" }
        ])
      });
      const signal = new AbortController().signal;

      const events = await collect(client.sendMessage("c/1", { data: { content: "Why no bids?" } }, signal));

      expect(events).toEqual([
        { type: "text_delta", text: "Hello" },
        { type: "done", reason: "stop" }
      ]);
      expect(fetchImpl).toHaveBeenCalledWith("/api/proxy/v1/assistant/conversations/c%2F1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "text/event-stream" },
        body: JSON.stringify({ data: { content: "Why no bids?" } }),
        signal
      });
    });

    it("throws an api error carrying the refusal code", async () => {
      const { client } = setup({ response: new Response(JSON.stringify({ code: "assistant_rate_limited", message: "Slow down" }), { status: 429 }) });

      const error = await collect(client.sendMessage("c-1", { data: { content: "Hi" } })).catch(cause => cause);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(429);
      expect(error.message).toBe("POST /v1/assistant/conversations/c-1/messages → 429");
      expect(extractApiErrorCode(error)).toBe("assistant_rate_limited");
    });

    it("keeps a refusal body that is not JSON as text", async () => {
      const { client } = setup({ response: new Response("Bad gateway", { status: 502 }) });

      const error = await collect(client.sendMessage("c-1", { data: { content: "Hi" } })).catch(cause => cause);

      expect(error.body).toBe("Bad gateway");
    });

    it("throws when a successful answer has no stream", async () => {
      const { client } = setup({ response: new Response(null, { status: 200 }) });

      const error = await collect(client.sendMessage("c-1", { data: { content: "Hi" } })).catch(cause => cause);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(200);
    });
  });

  describe("submitClientToolResults", () => {
    it("posts the results and yields the resumed turn", async () => {
      const { client, fetchImpl } = setup({ response: streamOf([{ type: "done", reason: "stop" }]) });
      const body = { data: { results: [{ toolCallId: "t-1", content: "logs", ok: true }] } };

      const events = await collect(client.submitClientToolResults("c-1", body));

      expect(events).toEqual([{ type: "done", reason: "stop" }]);
      expect(fetchImpl).toHaveBeenCalledWith(
        "/api/proxy/v1/assistant/conversations/c-1/client-tool-results",
        expect.objectContaining({ method: "POST", body: JSON.stringify(body) })
      );
    });
  });

  function streamOf(events: AssistantStreamEvent[]) {
    return new Response(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(""), { status: 200 });
  }

  async function collect(events: AsyncIterable<AssistantStreamEvent>) {
    const collected: AssistantStreamEvent[] = [];
    for await (const event of events) collected.push(event);
    return collected;
  }

  function setup(input: { response: Response }) {
    const fetchImpl = vi.fn<typeof fetch>(async () => input.response);
    const client = new AssistantConversationClient(fetchImpl, "/api/proxy");
    return { client, fetchImpl };
  }
});
