import type { HttpClient } from "@akashnetwork/http-sdk";
import { AxiosError, AxiosHeaders, type AxiosResponse } from "axios";
import { PassThrough, Readable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";
import { z } from "zod";

import type { CreateLogger } from "@src/core";
import { envSchema } from "@src/feedback/config/env.config";
import {
  AKASHML_RETRY_DELAYS_MS,
  AkashMlClient,
  AkashMlOutputError,
  AkashMlRequestError,
  AkashMlUnavailableError,
  type ChatCompletionRequest,
  type JsonOutputSchema,
  MAX_STREAM_LINE_LENGTH,
  parseJsonOutput
} from "./akashml.client";

const REQUEST: ChatCompletionRequest = { model: "test-model", messages: [{ role: "user", content: "hi" }] };
const MINTED_TOOL_CALL_ID = /^call_[0-9a-f-]{36}$/;

const ANSWER_SCHEMA: JsonOutputSchema<{ answer: number }> = {
  name: "answer",
  jsonSchema: { type: "object", properties: { answer: { type: "number" } } },
  parser: z.object({ answer: z.number() })
};

function completion(message: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return { choices: [{ message, finish_reason: "stop" }], usage: { prompt_tokens: 12, completion_tokens: 3 }, ...extra };
}

function response(data: unknown, status = 200): AxiosResponse {
  return { data, status, statusText: "", headers: {}, config: { headers: new AxiosHeaders({ Authorization: "Bearer secret-key" }) } };
}

function httpError(status: number | undefined, data?: unknown, code = "ERR_BAD_RESPONSE") {
  const errorResponse = status === undefined ? undefined : response(data, status);

  return new AxiosError("Request failed", code, errorResponse?.config, undefined, errorResponse);
}

function sse(payload: unknown): string {
  return `data: ${typeof payload === "string" ? payload : JSON.stringify(payload)}\n\n`;
}

function delta(delta: Record<string, unknown>, finishReason: string | null = null) {
  return sse({ choices: [{ index: 0, delta, finish_reason: finishReason }] });
}

function usageChunk(promptTokens: number, completionTokens: number) {
  return sse({ choices: [], usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens } });
}

function streamOf(...parts: (string | Buffer)[]): Readable {
  return Readable.from(parts.map(part => Buffer.from(part)));
}

