import type { HttpClient } from "@akashnetwork/http-sdk";
import { AxiosError, AxiosHeaders, type AxiosResponse } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import { envSchema } from "@src/feedback/config/env.config";
import {
  type JevRequest,
  TYPESAFE_RETRY_DELAYS_MS,
  TypeSafeClient,
  TypeSafeOutputError,
  TypeSafeRequestError,
  TypeSafeUnavailableError
} from "./typesafe.client";

const REQUEST: JevRequest = {
  model: "jev-test",
  state: { feedback: { message: "logs never load" } },
  questions: {
    is_bug: { type: "noul", instructions: "Is something broken?" },
    mood: { type: "score", instructions: "How does the user feel?", criteria: ["Bad", "Fine", "Good"] }
  }
};

const ANSWERS = {
  is_bug: { type: "noul", noul: 0.91 },
  mood: { type: "score", score: 0.4, confidence: 0.7, legend: { "0": "Bad", "1": "Fine", "2": "Good" }, probabilities: { "0": 0.6, "1": 0.4, "2": 0 } }
};

function systemOneResponse(answers: Record<string, unknown> = ANSWERS, extra: Record<string, unknown> = {}) {
  return { model: "jev-1.14.0", answers, usage: { input_tokens: 120, output_tokens: 12 }, ...extra };
}

function response(data: unknown, status = 200): AxiosResponse {
  return { data, status, statusText: "", headers: {}, config: { headers: new AxiosHeaders({ Authorization: "Bearer secret-key" }) } };
}

function httpError(status: number | undefined, data?: unknown, code = "ERR_BAD_RESPONSE") {
  const errorResponse = status === undefined ? undefined : response(data, status);

  return new AxiosError("Request failed", code, errorResponse?.config, undefined, errorResponse);
}

