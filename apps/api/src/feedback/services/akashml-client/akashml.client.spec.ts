import type { HttpClient } from "@akashnetwork/http-sdk";
import { AxiosError, AxiosHeaders, type AxiosResponse } from "axios";
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
  parseJsonOutput
} from "./akashml.client";

const REQUEST: ChatCompletionRequest = { model: "test-model", messages: [{ role: "user", content: "hi" }] };

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