describe(AkashMlClient.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("isAvailable", () => {
    it("answers whether an API key is configured", () => {
      expect(setup().client.isAvailable()).toBe(true);
      expect(setup({ apiKey: undefined }).client.isAvailable()).toBe(false);
    });
  });

  describe("createChatCompletion", () => {
    it("posts the request and answers the first choice with its usage", async () => {
      const { client, httpClient, logger } = setup();
      const toolCall = { id: "call-1", type: "function", function: { name: "lookup", arguments: '{"dseq":"1"}' } };
      httpClient.post.mockResolvedValue(response(completion({ content: "hello", tool_calls: [toolCall] })));

      const result = await client.createChatCompletion(REQUEST);

      expect(httpClient.post).toHaveBeenCalledWith("/chat/completions", REQUEST, { timeout: undefined, signal: undefined });
      expect(result).toEqual({ content: "hello", toolCalls: [toolCall], finishReason: "stop", usage: { promptTokens: 12, completionTokens: 3 } });
      expect(logger.info).toHaveBeenCalledWith({
        event: "AKASHML_COMPLETION",
        model: "test-model",
        finishReason: "stop",
        usage: { promptTokens: 12, completionTokens: 3 }
      });
    });

    it("passes a per-call timeout and abort signal", async () => {
      const { client, httpClient } = setup();
      const signal = new AbortController().signal;
      httpClient.post.mockResolvedValue(response(completion({ content: "ok" })));

      await client.createChatCompletion(REQUEST, { timeoutMs: 5000, signal });

      expect(httpClient.post).toHaveBeenCalledWith("/chat/completions", REQUEST, { timeout: 5000, signal });
    });

    it("answers empty content, no tool calls, no finish reason and no usage when the provider leaves them out", async () => {
      const { client, httpClient } = setup();
      httpClient.post.mockResolvedValue(response({ choices: [{ message: { content: null, tool_calls: null } }] }));

      expect(await client.createChatCompletion(REQUEST)).toEqual({ content: null, toolCalls: [], finishReason: null, usage: null });
    });

    it("gives each tool call answered without an id an id of its own", async () => {
      const { client, httpClient } = setup();
      httpClient.post.mockResolvedValue(
        response(
          completion({
            tool_calls: [
              { type: "function", function: { name: "get_deployment", arguments: "{}" } },
              { id: null, type: "function", function: { name: "get_bids", arguments: "{}" } },
              { id: "", type: "function", function: { name: "get_lease", arguments: "{}" } }
            ]
          })
        )
      );

      const { toolCalls } = await client.createChatCompletion(REQUEST);
      const ids = toolCalls.map(({ id }) => id);

      expect(toolCalls.map(({ function: { name } }) => name)).toEqual(["get_deployment", "get_bids", "get_lease"]);
      expect(ids).toEqual([expect.stringMatching(MINTED_TOOL_CALL_ID), expect.stringMatching(MINTED_TOOL_CALL_ID), expect.stringMatching(MINTED_TOOL_CALL_ID)]);
      expect(new Set(ids).size).toBe(3);
    });

    it("refuses without calling out when no API key is configured", async () => {
      const { client, httpClient } = setup({ apiKey: undefined });

      await expect(client.createChatCompletion(REQUEST)).rejects.toBeInstanceOf(AkashMlUnavailableError);
      await expect(client.createChatCompletion(REQUEST)).rejects.toMatchObject({ name: "AkashMlUnavailableError", message: "AkashML is not configured" });
      expect(httpClient.post).not.toHaveBeenCalled();
    });

    it("rejects an answer without choices", async () => {
      const { client, httpClient } = setup();
      httpClient.post.mockResolvedValue(response({ choices: [] }));

      await expect(client.createChatCompletion(REQUEST)).rejects.toThrow(new AkashMlOutputError("AkashML answered with an unexpected completion shape"));
    });

    it.each([429, 500, 502, 503, 504, 529, undefined])("retries a %s answer and succeeds", async status => {
      vi.useFakeTimers();
      const { client, httpClient } = setup();
      httpClient.post.mockRejectedValueOnce(httpError(status)).mockResolvedValueOnce(response(completion({ content: "ok" })));

      const result = client.createChatCompletion(REQUEST);
      await vi.advanceTimersByTimeAsync(AKASHML_RETRY_DELAYS_MS[0]);

      expect((await result).content).toBe("ok");
      expect(httpClient.post).toHaveBeenCalledTimes(2);
    });

    it("gives up after its bounded retries with the provider's answer only", async () => {
      vi.useFakeTimers();
      const { client, httpClient } = setup();
      httpClient.post.mockRejectedValue(httpError(503, { error: { message: "no healthy backend" } }));

      const result = client.createChatCompletion(REQUEST).catch(error => error);
      await vi.runAllTimersAsync();
      const error = await result;

      expect(httpClient.post).toHaveBeenCalledTimes(AKASHML_RETRY_DELAYS_MS.length + 1);
      expect(error).toBeInstanceOf(AkashMlRequestError);
      expect(error).toMatchObject({ status: 503, message: "AkashML answered 503: no healthy backend" });
      expect(JSON.stringify(error)).not.toContain("secret-key");
      expect(error.message).not.toContain("secret-key");
    });

    it.each([400, 401, 402, 403, 404, 422])("does not retry a %s answer", async status => {
      const { client, httpClient } = setup();
      httpClient.post.mockRejectedValue(httpError(status));

      await expect(client.createChatCompletion(REQUEST)).rejects.toMatchObject({ status, message: `AkashML answered ${status}` });
      expect(httpClient.post).toHaveBeenCalledTimes(1);
    });

    it("answers the status alone when the provider's body has no error message", async () => {
      const { client, httpClient } = setup();
      httpClient.post.mockRejectedValue(httpError(400, { detail: "bad" }));

      await expect(client.createChatCompletion(REQUEST)).rejects.toMatchObject({ name: "AkashMlRequestError", message: "AkashML answered 400" });
    });

    it("bounds the provider's error message", async () => {
      const { client, httpClient } = setup();
      httpClient.post.mockRejectedValue(httpError(400, { error: { message: "m".repeat(500) } }));

      await expect(client.createChatCompletion(REQUEST)).rejects.toMatchObject({ message: `AkashML answered 400: ${"m".repeat(200)}` });
    });

    it("names the transport error code when there is no answer", async () => {
      vi.useFakeTimers();
      const { client, httpClient } = setup();
      httpClient.post.mockRejectedValue(httpError(undefined, undefined, "ECONNABORTED"));

      const result = client.createChatCompletion(REQUEST).catch(error => error);
      await vi.runAllTimersAsync();

      expect(await result).toMatchObject({ status: undefined, message: "AkashML request failed: ECONNABORTED" });
    });

    it("wraps an error that did not come from the HTTP client", async () => {
      vi.useFakeTimers();
      const { client, httpClient } = setup();
      httpClient.post.mockRejectedValue(new Error("boom"));

      const result = client.createChatCompletion(REQUEST).catch(error => error);
      await vi.runAllTimersAsync();

      expect(await result).toMatchObject({ status: undefined, message: "AkashML request failed: Error: boom" });
    });
  });

  describe("streamChatCompletion", () => {
    it("asks for a stream with usage and hands over each content delta as it arrives", async () => {
      const { client, httpClient, logger } = setup();
      const upstream = new PassThrough();
      httpClient.post.mockResolvedValue(response(upstream));
      const onContentDelta = vi.fn(async () => {});

      const result = client.streamChatCompletion(REQUEST, { onContentDelta });
      upstream.write(delta({ role: "assistant", content: "Hel" }));
      await vi.waitFor(() => expect(onContentDelta).toHaveBeenCalledWith("Hel"));
      const deltasBeforeTheRest = onContentDelta.mock.calls.length;
      upstream.end(delta({ content: "lo" }, "stop") + usageChunk(12, 3) + sse("[DONE]"));

      expect(await result).toEqual({ content: "Hello", toolCalls: [], finishReason: "stop", usage: { promptTokens: 12, completionTokens: 3 } });
      expect(deltasBeforeTheRest).toBe(1);
      expect(onContentDelta.mock.calls).toEqual([["Hel"], ["lo"]]);
      expect(httpClient.post).toHaveBeenCalledWith(
        "/chat/completions",
        { ...REQUEST, stream: true, stream_options: { include_usage: true } },
        { timeout: undefined, signal: undefined, responseType: "stream", headers: { Accept: "text/event-stream" } }
      );
      expect(logger.info).toHaveBeenCalledWith({
        event: "AKASHML_COMPLETION",
        model: "test-model",
        finishReason: "stop",
        usage: { promptTokens: 12, completionTokens: 3 }
      });
    });

    it("passes a per-call timeout and abort signal", async () => {
      const { client, httpClient } = setup();
      const signal = new AbortController().signal;
      httpClient.post.mockResolvedValue(response(streamOf(sse("[DONE]"))));

      await client.streamChatCompletion(REQUEST, { timeoutMs: 5000, signal, onContentDelta: vi.fn() });

      expect(httpClient.post).toHaveBeenCalledWith("/chat/completions", expect.anything(), expect.objectContaining({ timeout: 5000, signal }));
    });

    it("assembles tool calls from argument fragments split across chunks, in index order", async () => {
      const { client, httpClient } = setup();
      httpClient.post.mockResolvedValue(
        response(
          streamOf(
            delta({ tool_calls: [{ index: 1, id: "call-2", type: "function", function: { name: "get_bids", arguments: "" } }] }),
            delta({ tool_calls: [{ index: 0, id: "call-1", type: "function", function: { name: "get_deployment", arguments: '{"ds' } }] }),
            delta({ tool_calls: [{ index: 1, function: { arguments: '{"dseq":"2"}' } }] }),
            delta({ tool_calls: [{ index: 0, function: { arguments: 'eq":"1"}' } }] }),
            delta({}, "tool_calls"),
            sse("[DONE]")
          )
        )
      );
      const onContentDelta = vi.fn(async () => {});

      const result = await client.streamChatCompletion(REQUEST, { onContentDelta });

      expect(result).toEqual({
        content: null,
        toolCalls: [
          { id: "call-1", type: "function", function: { name: "get_deployment", arguments: '{"dseq":"1"}' } },
          { id: "call-2", type: "function", function: { name: "get_bids", arguments: '{"dseq":"2"}' } }
        ],
        finishReason: "tool_calls",
        usage: null
      });
      expect(onContentDelta).not.toHaveBeenCalled();
    });

    it("keeps a tool call's id and name when later fragments leave them out", async () => {
      const { client, httpClient } = setup();
      httpClient.post.mockResolvedValue(
        response(
          streamOf(
            delta({ tool_calls: [{ index: 0, id: "call-1", function: { name: "search_docs" } }] }),
            delta({ tool_calls: [{ index: 0, id: null, function: { name: null, arguments: "{}" } }] }),
            delta({ tool_calls: [{ index: 0 }] }, "tool_calls"),
            sse("[DONE]")
          )
        )
      );

      const { toolCalls } = await client.streamChatCompletion(REQUEST, { onContentDelta: vi.fn() });

      expect(toolCalls).toEqual([{ id: "call-1", type: "function", function: { name: "search_docs", arguments: "{}" } }]);
    });

    it("gives each parallel tool call streamed without an id an id of its own", async () => {
      const { client, httpClient } = setup();
      httpClient.post.mockResolvedValue(
        response(
          streamOf(
            delta({ tool_calls: [{ index: 0, type: "function", function: { name: "get_deployment", arguments: '{"dseq":"1"}' } }] }),
            delta({ tool_calls: [{ index: 1, id: "", type: "function", function: { name: "get_bids", arguments: '{"dseq":"1"}' } }] }),
            delta({}, "tool_calls"),
            sse("[DONE]")
          )
        )
      );

      const { toolCalls } = await client.streamChatCompletion(REQUEST, { onContentDelta: vi.fn() });

      expect(toolCalls).toEqual([
        { id: expect.stringMatching(MINTED_TOOL_CALL_ID), type: "function", function: { name: "get_deployment", arguments: '{"dseq":"1"}' } },
        { id: expect.stringMatching(MINTED_TOOL_CALL_ID), type: "function", function: { name: "get_bids", arguments: '{"dseq":"1"}' } }
      ]);
      expect(toolCalls[0].id).not.toBe(toolCalls[1].id);
    });

    it("never hands reasoning over as text", async () => {
      const { client, httpClient } = setup();
      httpClient.post.mockResolvedValue(
        response(
          streamOf(
            delta({ role: "assistant", content: null, reasoning: "The user asks about bids." }),
            delta({ reasoning_content: "Let me answer briefly." }),
            delta({ content: "", reasoning: "Done thinking." }),
            delta({ content: "No bids yet." }, "stop"),
            sse("[DONE]")
          )
        )
      );
      const onContentDelta = vi.fn(async () => {});

      const result = await client.streamChatCompletion(REQUEST, { onContentDelta });

      expect(result.content).toBe("No bids yet.");
      expect(onContentDelta.mock.calls).toEqual([["No bids yet."]]);
    });

    it("reads events split across chunks, multibyte text split mid-character, comments and a last line without a newline", async () => {
      const { client, httpClient } = setup();
      const event = delta({ content: "Ready 🚀" });
      const bytes = Buffer.from(event);
      const rocketAt = bytes.indexOf(Buffer.from("🚀"));
      httpClient.post.mockResolvedValue(
        response(
          streamOf(
            ": keep-alive\n\n",
            bytes.subarray(0, rocketAt + 2),
            bytes.subarray(rocketAt + 2),
            "event: ignored\r\n",
            'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}'
          )
        )
      );
      const onContentDelta = vi.fn(async () => {});

      const result = await client.streamChatCompletion(REQUEST, { onContentDelta });

      expect(result).toMatchObject({ content: "Ready 🚀", finishReason: "stop" });
      expect(onContentDelta.mock.calls).toEqual([["Ready 🚀"]]);
    });

    it("reads a line as long as the line limit", async () => {
      const { client, httpClient } = setup();
      const head = 'data: {"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}],"padding":"';
      const tail = '"}';
      const longestLine = head + "x".repeat(MAX_STREAM_LINE_LENGTH - head.length - tail.length) + tail;
      httpClient.post.mockResolvedValue(response(streamOf(longestLine, "\n\n", sse("[DONE]"))));

      expect(await client.streamChatCompletion(REQUEST, { onContentDelta: vi.fn() })).toMatchObject({ content: "ok", finishReason: "stop" });
    });

    it("stops reading a line longer than the line limit before it ends", async () => {
      const { client, httpClient } = setup();
      const upstream = new PassThrough();
      httpClient.post.mockResolvedValue(response(upstream));

      const result = client.streamChatCompletion(REQUEST, { onContentDelta: vi.fn() }).catch(caught => caught);
      upstream.write(`data: ${"x".repeat(MAX_STREAM_LINE_LENGTH)}`);

      expect(await result).toMatchObject({ name: "AkashMlRequestError", status: undefined, message: "AkashML stream failed: ERR_STREAM_LINE_TOO_LONG" });
      expect(upstream.destroyed).toBe(true);
    });

    it("keeps the usage when the final chunk carries no choices, even after the finish reason", async () => {
      const { client, httpClient } = setup();
      httpClient.post.mockResolvedValue(response(streamOf(delta({ content: "a" }, "length"), usageChunk(40, 1200), delta({}), sse("[DONE]"))));

      const result = await client.streamChatCompletion(REQUEST, { onContentDelta: vi.fn() });

      expect(result).toEqual({ content: "a", toolCalls: [], finishReason: "length", usage: { promptTokens: 40, completionTokens: 1200 } });
    });

    it("answers no content, tool calls, finish reason or usage for an empty stream", async () => {
      const { client, httpClient } = setup();
      httpClient.post.mockResolvedValue(response(streamOf(sse("[DONE]"))));

      expect(await client.streamChatCompletion(REQUEST, { onContentDelta: vi.fn() })).toEqual({
        content: null,
        toolCalls: [],
        finishReason: null,
        usage: null
      });
    });

    it("stops reading at the end marker", async () => {
      const { client, httpClient } = setup();
      httpClient.post.mockResolvedValue(response(streamOf(delta({ content: "a" }), sse("[DONE]"), delta({ content: "b" }))));
      const onContentDelta = vi.fn(async () => {});

      expect((await client.streamChatCompletion(REQUEST, { onContentDelta })).content).toBe("a");
      expect(onContentDelta.mock.calls).toEqual([["a"]]);
    });

    it("rejects a stream that ends before the completion does", async () => {
      const { client, httpClient } = setup();
      httpClient.post.mockResolvedValue(response(streamOf(delta({ content: "partial" }))));

      await expect(client.streamChatCompletion(REQUEST, { onContentDelta: vi.fn() })).rejects.toThrow(
        new AkashMlRequestError("AkashML stream ended before the completion did", undefined)
      );
    });

    it("rejects a chunk that is not JSON", async () => {
      const { client, httpClient } = setup();
      httpClient.post.mockResolvedValue(response(streamOf(sse("{oops"))));

      await expect(client.streamChatCompletion(REQUEST, { onContentDelta: vi.fn() })).rejects.toThrow(
        new AkashMlOutputError("AkashML streamed malformed JSON")
      );
    });

    it("rejects a chunk outside the completion shape", async () => {
      const { client, httpClient } = setup();
      httpClient.post.mockResolvedValue(response(streamOf(sse({ choices: "none" }))));

      await expect(client.streamChatCompletion(REQUEST, { onContentDelta: vi.fn() })).rejects.toThrow(
        new AkashMlOutputError("AkashML streamed an unexpected chunk shape")
      );
    });

    it.each([
      [{ message: "upstream overloaded" }, "AkashML stream failed: upstream overloaded"],
      [{ message: "m".repeat(500) }, `AkashML stream failed: ${"m".repeat(200)}`],
      [{}, "AkashML stream failed: unknown error"]
    ])("rejects an error the provider streams after the first delta (%j), without retrying", async (error, message) => {
      const { client, httpClient } = setup();
      httpClient.post.mockResolvedValue(response(streamOf(delta({ content: "Hi" }), sse({ error }))));
      const onContentDelta = vi.fn(async () => {});

      const failure = await client.streamChatCompletion(REQUEST, { onContentDelta }).catch(caught => caught);

      expect(failure).toBeInstanceOf(AkashMlRequestError);
      expect(failure).toMatchObject({ status: undefined, message });
      expect(onContentDelta.mock.calls).toEqual([["Hi"]]);
      expect(httpClient.post).toHaveBeenCalledTimes(1);
    });

    it.each([
      [Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }), "AkashML stream failed: ECONNRESET"],
      [new Error("boom"), "AkashML stream failed: Error: boom"]
    ])("rejects a connection that breaks mid-stream without retrying", async (error, message) => {
      const { client, httpClient } = setup();
      const upstream = new PassThrough();
      httpClient.post.mockResolvedValue(response(upstream));
      const onContentDelta = vi.fn(async () => {});

      const result = client.streamChatCompletion(REQUEST, { onContentDelta }).catch(caught => caught);
      upstream.write(delta({ content: "Hi" }));
      await vi.waitFor(() => expect(onContentDelta).toHaveBeenCalled());
      upstream.destroy(error);

      expect(await result).toMatchObject({ name: "AkashMlRequestError", status: undefined, message });
      expect(httpClient.post).toHaveBeenCalledTimes(1);
    });

    it("stops reading and tears the stream down when aborted mid-stream", async () => {
      const { client, httpClient } = setup();
      const upstream = new PassThrough();
      httpClient.post.mockResolvedValue(response(upstream));
      const controller = new AbortController();
      const onContentDelta = vi.fn(async () => {});

      const result = client.streamChatCompletion(REQUEST, { signal: controller.signal, onContentDelta }).catch(caught => caught);
      upstream.write(delta({ content: "Hi" }));
      await vi.waitFor(() => expect(onContentDelta).toHaveBeenCalled());
      controller.abort();

      expect(await result).toMatchObject({ name: "AkashMlRequestError", message: "AkashML stream failed: AbortError: This operation was aborted" });
      expect(upstream.destroyed).toBe(true);
      expect(onContentDelta.mock.calls).toEqual([["Hi"]]);
    });

    it("passes on a failure to hand over a delta as it is", async () => {
      const { client, httpClient } = setup();
      const upstream = streamOf(delta({ content: "Hi" }), sse("[DONE]"));
      httpClient.post.mockResolvedValue(response(upstream));
      const error = new Error("client gone");

      await expect(client.streamChatCompletion(REQUEST, { onContentDelta: vi.fn().mockRejectedValue(error) })).rejects.toBe(error);
      expect(upstream.destroyed).toBe(true);
    });

    it("retries an answer that failed before the stream opened, with the provider's message read from the stream", async () => {
      vi.useFakeTimers();
      const { client, httpClient } = setup();
      httpClient.post
        .mockRejectedValueOnce(httpError(503, streamOf(JSON.stringify({ error: { message: "no healthy backend" } }))))
        .mockResolvedValueOnce(response(streamOf(delta({ content: "ok" }, "stop"), sse("[DONE]"))));

      const result = client.streamChatCompletion(REQUEST, { onContentDelta: vi.fn() });
      await vi.advanceTimersByTimeAsync(AKASHML_RETRY_DELAYS_MS[0]);

      expect((await result).content).toBe("ok");
      expect(httpClient.post).toHaveBeenCalledTimes(2);
    });

    it("answers the provider's message read from the stream of a refused request, without retrying", async () => {
      const { client, httpClient } = setup();
      httpClient.post.mockRejectedValue(httpError(400, streamOf('{"error":', '{"message":"context too long"}}')));

      await expect(client.streamChatCompletion(REQUEST, { onContentDelta: vi.fn() })).rejects.toMatchObject({
        status: 400,
        message: "AkashML answered 400: context too long"
      });
      expect(httpClient.post).toHaveBeenCalledTimes(1);
    });

    it("stops waiting on a refused request's stalled body when aborted", async () => {
      const { client, httpClient } = setup();
      const stalledBody = new PassThrough();
      httpClient.post.mockRejectedValue(httpError(400, stalledBody));
      const controller = new AbortController();

      const result = client.streamChatCompletion(REQUEST, { signal: controller.signal, onContentDelta: vi.fn() }).catch(caught => caught);
      stalledBody.write('{"error":');
      await vi.waitFor(() => expect(httpClient.post).toHaveBeenCalled());
      controller.abort();

      expect(await result).toMatchObject({ name: "AkashMlRequestError", status: 400, message: "AkashML answered 400" });
      expect(stalledBody.destroyed).toBe(true);
    });

    it.each([
      ["a body that is not JSON", streamOf("<html>Bad gateway</html>")],
      ["a body longer than it reads", streamOf(`{"error":{"message":"${"m".repeat(4_096)}`, '"}}')]
    ])("answers the status alone for %s", async (_name, body) => {
      const { client, httpClient } = setup();
      httpClient.post.mockRejectedValue(httpError(401, body));

      await expect(client.streamChatCompletion(REQUEST, { onContentDelta: vi.fn() })).rejects.toMatchObject({ message: "AkashML answered 401" });
    });

    it("answers the provider's message when the error body was already read", async () => {
      const { client, httpClient } = setup();
      httpClient.post.mockRejectedValue(httpError(400, { error: { message: "bad tools" } }));

      await expect(client.streamChatCompletion(REQUEST, { onContentDelta: vi.fn() })).rejects.toMatchObject({ message: "AkashML answered 400: bad tools" });
    });

    it("refuses without calling out when no API key is configured", async () => {
      const { client, httpClient } = setup({ apiKey: undefined });

      await expect(client.streamChatCompletion(REQUEST, { onContentDelta: vi.fn() })).rejects.toBeInstanceOf(AkashMlUnavailableError);
      expect(httpClient.post).not.toHaveBeenCalled();
    });
  });

  describe("completeJson", () => {
    it("asks for the schema strictly and answers the parsed object", async () => {
      const { client, httpClient } = setup();
      httpClient.post.mockResolvedValue(response(completion({ content: '{"answer":42}' })));

      const answer = await client.completeJson({ ...REQUEST, temperature: 0, schema: ANSWER_SCHEMA });

      expect(answer).toEqual({ answer: 42 });
      expect(httpClient.post).toHaveBeenCalledWith(
        "/chat/completions",
        {
          ...REQUEST,
          temperature: 0,
          response_format: { type: "json_schema", json_schema: { name: "answer", strict: true, schema: ANSWER_SCHEMA.jsonSchema } }
        },
        expect.anything()
      );
    });
  });

  function setup(input: { apiKey?: string } = { apiKey: "test-key" }) {
    const httpClient = mock<HttpClient>();
    const config = envSchema.parse({ AKASHML_API_KEY: input.apiKey });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const client = new AkashMlClient(httpClient, config, createLogger);

    return { client, httpClient, logger };
  }
});

describe(parseJsonOutput.name, () => {
  const parser = ANSWER_SCHEMA.parser;

  it("reads an object wrapped in prose", () => {
    expect(parseJsonOutput('Sure! {"answer": 1} hope that helps', parser)).toEqual({ answer: 1 });
  });

  it.each([null, "", "no json here", "} {"])("rejects %j as having no JSON object", content => {
    expect(() => parseJsonOutput(content, parser)).toThrow(new AkashMlOutputError("AkashML answered without a JSON object"));
  });

  it("rejects malformed JSON", () => {
    expect(() => parseJsonOutput("{answer: 1}", parser)).toThrow(
      expect.objectContaining({ name: "AkashMlOutputError", message: "AkashML answered with malformed JSON" })
    );
  });

  it("names the fields outside the schema without echoing the content", () => {
    expect(() => parseJsonOutput('{"answer":"secret text"}', parser)).toThrow(new AkashMlOutputError("AkashML answered outside the schema: answer"));
    expect(() => parseJsonOutput('{"a":1}', z.number())).toThrow(new AkashMlOutputError("AkashML answered outside the schema: (root)"));
  });
});