describe(TypeSafeClient.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("isAvailable", () => {
    it("answers whether an API key is configured", () => {
      expect(setup().client.isAvailable()).toBe(true);
      expect(setup({ apiKey: undefined }).client.isAvailable()).toBe(false);
    });
  });

  describe("judge", () => {
    it("posts the request and answers each Noul probability and Score level by question id", async () => {
      const { client, httpClient, logger } = setup();
      httpClient.post.mockResolvedValue(response(systemOneResponse()));

      const judgments = await client.judge(REQUEST);

      expect(httpClient.post).toHaveBeenCalledWith("/v1/systemone", REQUEST);
      expect(judgments).toEqual({ model: "jev-1.14.0", values: { is_bug: 0.91, mood: 0.4 }, inputTokens: 120 });
      expect(logger.info).toHaveBeenCalledWith({
        event: "TYPESAFE_JUDGMENTS",
        model: "jev-1.14.0",
        questions: 2,
        usage: { input_tokens: 120, output_tokens: 12 }
      });
    });

    it("refuses to call TypeSafe without an API key", async () => {
      const { client, httpClient } = setup({ apiKey: undefined });

      await expect(client.judge(REQUEST)).rejects.toThrow(TypeSafeUnavailableError);
      expect(httpClient.post).not.toHaveBeenCalled();
    });

    it.each([
      { name: "a question left unanswered", answers: { mood: ANSWERS.mood }, message: "TypeSafe left questions unanswered: is_bug" },
      {
        name: "an answer of another type",
        answers: { is_bug: ANSWERS.is_bug, mood: { type: "noul", noul: 0.5 } },
        message: "TypeSafe left questions unanswered: mood"
      }
    ])("rejects $name", async ({ answers, message }) => {
      const { client, httpClient } = setup();
      httpClient.post.mockResolvedValue(response(systemOneResponse(answers)));

      await expect(client.judge(REQUEST)).rejects.toThrow(new TypeSafeOutputError(message));
    });

    it.each([
      { name: "below the lowest level", score: -0.01 },
      { name: "above the highest level", score: 2.01 }
    ])("rejects a Score $name of its question", async ({ score }) => {
      const { client, httpClient } = setup();
      httpClient.post.mockResolvedValue(response(systemOneResponse({ ...ANSWERS, mood: { type: "score", score } })));

      await expect(client.judge(REQUEST)).rejects.toThrow(new TypeSafeOutputError("TypeSafe answered outside the levels of: mood"));
    });

    it.each([0, 2])("accepts a Score at level %s, the edge of its question's levels", async score => {
      const { client, httpClient } = setup();
      httpClient.post.mockResolvedValue(response(systemOneResponse({ ...ANSWERS, mood: { type: "score", score } })));

      await expect(client.judge(REQUEST)).resolves.toMatchObject({ values: { is_bug: 0.91, mood: score } });
    });

    it.each([
      { name: "a response without usage", data: { model: "jev", answers: ANSWERS } },
      { name: "a Noul outside 0 to 1", data: systemOneResponse({ ...ANSWERS, is_bug: { type: "noul", noul: 1.2 } }) },
      { name: "an unknown answer type", data: systemOneResponse({ ...ANSWERS, is_bug: { type: "box" } }) }
    ])("rejects $name as an unexpected shape", async ({ data }) => {
      const { client, httpClient } = setup();
      httpClient.post.mockResolvedValue(response(data));

      await expect(client.judge(REQUEST)).rejects.toThrow(new TypeSafeOutputError("TypeSafe answered with an unexpected response shape"));
    });

    it("retries a retryable failure and answers once TypeSafe recovers", async () => {
      vi.useFakeTimers();
      const { client, httpClient } = setup();
      httpClient.post.mockRejectedValueOnce(httpError(429)).mockRejectedValueOnce(httpError(503)).mockResolvedValue(response(systemOneResponse()));

      const judged = client.judge(REQUEST);
      await vi.advanceTimersByTimeAsync(TYPESAFE_RETRY_DELAYS_MS.reduce((sum, delay) => sum + delay, 0));

      await expect(judged).resolves.toMatchObject({ values: { is_bug: 0.91 } });
      expect(httpClient.post).toHaveBeenCalledTimes(3);
    });

    it("gives up after its retries", async () => {
      vi.useFakeTimers();
      const { client, httpClient } = setup();
      httpClient.post.mockRejectedValue(httpError(502));

      const judged = client.judge(REQUEST);
      const assertion = expect(judged).rejects.toThrow(new TypeSafeRequestError("TypeSafe answered 502", 502));
      await vi.advanceTimersByTimeAsync(TYPESAFE_RETRY_DELAYS_MS.reduce((sum, delay) => sum + delay, 0));

      await assertion;
      expect(httpClient.post).toHaveBeenCalledTimes(TYPESAFE_RETRY_DELAYS_MS.length + 1);
    });

    it("does not retry a request TypeSafe refused, and keeps its detail and the API key out of the error", async () => {
      const { client, httpClient } = setup();
      httpClient.post.mockRejectedValue(httpError(422, { detail: [{ loc: ["body", "state"], msg: "bad", input: "logs never load" }] }));

      const error = await client.judge(REQUEST).catch(caught => caught);

      expect(error).toEqual(new TypeSafeRequestError("TypeSafe answered 422", 422));
      expect(error.isRetryable).toBe(false);
      expect(JSON.stringify(error)).not.toContain("secret-key");
      expect(httpClient.post).toHaveBeenCalledTimes(1);
    });

    it.each([
      { name: "a network failure", error: httpError(undefined, undefined, "ECONNRESET"), message: "TypeSafe request failed: ECONNRESET" },
      { name: "a non-HTTP failure", error: new Error("boom"), message: "TypeSafe request failed: Error: boom" }
    ])("treats $name as retryable", async ({ error, message }) => {
      vi.useFakeTimers();
      const { client, httpClient } = setup();
      httpClient.post.mockRejectedValue(error);

      const judged = client.judge(REQUEST).catch(caught => caught);
      await vi.advanceTimersByTimeAsync(TYPESAFE_RETRY_DELAYS_MS.reduce((sum, delay) => sum + delay, 0));

      expect(await judged).toEqual(new TypeSafeRequestError(message, undefined));
      expect((await judged).isRetryable).toBe(true);
      expect(httpClient.post).toHaveBeenCalledTimes(TYPESAFE_RETRY_DELAYS_MS.length + 1);
    });
  });

  function setup(input: { apiKey?: string } = { apiKey: "test-key" }) {
    const httpClient = mock<HttpClient>();
    const config = envSchema.parse({ TYPESAFE_API_KEY: input.apiKey });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const client = new TypeSafeClient(httpClient, config, createLogger);

    return { client, httpClient, logger };
  }
});
